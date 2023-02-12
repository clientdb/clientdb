import { runInAction } from "mobx";
import { EntityClient } from "./client";
import { DbContext } from "./context";
import { EntityDefinition } from "./definition";
import { assert } from "./utils/assert";

import { createEntityClient } from "./client";
import { DbContextInstance } from "./context";
import { createCleanupObject } from "./utils/cleanup";
import { ClientDbEvents, ClientDbEventsEmmiter } from "./events";
import { createEventsEmmiter } from "./utils/eventManager";

interface ClientDbUtils {
  assertNotDestroyed(msg: string): void;
}

export type ClientDb = {
  destroy: () => void;
  entity<D, V>(definition: EntityDefinition<D, V>): EntityClient<D, V>;
  getContextValue<D>(context: DbContext<D>): D;
  readonly isDestroyed: boolean;
  utils: ClientDbUtils;
  events: ClientDbEventsEmmiter;
};

interface ClientDbConfig {
  contexts?: DbContextInstance<unknown>[];
}

export function createClientDb(
  definitions: Array<EntityDefinition<any, any>>,
  { contexts }: ClientDbConfig = {}
): ClientDb {
  const clientsLookup = new Map<
    EntityDefinition<any, any>,
    EntityClient<any, any>
  >();

  const cleanup = createCleanupObject();

  const events = createEventsEmmiter<ClientDbEvents>();

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
    events,
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
        `No client for given definition (${definition.config.name}) in this db. Make sure it is added to entities map when creating client db`
      );
    }

    return client as EntityClient<Data, View>;
  }

  function getContextValue<V>(context: DbContext<V>) {
    if (!contexts) {
      throw new Error(
        `No context are defined for this db (trying to get context - ${context.contextName})`
      );
    }

    const correspondingContextInstance = contexts.find(
      (contextInstance) => contextInstance.context === context
    );

    if (!correspondingContextInstance) {
      throw new Error(
        `No context in this db matching requested one - ${context.contextName}`
      );
    }

    return correspondingContextInstance.value as V;
  }

  return clientdb;
}
