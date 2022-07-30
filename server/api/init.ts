import { SyncRequestContext } from "@clientdb/server/context";
import { createInitialLoadQuery } from "@clientdb/server/query/init";
import { createLogger } from "@clientdb/server/utils/logger";

export interface EntityKindBootData<D = {}> {
  kind: string;
  items: D[];
}

export interface InitialLoadData {
  lastSyncId: number | null;
  data: EntityKindBootData<any>[];
}

const log = createLogger("Init Load", false);

async function fetchEntityIntialData(
  context: SyncRequestContext,
  entity: string
): Promise<EntityKindBootData<any>> {
  const query = createInitialLoadQuery(context, entity);

  if (!query) {
    return { kind: entity, items: [] };
  }

  log(`Fetching initial data for ${entity}`, query.toString());

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
