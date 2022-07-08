import { isEqual, pick, sortBy } from "lodash";
import { IObservableArray, observable, runInAction } from "mobx";

import { ClientDb } from "./db";
import { EntityDefinition } from "./definition";
import { Entity } from "./entity";
import { FindInput } from "./find";
import {
  createEntityQuery,
  Collection,
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
import { areArraysShallowEqual } from "./utils/arrays";
import { cachedComputed } from "./utils/cachedComputed";
import { cachedComputedWithoutArgs } from "./utils/cachedComputedWithoutArgs";
import { CleanupObject, createCleanupObject } from "./utils/cleanup";
import { deepMemoize } from "./utils/deepMap";
import { createEventsEmmiter, EventsEmmiter } from "./utils/eventManager";
import { typedKeys } from "./utils/object";

export interface EntityStorePublicMethods<Data, View> {
  query: (
    filter: FindInput<Data, View>,
    sort?: EntityQuerySortFunction<Data, View>
  ) => Collection<Data, View>;

  sort: (sort: EntityQuerySortInput<Data, View>) => Collection<Data, View>;

  findById(id: string): Entity<Data, View> | null;
  removeById(id: string): boolean;

  find(filter: FindInput<Data, View>): Entity<Data, View>[];
  findFirst(filter: FindInput<Data, View>): Entity<Data, View> | null;

  updateById(id: string, data: Partial<Data>): EntityUpdateResult;

  readonly all: Entity<Data, View>[];
}

export interface EntityStore<Data, View>
  extends EntityStorePublicMethods<Data, View> {
  db: ClientDb;
  // Will return all items in store, including ones not passing root filter
  items: IObservableArray<Entity<Data, View>>;
  sortItems(items: Entity<Data, View>[]): Entity<Data, View>[];
  add(input: Entity<Data, View>): Entity<Data, View>;
  events: EntityStoreEventsEmmiter<Data, View>;
  definition: EntityDefinition<Data, View>;
  getPropIndex<K extends IndexableKey<Data & View>>(
    key: K
  ): QueryIndex<Data, View, K>;
}

export interface EntityUpdateResult {
  hadChanges: boolean;
  undo: () => void;
}

export type EntityStoreFromDefinition<
  Definition extends EntityDefinition<unknown, unknown>
> = Definition extends EntityDefinition<infer Data, infer View>
  ? EntityStore<Data, View>
  : never;

export interface EntityCreatedEvent<Data> {
  db: ClientDb;
}
export interface EntityUpdatedEvent<Data> {
  dataBefore: Data;
  changedKeys: (keyof Data)[];
  changedData: Partial<Data>;
  db: ClientDb;
}

export interface EntityWillUpdateEvent<Data> {
  input: Partial<Data>;
  db: ClientDb;
}

export interface EntityRemovedEvent<Data> {
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
  db: ClientDb,
  cleanup: CleanupObject
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
  const events = createEventsEmmiter<EntityStoreEvents<Data, View>>(
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
    updateById(id, input) {
      const entity = findById(id);

      if (!entity) {
        throw new Error(
          `Entity "${definition.config.name}" with id "${id}" not found`
        );
      }

      const changedKeys = typedKeys(input).filter((keyToUpdate) => {
        const value = input[keyToUpdate];
        if (value === undefined) return false;

        const existingValue = entity[keyToUpdate];

        return !isEqual(value, existingValue);
      });

      if (changedKeys.includes(config.idField)) {
        throw new Error(
          `Cannot update id field of entity "${definition.config.name}"`
        );
      }

      // No changes will be made, return early
      if (!changedKeys.length)
        return {
          hadChanges: false,
          undo: () => void 0,
        };

      const dataBeforeUpdate = entity.getData();

      const undoData = pick(dataBeforeUpdate, changedKeys);

      events.emit("willUpdate", entity, { input, db });

      const changedData: Partial<Data> = {};

      runInAction(() => {
        changedKeys.forEach((keyToUpdate) => {
          const value = input[keyToUpdate];
          (entity as Data)[keyToUpdate] = value!;
          changedData[keyToUpdate] = value;
        });

        events.emit("updated", entity, {
          dataBefore: dataBeforeUpdate,
          changedKeys,
          changedData,
          db,
        });
      });

      return {
        hadChanges: true,
        undo() {
          store.updateById(id, undoData);
        },
      };
    },
    getPropIndex(key) {
      const existingIndex = propIndexMap.get(key);

      if (existingIndex) return existingIndex;

      const newIndex = createQueryFieldIndex(key, store, cleanup);

      propIndexMap.set(key, newIndex);

      return newIndex;
    },
    add(entity) {
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
        events.emit("created", entity, { db });
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
    removeById(id) {
      db.utils.assertNotDestroyed("Cannot remove items");
      const entity = itemsMap[id] ?? null;

      if (entity === null) return false;

      let didRemove = false;

      runInAction(() => {
        entity.cleanup.clean();
        didRemove = items.remove(entity);
        delete itemsMap[id];
        events.emit("removed", entity, { db });
      });

      return didRemove;
    },
    query(filter, sort) {
      return createOrReuseQuery(filter, sort);
    },
    sort(sort) {
      return createOrReuseQuery(undefined, sort);
    },
  };

  return store;
}
