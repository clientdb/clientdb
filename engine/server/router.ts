import { Express, Request } from "express";
import { Knex } from "knex";
import { SyncServerConfig } from "./config";
import { initializeSystemTables } from "./db/core";
import { fetchSyncDelta } from "./fetchSyncDelta";
import { SyncHandler } from "./handler";
import { performMutation } from "./mutation";
import { RealTimeManager } from "./realtime";
import { createRequestContext } from "./request";

interface SyncServerDatabaseConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface RouterInput {
  app: Express;
  config: SyncServerConfig;
  handler: SyncHandler;
  realtime: RealTimeManager;
  db: Knex;
}

export function attachSyncRouter({
  app,
  config,
  handler,
  realtime,
  db,
}: RouterInput) {
  const { requestHandlers, schema } = config;

  async function createContext(req: Request) {
    const context = await createRequestContext(
      req,
      requestHandlers,
      schema,
      db
    );

    return context;
  }

  app.get("/init", async (req, res) => {
    const context = await createContext(req);

    const initData = await handler.getInit(context);
    res.json(initData);
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

    realtime.requestEveryoneToSync();
  });
}
