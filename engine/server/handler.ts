import { EntitySchemaData } from "../schema/types";
import { EntityChange } from "./change";
import { SyncRequestContext } from "./context";
import { fetchSyncDelta } from "./fetchSyncDelta";
import { fetchInitialData } from "./init";
import { performMutation } from "./mutation";

export function createSyncHandler() {
  async function getInit(context: SyncRequestContext) {
    return await fetchInitialData(context);
  }

  async function getSync(context: SyncRequestContext) {
    return await fetchSyncDelta(context);
  }

  async function mutate<Schema, T extends keyof Schema>(
    context: SyncRequestContext,
    input: EntityChange<T, EntitySchemaData<Schema[T]>>
  ) {
    return await performMutation(context, input);
  }

  return {
    getInit,
    getSync,
    mutate,
  };
}

export type SyncHandler = ReturnType<typeof createSyncHandler>;
