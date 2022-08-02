import { SyncRequestContext } from "@clientdb/server/context";
import { pickPermission } from "@clientdb/server/permissions/picker";
import { createBasePermissionMapQuery } from "./access";
import { applyEntityDataSelect } from "./select/entity";

export function createInitialLoadQuery<T>(
  context: SyncRequestContext,
  entity: string
) {
  const permission = pickPermission(context.permissions, entity, "read");

  if (!permission) return null;

  let query = createBasePermissionMapQuery(permission.rule, context);

  query = applyEntityDataSelect(query, entity, context, "read");

  query = query.groupBy(`${entity}.${context.schema.getIdField(entity)}`);

  return query;
}
