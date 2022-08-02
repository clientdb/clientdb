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

const log = createLogger("Init Load");

async function fetchEntityIntialData(
  context: SyncRequestContext,
  entity: string
): Promise<EntityKindBootData<any>> {
  const initQuery = createInitialLoadQuery(context, entity);

  if (!initQuery) {
    console.warn("no init query");
    return { kind: entity, items: [] };
  }

  log.debug(`Fetching initial data for ${entity}`, initQuery.toString());

  const initialItems = await initQuery;
  return { kind: entity, items: initialItems };
}

export async function fetchInitialData(
  context: SyncRequestContext
): Promise<InitialLoadData> {
  const { schema } = context;

  const bootDataPromises = schema.entities.map(async (entity) => {
    return await fetchEntityIntialData(context, entity.name);
  });

  const bootData = await Promise.all(bootDataPromises);

  return {
    lastSyncId: null,
    data: bootData,
  };
}
