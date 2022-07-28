import { DbSchema } from "../schema/schema";
import { createRequestContext, RequestDataHandlers } from "./request";
import express, { Request } from "express";
import knex, { Knex } from "knex";
import { fetchInitialData } from "./init";
import { performMutation } from "./mutation";
import { fetchSyncDelta } from "./fetchSyncDelta";
import http from "http";
import { Server as SocketServer } from "socket.io";
import { createRealTimeManager } from "./realtime";
import { initializeTablesFromSchema } from "./db/schema";
import { createSchemaModel } from "../schema/model";
import { initializeSystemTables } from "./db/core";
import { createSyncHandler } from "./handler";
import { attachSyncRouter } from "./router";
import { createSyncAdmin } from "./admin";
import { SchemaPermissions } from "../schema/types";

interface SyncServerDatabaseConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface SyncServerConfig<Schema> {
  schema: DbSchema;
  requestHandlers: RequestDataHandlers;
  dbConnection?: SyncServerDatabaseConnectionConfig;
  /**
   * Knex instance for the database. Used for testing.
   * @internal
   */
  db?: Knex;
  permissions: SchemaPermissions<Schema>;
}

export function createSyncServer<Schema = any>(
  config: SyncServerConfig<Schema>
) {
  const app = express();
  const httpServer = http.createServer(app);
  const socketServer = new SocketServer(httpServer);

  const realTimeManager = createRealTimeManager(socketServer);

  const schemaModel = createSchemaModel(config.schema);

  const dbConnection =
    config.db ??
    knex({
      connection: config.dbConnection,
    });

  const handler = createSyncHandler();

  const admin = createSyncAdmin<Schema>({
    db: dbConnection,
    schema: schemaModel,
    handler,
    permissions: config.permissions!,
  });

  attachSyncRouter({
    app,
    config,
    handler,
    realtime: realTimeManager,
    db: dbConnection,
  });

  async function bootstrapTables() {
    await initializeTablesFromSchema(dbConnection, schemaModel);
  }

  async function initialize() {
    await initializeSystemTables(dbConnection);

    await bootstrapTables();
  }

  async function listen(port: number) {
    return new Promise<void>((resolve) => {
      app.listen(port, () => {
        console.info(`Sync server listening on port ${port}`);
        resolve();
      });
    });
  }

  return {
    initialize,
    listen,
    app,
    admin,
    db: dbConnection,
  };
}

export type SyncServer<Schema> = ReturnType<typeof createSyncServer<Schema>>;
