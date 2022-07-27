import { DbSchema } from "../schema/schema";
import { Knex, knex } from "knex";
import { SchemaPermissions } from "../schema/types";
import { DbSchemaModel } from "../schema/model";
import { SyncServerConfigInput } from "./config";

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
