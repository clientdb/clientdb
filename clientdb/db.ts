import { EntityClient } from "./client";
import { DbContext } from "./context";
import { EntityDefinition } from "./definition";

export type ClientDb = {
  destroy: () => void;
  entity<D, V>(definition: EntityDefinition<D, V>): EntityClient<D, V>;
  getContextValue<D>(context: DbContext<D>): D;
};

import { runInAction } from "mobx";

import { createEntityClient } from "./client";
import { DbContextInstance } from "./context";
import { PersistanceAdapterInfo } from "./persistanceAdapter";
import { initializePersistance } from "./initializePersistance";
import { assert } from "./utils/assert";
import { IS_CLIENT } from "./utils/client";

interface ClientDbConfig {
  persistance: PersistanceAdapterInfo;
  contexts?: DbContextInstance<unknown>[];
  disableSync?: boolean;
  onDestroyRequest?: () => void;
}

export async function createClientDb(
  definitions: Array<EntityDefinition<any, any>>,
  {
    persistance,
    contexts,
    onDestroyRequest,
    disableSync = false,
  }: ClientDbConfig
): Promise<ClientDb> {
  assert(IS_CLIENT, "Client DB can only be created on client side");

  const persistanceDb = await initializePersistance(
    definitions as EntityDefinition<unknown, unknown>[],
    persistance,
    onDestroyRequest
  );

  const clientsLookup = new Map<
    EntityDefinition<any, any>,
    EntityClient<any, any>
  >();

  const clientdb: ClientDb = {
    entity: getEntityClient,
    getContextValue,
    destroy,
  };

  const entityClients = definitions.map((definition) => {
    const entityClient = createEntityClient(definition, {
      db: clientdb,
      persistanceDb,
      disableSync,
    });

    return entityClient;
  });

  for (const client of entityClients) {
    clientsLookup.set(client.definition, client);
  }

  function getEntityClient<Data, View>(
    definition: EntityDefinition<Data, View>
  ): EntityClient<Data, View> {
    const client = clientsLookup.get(definition);

    if (!client) {
      throw new Error(
        `no client for given definition (${definition.config.name}) in this db. Make sure it is added to entities map when creating client db`
      );
    }

    return client as EntityClient<Data, View>;
  }

  function getContextValue<V>(context: DbContext<V>) {
    if (!contexts) {
      throw new Error(`No context are defined for this db`);
    }

    const correspondingContextInstance = contexts.find(
      (contextInstance) => contextInstance.context === context
    );

    if (!correspondingContextInstance) {
      throw new Error(`No context in this db matching requested one`);
    }

    return correspondingContextInstance.value as V;
  }

  function destroy() {
    // ! close indexeddb connection so in case new clientdb is created for same name - it will be able to connect.
    persistanceDb.close();
    runInAction(() => {
      entityClients.forEach((client) => {
        client.destroy();
      });
    });
  }

  /**
   * We'll load all persisted data we have from all entities and register everything in one, big action call.
   *
   * This will ensure us that all events, relation mapping, index creation etc. happens when we have full data already present.
   * This is especially important for cases when one entity depends on another instantly when created (eg. accessValidator)
   */
  async function loadPersistedData() {
    const persistedDataWithClient = await Promise.all(
      entityClients.map(async (client) => {
        const persistedData =
          await client.persistanceManager.fetchPersistedItems();

        return { persistedData, client };
      })
    );

    runInAction(() => {
      persistedDataWithClient.forEach(({ client, persistedData }) => {
        for (const persistedItem of persistedData) {
          client.create(persistedItem as Partial<unknown>, "persistance");
        }
      });
    });

    persistedDataWithClient.forEach(({ client }) => {
      client.persistanceManager.startPersistingChanges();
    });
  }

  const persistanceLoadedPromise = loadPersistedData();

  if (!disableSync) {
    // Start sync at once when all persistance data is loaded
    persistanceLoadedPromise.then(() => {
      entityClients.forEach((client: EntityClient<unknown, unknown>) => {
        client.startSync();
      });
    });

    const firstSyncPromise = Promise.all(
      entityClients.map((client) => client.firstSyncLoaded)
    );

    await Promise.all([persistanceLoadedPromise, firstSyncPromise]);
  } else {
    await persistanceLoadedPromise;
  }

  return clientdb;
}
