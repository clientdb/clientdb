import { SyncRequestContext } from "./context";

export interface EntityKindBootData<D = {}> {
  kind: string;
  items: D[];
}

export async function fetchBootData(
  context: SyncRequestContext
): Promise<EntityKindBootData<any>[]> {
  const { connector, schema } = context;

  const bootDataPromises = schema.entities.map(async (entity) => {
    const kind = entity.name;
    const items = await connector.fetchBootData(kind, context);
    return { kind, items };
  });

  const bootData = await Promise.all(bootDataPromises);

  return bootData;
}
