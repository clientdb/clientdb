import { Index } from "flexsearch";
import { mapValues, memoize, pick, values } from "lodash";
import { makeAutoObservable } from "mobx";

import { Entity } from "./entity";

import { EntityStore } from "./store";
import { assert } from "./utils/assert";
import { computedArray } from "./utils/computedArray";
import { runUntracked } from "./utils/mobx";
import { isNotNullish } from "./utils/nullish";
import { typedKeys } from "./utils/object";

interface EntitySearchFieldDetailedConfig<Value> {
  extract?: (value: Value) => string;
  boost?: number;
}

type EntitySearchFieldConfig<Value> =
  | true
  | EntitySearchFieldDetailedConfig<Value>;

function isDetailedEntitySearchFieldConfig<Value>(
  config: EntitySearchFieldConfig<Value>
): config is EntitySearchFieldDetailedConfig<Value> {
  return config !== true;
}

type EntitySearchFields<Data> = {
  [key in keyof Data]?: EntitySearchFieldConfig<Data[key]>;
};

export interface EntitySearchConfig<Data> {
  fields: EntitySearchFields<Data>;
  persistIndex?: boolean;
}

export interface EntitySearch<Data, View> {
  search(term: string): Entity<Data, View>[];
  destroy(): void;
}

export function createEntitySearch<Data, View>(
  { fields }: EntitySearchConfig<Data>,
  store: EntityStore<Data, View>
): EntitySearch<Data, View> {
  const fieldsList = typedKeys(fields);
  const entityName = store.definition.config.name;

  function prepareEntitySearchTerm(entity: Entity<Data, View>): string {
    const dataToIndex: Partial<Data> = pick(entity, fieldsList);

    const indexedValuesMap = mapValues(dataToIndex, (value, key) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const fieldConfig = fields[key as keyof Data]!;

      if (
        !isDetailedEntitySearchFieldConfig(fieldConfig) ||
        !fieldConfig.extract
      ) {
        assert(
          typeof value === "string",
          `Only string values can be indexed if no convert function is provided`
        );
        return value as string;
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const stringValue = fieldConfig.extract(value!);

      return stringValue;
    });

    const term = values<string>(indexedValuesMap).join(" ");

    return term;
  }

  const index = new Index({
    preset: "match",
    // Will find "hello", when looking for "he"
    tokenize: "forward",
    // Will normalize custom characters.
    charset: "lating:advanced",
    language: "en",
  });

  function populateIndex() {
    runUntracked(() => {
      store.items.forEach((entity) => {
        index.add(entity.getId(), prepareEntitySearchTerm(entity));
      });
    });
  }

  /**
   * Changes of items can change search results. But index is not observable so we need a way to track updates in it to
   * force 're-search'.
   */
  const status = makeAutoObservable({ updatesCount: 0 });

  function trackUpdate() {
    status.updatesCount++;
  }

  const listenToUpdatesIfNeeded = memoize(() => {
    const cancelAdd = store.events.on("created", (entity) => {
      index.add(entity.getId(), prepareEntitySearchTerm(entity));
      trackUpdate();
    });

    const cancelDelete = store.events.on("removed", (entity) => {
      trackUpdate();
      index.remove(entity.getId());
    });

    const cancelUpdate = store.events.on("updated", (entity) => {
      index.update(entity.getId(), prepareEntitySearchTerm(entity));
      trackUpdate();
    });

    return function cancel() {
      cancelAdd();
      cancelDelete();
      cancelUpdate();
    };
  });

  const initializeIfNeeded = memoize(() => {
    populateIndex();

    return listenToUpdatesIfNeeded();
  });

  function search(input: string) {
    // Return empty list of empty input. No need to make it observable.
    if (!input.trim().length) return [];

    // Index is built on first search (aka. it is lazy)
    initializeIfNeeded();

    return computedArray(() => {
      // We simply read this value to let mobx know to re-compute if there is change in the index
      status.updatesCount;
      const foundIds = index.search(input, { limit: 20, suggest: true });

      return (
        foundIds
          .map((id) => store.findById(id as string))
          // It is possible we found items that we dont have access to (they're also indexed) - filter them out.
          .filter(isNotNullish)
      );
    }).get();
  }

  function destroy() {
    const cancelUpdatesTracking = initializeIfNeeded();

    cancelUpdatesTracking();
  }

  return {
    search,
    destroy,
  };
}
