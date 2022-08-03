import { SyncRequestContext } from "@clientdb/server/context";

import {
  EntitySchemaData,
  EntitySchemaDataKeys,
  EntitySchemaRelations,
  RelationSchemaType,
} from "@clientdb/schema";

export type ConditionGroupSegment = "and" | "or" | number;

type Maybe<T> = T | null | undefined;

export type ContextValuePointer<T> = (ctx: SyncRequestContext) => Maybe<T>;

export type ValuePointer<T> = T | ContextValuePointer<T>;

export type ValueRuleInput<T = unknown> = ValuePointer<T> | ValueRuleConfig<T>;

export type ValueRuleConfig<T> = {
  $eq?: ValuePointer<T>;
  $ne?: ValuePointer<T>;
  $gt?: ValuePointer<T>;
  $gte?: ValuePointer<T>;
  $lt?: ValuePointer<T>;
  $lte?: ValuePointer<T>;
  $in?: ValuePointer<T[]>;
  $notIn?: ValuePointer<T[]>;
  $isNull?: ValuePointer<boolean>;
};

export type DataRulesInput<EntitySchema> = {
  [K in keyof EntitySchema]?: ValueRuleInput<EntitySchema[K]>;
};

export type RelationRuleInput<RelationPointer> = PermissionRuleInput<
  RelationSchemaType<RelationPointer>
>;

export type RelationRulesInput<EntityRelations> = {
  [K in keyof EntityRelations]?: RelationRuleInput<EntityRelations[K]>;
};

export type EntityRulesInput<EntitySchema> = DataRulesInput<
  EntitySchemaData<EntitySchema>
> &
  RelationRulesInput<EntitySchemaRelations<EntitySchema>>;

export type PermissionRuleInput<EntitySchema = any> =
  EntityRulesInput<EntitySchema> & {
    $or?: PermissionRuleInput<EntitySchema>[];
    $and?: PermissionRuleInput<EntitySchema>[];
  };

export type EntityInputPreset<T> = {
  [K in keyof T]?: ValuePointer<T[K]>;
};

export type PermissionOperationType = "read" | "create" | "update" | "remove";

export type ReadPermission<T> = {
  rule: PermissionRuleInput<T>;
  fields?: Array<EntitySchemaDataKeys<T>>;
};

export type CreatePermissionInput<T> = {
  rule: PermissionRuleInput<T>;
  fields?: Array<EntitySchemaDataKeys<T>>;
  preset?: EntityInputPreset<T>;
};

export type UpdatePermissionInput<T> = {
  rule: PermissionRuleInput<T>;
  fields?: Array<EntitySchemaDataKeys<T>>;
};

export type RemovePermissionInput<T> = PermissionRuleInput<T>;

export type EntityPermissionsInput<T> = {
  read?: ReadPermission<T>;
  create?: CreatePermissionInput<T>;
  update?: UpdatePermissionInput<T>;
  remove?: RemovePermissionInput<T>;
};

export type SchemaPermissions<S = any> = {
  [K in keyof S]: EntityPermissionsInput<S[K]>;
};

/**
 * Utils
 */

export type SchemaWhere<S> = {
  [K in keyof S]: EntityRulesInput<S[K]>;
};

export type SchemaRules<S> = {
  [K in keyof S]: PermissionRuleInput<S[K]>;
};

export function currentUser(ctx: SyncRequestContext) {
  return ctx.userId;
}
