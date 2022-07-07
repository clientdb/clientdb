import { DbSchema } from "../schema/schema";
import { RequestDataHandlers } from "./request";

interface SyncServerConfig {
  schema: DbSchema;
  requestHandlers: RequestDataHandlers;
}

export function createSyncServer(config: SyncServerConfig) {}
