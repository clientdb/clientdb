import { EntitiesSchema } from "@clientdb/schema";
import { Knex } from "knex";
import { PermissionsRoot } from "../permissions/PermissionsRoot";

export interface SyncServerContextConfig {
  userTable: string;
}

export interface SyncRequestContext<Schema = any> {
  userId: string | null;
  lastSyncId: number | null;
  schema: EntitiesSchema;
  db: Knex;
  permissions: PermissionsRoot<Schema>;
  config: SyncServerContextConfig;
}
