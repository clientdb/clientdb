import { computed, runInAction } from "mobx";
import { assert } from "./utils/assert";
import { ClientDb } from "./db";

import { EntityDefinition } from "./definition";
import { Entity, createEntity } from "./entity";
import { createEntitySearch } from "./search";
import { EntityStoreFindMethods, createEntityStore } from "./store";
import { EntityChangeSource } from "./types";

export interface EntityClient<Data, View>
  extends EntityStoreFindMethods<Data, View> {
  all: Entity<Data, View>[];
  hasItems: boolean;
  search(term: string): Entity<Data, View>[];
  create(input: Partial<Data>, source?: EntityChangeSource): Entity<Data, View>;
  update(
    id: string,
    input: Partial<Data>,
    source?: EntityChangeSource
  ): Entity<Data, View>;
  createOrUpdate(
    input: Partial<Data>,
    source?: EntityChangeSource
  ): Entity<Data, View>;
  destroy(): void;
  definition: EntityDefinition<Data, View>;
}

export type EntityClientByDefinition<
  Def extends EntityDefinition<unknown, unknown>
> = Def extends EntityDefinition<infer Data, infer View>
  ? EntityClient<Data, View>
  : never;

interface EntityClientConfig {
  db: ClientDb;
}

/**
 * Client is 'public api' surface for entity.
 *
 * It also initializes synchronization and persistance.
 */
export function createEntityClient<Data, View>(
  definition: EntityDefinition<Data, View>,
  { db }: EntityClientConfig
): EntityClient<Data, View> {
  const store = createEntityStore<Data, View>(definition, db);

  function attachEntityEvents() {
    const cleanupcreated = store.events.on("created", (entity, event) => {
      if (event.source === "user") {
        definition.config.events?.created?.(entity, event);
      }
    });
    const cleanupupdated = store.events.on("updated", (entity, event) => {
      if (event.source === "user") {
        definition.config.events?.updated?.(entity, event);
      }
    });
    const cleanupremoved = store.events.on("removed", (entity, event) => {
      if (event.source === "user") {
        definition.config.events?.removed?.(entity, event);
      }
    });

    return function cleanup() {
      cleanupcreated();
      cleanupupdated();
      cleanupremoved();
    };
  }

  const { query, findById, removeById, sort, find, findFirst } = store;

  const searchEngine = definition.config.search
    ? createEntitySearch(definition.config.search, store)
    : null;

  function createStoreEntity(input: Partial<Data>) {
    return createEntity<Data, View>({ data: input, store });
  }

  let entityEventsCleanup: () => void;

  entityEventsCleanup = attachEntityEvents();

  const hasItemsComputed = computed(() => {
    return client.all.length > 0;
  });

  const client: EntityClient<Data, View> = {
    definition,
    query,
    findById,
    removeById,
    find,
    findFirst,
    sort,
    search(term) {
      assert(
        searchEngine,
        `No search configuration is provided for entity ${definition.config.name}`
      );

      return searchEngine.search(term);
    },
    get all() {
      return store.all;
    },
    get hasItems() {
      return hasItemsComputed.get();
    },
    create(input, source = "user") {
      const newEntity = createStoreEntity(input);
      return store.add(newEntity, source);
    },
    update(id, input, source = "user") {
      const entity = client.findById(id);

      if (!entity) {
        throw new Error("no update with this id");
      }

      entity.update(input, source);

      return entity;
    },
    createOrUpdate(input, source = "user") {
      const id = `${input[definition.config.idField]}`;
      if (client.findById(id)) {
        return client.update(id, input, source);
      }

      const newEntity = createStoreEntity(input);
      return store.add(newEntity, source);
    },
    destroy() {
      runInAction(() => {
        store.destroy();
        searchEngine?.destroy();
        entityEventsCleanup?.();
      });
    },
  };

  return client;
}

export type GetEntityClientByDefinition<Data, View> = (
  definition: EntityDefinition<Data, View>
) => EntityClient<Data, View>;
