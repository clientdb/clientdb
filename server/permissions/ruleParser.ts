import { DbSchemaModel } from "@clientdb/schema";
import {
  DataRules,
  PermissionRule,
  EntityRules,
  RelationRule,
  RelationRules,
  ValueRule,
} from "./types";

export function pickRelationPermissions<T = any>(
  rule: PermissionRule<T>,
  entity: string,
  schema: DbSchemaModel
): RelationRules<T> {
  const relationPermissions: RelationRules<T> = {};

  for (const [field, fieldSpec] of Object.entries(rule)) {
    const relation = schema.getRelation(entity, field);

    if (!relation) {
      continue;
    }

    relationPermissions[field as keyof T] = fieldSpec as any;
  }

  return relationPermissions;
}

export function pickDataPermissions<T = any>(
  rule: PermissionRule<T>,
  entity: string,
  schema: DbSchemaModel
): DataRules<T> {
  const dataPermissions: DataRules<T> = {};

  for (const [field, fieldSpec] of Object.entries(rule)) {
    const relation = schema.getRelation(entity, field);

    if (relation) {
      continue;
    }

    const attribute = schema.getAttribute(entity, field);

    if (!attribute) {
      continue;
    }

    dataPermissions[field as keyof T] = fieldSpec as any;
  }

  return dataPermissions;
}

export function parseRule<T = any>(
  rule: PermissionRule<T>,
  entity: string,
  schema: DbSchemaModel
) {
  const { $and, $or } = rule;
  const dataPermissions = pickDataPermissions(rule, entity, schema);
  const relationPermissions = pickRelationPermissions(rule, entity, schema);

  const dataEntires = Object.entries(dataPermissions) as Array<
    [keyof T, ValueRule<T[keyof T]>]
  >;

  const relationEntires = Object.entries(relationPermissions) as Array<
    [keyof T, RelationRule<T[keyof T]>]
  >;

  return {
    dataEntires,
    relationEntires,
    $and,
    $or,
  };
}
