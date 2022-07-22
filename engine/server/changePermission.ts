import { DbSchema } from "../schema/schema";
import { unsafeAssertType } from "../utils/assert";
import { createJoins } from "./access/join";
import { EntityChange, pickChangePermission } from "./change";
import { SyncRequestContext } from "./context";

export async function getIsChangeAllowed<T, D>(
  context: SyncRequestContext,
  change: EntityChange<T, D>
): Promise<boolean> {
  const permission = pickChangePermission(change, context);

  if (!permission) {
    return false;
  }

  const joins = createJoins(
    change.entity as any as string,
    permission,
    context.schema
  );

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
