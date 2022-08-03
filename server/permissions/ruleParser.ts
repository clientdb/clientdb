import { EntitiesSchemaModel } from "@clientdb/schema";
import {
  DataRulesInput,
  PermissionRuleInput,
  RelationRuleInput,
  RelationRulesInput,
  ValueRuleInput,
} from "./types";

export function pickRelationPermissions<T = any>(
  rule: PermissionRuleInput<T>,
  entity: string,
  schema: EntitiesSchemaModel
): RelationRulesInput<T> {
  const relationPermissions: RelationRulesInput<T> = {};

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
  rule: PermissionRuleInput<T>,
  entity: string,
  schema: EntitiesSchemaModel
): DataRulesInput<T> {
  const dataPermissions: DataRulesInput<T> = {};

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
