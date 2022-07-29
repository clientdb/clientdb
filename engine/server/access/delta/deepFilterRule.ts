import { DbSchemaModel } from "../../../schema/model";
import { DataSelector, PermissionRule } from "../../../schema/types";
import { isNotNullish } from "../../../utils/nullish";
import {
  pickDataPermissions,
  pickRelationPermissions,
} from "../utils/permissions";
import { simplifyRule } from "./simplifyRule";

function mapObject<K extends string, V, NV>(
  object: Record<K, V | undefined>,
  mapper: (value: V, key: K) => NV | undefined
): Record<K, NV> {
  const result: Record<K, NV> = {} as Record<K, NV>;

  for (const [key, value] of Object.entries(object)) {
    if (value === undefined) continue;

    const mappedValue = mapper(value as V, key as K);

    if (mappedValue !== undefined) {
      result[key as K] = mappedValue;
    }
  }

  return result;
}

function getIsRuleEmpty(rule: PermissionRule) {
  const { $and, $or, ...fields } = rule;

  if ($and?.length) return false;
  if ($or?.length) return false;

  return Object.keys(fields).length === 0;
}

function filterAndMap<T, R>(
  items: T[],
  filterAndMapper: (item: T) => R | false
): R[] {
  const results: R[] = [];

  for (const item of items) {
    const result = filterAndMapper(item);

    if (result === false) continue;

    results.push(result);
  }

  return results;
}

function cleanRule<T>(rule: PermissionRule<T>) {
  rule = { ...rule };

  const { $and, $or, ...fields } = rule;

  if (!$and?.length) {
    delete rule.$and;
  }

  if (!$or?.length) {
    delete rule.$or;
  }

  return rule;
}

function deepFilterRuleWithPath(
  rule: PermissionRule<any>,
  path: string[],
  filter: (
    rule: PermissionRule<any>,
    ruleEntity: string,
    path: string[]
  ) => boolean,
  schema: DbSchemaModel
): PermissionRule<any> {
  const entity = path.at(-1)!;
  const { $and = [], $or = [], ...fields } = rule;

  const passingOr = $or
    .map((rule) => {
      if (!filter(rule, entity, path)) return null;
      return deepFilterRuleWithPath(rule, path, filter, schema);
    })
    .filter(isNotNullish);

  const passingAnd = $and.map((rule) => {
    const { $or, $and, ...fields } = rule;

    rule.$or = rule.$or?.map((or) => {
      return deepFilterRuleWithPath(or, path, filter, schema);
    });
    return deepFilterRuleWithPath(rule, path, filter, schema);
  });

  const dataPermissions = pickDataPermissions(fields, entity, schema);
  const relationPermissions = pickRelationPermissions(fields, entity, schema);

  const passingRelationRules = mapObject(
    relationPermissions,
    (value, relation) => {
      const nestedEntity = schema.getRelation(entity, relation)!.target;

      return deepFilterRuleWithPath(
        value,
        [...path, nestedEntity],
        filter,
        schema
      );
    }
  );

  const passingDataRules = mapObject(dataPermissions, (value, field) => {
    const rule: DataSelector<any> = {
      [field]: value,
    };

    const isPassing = filter(rule, entity, path);

    if (!isPassing) return;

    return value;
  });

  const filteredRule: PermissionRule<any> = {
    $and: passingAnd,
    $or: passingOr,
    ...passingRelationRules,
    ...passingDataRules,
  };

  return simplifyRule(filteredRule);
}

export function deepFilterRule(
  rule: PermissionRule<any>,
  entity: string,
  filter: (
    rule: PermissionRule<any>,
    ruleEntity: string,
    path: string[]
  ) => boolean,
  schema: DbSchemaModel
): PermissionRule<any> {
  return deepFilterRuleWithPath(rule, [entity], filter, schema);
}
