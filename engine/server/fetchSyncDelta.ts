import { SyncRequestContext } from "./context";

type EntityRemoveRequest = {
  type: "remove";
  entity: string;
  id: string;
};

type EntityUpdateRequest = {
  type: "update";
  entity: string;
  id: string;
  data: object;
};

type EntityCreateRequest = {
  type: "create";
  entity: string;
  data: object;
};

export type EntityDelta =
  | EntityRemoveRequest
  | EntityUpdateRequest
  | EntityCreateRequest;

export async function fetchSyncDelta(
  context: SyncRequestContext
): Promise<EntityDelta[]> {
  const { db, schema, lastSyncId } = context;

  const syncRequests = await db
    .table("sync")
    .select("*")
    .where("id", ">", lastSyncId)
    .andWhere("user_id", "=", context.userId);

  return syncRequests;
}
