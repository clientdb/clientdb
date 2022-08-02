import { ConditionalExcept, ConditionalPick } from "type-fest";

export interface SchemaCollection<T> {
  $collection: T;
}

export interface SchemaReference<T> {
  $reference: T;
}

export type EntitySchemaData<T = unknown> = ConditionalExcept<
  T,
  SchemaCollection<unknown> | SchemaReference<unknown>
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
