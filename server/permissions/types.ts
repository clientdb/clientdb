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

export type ValueRule<T> = ValuePointer<T> | ValueRuleConfig<T>;

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

export type DataRules<EntitySchema> = {
  [K in keyof EntitySchema]?: ValueRule<EntitySchema[K]>;
};

export type RelationRule<RelationPointer> = PermissionRule<
  RelationSchemaType<RelationPointer>
>;

export type RelationRules<EntityRelations> = {
  [K in keyof EntityRelations]?: RelationRule<EntityRelations[K]>;
};

export type EntityRules<EntitySchema> = DataRules<
  EntitySchemaData<EntitySchema>
> &
  RelationRules<EntitySchemaRelations<EntitySchema>>;

export type PermissionRule<EntitySchema = any> = EntityRules<EntitySchema> & {
  $or?: PermissionRule<EntitySchema>[];
  $and?: PermissionRule<EntitySchema>[];
};

export type EntityInputPreset<T> = {
  [K in keyof T]?: ValuePointer<T[K]>;
};

export type PermissionOperationType = "read" | "create" | "update" | "remove";

export type ReadPermission<T> = {
  rule: PermissionRule<T>;
  fields?: Array<EntitySchemaDataKeys<T>>;
};

export type CreatePermission<T> = {
  rule: PermissionRule<T>;
  fields?: Array<EntitySchemaDataKeys<T>>;
  preset?: EntityInputPreset<T>;
};

export type UpdatePermission<T> = {
  rule: PermissionRule<T>;
  fields?: Array<EntitySchemaDataKeys<T>>;
};

export type RemovePermission<T> = PermissionRule<T>;

export type EntityPermissionsConfig<T> = {
  read?: ReadPermission<T>;
  create?: CreatePermission<T>;
  update?: UpdatePermission<T>;
  remove?: RemovePermission<T>;
};

export type SchemaPermissions<S = any> = {
  [K in keyof S]: EntityPermissionsConfig<S[K]>;
};

/**
 * Utils
 */

export type SchemaWhere<S> = {
  [K in keyof S]: EntityRules<S[K]>;
};

export type SchemaRules<S> = {
  [K in keyof S]: PermissionRule<S[K]>;
};

export function currentUser(ctx: SyncRequestContext) {
  return ctx.userId;
}
