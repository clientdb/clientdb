import { find, forEach, mapValues } from "lodash";
import { runInAction } from "mobx";


import { createEntityClient, EntityClient, EntityClientByDefinition } from "./entity/client";
import { DbContext, DbContextInstance } from "./entity/context";
import { PersistanceAdapterInfo } from "./entity/db/adapter";
import { EntityDefinition } from "./entity/definition";
import { DatabaseLinker } from "./entity/entitiesConnections";
import { EntitiesMap } from "./entity/entitiesMap";
import { initializePersistance } from "./entity/initializePersistance";
import { assert } from "./utils/assert";
import { IS_CLIENT } from "./utils/client";

export * from "./entity/index";

interface ClientDbConfig {
  db: PersistanceAdapterInfo;
  contexts?: DbContextInstance<unknown>[];
  disableSync?: boolean;
  onDestroyRequest?: () => void;
}

type EntitiesClientsMap<Entities extends EntitiesMap> = {
  // If you're brave - go for it! You've been warned.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  [key in keyof Entities]: EntityClientByDefinition<Entities[key]>;
};

type ClientDbExtra = {
  destroy: () => void;
  linker: DatabaseLinker;
};

type ClientDb<Entities extends EntitiesMap> = ClientDbExtra & EntitiesClientsMap<Entities>;

export async function createClientDb<Entities extends EntitiesMap>(
  { db, contexts, onDestroyRequest, disableSync = false }: ClientDbConfig,
  definitionsMap: Entities
): Promise<ClientDb<Entities>> {
  const definitions = Object.values(definitionsMap);

  assert(IS_CLIENT, "Client DB can only be created on client side");

  const [persistanceDb, cacheTable] = await initializePersistance(
    definitions as EntityDefinition<unknown, unknown>[],
    db,
    onDestroyRequest
  );

  const databaseLinker: DatabaseLinker = {
    getEntity<Data, Connections>(definition: EntityDefinition<Data, Connections>): EntityClient<Data, Connections> {
      const foundClient = find(entityClients, (client: EntityClient<unknown, unknown>) => {
        return (client as EntityClient<Data, Connections>).definition === definition;
      });

      if (!foundClient) {
        throw new Error(
          `no client for given definition (${definition.config.name}) in this db. Make sure it is added to entities map when creating client db`
        );
      }

      return foundClient as EntityClient<Data, Connections>;
    },
    getContextValue<V>(context: DbContext<V>) {
      if (!contexts) {
        throw new Error(`No context are defined for this db`);
      }

      const correspondingContextInstance = contexts.find((contextInstance) => contextInstance.context === context);

      if (!correspondingContextInstance) {
        throw new Error(`No context in this db matching requested one`);
      }

      return correspondingContextInstance.value as V;
    },
  };

  const entityClients = mapValues(definitionsMap, (definition) => {
    const entityClient = createEntityClient(definition, {
      linker: databaseLinker,
      persistanceDb,
      disableSync,
    });

    return entityClient;
  }) as EntitiesClientsMap<Entities>;

  function destroy() {
    // ! close indexeddb connection so in case new clientdb is created for same name - it will be able to connect.
    persistanceDb.close();
    runInAction(() => {
      forEach(entityClients, (client: EntityClient<unknown, unknown>) => {
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
      Object.values<EntityClient<unknown, unknown>>(entityClients).map(async (client) => {
        const persistedData = await client.persistanceManager.fetchPersistedItems();

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
      forEach(entityClients, (client: EntityClient<unknown, unknown>) => {
        client.startSync();
      });
    });

    const firstSyncPromise = Promise.all(
      Object.values<EntityClient<unknown, unknown>>(entityClients).map((client) => client.firstSyncLoaded)
    );

    await Promise.all([persistanceLoadedPromise, firstSyncPromise]);
  } else {
    await persistanceLoadedPromise;
  }

  const clientDbMethods: ClientDbExtra = {
    destroy,
    linker: databaseLinker,
  };

  return { ...entityClients, ...clientDbMethods };
}
