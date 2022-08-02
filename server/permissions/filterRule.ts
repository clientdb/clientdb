import { isNotNullish } from "@clientdb/server/utils/nullish";
import { clonePermissionRule } from "./clone";
import { PermissionRuleModel } from "./model";
import { simplifyRule } from "./simplifyRule";
import { DataRules } from "./types";

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

function createEmptyRule(
  rule: PermissionRuleModel<any>
): PermissionRuleModel<any> {
  const emptyRule: PermissionRuleModel<any> = {
    ...rule,
    $and: [],
    $or: [],
    $relations: {},
    $data: {},
  };

  return emptyRule;
}

function filterRuleWithPath(
  rule: PermissionRuleModel<any>,
  path: string[],
  filter: (rule: PermissionRuleModel<any>) => boolean
): PermissionRuleModel<any> {
  const schema = rule.$schema;
  const entity = rule.$entity;
  const { $and = [], $or = [], ...fields } = rule;

  // if (!filter(rule)) {
  //   return createEmptyRule(rule);
  // }

  const passingOr = $or
    .map((rule) => {
      if (!filter(rule)) return null;
      return filterRuleWithPath(rule, path, filter);
    })
    .filter(isNotNullish);

  const passingAnd = $and.map((rule) => {
    const { $or, $and, ...fields } = rule;

    rule.$or = rule.$or?.map((or) => {
      return filterRuleWithPath(or, path, filter);
    });
    return filterRuleWithPath(rule, path, filter);
  });

  const dataPermissions = rule.$data;
  const relationPermissions = rule.$relations;

  const passingRelationRules = mapObject(
    relationPermissions,
    (value, relation) => {
      const nestedEntity = schema.getRelation(entity, relation)!.target;

      return filterRuleWithPath(value, [...path, nestedEntity], filter);
    }
  );

  // const passingDataRules = mapObject<any, any, any>(
  //   dataPermissions,
  //   (value, field) => {
  //     const dataRule: DataRules<any> = {
  //       [field]: value,
  //     };

  //     const dataRuleModel = clonePermissionRule(rule);

  //     delete dataRuleModel.$and;
  //     delete dataRuleModel.$or;
  //     dataRuleModel.$relations = {};
  //     dataRuleModel.$data = dataRule;

  //     const isPassing = filter(dataRuleModel);

  //     if (!isPassing) return;

  //     return value;
  //   }
  // );

  const filteredRule: PermissionRuleModel<any> = {
    ...rule,
    $and: passingAnd,
    $or: passingOr,
    $relations: passingRelationRules,
    // $data: passingDataRules,
  };

  return simplifyRule(filteredRule);
}

export function filterRule(
  rule: PermissionRuleModel<any>,
  filter: (rule: PermissionRuleModel<any>) => boolean
): PermissionRuleModel<any> {
  return filterRuleWithPath(rule, [rule.$entity], filter);
}
