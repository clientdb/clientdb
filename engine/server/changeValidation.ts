import { DbSchema } from "../schema/schema";
import {
  validateEntityData,
  validateEntityUpdateData,
} from "../schema/validate";
import { EntityChange, getEntityChangeSchema } from "./change";
import { SyncRequestContext } from "./context";

export async function getIsChangeDataValid(
  context: SyncRequestContext,
  change: EntityChange
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
