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
  const { connector, schema, lastSyncId } = context;

  const deltaPromises = schema.entities.map(async (entity) => {
    const kind = entity.name;
    const items = await connector.fetchDelta(kind, context);
    return items;
  });

  const delta = await Promise.all(deltaPromises);

  return delta;
}
