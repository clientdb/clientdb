import { sortBy } from "lodash";
import { IObservableArray, observable, runInAction } from "mobx";

import { ClientDb } from "./db";
import { EntityDefinition } from "./definition";
import { Entity } from "./entity";
import { FindInput } from "./find";
import {
  createEntityQuery,
  EntityQuery,
  EntityQuerySortFunction,
  EntityQuerySortInput,
  resolveSortInput,
} from "./query";
import {
  createQueryFieldIndex,
  IndexableKey,
  IndexFindInput,
  QueryIndex,
} from "./queryIndex";
import { EntityChangeSource } from "./types";
import { areArraysShallowEqual } from "./utils/arrays";
import { cachedComputed } from "./utils/cachedComputed";
import { cachedComputedWithoutArgs } from "./utils/cachedComputedWithoutArgs";
import { createCleanupObject } from "./utils/cleanup";
import { deepMemoize } from "./utils/deepMap";
import {
  createMobxAwareEventsEmmiter,
  EventsEmmiter,
} from "./utils/eventManager";

export interface EntityStoreFindMethods<Data, View> {
  query: (
    filter: FindInput<Data, View>,
    sort?: EntityQuerySortFunction<Data, View>
  ) => EntityQuery<Data, View>;

  sort: (sort: EntityQuerySortInput<Data, View>) => EntityQuery<Data, View>;

  findById(id: string): Entity<Data, View> | null;
  removeById(id: string, source?: EntityChangeSource): boolean;

  find(filter: FindInput<Data, View>): Entity<Data, View>[];
  findFirst(filter: FindInput<Data, View>): Entity<Data, View> | null;

  readonly all: Entity<Data, View>[];
}

export interface EntityStore<Data, View>
  extends EntityStoreFindMethods<Data, View> {
  db: ClientDb;
  // Will return all items in store, including ones not passing root filter
  items: IObservableArray<Entity<Data, View>>;
  sortItems(items: Entity<Data, View>[]): Entity<Data, View>[];
  add(
    input: Entity<Data, View>,
    source?: EntityChangeSource
  ): Entity<Data, View>;
  events: EntityStoreEventsEmmiter<Data, View>;
  definition: EntityDefinition<Data, View>;
  destroy: () => void;
  getPropIndex<K extends IndexableKey<Data & View>>(
    key: K
  ): QueryIndex<Data, View, K>;
}

export type EntityStoreFromDefinition<
  Definition extends EntityDefinition<unknown, unknown>
> = Definition extends EntityDefinition<infer Data, infer View>
  ? EntityStore<Data, View>
  : never;

export interface EntityCreatedEvent<Data> {
  source: EntityChangeSource;
  db: ClientDb;
}
export interface EntityUpdatedEvent<Data> {
  dataBefore: Data;
  changedKeys: (keyof Data)[];
  changedData: Partial<Data>;
  source: EntityChangeSource;
  db: ClientDb;
}

export interface EntityWillUpdateEvent<Data> {
  input: Partial<Data>;
  source: EntityChangeSource;
  db: ClientDb;
}

export interface EntityRemovedEvent<Data> {
  source: EntityChangeSource;
  db: ClientDb;
}

type EntityStoreEvents<Data, View> = {
  created: [Entity<Data, View>, EntityCreatedEvent<Data>];
  updated: [Entity<Data, View>, EntityUpdatedEvent<Data>];
  willUpdate: [Entity<Data, View>, EntityWillUpdateEvent<Data>];
  removed: [Entity<Data, View>, EntityRemovedEvent<Data>];
};

export type EntityStoreEventsEmmiter<Data, View> = EventsEmmiter<
  EntityStoreEvents<Data, View>
>;

/**
 * Store is inner 'registry' of all items of given entity. It is like 'raw' database with no extra logic (like syncing)
 */
