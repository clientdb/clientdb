import {
  PermissionOperationType,
  SchemaPermissions,
} from "@clientdb/server/permissions/types";

import { EntityChange } from "@clientdb/common/sync/change";
import { SyncRequestContext } from "@clientdb/server/context";

export function pickPermissionsRule<T extends PermissionOperationType>(
  permissions: SchemaPermissions,
  entity: string,
  operation: T
) {
  const operationConfig = permissions[entity]?.[operation];

  if (!operationConfig) {
    return null;
  }

  if (operation === "remove") {
    return operationConfig ?? null;
  }

  return operationConfig.rule ?? null;
}

export function pickPermission<T extends PermissionOperationType>(
  permissions: SchemaPermissions,
  entity: string,
  operation: T
) {
  return permissions[entity]?.[operation] ?? null;
}

export function pickChangePermission<T, D>(
  change: EntityChange<T, D>,
  context: SyncRequestContext
) {
  const { entity, type } = change;

  return pickPermissionsRule(
    context.permissions,
    entity as any as string,
    type
  );
}
