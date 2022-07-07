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
import { assert } from "./utils/assert";
import { IS_CLIENT } from "./utils/client";

interface ClientDbConfig {
  contexts?: DbContextInstance<unknown>[];
  onDestroyRequest?: () => void;
}

export function createClientDb(
  definitions: Array<EntityDefinition<any, any>>,
  { contexts, onDestroyRequest }: ClientDbConfig
): ClientDb {
  assert(IS_CLIENT, "Client DB can only be created on client side");

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
    runInAction(() => {
      entityClients.forEach((client) => {
        client.destroy();
      });
    });
  }

  return clientdb;
}
