import { SyncRequestContext } from "../context";
import { DeltaRow } from "../db/delta";

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
