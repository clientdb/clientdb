import { Knex } from "knex";
import { DbSchema } from "../schema/schema";
import { RequestDataHandlers } from "./request";

interface SyncServerDatabaseConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface SyncServerConfig {
  schema: DbSchema;
  requestHandlers: RequestDataHandlers;
  dbConnection?: SyncServerDatabaseConnectionConfig;
  /**
   * Knex instance for the database. Used for testing.
   * @internal
   */
  db?: Knex;
  permissions?: any;
}