export function createEntityStore<Data, View>(
  definition: EntityDefinition<Data, View>,
  db: ClientDb
): EntityStore<Data, View> {
  type StoreEntity = Entity<Data, View>;

  const { config } = definition;
  /**
   * Keep 2 'versions' of items list. Array and id<>item map for quick 'by id' access.
   */
  const items = observable.array<StoreEntity>([]);
  const itemsMap = observable.object<Record<string, Entity<Data, View>>>({});

  const getIsEntityAccessable =
    config.rootFilter &&
    cachedComputed(function getIsEntityAccessable(entity: StoreEntity) {
      return config.rootFilter!(entity, db);
    });

  const getRootSource = cachedComputed(
    function getSourceForQueryInput(): Entity<Data, View>[] {
      let output = items as StoreEntity[];

      if (config.rootFilter) {
        output = output.filter((entity) => getIsEntityAccessable!(entity));
      }

      return output;
    },
    { equals: areArraysShallowEqual }
  );

  const sortItems = cachedComputed((items: StoreEntity[]) => {
    if (!config.defaultSort) {
      return items;
    }

    return sortBy(items, config.defaultSort);
  });

  const allItems = cachedComputedWithoutArgs(() => {
    return sortItems(getRootSource());
  });

  // Allow listening to CRUD updates in the store
  const events = createMobxAwareEventsEmmiter<EntityStoreEvents<Data, View>>(
    config.name
  );

  const propIndexMap = new Map<
    keyof Data | keyof View,
    QueryIndex<Data, View, IndexableKey<Data & View>>
  >();

  function getEntityId(entity: Entity<Data, View>) {
    const id = `${entity[config.idField]}`;

    return id;
  }

  const cleanups = createCleanupObject();

  const createOrReuseQuery = deepMemoize(
    function createOrReuseQuery(
      filter?: FindInput<Data, View>,
      sort?: EntityQuerySortInput<Data, View>
    ) {
      const resolvedSort = resolveSortInput(sort) ?? undefined;

      return createEntityQuery(
        getRootSource,
        { filter: filter, sort: resolvedSort },
        store
      );
    },
    { checkEquality: true }
  );

  const findById = cachedComputed((id: string) => {
    const entity = itemsMap[id];

    if (!entity) return null;

    if (getIsEntityAccessable && !getIsEntityAccessable(entity)) return null;

    return entity;
  });

  function assertEntityNotBreakingUniqueIndex(entity: StoreEntity) {
    if (!definition.config.uniqueProps) return;

    for (const uniquePropName of definition.config.uniqueProps) {
      const index = store.getPropIndex(uniquePropName);
      const propValue = entity[uniquePropName] as unknown as IndexFindInput<
        Data,
        View,
        keyof Data
      >;
      const existingEntities = index.find(propValue);

      if (existingEntities.length > 0) {
        throw new Error(
          `Entity "${
            definition.config.name
          }" with unique property "${uniquePropName.toString()}"="${propValue?.toString()}" already exists`
        );
      }
    }
  }

  const store: EntityStore<Data, View> = {
    get all() {
      return allItems.get();
    },
    db,
    definition,
    events,
    items,
    sortItems,
    getPropIndex(key) {
      const existingIndex = propIndexMap.get(key);

      if (existingIndex) return existingIndex;

      const newIndex = createQueryFieldIndex(key, store);

      propIndexMap.set(key, newIndex);

      return newIndex;
    },
    add(entity, source = "user") {
      const id = getEntityId(entity);

      if (itemsMap[id]) {
        throw new Error(
          `Cannot create entity "${definition.config.name}" with id "${id}" because it already exists`
        );
      }

      assertEntityNotBreakingUniqueIndex(entity);

      runInAction(() => {
        items.push(entity);
        itemsMap[id] = entity;
        events.emit("created", entity, { source, db });
      });

      return entity;
    },
    findById(id) {
      return findById(id);
    },
    find(filter) {
      return store.query(filter).all;
    },
    findFirst(filter) {
      return store.query(filter).first;
    },
    removeById(id, source = "user") {
      const entity = itemsMap[id] ?? null;

      if (entity === null) return false;

      let didRemove = false;

      runInAction(() => {
        entity.cleanup.clean();
        didRemove = items.remove(entity);
        delete itemsMap[id];
        events.emit("removed", entity, { source, db });
      });

      return didRemove;
    },
    query(filter, sort) {
      return createOrReuseQuery(filter, sort);
    },
    sort(sort) {
      return createOrReuseQuery(undefined, sort);
    },
    destroy() {
      runInAction(() => {
        cleanups.clean();
        propIndexMap.forEach((queryIndex) => {
          queryIndex.destroy();
        });
        events.destroy();
      });
    },
  };

  return store;
}
