import { sortBy } from "lodash";
import { IObservableArray } from "mobx";

import { EntityDefinition } from "./definition";
import { Entity } from "./entity";
import { FindInput, findInSource } from "./find";
import { EntityStore } from "./store";
import { areArraysShallowEqual } from "./utils/arrays";
import { cachedComputed } from "./utils/cachedComputed";
import { cachedComputedWithoutArgs } from "./utils/cachedComputedWithoutArgs";
import { deepMemoize } from "./utils/deepMap";

export type EntityFilterFunction<Data, View> = (
  item: Entity<Data, View>
) => boolean;

export type EntityQuerySortFunction<Data, View> = (
  item: Entity<Data, View>
) => SortResult;

export type EntitySortDirection = "asc" | "desc";

type EntityQuerySortConfig<Data, View> = {
  sort: EntityQuerySortFunction<Data, View>;
  direction: "asc" | "desc";
};

export type EntityQuerySortInput<Data, View> =
  | EntityQuerySortFunction<Data, View>
  | EntityQuerySortConfig<Data, View>;

export type SortResult =
  | string
  | number
  | boolean
  | Date
  | null
  | void
  | undefined;

export type EntityQueryConfig<Data, View> = {
  filter?: FindInput<Data, View>;
  sort?: EntityQuerySortInput<Data, View>;
  name?: string;
};

export type EntityQueryByDefinition<Def> = Def extends EntityDefinition<
  infer D,
  infer V
>
  ? EntityQuery<D, V>
  : never;

export function resolveSortInput<Data, View>(
  sort?: EntityQuerySortInput<Data, View>
): EntityQuerySortConfig<Data, View> | null {
  if (!sort) return null;

  if (typeof sort === "function") {
    return { sort, direction: "desc" };
  }

  return sort;
}

type MaybeObservableArray<T> = IObservableArray<T> | T[];

export type EntityQuery<Data, View> = {
  all: Entity<Data, View>[];
  first: Entity<Data, View> | null;
  last: Entity<Data, View> | null;
  hasItems: boolean;
  isEmpty: boolean;
  count: number;
  findById(id: string): Entity<Data, View> | null;
  query: (
    filter: FindInput<Data, View>,
    sort?: EntityQuerySortFunction<Data, View>
  ) => EntityQuery<Data, View>;
  sort(sort: EntityQuerySortFunction<Data, View>): EntityQuery<Data, View>;
};

/**
 * Query keeps track of all items passing given query filter and sorter.
 *
 * It will automatically update results if 'source list' changes.
 *
 * It is also lazy - it will not calculate results until they are needed.
 */
