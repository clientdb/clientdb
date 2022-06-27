import { sortBy } from "lodash";
import { IObservableArray, observable, runInAction } from "mobx";


import { EntityDefinition } from "./definition";
import { DatabaseLinker } from "./entitiesConnections";
import { Entity } from "./entity";
import { FindInput } from "./find";
import {
  EntityQuery,
  EntityQuerySortFunction,
  EntityQuerySortInput,
  createEntityQuery,
  resolveSortInput,
} from "./query";
import { IndexableData, IndexableKey, QueryIndex, createQueryFieldIndex } from "./queryIndex";
import { EntityChangeSource } from "./types";
import { EventsEmmiter, createMobxAwareEventsEmmiter } from "./utils/eventManager";
import { cachedComputed } from ".";
import { MessageOrError, assert } from "../utils/assert";
import { areArraysShallowEqual } from "./utils/arrays";
import { createCleanupObject } from "./utils/cleanup";
import { deepMemoize } from "./utils/deepMap";

export interface EntityStoreFindMethods<Data, Connections> {
  query: (
    filter: FindInput<Data, Connections>,
    sort?: EntityQuerySortFunction<Data, Connections>
  ) => EntityQuery<Data, Connections>;

  sort: (sort: EntityQuerySortInput<Data, Connections>) => EntityQuery<Data, Connections>;
  // findAllByIndexValue<K extends keyof IndexQueryInput<Data & Connections>>(
  //   key: K,
  //   value: IndexQueryInput<Data & Connections>[K]
  // ): IObservableArray<Entity<Data, Connections>>;
  findByUniqueIndex<K extends IndexableKey<Data & Connections>>(
    key: K,
    value: IndexableData<Data & Connections>[K]
  ): Entity<Data, Connections> | null;
  assertFindByUniqueIndex<K extends IndexableKey<Data & Connections>>(
    key: K,
    value: IndexableData<Data & Connections>[K]
  ): Entity<Data, Connections>;

  findById(id: string): Entity<Data, Connections> | null;
  assertFindById(id: string, error?: MessageOrError): Entity<Data, Connections>;
  removeById(id: string, source?: EntityChangeSource): boolean;

  find(filter: FindInput<Data, Connections>): Entity<Data, Connections>[];
  findFirst(filter: FindInput<Data, Connections>): Entity<Data, Connections> | null;
}

export interface EntityStore<Data, Connections> extends EntityStoreFindMethods<Data, Connections> {
  items: IObservableArray<Entity<Data, Connections>>;
  sortItems(items: Entity<Data, Connections>[]): Entity<Data, Connections>[];
  add(input: Entity<Data, Connections>, source?: EntityChangeSource): Entity<Data, Connections>;
  events: EntityStoreEventsEmmiter<Data, Connections>;
  definition: EntityDefinition<Data, Connections>;
  destroy: () => void;
  getKeyIndex<K extends IndexableKey<Data & Connections>>(key: K): QueryIndex<Data, Connections, K>;
}

export type EntityStoreFromDefinition<Definition extends EntityDefinition<unknown, unknown>> =
  Definition extends EntityDefinition<infer Data, infer Connections> ? EntityStore<Data, Connections> : never;

type EntityStoreEvents<Data, Connections> = {
  itemAdded: [Entity<Data, Connections>, EntityChangeSource];
  itemUpdated: [entity: Entity<Data, Connections>, dataBefore: Data, source: EntityChangeSource];
  itemWillUpdate: [entity: Entity<Data, Connections>, input: Partial<Data>, source: EntityChangeSource];
  itemRemoved: [Entity<Data, Connections>, EntityChangeSource];
};

export type EntityStoreEventsEmmiter<Data, Connections> = EventsEmmiter<EntityStoreEvents<Data, Connections>>;

/**
 * Store is inner 'registry' of all items of given entity. It is like 'raw' database with no extra logic (like syncing)
 */
