import { uniq } from "lodash";
import { IObservableArray } from "mobx";

import { EntityDefinition } from "./definition";
import { Entity } from "./entity";
import { IndexValueInput } from "./queryIndex";
import { EntityStore } from "./store";
import { getArraysCommonPart, getMaxBy } from "./utils/arrays";
import { typedKeys } from "./utils/object";

type FindObjectPartInput<T> = Partial<{
  [key in keyof T]: IndexValueInput<T[key]>;
}>;

export type FindObjectInput<T> = FindObjectPartInput<T> & {
  $or?: FindObjectPartInput<T>[];
};

type AnyKeyIndexInput<T> = IndexValueInput<T> extends infer U
  ? U[keyof U]
  : never;

type MaybeObservableArray<T> = IObservableArray<T> | T[];

function getRemainingItemsAfterApplyingQueryFields<Data, View>(
  currentItems: Entity<Data, View>[],
  store: EntityStore<Data, View>,
  queryObject: FindObjectPartInput<Data & View>
) {
  let passingItems = currentItems;

  const itemsMatchingEachValue: Entity<Data, View>[][] = [];

  for (const queryKey of typedKeys(queryObject)) {
    const queryValue = queryObject[queryKey] as AnyKeyIndexInput<Data & View>;
    const index = store.getPropIndex(queryKey);

    const itemsMatchingValue = index.find(queryValue);

    // If no items are matching some value - there is no point in continuing.
    if (itemsMatchingValue.length === 0) return [];

    itemsMatchingEachValue.push(itemsMatchingValue);
  }

  return getArraysCommonPart(passingItems, ...itemsMatchingEachValue);
}

export function findInSourceByObjectInput<Data, View>(
  source: MaybeObservableArray<Entity<Data, View>>,
  store: EntityStore<Data, View>,
  queryObject: FindObjectInput<Data & View>
) {
  if (source.length === 0) return [];

  const { $or, ...requiredKeysRaw } = queryObject;

  const itemsMatchingRootQuery = getRemainingItemsAfterApplyingQueryFields(
    source,
    store,
    requiredKeysRaw as FindObjectPartInput<Data & View>
  );

  if (!itemsMatchingRootQuery.length) {
    return [];
  }

  if (!$or) {
    return itemsMatchingRootQuery;
  }

  if (!$or.length) {
    return itemsMatchingRootQuery;
  }

  const orQueriesResults = $or.map((orQuery) => {
    return getRemainingItemsAfterApplyingQueryFields(source, store, orQuery);
  });

  const maxOrResultSize = getMaxBy(orQueriesResults, (result) => result.length);

  /**
   * Performance optimization. eg. if itemsMatchingRootQuery has 3 items, but or results have 1000 - it would be big bottleneck to first create unique array out of it
   * Instead, we'll be able to quickly iterate with small array of root query items over every or query
   */
  if (maxOrResultSize > itemsMatchingRootQuery.length) {
    return getArraysCommonPart(itemsMatchingRootQuery, ...orQueriesResults);
  }

  // Root is matching more items than or queries - we'll create unique list of or queries and compare then.
  return getArraysCommonPart(
    uniq(orQueriesResults.flat()),
    itemsMatchingRootQuery
  );
}

type FindFunctionalInput<T> = (item: T) => boolean;

export type FindInput<D, V> =
  | FindObjectInput<D & V>
  | FindFunctionalInput<Entity<D, V>>;

export type EntityFindInputByDefinition<Def> = Def extends EntityDefinition<
  infer D,
  infer V
>
  ? FindInput<D, V>
  : never;

export function findInSource<Data, View>(
  source: MaybeObservableArray<Entity<Data, View>>,
  store: EntityStore<Data, View>,
  input: FindInput<Data, View>
) {
  if (typeof input === "function") {
    // ! Do not pass filter directly as it will break cache (filter pass 3 arguments)
    return source.filter((item) => input(item));
  }

  return findInSourceByObjectInput(source, store, input);
}
