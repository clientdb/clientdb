import { runInAction } from "mobx";
import { EntityClient } from "./client";
import { DbContext } from "./context";
import { EntityDefinition } from "./definition";
import { assert } from "./utils/assert";

import { createEntityClient } from "./client";
import { DbContextInstance } from "./context";
import { createCleanupObject } from "./utils/cleanup";
import { IS_CLIENT } from "./utils/client";

interface ClientDbUtils {
  assertNotDestroyed(msg: string): void;
}

export type ClientDb = {
  destroy: () => void;
  entity<D, V>(definition: EntityDefinition<D, V>): EntityClient<D, V>;
  getContextValue<D>(context: DbContext<D>): D;
  readonly isDestroyed: boolean;
  utils: ClientDbUtils;
};

interface ClientDbConfig {
  contexts?: DbContextInstance<unknown>[];
}

export function createClientDb(
  definitions: Array<EntityDefinition<any, any>>,
  { contexts }: ClientDbConfig
): ClientDb {
  assert(IS_CLIENT, "Client DB can only be created on client side");

  const clientsLookup = new Map<
    EntityDefinition<any, any>,
    EntityClient<any, any>
  >();

  const cleanup = createCleanupObject();

  let isDestroyed = false;

  function destroy() {
    if (isDestroyed) {
      throw new Error("Client DB is already destroyed");
    }

    runInAction(() => {
      cleanup.clean();
    });

    isDestroyed = true;
  }

  const utils: ClientDbUtils = {
    assertNotDestroyed(msg) {
      assert(!isDestroyed, `${msg} - ClientDB is destroyed`);
    },
  };

  const clientdb: ClientDb = {
    entity: getEntityClient,
    getContextValue,
    destroy,
    get isDestroyed() {
      return isDestroyed;
    },
    utils,
  };

  for (const definition of definitions) {
    const client = createEntityClient(definition, {
      db: clientdb,
      cleanup,
    });

    clientsLookup.set(definition, client);
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

  return clientdb;
}
