import { DbSchemaModel } from "../../schema/model";
import {
  DataSelector,
  RelationsSelector,
  PermissionSelector,
  PermissionRule,
  WhereValue,
  RelationRule,
} from "../../schema/types";

export function pickRelationPermissions<T>(
  rule: PermissionSelector<T>,
  entity: string,
  schema: DbSchemaModel
): RelationsSelector<T> {
  const relationPermissions: RelationsSelector<T> = {};

  for (const [field, fieldSpec] of Object.entries(rule)) {
    const relation = schema.getRelation(entity, field);

    if (!relation) {
      continue;
    }

    relationPermissions[field as keyof T] = fieldSpec as any;
  }

  return relationPermissions;
}

export function pickDataPermissions<T>(
  rule: PermissionSelector<T>,
  entity: string,
  schema: DbSchemaModel
): DataSelector<T> {
  const dataPermissions: DataSelector<T> = {};

  for (const [field, fieldSpec] of Object.entries(rule)) {
    const relation = schema.getRelation(entity, field);

    if (relation) {
      continue;
    }

    const attribute = schema.getAttribute(entity, field);

    if (!attribute) {
      throw new Error(
        `No relation not attribute for entity ${entity} field ${field}`
      );
    }

    dataPermissions[field as keyof T] = fieldSpec as any;
  }

  return dataPermissions;
}

export function parseWherePermission<T>(permission: PermissionRule<T>) {
  const { $and, $or, ...rule } = permission;

  return {
    rule: rule as PermissionSelector<T>,
    $and,
    $or,
  };
}

export function parseWhereRule<T>(
  rule: PermissionSelector<T>,
  entity: string,
  schema: DbSchemaModel
) {
  const dataPermissions = pickDataPermissions(rule, entity, schema);
  const relationPermissions = pickRelationPermissions(rule, entity, schema);

  const dataEntires = Object.entries(dataPermissions) as Array<
    [keyof T, WhereValue<T[keyof T]>]
  >;

  const relationEntires = Object.entries(relationPermissions) as Array<
    [keyof T, RelationRule<T[keyof T]>]
  >;

  return {
    dataEntires,
    relationEntires,
  };
}

export function iterateWithPrevious<T>(items: T[]) {
  const entries = items.map((item, index) => {
    return [item, items[index - 1] ?? null] as [T, T | null];
  });

  return entries;
}

export function insertAtIndexIfDoesntExist<T>(
  items: T[],
  index: number,
  getter: () => T
) {
  if (items[index] !== undefined) return items[index]!;

  if (items.length <= index - 1) {
    items.length = index - 1;
  }

  const item = getter();

  items[index] = item;

  return item;
}
