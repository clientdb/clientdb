import { createWhereConditions } from "./access/where";
import { createJoins } from "./access/join";
import { createUserSelects } from "./access/userSelect";
import { pickPermissions } from "./change";
import { SyncRequestContext } from "./context";
import { createAccessQuery, createInitialLoadQuery } from "./access/query";

export interface EntityKindBootData<D = {}> {
  kind: string;
  items: D[];
}

export interface InitialLoadData {
  lastSyncId: number | null;
  data: EntityKindBootData<any>[];
}

async function fetchEntityIntialData(
  context: SyncRequestContext,
  entity: string
): Promise<EntityKindBootData<any>> {
  const query = createInitialLoadQuery(context, entity);

  if (!query) {
    return { kind: entity, items: [] };
  }

  const items = await query;
  const kind = entity;
  return { kind, items };
}

export async function fetchInitialData(
  context: SyncRequestContext
): Promise<InitialLoadData> {
  const { db, schema } = context;

  const bootDataPromises = schema.entities.map(async (entity) => {
    return await fetchEntityIntialData(context, entity.name);
  });

  const bootData = await Promise.all(bootDataPromises);

  return {
    lastSyncId: null,
    data: bootData,
  };
}
