import { ConditionalExcept, ConditionalPick } from "type-fest";
import { SyncRequestContext } from "../server/context";

export interface SchemaCollection<T> {
  $collection: T;
}

export interface SchemaReference<T> {
  $reference: T;
}

export type EntitySchemaData<T> = ConditionalExcept<
  T,
  SchemaCollection<any> | SchemaReference<any>
>;
export type EntitySchemaInput<T> = Partial<EntitySchemaData<T>>;
export type EntitySchemaDataKeys<T> = keyof EntitySchemaData<T>;
export type EntitySchemaRelations<T> = ConditionalPick<
  T,
  SchemaCollection<any> | SchemaReference<any>
>;

export type RelationSchemaType<T> = T extends SchemaCollection<infer U>
  ? U
  : T extends SchemaReference<infer U>
  ? U
  : never;

type Maybe<T> = T | null | undefined;

export type ContextValuePointer<T> = (ctx: SyncRequestContext) => Maybe<T>;

export type ValuePointer<T> = T | ContextValuePointer<T>;

export type WhereValue<T> = ValuePointer<T> | WhereValueConfig<T>;

export type WhereValueConfig<T> = {
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

export type DataSelector<T> = {
  [K in keyof T]?: WhereValue<T[K]>;
};

export type RelationRule<T> = PermissionRule<RelationSchemaType<T>>;

export type RelationsSelector<T> = {
  [K in keyof T]?: RelationRule<T[K]>;
};

export type PermissionSelector<T> = DataSelector<EntitySchemaData<T>> &
  RelationsSelector<EntitySchemaRelations<T>>;

export type PermissionRule<T = any> = PermissionSelector<T> & {
  $or?: PermissionRule<T>[];
  $and?: PermissionRule<T>[];
};

export type DefaultInput<T> = {
  [K in keyof T]?: ValuePointer<T[K]>;
};

export type PermissionOperationType = "read" | "create" | "update" | "remove";

export type EntityReadPermissionConfig<T> = {
  rule: PermissionRule<T>;
  fields?: Array<EntitySchemaDataKeys<T>>;
};

export type EntityCreatePermissionConfig<T> = {
  rule: PermissionRule<T>;
  fields?: Array<EntitySchemaDataKeys<T>>;
  preset?: DefaultInput<T>;
};

export type EntityUpdatePermissionConfig<T> = {
  rule: PermissionRule<T>;
  fields?: Array<EntitySchemaDataKeys<T>>;
};

export type EntityRemovePermissionConfig<T> = PermissionRule<T>;

export type EntityPermissionsConfig<T> = {
  read?: EntityReadPermissionConfig<T>;
  create?: EntityCreatePermissionConfig<T>;
  update?: EntityUpdatePermissionConfig<T>;
  remove?: EntityRemovePermissionConfig<T>;
};

export type SchemaPermissions<S> = {
  [K in keyof S]: EntityPermissionsConfig<S[K]>;
};

export type SchemaWhere<S> = {
  [K in keyof S]: PermissionSelector<S[K]>;
};

export type SchemaRules<S> = {
  [K in keyof S]: PermissionRule<S[K]>;
};

export function currentUser(ctx: SyncRequestContext) {
  return ctx.userId;
}
