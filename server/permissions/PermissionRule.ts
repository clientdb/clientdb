import { EntitiesSchema, EntitySchema } from "@clientdb/schema";
import {
  cloneDeep,
  Dictionary,
  map,
  mapValues,
  pickBy,
  toPlainObject,
} from "lodash";
import { SyncServerConfig } from "../server/config";
import { isNotNullish } from "../utils/nullish";
import { AccessQueryBuilder } from "./AccessQueryBuilder";
import { DeltaQueryBuilder } from "./DeltaQueryBuilder";
import {
  PermissionOperationType,
  PermissionRuleInput,
  ValueRuleConfig,
  ValueRuleInput,
} from "./input";
import { PermissionQueryBuilder } from "./PermissionQueryBuilder";
import { PermissionsRoot } from "./PermissionsRoot";
import { memoizeGetters } from "./utils";
import { ValueRule } from "./ValueRule";

interface PermissionRuleConfig {
  entity: EntitySchema;
  input: PermissionRuleInput;
  parentInfo: PermissionRuleParentInfo | null;
  schema: EntitiesSchema;
  permissions: PermissionsRoot<any>;
}

type LogicalConditionKind = "and" | "or";
type LogicalConditionSegment = LogicalConditionKind | number;

interface PermissionRuleParentInfo {
  rule: PermissionRule;
  schemaFieldInParent: string | null;
  conditionInParent: [LogicalConditionKind, number] | null;
}

export interface PermissionRuleItem {
  rule?: PermissionRule;
  value?: ValueRule<any>;
}

type PermissionRuleIterationCallback<R> = (iteration: PermissionRuleItem) => R;

interface PermissionFilters {
  branches?: (rule: PermissionRule) => boolean;
  values?: (rule: ValueRule<any>) => boolean;
}

export interface PermissionJoinInfo {
  selector: string;
  table: string;
  on: {
    left: string;
    right: string;
  };
}

export class PermissionRule {
  readonly entity: EntitySchema;
  readonly schema: EntitiesSchema;
  readonly input: PermissionRuleInput;
  readonly parentInfo: PermissionRuleParentInfo | null;

  constructor(
    private config: PermissionRuleConfig,
    private filters?: PermissionFilters
  ) {
    const { entity, input, parentInfo } = config;

    this.entity = entity;
    this.input = input;
    this.parentInfo = parentInfo;
    this.schema = this.entity.schema;

    memoizeGetters(
      this,
      "dataRules",
      "relationRules",
      "$and",
      "$or",
      "schemaPath",
      "conditionPath"
    );
  }

  query() {
    return new PermissionQueryBuilder(this);
  }

  accessQuery() {
    return new AccessQueryBuilder(this);
  }

  deltaQuery() {
    return new DeltaQueryBuilder(this);
  }

  get raw(): PermissionRuleInput<any> {
    const { $and, $or, dataRules, relationRules } = this;

    const input: PermissionRuleInput<any> = {};

    for (const dataRule of dataRules) {
      input[dataRule.field] = dataRule.input;
    }

    for (const relationRule of relationRules) {
      input[relationRule.fieldInParent!] = relationRule.raw;
    }

    const andInput = $and.map((rule) => rule.raw);
    const orInput = $or.map((rule) => rule.raw);

    if (andInput.length > 0) {
      input.$and = andInput;
    }

    if (orInput.length > 0) {
      input.$or = orInput;
    }

    return input;
  }

  get db() {
    return this.schema.db;
  }

  get permissions() {
    return this.config.permissions.getPermissions(this.entity.name);
  }

  get entityName() {
    return this.entity.name;
  }

  get idField() {
    return this.entity.idField;
  }

  get isEmpty() {
    if (this.dataRules.length) return false;
    if (this.relationRules.some((relation) => !relation.isEmpty)) return false;
    if (this.$and.some((rule) => !rule.isEmpty)) return false;
    if (this.$or.some((rule) => !rule.isEmpty)) return false;

    return true;
  }

