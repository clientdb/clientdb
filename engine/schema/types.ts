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
};

export type DataPermissions<T> = {
  [K in keyof T]?: WhereValue<T[K]>;
};

export type RelationPermission<T> = WherePermission<RelationSchemaType<T>>;

export type RelationsPermissions<T> = {
  [K in keyof T]?: RelationPermission<T[K]>;
};

export type WhereRule<T> = DataPermissions<EntitySchemaData<T>> &
  RelationsPermissions<EntitySchemaRelations<T>>;

export type WherePermission<T> = WhereRule<T> & {
  $or?: WherePermission<T>[];
  $and?: WherePermission<T>[];
};

export type DefaultInput<T> = {
  [K in keyof T]?: ValuePointer<T[K]>;
};

export type PermissionOperationType = "read" | "create" | "update" | "remove";

export type EntityPermissionsConfig<T> = {
  read?: {
    check: WherePermission<T>;
    fields?: Array<EntitySchemaDataKeys<T>>;
  };
  create?: {
    check?: WherePermission<T>;
    fields?: Array<EntitySchemaDataKeys<T>>;
    preset?: DefaultInput<T>;
  };
  update?: {
    check: WherePermission<T>;
    fields?: Array<EntitySchemaDataKeys<T>>;
  };
  remove?: WherePermission<T>;
};

export type SchemaPermissions<S> = {
  [K in keyof S]: EntityPermissionsConfig<S[K]>;
};

export type SchemaWhere<S> = {
  [K in keyof S]: WhereRule<S[K]>;
};

export function currentUser(ctx: SyncRequestContext) {
  return ctx.userId;
}
