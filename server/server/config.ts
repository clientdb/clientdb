import { EntitiesSchema, EntitiesSchemaInput } from "@clientdb/schema";
import { Knex } from "knex";
import { SchemaPermissions } from "../permissions/input";
import { PermissionsRoot } from "../permissions/PermissionsRoot";
import { RequestDataHandlers } from "./request";

interface SyncServerDatabaseConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface SyncServerConfigInput<Schema> {
  schema: EntitiesSchemaInput;
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
  schema: EntitiesSchema;
  requestHandlers: RequestDataHandlers;
  db: Knex;
  permissions: PermissionsRoot<Schema>;
  userTable: string;
}

export function resolveSyncServerConfigInput<Schema>(
  input: SyncServerConfigInput<Schema>,
  db: Knex
): SyncServerConfig<Schema> {
  const schema = new EntitiesSchema(input.schema, { db, userTable: "user" });
  const config: SyncServerConfig<Schema> = {
    schema,
    requestHandlers: input.requestHandlers,
    db,
    get permissions() {
      return new PermissionsRoot(input.permissions!, schema)!;
    },
    userTable: input.userTable ?? "user",
  };

  return config;
}
