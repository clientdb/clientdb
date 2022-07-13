import { DbSchema } from "../schema/schema";
import { createRequestContext, RequestDataHandlers } from "./request";
import express, { Request } from "express";
import knex from "knex";
import { fetchInitialData } from "./init";
import { performMutation } from "./mutation";
import { fetchSyncDelta } from "./fetchSyncDelta";
import http from "http";
import { Server as SocketServer } from "socket.io";
import { createRealTimeManager } from "./realtime";

interface SyncServerDatabaseConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface SyncServerConfig {
  schema: DbSchema;
  requestHandlers: RequestDataHandlers;
  dbConnection: SyncServerDatabaseConnectionConfig;
}

/**
 * /init
 * /mutate
 * /sync
 *
 * socket -> connnect , 'sync trigger',
 */

export function createSyncServer(config: SyncServerConfig) {
  const app = express();
  const httpServer = http.createServer(app);
  const socketServer = new SocketServer(httpServer);

  const realTimeManager = createRealTimeManager(socketServer);

  const dbConnection = knex({
    connection: config.dbConnection,
  });

  const { requestHandlers, schema } = config;

  async function createContext(req: Request) {
    const context = await createRequestContext(
      req,
      requestHandlers,
      schema,
      dbConnection
    );

    return context;
  }

  app.get("/init", async (req, res) => {
    const context = await createContext(req);

    const bootData = await fetchInitialData(context);
    res.json(bootData);
  });

  app.get("/sync", async (req, res) => {
    const context = await createContext(req);

    const result = await fetchSyncDelta(context);

    res.json(result);
  });

  app.post("/mutate", async (req, res) => {
    const context = await createContext(req);

    const {
      body: { input },
    } = req;

    const result = await performMutation(context, input);

    res.json(result);

    realTimeManager.requestEveryoneToSync();
  });

  function listen(port: number) {
    return new Promise<void>((resolve) => {
      app.listen(port, () => {
        console.log(`Sync server listening on port ${port}`);
        resolve();
      });
    });
  }

  return {
    listen,
    app,
  };
}
