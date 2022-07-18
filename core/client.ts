import { computed, runInAction } from "mobx";
import { assert } from "./utils/assert";
import { ClientDb } from "./db";

import { EntityDefinition } from "./definition";
import { Entity, createEntity } from "./entity";
import {
  EntityStorePublicMethods,
  createEntityStore,
  EntityStore,
} from "./store";
import { CleanupObject } from "./utils/cleanup";
import {
  EntityChangeEvent,
  EntityStoreEvents,
  EntityStoreEventsEmmiter,
} from "./events";
import { createEventsEmmiter } from "./utils/eventManager";
import {
  createTransactionWithChanges,
  getCurrentTransaction,
} from "./transaction";

export interface EntityClient<Data, View>
  extends EntityStorePublicMethods<Data, View> {
  all: Entity<Data, View>[];
  hasItems: boolean;
  count: number;
  create(input: Partial<Data>): Entity<Data, View>;
  put(input: Partial<Data>): Entity<Data, View>;
  definition: EntityDefinition<Data, View>;
  store: EntityStore<Data, View>;

  events: EntityStoreEventsEmmiter<Data, View>;
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

  // Allow listening to CRUD updates in the store
  const events = createEventsEmmiter<EntityStoreEvents<Data, View>>(
    definition.config.name
  );

  const { created, removed, updated } = definition.config.events ?? {};

  if (created) {
    cleanup.next = events.on("created", created);
  }

  if (removed) {
    cleanup.next = events.on("removed", removed);
  }

  if (updated) {
    cleanup.next = events.on("updated", updated);
  }

  cleanup.next = events.onOneOf(["created", "removed", "updated"], (change) => {
    const currentTransaction = getCurrentTransaction();

    if (!db.events.hasListeners("transaction")) {
      if (currentTransaction) {
        console.warn(
          "running runTransaction with operations on db that is not listening to transactions."
        );
      }
      return;
    }

    if (!currentTransaction) {
      // Emit change as one-step transaction
      const transaction = createTransactionWithChanges([
        change as EntityChangeEvent<unknown, unknown>,
      ]);

      db.events.emit("transaction", { type: "transaction", transaction });
      return;
    }

    currentTransaction.pushChange(
      change as EntityChangeEvent<unknown, unknown>
    );
  });

  cleanup.next = events.removeAllListeners;

  const { query, findById, sort, find, findFirst } = store;

  function createStoreEntity(input: Partial<Data>) {
    return createEntity<Data, View>({ data: input, client });
  }

  const countComputed = computed(() => {
    return client.all.length;
  });

  const hasItemsComputed = computed(() => {
    return countComputed.get() > 0;
  });

  const client: EntityClient<Data, View> = {
    definition,
    query,
    findById,
    find,
    findFirst,
    sort,
    store,
    events,
    get all() {
      return store.all;
    },
    get count() {
      return countComputed.get();
    },
    get hasItems() {
      return hasItemsComputed.get();
    },
    create(input) {
      const newEntity = createStoreEntity(input);

      return runInAction(() => {
        store.add(newEntity);
        events.emit("created", {
          db,
          entity: newEntity,
          type: "created",
          rollback() {
            store.remove(newEntity.getId());
          },
        });
        return newEntity;
      });
    },
    remove(id) {
      return runInAction(() => {
        const entity = store.findById(id);

        const didRemove = store.remove(id);

        if (!didRemove) return false;

        events.emit("removed", {
          db,
          entity: entity!,
          type: "removed",
          rollback() {
            store.add(entity!);
          },
        });

        return didRemove;
      });
    },
    update(id, input) {
      return runInAction(() => {
        const updateEvent = store.update(id, input);
        events.emit("updated", updateEvent);
        return updateEvent;
      });
    },
    put(input) {
      const id = `${input[definition.config.idField!]}`;
      if (client.findById(id)) {
        return client.update(id, input).entity;
      }

      return client.create(input);
    },
  };

  return client;
}

export type GetEntityClientByDefinition<Data, View> = (
  definition: EntityDefinition<Data, View>
) => EntityClient<Data, View>;
