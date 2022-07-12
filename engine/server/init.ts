import { SyncRequestContext } from "./context";

export interface EntityKindBootData<D = {}> {
  kind: string;
  items: D[];
}

export async function fetchInitialData(
  context: SyncRequestContext
): Promise<EntityKindBootData<any>[]> {
  const { db, schema } = context;

  const bootDataPromises = schema.entities.map(async (entity) => {
    const items = await db.table(entity.name).select("*");
    const kind = entity.name;
    return { kind, items };
  });

  const bootData = await Promise.all(bootDataPromises);

  return bootData;
}
