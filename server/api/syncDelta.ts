import { SyncRequestContext } from "@clientdb/server/context";
import { DeltaRow } from "@clientdb/server/db/delta";

export async function fetchSyncDelta(
  context: SyncRequestContext
): Promise<DeltaRow[]> {
  const { db, schema, lastSyncId, userId } = context;

  const syncRequests = await db
    .table<DeltaRow>("sync")
    .select("*")
    .where("id", ">", lastSyncId)
    .andWhere("user_id", "=", context.userId);

  return syncRequests;
}
