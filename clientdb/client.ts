import { computed, runInAction } from "mobx";
import { assert } from "./utils/assert";
import { ClientDb } from "./db";

import { PersistanceDB } from "./persistanceAdapter";
import { EntityDefinition } from "./definition";
import { Entity, createEntity } from "./entity";
import {
  EntityPersistanceManager,
  createEntityPersistanceManager,
} from "./persistance";
import { createEntitySearch } from "./search";
import { EntityStoreFindMethods, createEntityStore } from "./store";
import { createEntitySyncManager } from "./sync";
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
  persistanceLoaded: Promise<void>;
  firstSyncLoaded: Promise<void>;
  startSync(): Promise<void>;
  fetchPersistedItems(): Promise<Data[]>;
  persistanceManager: EntityPersistanceManager<Data, View>;
}

export type EntityClientByDefinition<
  Def extends EntityDefinition<unknown, unknown>
> = Def extends EntityDefinition<infer Data, infer View>
  ? EntityClient<Data, View>
  : never;

interface EntityClientConfig {
  db: ClientDb;
  persistanceDb: PersistanceDB;
  disableSync: boolean;
}

/**
 * Client is 'public api' surface for entity.
 *
 * It also initializes synchronization and persistance.
 */
export function createEntityClient<Data, View>(
  definition: EntityDefinition<Data, View>,
  { db, persistanceDb, disableSync }: EntityClientConfig
): EntityClient<Data, View> {
  const store = createEntityStore<Data, View>(definition, db);

  function attachEntityEvents() {
    const cleanupcreated = store.events.on("created", (entity, source) => {
      if (source === "user") {
        definition.config.events?.created?.(entity, db);
      }
    });
    const cleanupupdated = store.events.on(
      "updated",
      (entity, dataBefore, source) => {
        if (source === "user") {
          definition.config.events?.updated?.(entity, dataBefore, db);
        }
      }
    );
    const cleanupremoved = store.events.on("removed", (entity, source) => {
      if (source === "user") {
        definition.config.events?.removed?.(entity, db);
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

  const persistanceManager = createEntityPersistanceManager(definition, {
    store,
    persistanceDb,
  });

  const syncManager = createEntitySyncManager<Data, View>(
    store,
    {
      entitySyncConfig: definition.config.sync,
      // We're passing callbacks that connects sync layer with client
      onItemsData(items) {
        runInAction(() => {
          items.forEach((item) => {
            client.createOrUpdate(item, "sync");
          });
        });
      },
      onItemRemoveRequest(idsToRemove) {
        runInAction(() => {
          idsToRemove.forEach((idToRemove) => {
            client.removeById(idToRemove, "sync");
          });
        });
      },
    },
    db
  );

  let entityEventsCleanup: () => void;

  async function startSync() {
    await syncManager.start();

    /**
     * This is important that we attach listeners after sync manager attaches theirs.
     *
     * Otherwise - if entity events are also creating entities, order of operations will be bottom-up resulting
     * in pushing changes in incorrect order.
     *
     * Example:
     * message has event > create tasks
     * Message is created
     * message 'created' event is fired
     * if events are first to pick it, order of execution would be
     * message events "created" > create task > task is pushed to create queue
     * message sync picked event > pushes message to sync
     *
     * Thus task create sync is first - would return in error 'message does not exist'.
     *
     * Note: this could be solved in 'priority' in listeners, but I thought it would be even more confusing than attaching it here
     */
    entityEventsCleanup = attachEntityEvents();
  }

  if (disableSync) {
    entityEventsCleanup = attachEntityEvents();
  }

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
    startSync,
    destroy() {
      runInAction(() => {
        persistanceManager.destroy();
        syncManager.cancel();
        store.destroy();
        searchEngine?.destroy();
        entityEventsCleanup?.();
      });
    },
    firstSyncLoaded: syncManager.firstSyncPromise,
    persistanceLoaded: persistanceManager.persistedItemsLoaded,
    fetchPersistedItems: persistanceManager.fetchPersistedItems,
    persistanceManager,
  };

  return client;
}

export type GetEntityClientByDefinition<Data, View> = (
  definition: EntityDefinition<Data, View>
) => EntityClient<Data, View>;
