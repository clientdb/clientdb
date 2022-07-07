import { DbSchema } from "../schema/schema";

interface SyncServerConfig {
  schema: DbSchema;
}

export function createSyncServer(config: SyncServerConfig) {}