export function createEntityStore<Data, Connections>(
  definition: EntityDefinition<Data, Connections>,
  linker: DatabaseLinker
): EntityStore<Data, Connections> {
  type StoreEntity = Entity<Data, Connections>;

  const { config } = definition;
  /**
   * Keep 2 'versions' of items list. Array and id<>item map for quick 'by id' access.
   */
  const items = observable.array<StoreEntity>([]);
  const itemsMap = observable.object<Record<string, Entity<Data, Connections>>>({});

  const getIsEntityAccessable =
    config.accessValidator &&
    cachedComputed(function getIsEntityAccessable(entity: StoreEntity) {
      return config.accessValidator!(entity, linker);
    });

  const getRootSource = cachedComputed(
    function getSourceForQueryInput(): Entity<Data, Connections>[] {
      let output = items as StoreEntity[];

      if (config.accessValidator) {
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

  // Allow listening to CRUD updates in the store
  const events = createMobxAwareEventsEmmiter<EntityStoreEvents<Data, Connections>>(config.name);

  const queryIndexes = new Map<
    keyof Data | keyof Connections,
    QueryIndex<Data, Connections, IndexableKey<Data & Connections>>
  >();

  function getEntityId(entity: Entity<Data, Connections>) {
    const id = `${entity[config.keyField]}`;

    return id;
  }

  const cleanups = createCleanupObject();

  const createOrReuseQuery = deepMemoize(
    function createOrReuseQuery(filter?: FindInput<Data, Connections>, sort?: EntityQuerySortInput<Data, Connections>) {
      const resolvedSort = resolveSortInput(sort) ?? undefined;

      return createEntityQuery(getRootSource, { filter: filter, sort: resolvedSort }, store);
    },
    { checkEquality: true }
  );

  const findById = cachedComputed((id: string) => {
    const entity = itemsMap[id];

    if (!entity) return null;

    if (getIsEntityAccessable && !getIsEntityAccessable(entity)) return null;

    return entity;
  });

  const store: EntityStore<Data, Connections> = {
    definition,
    events,
    items,
    sortItems,
    getKeyIndex(key) {
      const existingIndex = queryIndexes.get(key);

      if (existingIndex) return existingIndex;

      const newIndex = createQueryFieldIndex(key, store);

      queryIndexes.set(key, newIndex);

      return newIndex;
    },
    add(entity, source = "user") {
      const id = getEntityId(entity);

      runInAction(() => {
        items.push(entity);
        itemsMap[id] = entity;
        events.emit("itemAdded", entity, source);
      });

      return entity;
    },
    findById(id) {
      return findById(id);
    },
    assertFindById(id, error) {
      const item = store.findById(id);

      assert(item, error ?? `No item found for id ${id}`);

      return item;
    },
    find(filter) {
      return store.query(filter).all;
    },
    findFirst(filter) {
      return store.query(filter).first;
    },
    findByUniqueIndex(key, value) {
      const results = store.getKeyIndex(key).find(value);

      if (!results.length) return null;

      if (results.length > 1) console.warn(`Store has multiple items for unique index value ${key as string}:${value as string}.`);

      const result = results[0];

      if (getIsEntityAccessable && !getIsEntityAccessable(result)) return null;

      return result;
    },
    assertFindByUniqueIndex(key, value) {
      const entity = store.findByUniqueIndex(key, value);

      assert(entity, `Assertion error for assertFindByUniqueIndex for key ${key as string} and value ${value as string}`);

      return entity;
    },
    removeById(id, source = "user") {
      const entity = itemsMap[id] ?? null;

      if (entity === null) return false;

      let didRemove = false;

      runInAction(() => {
        entity.cleanup.clean();
        didRemove = items.remove(entity);
        delete itemsMap[id];
        events.emit("itemRemoved", entity, source);
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
        queryIndexes.forEach((queryIndex) => {
          queryIndex.destroy();
        });
        events.destroy();
      });
    },
  };

  return store;
}
