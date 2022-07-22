import { DbSchema } from "../schema/schema";
import knex from "knex";
import { createSyncServer } from "../server";
import { ConditionalExcept, ConditionalPick, ConditionalKeys } from "type-fest";
import { SyncRequestContext } from "../server/context";

interface Collection<T> {
  $collection: T;
}

interface Reference<T> {
  $reference: T;
}

interface User {
  id: string;
  name: string;
  todos: Collection<Todo>;
  lists: Collection<List>;
}

interface List {
  id: string;
  is_private: boolean;
  name: string;
  user_id: string;
  todos: Collection<Todo>;
  user: Reference<User>;
}

interface Todo {
  done_at: string | null;
  id: string;
  list_id: string;
  name: string;
  user_id: string;
  list: Reference<List>;
  user: Reference<User>;
}

interface DataSchema {
  todo: Todo;
  list: List;
  user: User;
}

type EntityData<T> = ConditionalExcept<T, Collection<any> | Reference<any>>;
type EntityDataKeys<T> = keyof EntityData<T>;
type EntityRelations<T> = ConditionalPick<T, Collection<any> | Reference<any>>;

type RelationType<T> = T extends Collection<infer U>
  ? U
  : T extends Reference<infer U>
  ? U
  : never;

type Maybe<T> = T | null | undefined;

export type ContextValuePicker<T> = (ctx: SyncRequestContext) => Maybe<T>;

export type ValueInput<T> = T | ContextValuePicker<T>;

export type ValueCompareInput<T> =
  | ValueInput<T>
  | ValueCompareRule<ValueInput<T>>;

export type ValueCompareRule<T> = {
  $eq?: T;
  $ne?: T;
  $gt?: T;
  $gte?: T;
  $lt?: T;
  $lte?: T;
  $in?: T[];
  $notIn?: T[];
};

type DataWhere<T> = {
  [K in keyof T]?: ValueCompareInput<T[K]>;
};

type RelationsWhere<T> = {
  [K in keyof T]?: Where<RelationType<T[K]>>;
};

type Where<T> = DataWhere<EntityData<T>> & RelationsWhere<EntityRelations<T>>;

type EntityPermissionsConfig<T> = {
  read?: {
    check: Where<T>;
    fields?: Array<EntityDataKeys<T>>;
  };
  create?: {
    check: Where<T>;
    fields?: Array<EntityDataKeys<T>>;
  };
  update?: {
    check: Where<T>;
    fields?: Array<EntityDataKeys<T>>;
  };
  delete?: Where<T>;
};

const perm: EntityPermissionsConfig<Todo> = {
  create: {
    check: {
      user: {
        id: (ctx) => ctx.userId,
      },
    },
  },
};

export type SchemaPermissions<S> = {
  [K in keyof S]: EntityPermissionsConfig<S[K]>;
};