export function createEntityQuery<Data, View>(
  // Might be plain array or any observable array. This allows creating nested queries of previously created queries
  // It is getter as source value might be computed value, so we want to observe getting it (especially in nested queries)
  getSource: () => MaybeObservableArray<Entity<Data, View>>,
  queryConfig: EntityQueryConfig<Data, View>,
  store: EntityStore<Data, View>
): EntityQuery<Data, View> {
  const { definition } = store;
  const { filter, sort, name: queryName } = queryConfig;

  const {
    config: { functionalFilterCheck },
  } = definition;

  if (!filter && !sort) {
    throw new Error(
      `Either filter or sort is needed to be provided to query. If no sort or filter is needed, use .all property.`
    );
  }

  const sortConfig = resolveSortInput(sort);

  function getQueryKeyBase() {
    const parts: string[] = [definition.config.name];

    if (queryName) {
      parts.push(queryName);
    }

    if (filter) {
      if (typeof filter === "function") {
        parts.push(`filter()`);
      } else {
        parts.push(`filter({${Object.keys(filter).join(",")}})`);
      }
    }

    if (sortConfig) {
      parts.push(`sort()[${sortConfig.direction}]`);
    }

    return parts.join("__");
  }

  const queryKeyBase = getQueryKeyBase();

  /**
   * Create filter cache only for functional filter.
   *
   * Simple query filter eg { user_id: "foo" } does not require it as simpleQuery is already cached
   * and observable.
   *
   * Also it is very often used resulting easily in 100k+ calls on production data (we really dont want so many cached functions
   * created for already cached list)
   */
  const cachedFilterForFunctionalFilter =
    typeof filter === "function"
      ? /**
         * Important! Do not do cachedComputed(filter) - it might look the same, but native .filter function of
         * array is using 3 arguments (item, index, array), not one. In such case cache would be created for all of those arguments.
         */
        cachedComputed((item: Entity<Data, View>) => {
          if (functionalFilterCheck) {
            functionalFilterCheck(item, filter);
          }

          return filter(item);
        })
      : null;

  // Note: this value will be cached as long as it is in use and nothing it uses changes.
  // TLDR: query value is cached between renders if no items it used changed.
  const passingItems = cachedComputedWithoutArgs(
    () => {
      let items = getSource();

      if (!items.length) {
        // It is important we return empty array instead of items. items might be directly array of index of some property and this index items might change.
        // If it changes - we should re-compute query instead of directly using it as items in it might not match this query filter
        return [];
      }

      const finalFilter = cachedFilterForFunctionalFilter ?? filter;

      if (finalFilter) {
        items = findInSource(items, store, finalFilter);
      }

      return items;
    },
    { name: `${queryKeyBase}.passingItems`, equals: areArraysShallowEqual }
  );

  const passingSortedItems = cachedComputedWithoutArgs(
    () => {
      let items = passingItems.get();

      if (sortConfig) {
        items = sortBy(items, sortConfig.sort);

        if (sortConfig?.direction === "desc") {
          return items;
        }

        return items.reverse();
      }

      return store.sortItems(items);
    },
    {
      name: `${queryKeyBase}.passingSortedItems`,
      equals: areArraysShallowEqual,
    }
  );

  const hasItemsComputed = cachedComputedWithoutArgs(
    () => {
      return passingItems.get().length > 0;
    },
    { name: `${queryKeyBase}.hasItems` }
  );

  const countComputed = cachedComputedWithoutArgs(
    () => passingItems.get().length,
    { name: `${queryKeyBase}.count` }
  );
  const firstComputed = cachedComputedWithoutArgs(
    () => passingSortedItems.get()[0] ?? null,
    {
      name: `${queryKeyBase}.first`,
    }
  );
  const lastComputed = cachedComputedWithoutArgs(
    () => {
      const all = passingSortedItems.get();

      return all[all.length - 1] ?? null;
    },
    { name: `${queryKeyBase}.last` }
  );

  const byIdMapComputed = cachedComputedWithoutArgs(
    () => {
      const all = passingItems.get();

      const record: Record<string, Entity<Data, View>> = {};

      for (const item of all) {
        record[item.getId()] = item;
      }

      return record;
    },
    { name: `${queryKeyBase}.idMap` }
  );

  const getById = cachedComputed(
    function getById(id: string) {
      return byIdMapComputed.get()[id] ?? null;
    },
    { name: `${queryKeyBase}.getById` }
  );

  const createOrReuseQuery = deepMemoize(
    function createOrReuseQuery(
      filter?: FindInput<Data, View>,
      sort?: EntityQuerySortInput<Data, View>
    ) {
      const resolvedSort = resolveSortInput(sort) ?? undefined;

      const query = createEntityQuery(
        passingItems.get,
        { filter, sort: resolvedSort },
        store
      );

      return query;
    },
    { checkEquality: true }
  );

  return {
    get hasItems() {
      return hasItemsComputed.get();
    },
    get isEmpty() {
      return !hasItemsComputed.get();
    },
    get count() {
      return countComputed.get();
    },
    get all() {
      return passingSortedItems.get();
    },
    get first() {
      return firstComputed.get();
    },
    get last() {
      return lastComputed.get();
    },
    findById(id) {
      return getById(id);
    },
    query(filter, sort) {
      return createOrReuseQuery(filter, sort);
    },
    sort(sort) {
      return createOrReuseQuery(undefined, sort);
    },
  };
}
