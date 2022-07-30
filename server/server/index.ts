import { createSchemaModel } from "@clientdb/schema";
import { initializeSystemTables } from "@clientdb/server/db/core";
import { initializeTablesFromSchema } from "@clientdb/server/db/schema";
import express from "express";
import http from "http";
import knex from "knex";
import { Server as SocketServer } from "socket.io";
import { createSyncAdmin } from "./admin";
import {
  resolveSyncServerConfigInput,
  SyncServerConfig,
  SyncServerConfigInput,
} from "./config";
import { createRealTimeManager } from "./realtime";
import { attachSyncRouter } from "./router";

export function createSyncServer<Schema = any>(
  configInput: SyncServerConfigInput<Schema>
) {
  const app = express();
  const httpServer = http.createServer(app);
  const socketServer = new SocketServer(httpServer);

  const realTimeManager = createRealTimeManager(socketServer);

  const schemaModel = createSchemaModel(configInput.schema);

  const dbConnection =
    configInput.db ??
    knex({
      connection: configInput.dbConnection,
    });

  const config: SyncServerConfig<Schema> = resolveSyncServerConfigInput<Schema>(
    configInput,
    dbConnection
  );

  const admin = createSyncAdmin<Schema>(config);

  attachSyncRouter({
    app,
    config,
    realtime: realTimeManager,
  });

  async function bootstrapTables() {
    await initializeTablesFromSchema(
      dbConnection,
      schemaModel,
      config.permissions!
    );
  }

  async function initialize() {
    await bootstrapTables();
    await initializeSystemTables(
      dbConnection,
      schemaModel,
      config.userTable ?? "user"
    );
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
