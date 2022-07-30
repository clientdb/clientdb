import { createSchemaModel, DbSchema, DbSchemaModel } from "@clientdb/schema";
import { SchemaPermissions } from "@clientdb/server/permissions/types";
import { Knex } from "knex";
import { RequestDataHandlers } from "./request";

interface SyncServerDatabaseConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface SyncServerConfigInput<Schema> {
  schema: DbSchema;
  requestHandlers: RequestDataHandlers;
  dbConnection?: SyncServerDatabaseConnectionConfig;
  /**
   * Knex instance for the database. Used for testing.
   * @internal
   */
  db?: Knex;
  permissions?: SchemaPermissions<Schema>;
  userTable?: string;
}

export interface SyncServerConfig<Schema = any> {
  schema: DbSchemaModel;
  requestHandlers: RequestDataHandlers;
  db: Knex;
  permissions: SchemaPermissions<Schema>;
  userTable: string;
}

export function resolveSyncServerConfigInput<Schema>(
  input: SyncServerConfigInput<Schema>,
  db: Knex
): SyncServerConfig<Schema> {
  return {
    schema: createSchemaModel(input.schema),
    requestHandlers: input.requestHandlers,
    db,
    permissions: input.permissions!,
    userTable: input.userTable ?? "user",
  };
}
