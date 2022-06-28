import { memoize, throttle } from "lodash";

import { PersistanceDB } from "./persistanceAdapter";
import { EntityDefinition } from "./definition";
import { EntityStore } from "./store";
import { createResolvablePromise } from "./utils/promises";
import { createPushQueue } from "./utils/pushQueue";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type EntityPersistanceManager<Data, View> = {
  startPersistingChanges(): void;
  destroy(): void;
  persistedItemsLoaded: Promise<void>;
  fetchPersistedItems(): Promise<Data[]>;
};

interface PersistanceManagerConfig<Data> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: EntityStore<Data, any>;
  persistanceDb: PersistanceDB;
}

const persistanceExecuteQueue = createPushQueue();

export const PERSISTANCE_BATCH_FLUSH_TIMEOUT = 50;

/**
 * Client is 'public api' surface for entity.
 *
 * It also initializes synchronization and persistance.
 */
export function createEntityPersistanceManager<Data, View>(
  definition: EntityDefinition<Data, View>,
  { persistanceDb, store }: PersistanceManagerConfig<Data>
): EntityPersistanceManager<Data, View> {
  const persistedItems = createResolvablePromise<void>();

  const getPersistanceTable = memoize(async () => {
    const persistanceTablePromise = persistanceDb.getTable<Data>(
      definition.config.name
    );

    if (!persistanceTablePromise) return null;

    const persistanceTable = await persistanceTablePromise;

    return persistanceTable;
  });

  const fetchPersistedItems = async () => {
    const persistanceTable = await getPersistanceTable();

    if (!persistanceTable) return [];

    // Instantly fetch all already persisted items
    const allItems = await persistanceTable.fetchAllItems();

    return allItems;
  };

  let currentCancelPromise: Promise<(() => void) | null>;

  async function startPersistingChanges() {
    const persistanceTable = await getPersistanceTable();

    if (!persistanceTable) return null;

    /**
     * We're batching updates in quick interval to save performance.
     * To ensure proper order of batched operations we keep both 'save' and 'remove' queues.
     *
     * As soon as operations of the same type are collected, they're batched, but if operation type changes, it is instantly flushed.
     */

    const batchSaveQueue = new Set<Data>();
    const batchRemoveQueue = new Set<string>();

    const flushQueue = () => {
      if (batchSaveQueue.size && batchRemoveQueue.size) {
        throw new Error(
          "Incorrect state - both save and remove at once - cannot guarantee proper order"
        );
      }

      if (batchSaveQueue.size) {
        const saveItems = Array.from(batchSaveQueue);
        batchSaveQueue.clear();

        persistanceExecuteQueue.add(() =>
          persistanceTable.saveItems(saveItems)
        );
      }

      if (batchRemoveQueue.size) {
        const removeItems = Array.from(batchRemoveQueue);

        batchRemoveQueue.clear();

        persistanceExecuteQueue.add(() =>
          persistanceTable.removeItems(removeItems)
        );
      }
    };

    const throttledFlushQueue = throttle(
      flushQueue,
      PERSISTANCE_BATCH_FLUSH_TIMEOUT,
      {
        leading: false,
        trailing: true,
      }
    );

    // Persist all changes locally
    const cancelAdded = store.events.on("created", (entity) => {
      if (batchRemoveQueue.size) {
        flushQueue();
      }
      batchSaveQueue.add(entity.getData());
      throttledFlushQueue();
    });

    const cancelUpdated = store.events.on("updated", (entity) => {
      if (batchRemoveQueue.size) {
        flushQueue();
      }
      batchSaveQueue.add(entity.getData());
      throttledFlushQueue();
    });

    const cancelRemoved = store.events.on("removed", (entity) => {
      if (batchSaveQueue.size) {
        flushQueue();
      }
      batchRemoveQueue.add(entity.getKey());
      throttledFlushQueue();
    });

    return () => {
      cancelAdded();
      cancelRemoved();
      cancelUpdated();
      throttledFlushQueue.cancel();
    };
  }

  async function destroy() {
    if (!currentCancelPromise) {
      return;
    }

    const cancelSync = await currentCancelPromise;

    cancelSync?.();
  }

  return {
    startPersistingChanges,
    destroy,
    persistedItemsLoaded: persistedItems.promise,
    fetchPersistedItems: fetchPersistedItems,
  };
}
