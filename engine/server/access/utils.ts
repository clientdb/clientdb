import { DbSchemaModel } from "../../schema/model";
import {
  DataPermissions,
  RelationsPermissions,
  WhereRule,
  WherePermission,
  WhereValue,
  RelationPermission,
} from "../../schema/types";

export function pickRelationPermissions<T>(
  rule: WhereRule<T>,
  entity: string,
  schema: DbSchemaModel
): RelationsPermissions<T> {
  const relationPermissions: RelationsPermissions<T> = {};

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
  rule: WhereRule<T>,
  entity: string,
  schema: DbSchemaModel
): DataPermissions<T> {
  const dataPermissions: DataPermissions<T> = {};

  for (const [field, fieldSpec] of Object.entries(rule)) {
    const relation = schema.getRelation(entity, field);

    if (relation) {
      continue;
    }

    dataPermissions[field as keyof T] = fieldSpec as any;
  }

  return dataPermissions;
}

export function parseWherePermission<T>(permission: WherePermission<T>) {
  const { $and, $or, ...rule } = permission;

  return {
    rule: rule as WhereRule<T>,
    $and,
    $or,
  };
}

export function parseWhereRule<T>(
  rule: WhereRule<T>,
  entity: string,
  schema: DbSchemaModel
) {
  const dataPermissions = pickDataPermissions(rule, entity, schema);
  const relationPermissions = pickRelationPermissions(rule, entity, schema);

  const dataEntires = Object.entries(dataPermissions) as Array<
    [keyof T, WhereValue<T[keyof T]>]
  >;

  const relationEntires = Object.entries(relationPermissions) as Array<
    [keyof T, RelationPermission<T[keyof T]>]
  >;

  return {
    dataEntires,
    relationEntires,
  };
}
