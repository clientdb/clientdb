import { sortBy } from "lodash";
import { IObservableArray, observable, runInAction } from "mobx";

import { ClientDb } from "./db";
import { EntityDefinition } from "./definition";
import { Entity } from "./entity";
import { EntityUpdatedEvent } from "./events";
import { FindInput } from "./find";
import {
  Collection,
  createEntityQuery,
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
import { computeChanges, pickBeforeFromChanges } from "./utils/changes";
import { CleanupObject } from "./utils/cleanup";
import { deepMemoize } from "./utils/deepMap";
import { typedKeys } from "./utils/object";

export interface EntityStorePublicMethods<Data, View> {
  query: (
    filter: FindInput<Data, View>,
    sort?: EntityQuerySortFunction<Data, View>
  ) => Collection<Data, View>;

  sort: (sort: EntityQuerySortInput<Data, View>) => Collection<Data, View>;

  findById(id: string): Entity<Data, View> | null;
  remove(id: string): boolean;
  update(id: string, data: Partial<Data>): EntityUpdatedEvent<Data, View>;
  find(filter: FindInput<Data, View>): Entity<Data, View>[];
  findFirst(filter: FindInput<Data, View>): Entity<Data, View> | null;

  readonly all: Entity<Data, View>[];
}

export interface EntityStore<Data, View>
  extends EntityStorePublicMethods<Data, View> {
  db: ClientDb;
  // Will return all items in store, including ones not passing root filter
  items: IObservableArray<Entity<Data, View>>;
  sortItems(items: Entity<Data, View>[]): Entity<Data, View>[];
  add(input: Entity<Data, View>): Entity<Data, View>;

  definition: EntityDefinition<Data, View>;
  getPropIndex<K extends IndexableKey<Data & View>>(
    key: K
  ): QueryIndex<Data, View, K>;
}

export type EntityStoreFromDefinition<
  Definition extends EntityDefinition<unknown, unknown>
> = Definition extends EntityDefinition<infer Data, infer View>
  ? EntityStore<Data, View>
  : never;

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

  function updateEntityIndexes(
    entity: StoreEntity,
    changedKeys?: Array<keyof Data>
  ) {
    for (const [indexKey, index] of propIndexMap.entries()) {
      if (changedKeys && !changedKeys.includes(indexKey as keyof Data))
        continue;
      index.update(entity);
    }
  }

  function removeEntityFromIndexes(entity: StoreEntity) {
    for (const [indexKey, index] of propIndexMap.entries()) {
      index.remove(entity);
    }
  }

  const store: EntityStore<Data, View> = {
    get all() {
      return allItems.get();
    },
    db,
    definition,
    items,
    sortItems,
    update(id, input) {
      const entity = itemsMap[id];

      if (!entity) {
        throw new Error(
          `Entity "${definition.config.name}" with id "${id}" not found`
        );
      }

      const changes = computeChanges(entity, input);
      const changedKeys = typedKeys(changes);

      if (changedKeys.includes(config.idField)) {
        throw new Error(
          `Cannot update id field of entity "${definition.config.name}"`
        );
      }

      // No changes will be made, return early
      if (!changedKeys.length)
        return {
          changes,
          db,
          entity,
          type: "updated",
          rollback: () => void 0,
        };

      const changedData: Partial<Data> = {};

      function rollback() {
        const undoInput = pickBeforeFromChanges(changes);
        store.update(id, undoInput);
      }

      runInAction(() => {
        changedKeys.forEach((keyToUpdate) => {
          const value = input[keyToUpdate];
          (entity as Data)[keyToUpdate] = value!;
          changedData[keyToUpdate] = value;
        });
        updateEntityIndexes(entity, changedKeys);
      });

      return {
        changes,
        db,
        entity,
        rollback,
        type: "updated",
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
        updateEntityIndexes(entity);
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
    remove(id) {
      db.utils.assertNotDestroyed("Cannot remove items");
      const entity = itemsMap[id] ?? null;

      if (entity === null) return false;

      let didRemove = false;

      runInAction(() => {
        entity.cleanup.clean();
        didRemove = items.remove(entity);
        delete itemsMap[id];
        removeEntityFromIndexes(entity);
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
