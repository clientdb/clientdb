import { DbSchemaModel } from "@clientdb/schema";
import { Knex } from "knex";
import { SchemaPermissionsModel } from "../permissions/model";

export interface SyncServerContextConfig {
  userTable: string;
}

export interface SyncRequestContext<Schema = any> {
  userId: string | null;
  lastSyncId: number | null;
  schema: DbSchemaModel;
  db: Knex;
  permissions: SchemaPermissionsModel<Schema>;
  config: SyncServerContextConfig;
}
