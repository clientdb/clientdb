import { DbSchema } from "../schema/schema";
import { EntityChange } from "./change";
import { SyncRequestContext } from "./context";

export async function getIsChangeAllowed(
  context: SyncRequestContext,
  change: EntityChange
): Promise<boolean> {
  // TODO: Implement permission check
  switch (change.type) {
    case "remove":
      return true;
    case "update":
      return true;
    case "create":
      return true;
    default:
      return false;
  }
}
