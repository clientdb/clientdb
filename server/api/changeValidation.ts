import {
  EntityChange,
  getEntityChangeSchema,
} from "@clientdb/common/sync/change";
import { validateEntityData, validateEntityUpdateData } from "@clientdb/schema";
import { SyncRequestContext } from "@clientdb/server/context";

export async function getIsChangeDataValid<T, D>(
  context: SyncRequestContext,
  change: EntityChange<T, D>
): Promise<boolean> {
  const schema = getEntityChangeSchema(change, context);

  switch (change.type) {
    case "remove":
      return true;
    case "update": {
      const { data } = change;
      validateEntityUpdateData(data, schema);

      return true;
    }
    case "create": {
      validateEntityData(change.data, schema);
      return true;
    }
    default:
      return false;
  }
}
