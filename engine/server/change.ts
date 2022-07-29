import { PermissionOperationType, SchemaPermissions } from "../schema/types";
import { unsafeAssertType } from "../utils/assert";
import { SyncRequestContext } from "./context";

export type EntityRemoveChange<T> = {
  type: "remove";
  entity: T;
  id: string;
};

export type EntityUpdateChange<T, D> = {
  type: "update";
  entity: T;
  id: string;
  data: Partial<D>;
};

export type EntityCreateChange<T, D> = {
  type: "create";
  entity: T;
  data: Partial<D>;
};

export type EntityChange<T, D> =
  | EntityRemoveChange<T>
  | EntityUpdateChange<T, D>
  | EntityCreateChange<T, D>;

export function getEntityChangeSchema<T, D>(
  change: EntityChange<T, D>,
  context: SyncRequestContext
) {
  const { entity } = change;

  const schema = context.schema.getEntity(entity as any as string);

  if (!schema) {
    throw new Error(`No schema found for entity ${entity}`);
  }

  return schema;
}

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
