import { EntitiesSchema, EntitySchema } from "@clientdb/schema";
import { mapValues, some } from "lodash";
import { SyncRequestContext } from "../context";
import { QueryBuilder } from "../query/types";
import { SyncServerConfig } from "../server/config";
import { unsafeAssertType } from "../utils/assert";
import { PermissionRule } from "./PermissionRule";
import {
  ContextValuePointer,
  ValuePointer,
  ValueRuleConfig,
  ValueRuleInput,
} from "./input";
import { isPrimitive } from "./utils";

interface ValueRuleOptions<T> {
  input: ValueRuleInput<T>;
  parentInfo: PermissionRuleParentInfo;
  schema: EntitiesSchema;
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

  constructor(private options: ValueRuleOptions<T>) {
    const { input, parentInfo } = options;

    this.entity = parentInfo.parent.entity;
    this.input = input;
    this.schema = this.entity.schema;
    this.parentRule = parentInfo.parent;
    this.field = parentInfo.field;
  }

  get db() {
    return this.parentRule.db;
  }

  get selector() {
    return `${this.parentRule.selector}.${this.field}`;
  }

  get conditionPath() {
    return this.parentRule.conditionPath;
  }

  private get userTable() {
    return this.options.schema.userTableName;
  }

  get referencedEntity() {
    return this.entity.getReferencedEntity(this.field);
  }

  get isIdField() {
    return this.field === this.entity.idField;
  }

  get isPointingToUser() {
    return this.referencedEntity?.name === this.userTable;
  }

  get isStatic() {
    const input = this.input;

    if (typeof input === "function") return false;

    if (isPrimitive(input)) return true;

    unsafeAssertType<ValueRuleConfig<T>>(input);

    return !some(input, (value) => typeof value === "function");
  }

  get valueConfig(): ValueRuleConfig<T> {
    return resolveValueRuleInput(this.input);
  }

  applyToQuery(qb: QueryBuilder, context: SyncRequestContext) {
    const { selector, valueConfig } = this;

    const { $eq, $ne, $gt, $gte, $lt, $lte, $in, $notIn, $isNull } =
      valueConfig;

    if ($eq !== undefined) {
      return qb.where(selector, "=", resolveValuePointer($eq, context));
    }

    if ($ne !== undefined) {
      qb.where(selector, "<>", resolveValuePointer($ne, context));
    }

    if ($gt !== undefined) {
      qb.where(selector, ">", resolveValuePointer($gt, context));
    }

    if ($gte !== undefined) {
      qb.where(selector, ">=", resolveValuePointer($gte, context));
    }

    if ($lt !== undefined) {
      qb.where(selector, "<", resolveValuePointer($lt, context));
    }

    if ($lte !== undefined) {
      qb.where(selector, "<=", resolveValuePointer($lte, context));
    }

    if ($in !== undefined) {
      qb.whereIn(selector, resolveValuePointer($in, context));
    }

    if ($notIn !== undefined) {
      qb.whereNotIn(selector, resolveValuePointer($notIn, context));
    }

    if ($isNull !== undefined) {
      const nullValue = resolveValuePointer($isNull, context);

      if (nullValue) {
        qb.whereNull(selector);
      } else {
        qb.whereNotNull(selector);
      }
    }

    return qb;
  }
}

export function resolveValuePointer<T>(
  value: ValuePointer<T>,
  context: SyncRequestContext
): T {
  if (typeof value === "function") {
    return (value as ContextValuePointer<T>)(context)!;
  }

  return value;
}

export function resolveValueRuleInput<T>(
  input: ValueRuleInput<T>
): ValueRuleConfig<T> {
  if (isPrimitive(input)) {
    return { $eq: input } as ValueRuleConfig<T>;
  }

  if (typeof input === "function") {
    return { $eq: input };
  }

  return input;
}
