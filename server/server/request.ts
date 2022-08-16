import { Request } from "express";
import { SyncRequestContext } from "@clientdb/server/context";
import { SyncServerConfig } from "./config";

export interface RequestDataHandlers {
  getUserId: (request: Request) => Promise<string | null>;
  getLastSyncId: (request: Request) => Promise<number | null>;
}

export async function createRequestContext(
  req: Request,
  config: SyncServerConfig<any>
): Promise<SyncRequestContext> {
  const userId = await config.requestHandlers.getUserId(req);
  const lastSyncId = await config.requestHandlers.getLastSyncId(req);

  return {
    userId,
    lastSyncId,
    schema: config.schema,
    db: config.db,
    config,
    permissions: config.permissions,
  };
}
