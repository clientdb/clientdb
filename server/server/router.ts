import { performMutation } from "@clientdb/server/api/mutation";
import { fetchSyncDelta } from "@clientdb/server/api/syncDelta";
import { Express, Request } from "express";
import { fetchInitialData } from "@clientdb/server/api/init";
import { SyncServerConfig } from "./config";
import { RealTimeManager } from "./realtime";
import { createRequestContext } from "./request";

interface RouterInput {
  app: Express;
  config: SyncServerConfig<any>;
  realtime: RealTimeManager;
}

export function attachSyncRouter({ app, config, realtime }: RouterInput) {
  async function createContext(req: Request) {
    const context = await createRequestContext(req, config);

    return context;
  }

  app.get("/init", async (req, res) => {
    const context = await createContext(req);

    const initData = await fetchInitialData(context);

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
