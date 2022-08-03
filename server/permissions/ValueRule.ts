import {
  EntitiesSchema,
  EntitiesSchemaModel,
  EntitySchema,
  SchemaEntityInput,
} from "@clientdb/schema";
import { Dictionary, filter, mapValues, pickBy } from "lodash";
import { isNotNullish } from "../utils/nullish";
import { PermissionRule } from "./PermissionRule";
import {
  DataRulesInput,
  PermissionRuleInput,
  RelationRulesInput,
  ValueRuleInput,
} from "./types";

interface ValueRuleConfig<T> {
  input: ValueRuleInput<T>;
  parentInfo: PermissionRuleParentInfo;
}

interface PermissionRuleParentInfo {
  parent: PermissionRule;
  field: string;
}

export class ValueRule<T> {
  readonly entity: EntitySchema;
  readonly schema: EntitiesSchema;
  readonly input: ValueRuleInput<T>;
  readonly parentRule: PermissionRule;
  readonly field: string;

  constructor(private config: ValueRuleConfig<T>) {
    const { input, parentInfo } = config;

    this.entity = parentInfo.parent.entity;
    this.input = input;
    this.schema = this.entity.schema;
    this.parentRule = parentInfo.parent;
    this.field = parentInfo.field;
  }

  get selector() {
    return `${this.parentRule.selector}.${this.field}`;
  }

  get conditionPath() {
    return this.parentRule.conditionPath;
  }
}