  mapValues(
    callback: (rule: ValueRule<any>) => ValueRuleConfig<any> | void
  ): PermissionRule {
    const newValuesConfigs: Dictionary<ValueRuleConfig<any>> = {};

    // TODO optimize
    this.dataRules.forEach((rule) => {
      const field = rule.field;
      const result = callback(rule);

      if (!result) {
        newValuesConfigs[field] = rule.valueConfig;
      } else {
        newValuesConfigs[field] = result;
      }
    });

    const $or = this.$or.map((orRule) => orRule.mapValues(callback).raw);
    const $and = this.$and.map((andRule) => andRule.mapValues(callback).raw);

    return new PermissionRule({
      ...this.config,
      input: {
        ...this.raw,
        ...newValuesConfigs,
        $and,
        $or,
      },
    });
  }

  private createChildRule(config: PermissionRuleConfig) {
    const { parentInfo } = config;
    if (!parentInfo) {
      throw new Error("Parent info is required");
    }

    if (!parentInfo.conditionInParent && !parentInfo.schemaFieldInParent) {
      throw new Error("Child rule needs either condition or schema position");
    }

    return new PermissionRule(config, this.filters);
  }

  get $or(): PermissionRule[] {
    if (!this.input.$or) return [];

    const { branches } = this.filters ?? {};

    const orRules = this.input.$or.map((input, index) => {
      return this.createChildRule({
        ...this.config,
        input,
        parentInfo: {
          rule: this,
          schemaFieldInParent: null,
          conditionInParent: ["or", index],
        },
      });
    });

    if (branches) {
      return orRules.filter((rule) => branches(rule));
    }

    return orRules;
  }

  get $and(): PermissionRule[] {
    return (
      this.input.$and?.map((input, index) =>
        this.createChildRule({
          ...this.config,
          input,
          parentInfo: {
            rule: this,
            schemaFieldInParent: null,
            conditionInParent: ["and", index],
          },
        })
      ) ?? []
    );
  }

  get isRoot() {
    return !this.parentInfo;
  }

  get root(): PermissionRule {
    if (!this.parentInfo) return this;

    let parent: PermissionRule = this.parentInfo.rule;

    while (parent) {
      if (parent.isRoot) {
        return parent;
      }

      parent = parent.parentRule!;
    }

    throw new Error("Root rule not found");
  }

  get fieldInParent() {
    let parent = this.parentInfo;

    while (parent) {
      if (parent.schemaFieldInParent) {
        return parent.schemaFieldInParent;
      }

      parent = parent.rule.parentInfo;
    }

    return null;
  }

  get schemaPath(): string[] {
    if (!this.parentInfo) {
      return [this.entity.name];
    }

    const parentSchemaPath = this.parentInfo.rule.schemaPath;

    if (!this.parentInfo.schemaFieldInParent) {
      return parentSchemaPath;
    }

    return [...parentSchemaPath, this.parentInfo.schemaFieldInParent];
  }

  get relationWithParent() {
    if (!this.parentInfo) return null;

    const parentEntity = this.parentInfo.rule.entity;
    const fieldInParent = this.fieldInParent;

    if (!fieldInParent) return null;

    return parentEntity.getRelation(fieldInParent);
  }

  get parentRule(): PermissionRule | null {
    return this.parentInfo?.rule ?? null;
  }

  get referencedBySelector() {
    if (!this.parentInfo) {
      return null;
    }

    const parentRule = this.parentInfo.rule;

    const parentEntity = parentRule.entity;
    const fieldInParent = this.fieldInParent;

    if (!fieldInParent) return null;

    const relation = parentEntity.getRelation(fieldInParent);

    if (!relation) return null;

    return `${parentRule.selector}.${relation.field}`;
  }

