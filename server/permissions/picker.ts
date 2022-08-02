import { PermissionOperationType } from "@clientdb/server/permissions/types";

import { EntityChange } from "@clientdb/common/sync/change";
import { SyncRequestContext } from "@clientdb/server/context";
import { PermissionRuleModel, SchemaPermissionsModel } from "./model";

export function pickPermissionsRule<T extends PermissionOperationType>(
  permissions: SchemaPermissionsModel,
  entity: string,
  operation: T
): PermissionRuleModel<any> | null {
  const entityConfig = permissions[entity];

  const operationConfig = permissions[entity]?.[operation];

  if (!operationConfig) {
    return null;
  }

  if (operation === "remove") {
    return entityConfig["remove"] ?? null;
  }

  if (operation === "create") {
    return entityConfig["create"]?.rule ?? null;
  }

  if (operation === "update") {
    return entityConfig["update"]?.rule ?? null;
  }

  if (operation === "read") {
    return entityConfig["read"]?.rule ?? null;
  }

  throw new Error(`Unknown operation ${operation}`);
}

export function pickPermission<T extends PermissionOperationType>(
  permissions: SchemaPermissionsModel,
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
