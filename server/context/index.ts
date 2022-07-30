import { DbSchemaModel } from "@clientdb/schema";
import { SchemaPermissions } from "@clientdb/server/permissions/types";
import { Knex } from "knex";

export interface SyncServerContextConfig {
  userTable: string;
}

export interface SyncRequestContext<Schema = any> {
  userId: string | null;
  lastSyncId: number | null;
  schema: DbSchemaModel;
  db: Knex;
  permissions: SchemaPermissions<Schema>;
  config: SyncServerContextConfig;
}
