import { EntitySchema } from "@clientdb/schema";
import { SyncRequestContext } from "@clientdb/server/context";
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
  entity: EntitySchema
): Promise<EntityKindBootData<any>> {
  const readRule = context.permissions.getPermissionRule(entity.name, "read");

  if (!readRule) {
    return { kind: entity.name, items: [] };
  }

  const query = readRule
    .accessQuery()
    .applyRules(context)
    .selectAllData()
    .build(context);

  log.debug(`Fetching initial data for ${entity.name}`, query.toString());

  const initialItems = await query;
  return { kind: entity.name, items: initialItems };
}

export async function fetchInitialData(
  context: SyncRequestContext
): Promise<InitialLoadData> {
  const { schema } = context;

  const bootDataPromises = schema.entities.map(async (entity) => {
    return await fetchEntityIntialData(context, entity);
  });

  const bootData = await Promise.all(bootDataPromises);

  return {
    lastSyncId: null,
    data: bootData,
  };
}
