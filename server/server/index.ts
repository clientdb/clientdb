import { EntitiesSchema } from "@clientdb/schema";
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

  const dbConnection =
    configInput.db ??
    knex({
      connection: configInput.dbConnection,
    });

  const schemaModel = new EntitiesSchema(configInput.schema, {
    db: dbConnection,
    userTable: "user",
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
    const res = await dbConnection.raw("set jit = off;");

    await dbConnection.raw("alter database test set jit=on;");
    await dbConnection.raw("set jit_above_cost = -1;");

    console.log({ res });
    await bootstrapTables();
    await initializeSystemTables(schemaModel);
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
