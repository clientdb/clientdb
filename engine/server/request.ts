import { DbSchema } from "../schema/schema";
import { SyncRequestContext } from "./context";

export interface RequestDataHandlers {
  getUserId: (request: Request) => string | null;
  getLastSyncId: (request: Request) => number | null;
}

export function createRequestContext(
  req: Request,
  config: RequestDataHandlers,
  schema: DbSchema,
  connector: any
): SyncRequestContext {
  const userId = config.getUserId(req);
  const lastSyncId = config.getLastSyncId(req);

  return {
    userId,
    lastSyncId,
    schema,
    connector,
  };
}
