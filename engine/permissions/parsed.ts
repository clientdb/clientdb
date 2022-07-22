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

export interface ValueRule<T> {
  type: "value";
  table: string;
  column: string;
  value: ValueCompareRule<T>;
}

export interface RelationRuleData<T> {
  table: string;
  referencedTable: string;
  checks: Rule[];
}

export interface SomeRule<T> extends RelationRuleData<T> {
  type: "some";
}

export interface EveryRule<T> extends RelationRuleData<T> {
  type: "every";
}

export interface NoneRule<T> extends RelationRuleData<T> {
  type: "none";
}

export type RelationRule<T> = SomeRule<T> | EveryRule<T> | NoneRule<T>;

export type FieldRule = ValueRule<unknown> | RelationRule<unknown>;

export interface ComplexRule {
  AND?: Rule[];
  OR?: Rule[];
  NOT?: Rule[];
}

export type Rule = FieldRule | ComplexRule;

export interface TablePermissions {
  type: "table-permissions";
  table: string;
  checks: Rule[];
}
