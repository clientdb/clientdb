import { EntityChange } from "@clientdb/common/sync/change";
import { EntitySchemaData, EntitySchemaInput } from "@clientdb/schema";
import { fetchInitialData } from "@clientdb/server/api/init";
import { performMutation } from "@clientdb/server/api/mutation";
import { fetchSyncDelta } from "@clientdb/server/api/syncDelta";
import { SyncRequestContext } from "@clientdb/server/context";

import { SyncServerConfig } from "./config";

interface AdminCreateContextInput {
  userId?: string | null;
  lastSyncId?: number | null;
}

export function createSyncAdmin<Schema>({
  db,
  schema,
  permissions,
}: SyncServerConfig<Schema>) {
  function createContext(input?: AdminCreateContextInput): SyncRequestContext {
    return {
      userId: input?.userId ?? null,
      lastSyncId: input?.lastSyncId ?? null,
      db,
      schema,
      permissions,
      config: {
        userTable: "user",
      },
    };
  }

  async function getInit(input?: AdminCreateContextInput) {
    const context = createContext(input);
    return await fetchInitialData(context);
  }

  async function getSync(input?: AdminCreateContextInput) {
    const context = createContext(input);
    return await fetchSyncDelta(context);
  }

  async function mutate<T extends keyof Schema>(
    input: EntityChange<T, EntitySchemaData<Schema[T]>>,
    contextInput?: AdminCreateContextInput
  ) {
    const context = createContext(contextInput);
    return await performMutation(context, input);
  }

  async function create<T extends keyof Schema>(
    entity: T,
    input: EntitySchemaInput<Schema[T]>,
    contextInput?: AdminCreateContextInput
  ) {
    return await mutate<T>(
      { type: "create", entity, data: input },
      contextInput
    );
  }

  return {
    getInit,
    getSync,
    mutate,
    create,
    createContext,
  };
}

export type SyncAdmin = ReturnType<typeof createSyncAdmin>;
