import { computed, runInAction } from "mobx";
import { assert } from "../utils/assert";


import { PersistanceDB } from "./db/adapter";
import { EntityDefinition } from "./definition";
import { DatabaseLinker } from "./entitiesConnections";
import { Entity, createEntity } from "./entity";
import { EntityPersistanceManager, createEntityPersistanceManager } from "./persistance";
import { createEntitySearch } from "./search";
import { EntityStoreFindMethods, createEntityStore } from "./store";
import { createEntitySyncManager } from "./sync";
import { EntityChangeSource } from "./types";

export interface EntityClient<Data, Connections> extends EntityStoreFindMethods<Data, Connections> {
  all: Entity<Data, Connections>[];
  hasItems: boolean;
  search(term: string): Entity<Data, Connections>[];
  create(input: Partial<Data>, source?: EntityChangeSource): Entity<Data, Connections>;
  update(id: string, input: Partial<Data>, source?: EntityChangeSource): Entity<Data, Connections>;
  createOrUpdate(input: Partial<Data>, source?: EntityChangeSource): Entity<Data, Connections>;
  destroy(): void;
  definition: EntityDefinition<Data, Connections>;
  persistanceLoaded: Promise<void>;
  firstSyncLoaded: Promise<void>;
  startSync(): Promise<void>;
  fetchPersistedItems(): Promise<Data[]>;
  persistanceManager: EntityPersistanceManager<Data, Connections>;
}

export type EntityClientByDefinition<Def extends EntityDefinition<unknown, unknown>> = Def extends EntityDefinition<
  infer Data,
  infer Connections
>
  ? EntityClient<Data, Connections>
  : never;

interface EntityClientConfig {
  linker: DatabaseLinker;
  persistanceDb: PersistanceDB;
  disableSync: boolean;
}

const truePredicate = () => true;

/**
 * Client is 'public api' surface for entity.
 *
 * It also initializes synchronization and persistance.
 */
export function createEntityClient<Data, Connections>(
  definition: EntityDefinition<Data, Connections>,
  { linker, persistanceDb, disableSync }: EntityClientConfig
): EntityClient<Data, Connections> {
  const store = createEntityStore<Data, Connections>(definition, linker);

  function attachEntityEvents() {
    const cleanupItemAdded = store.events.on("itemAdded", (entity, source) => {
      if (source === "user") {
        definition.config.events?.itemAdded?.(entity, linker);
      }
    });
    const cleanupItemUpdated = store.events.on("itemUpdated", (entity, dataBefore, source) => {
      if (source === "user") {
        definition.config.events?.itemUpdated?.(entity, dataBefore, linker);
      }
    });
    const cleanupItemRemoved = store.events.on("itemRemoved", (entity, source) => {
      if (source === "user") {
        definition.config.events?.itemRemoved?.(entity, linker);
      }
    });

    return function cleanup() {
      cleanupItemAdded();
      cleanupItemUpdated();
      cleanupItemRemoved();
    };
  }

  const {
    query,
    findById,
    findByUniqueIndex,
    assertFindById,
    removeById,
    assertFindByUniqueIndex,
    sort,
    find,
    findFirst,
  } = store;

  const searchEngine = definition.config.search ? createEntitySearch(definition.config.search, store) : null;

  function createEntityWithData(input: Partial<Data>) {
    return createEntity<Data, Connections>({ data: input, definition, store, linker });
  }

  const persistanceManager = createEntityPersistanceManager(definition, {
    store,
    persistanceDb,
  });

  const syncManager = createEntitySyncManager<Data, Connections>(
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
    linker
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

  const client: EntityClient<Data, Connections> = {
    definition,
    query,
    findById,
    findByUniqueIndex,
    assertFindById,
    removeById,
    assertFindByUniqueIndex,
    find,
    findFirst,
    sort,
    search(term) {
      assert(searchEngine, `No search configuration is provided for entity ${definition.config.name}`);

      return searchEngine.search(term);
    },
    get all() {
      return client.query(truePredicate).all;
    },
    get hasItems() {
      return hasItemsComputed.get();
    },
    create(input, source = "user") {
      const newEntity = createEntityWithData(input);
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
      const id = `${input[definition.config.keyField]}`;
      if (client.findById(id)) {
        return client.update(id, input, source);
      }

      const newEntity = createEntityWithData(input);
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

export type GetEntityClientByDefinition<Data, Connections> = (
  definition: EntityDefinition<Data, Connections>
) => EntityClient<Data, Connections>;
