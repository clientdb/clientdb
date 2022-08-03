import { EntitiesSchema, EntitySchema } from "@clientdb/schema";
import { cloneDeep, Dictionary, mapValues, pickBy } from "lodash";
import { isNotNullish } from "../utils/nullish";
import { PermissionRuleInput } from "./types";
import { memoizeGetters } from "./utils";
import { ValueRule } from "./ValueRule";

interface PermissionRuleConfig {
  entity: EntitySchema;
  input: PermissionRuleInput;
  parentInfo: PermissionRuleParentInfo | null;
}

type LogicalConditionKind = "and" | "or";
type LogicalConditionSegment = LogicalConditionKind | number;

interface PermissionRuleParentInfo {
  parent: PermissionRule;
  schemaFieldInParent: string | null;
  conditionInParent: [LogicalConditionKind, number] | null;
}

interface PermissionRuleIteration {
  rule?: PermissionRule;
  value?: ValueRule<any>;
}

type PermissionRuleIterationCallback<R> = (
  iteration: PermissionRuleIteration
) => R;

interface PermissionFilters {
  branches?: (rule: PermissionRule) => boolean;
  values?: (rule: ValueRule<any>) => boolean;
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

    memoizeGetters(this, "dataRules", "relationRules");
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
    return (
      this.input.$or?.map((input, index) =>
        this.createChildRule({
          entity: this.entity,
          input,
          parentInfo: {
            parent: this,
            schemaFieldInParent: null,
            conditionInParent: ["or", index],
          },
        })
      ) ?? []
    );
  }

  get $and(): PermissionRule[] {
    return (
      this.input.$and?.map((input, index) =>
        this.createChildRule({
          entity: this.entity,
          input,
          parentInfo: {
            parent: this,
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

  get fieldInParent() {
    return this.parentInfo?.schemaFieldInParent ?? null;
  }

  get schemaPath(): string[] {
    if (!this.parentInfo) {
      return [this.entity.name];
    }

    const parentSchemaPath = this.parentInfo.parent.schemaPath;

    if (!this.parentInfo.schemaFieldInParent) {
      return parentSchemaPath;
    }

    return [...parentSchemaPath, this.parentInfo.schemaFieldInParent];
  }

  get selector() {
    return this.schemaPath.join("__");
  }

  get conditionPath(): LogicalConditionSegment[] {
    if (!this.parentInfo) {
      return [];
    }

    const parentConditionPath = this.parentInfo.parent.conditionPath;

    if (!this.parentInfo.conditionInParent) {
      return parentConditionPath;
    }

    return [...parentConditionPath, ...this.parentInfo.conditionInParent];
  }

  get dataRules(): Dictionary<ValueRule<any>> {
    const { $and, $or, ...fields } = this.input;

    const dataRules = mapValues(fields, (fieldInfo, key) => {
      const attribute = this.entity.getAttribute(key);

      if (!attribute) return;

      return new ValueRule({
        input: fieldInfo,
        parentInfo: { field: key, parent: this },
      });
    });

    return pickBy(dataRules, isNotNullish);
  }

  clone(filters?: PermissionFilters) {
    return new PermissionRule(
      {
        entity: this.entity,
        input: cloneDeep(this.input),
        parentInfo: this.parentInfo,
      },
      filters
    );
  }

  filter(filters: PermissionFilters) {
    return this.clone(filters);
  }

  getDataRule(field: string): ValueRule<any> | null {
    return this.dataRules[field] ?? null;
  }

  get relationRules(): Dictionary<PermissionRule> {
    const { $and, $or, ...fields } = this.input;

    const relationRules = mapValues(fields, (fieldInfo, key) => {
      const relation = this.entity.getRelation(key);

      if (!relation || !fieldInfo) return;

      return this.createChildRule({
        entity: this.schema.assertEntity(relation.target),
        input: fieldInfo,
        parentInfo: {
          schemaFieldInParent: key,
          conditionInParent: null,
          parent: this,
        },
      });
    });

    return pickBy(relationRules, isNotNullish);
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

  *[Symbol.iterator](): IterableIterator<PermissionRuleIteration> {
    const dataRules = this.dataRules;
    const relationRules = this.relationRules;

    const { branches: branchesFilter, values: valuesFilter } =
      this.filters ?? {};

    if (this.isRoot && branchesFilter && !branchesFilter(this)) {
      return;
    }

    yield { rule: this };

    for (const value of Object.values(dataRules)) {
      if (valuesFilter && !valuesFilter(value)) {
        continue;
      }

      yield { value };
    }

    for (const rule of Object.values(relationRules)) {
      yield* rule;
    }

    for (const orRule of this.$or) {
      if (branchesFilter && !branchesFilter(orRule)) {
        continue;
      }

      yield* orRule;
    }

    for (const andRule of this.$and) {
      yield* andRule;
    }
  }
}
