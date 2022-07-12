import { DbSchema } from "../schema/schema";
import { SyncRequestContext } from "./context";
import { Knex } from "knex";
import { Request } from "express";

export interface RequestDataHandlers {
  getUserId: (request: Request) => Promise<string | null>;
  getLastSyncId: (request: Request) => Promise<number | null>;
}

export async function createRequestContext(
  req: Request,
  config: RequestDataHandlers,
  schema: DbSchema,
  db: Knex
): Promise<SyncRequestContext> {
  const userId = await config.getUserId(req);
  const lastSyncId = await config.getLastSyncId(req);

  return {
    userId,
    lastSyncId,
    schema,
    db,
  };
}