  get joinInfo(): PermissionJoinInfo | null {
    const { relationWithParent, parentRule } = this;

    if (!relationWithParent || !parentRule) return null;

    // Parent is referencing this rule
    if (relationWithParent.type === "reference") {
      return {
        selector: this.selector,
        table: this.entityName,
        on: {
          left: `${parentRule.selector}.${relationWithParent.field}`,
          right: `${this.selector}.${this.idField}`,
        },
      };
    }

    // This rule is referencing parent
    return {
      selector: this.selector,
      table: this.entityName,
      on: {
        left: `${parentRule.selector}.${parentRule.idField}`,
        right: `${this.selector}.${relationWithParent.field}`,
      },
    };
  }

  get selector() {
    return this.schemaPath.join("__");
  }

  get idSelector() {
    return `${this.selector}.${this.entity.idField}`;
  }

  get conditionPath(): LogicalConditionSegment[] {
    if (!this.parentInfo) {
      return [];
    }

    const parentConditionPath = this.parentInfo.rule.conditionPath;

    if (!this.parentInfo.conditionInParent) {
      return parentConditionPath;
    }

    return [...parentConditionPath, ...this.parentInfo.conditionInParent];
  }

  get dataRules(): Array<ValueRule<any>> {
    const { $and, $or, ...fields } = this.input;

    const dataRules = map(fields, (fieldInfo, key) => {
      const attribute = this.entity.getAttribute(key);

      if (!attribute) return;

      return new ValueRule({
        input: fieldInfo,
        parentInfo: { field: key, parent: this },
        schema: this.schema,
      });
    }).filter(isNotNullish);

    return dataRules;
  }

  clone(filters?: PermissionFilters) {
    return new PermissionRule(
      {
        ...this.config,
        input: cloneDeep(this.input),
      },
      filters
    );
  }

  filter(filters: PermissionFilters) {
    return this.clone(filters);
  }

  getDataRule(field: string): ValueRule<any> | null {
    return this.dataRules.find((rule) => rule.field === field) ?? null;
  }

  get relationRules(): Array<PermissionRule> {
    const { $and, $or, ...fields } = this.input;

    const relationRules = map(fields, (fieldInfo, key) => {
      const relation = this.entity.getRelation(key);

      if (!relation || !fieldInfo) return;

      return this.createChildRule({
        ...this.config,
        entity: this.schema.assertEntity(relation.target),
        input: fieldInfo,
        parentInfo: {
          schemaFieldInParent: key,
          conditionInParent: null,
          rule: this,
        },
      });
    }).filter(isNotNullish);

    return relationRules;
  }

  collect<T>(picker: PermissionRuleIterationCallback<T | undefined>): T[] {
    const results: T[] = [];
    for (const iteration of this) {
      const result = picker(iteration);

      if (result === undefined) continue;

      results.push(result);
    }

    return results;
  }

  has(checker: PermissionRuleIterationCallback<boolean | undefined>) {
    for (const iteration of this) {
      if (checker(iteration)) {
        return true;
      }
    }

    return false;
  }

  getDoesDependOn(entity: string) {
    return this.has(({ rule, value }) => {
      if (rule && rule.entity.name === entity) {
        return true;
      }

      if (value && value.entity.name === entity) {
        return true;
      }
    });
  }

  *iterateRules(): IterableIterator<PermissionRule> {
    for (const { rule } of this[Symbol.iterator]()) {
      if (rule) {
        yield rule;
      }
    }
  }

  *iterateValues(): IterableIterator<ValueRule<any>> {
    for (const { value } of this[Symbol.iterator]()) {
      if (value) {
        yield value;
      }
    }
  }

  *[Symbol.iterator](): IterableIterator<PermissionRuleItem> {
    if (this.isRoot) {
      yield { rule: this };
    }

    const { dataRules, relationRules, $or, $and } = this;

    for (const dataRule of dataRules) {
      yield { value: dataRule };
    }

    for (const relationRule of relationRules) {
      yield { rule: relationRule };
      yield* relationRule;
    }

    for (const orRule of $or) {
      yield* orRule;
    }

    for (const andRule of $and) {
      yield* andRule;
    }
  }
}
