import { DbSchema } from "../schema/schema";
import { Knex, knex } from "knex";
import { SchemaPermissions } from "../schema/types";
import { DbSchemaModel } from "../schema/model";

export interface SyncRequestContext<Schema = any> {
  userId: string | null;
  lastSyncId: number | null;
  schema: DbSchemaModel;
  db: Knex;
  permissions: SchemaPermissions<Schema>;
}
