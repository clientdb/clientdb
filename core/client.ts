import { computed, runInAction } from "mobx";
import { assert } from "./utils/assert";
import { ClientDb } from "./db";

import { EntityDefinition } from "./definition";
import { Entity, createEntity } from "./entity";
import { EntityStorePublicMethods, createEntityStore } from "./store";
import { CleanupObject } from "./utils/cleanup";

export interface EntityClient<Data, View>
  extends EntityStorePublicMethods<Data, View> {
  all: Entity<Data, View>[];
  hasItems: boolean;
  create(input: Partial<Data>): Entity<Data, View>;
  update(id: string, input: Partial<Data>): Entity<Data, View>;
  put(input: Partial<Data>): Entity<Data, View>;
  definition: EntityDefinition<Data, View>;
}

export type EntityClientByDefinition<
  Def extends EntityDefinition<unknown, unknown>
> = Def extends EntityDefinition<infer Data, infer View>
  ? EntityClient<Data, View>
  : never;

interface EntityClientConfig {
  db: ClientDb;
  cleanup: CleanupObject;
}

/**
 * Client is 'public api' surface for entity.
 *
 * It also initializes synchronization and persistance.
 */
export function createEntityClient<Data, View>(
  definition: EntityDefinition<Data, View>,
  { db, cleanup }: EntityClientConfig
): EntityClient<Data, View> {
  const store = createEntityStore<Data, View>(definition, db, cleanup);

  function attachEntityEvents() {
    const { created, removed, updated } = definition.config.events ?? {};

    if (created) {
      cleanup.next = store.events.on("created", created);
    }

    if (removed) {
      cleanup.next = store.events.on("removed", removed);
    }

    if (updated) {
      cleanup.next = store.events.on("updated", updated);
    }
  }

  attachEntityEvents();

  const { query, findById, removeById, sort, find, findFirst, updateById } =
    store;

  function createStoreEntity(input: Partial<Data>) {
    return createEntity<Data, View>({ data: input, store });
  }

  const hasItemsComputed = computed(() => {
    return client.all.length > 0;
  });

  const client: EntityClient<Data, View> = {
    definition,
    query,
    findById,
    removeById,
    updateById,
    find,
    findFirst,
    sort,
    get all() {
      return store.all;
    },
    get hasItems() {
      return hasItemsComputed.get();
    },
    create(input) {
      const newEntity = createStoreEntity(input);
      return store.add(newEntity);
    },
    update(id, input) {
      const entity = client.findById(id);

      if (!entity) {
        throw new Error("no update with this id");
      }

      entity.update(input);

      return entity;
    },
    put(input) {
      const id = `${input[definition.config.idField]}`;
      if (client.findById(id)) {
        return client.update(id, input);
      }

      const newEntity = createStoreEntity(input);
      return store.add(newEntity);
    },
  };

  return client;
}

export type GetEntityClientByDefinition<Data, View> = (
  definition: EntityDefinition<Data, View>
) => EntityClient<Data, View>;
