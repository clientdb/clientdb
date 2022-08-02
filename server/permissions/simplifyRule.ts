import { mapValues } from "../utils/object";
import { PermissionRuleModel } from "./model";

function isPrimitive(input: unknown): boolean {
  if (typeof input === "object" || typeof input === "function") {
    return input === null;
  }

  return true;
}

/**
 * Returns true if provided with undefined or empty {} object
 */
function getIsEmpty(input: any): boolean {
  if (input === undefined) return true;

  if (isPrimitive(input)) return false;

  if (typeof input === "function") return false;

  for (let i in input) {
    return false;
  }
  return true;
}

export function getIsRuleEmpty(rule: PermissionRuleModel) {
  const { $and, $or, $data, $relations } = rule;

  if (Object.keys($data).length > 0) return false;
  if (Object.keys($relations).length > 0) return false;

  if ($and?.some((rule) => !getIsRuleEmpty(rule))) return false;
  if ($or?.some((rule) => !getIsRuleEmpty(rule))) return false;

  return true;
}

function removeEmptyRuleParts(rule: PermissionRuleModel): PermissionRuleModel {
  const { $and, $or, $data } = rule;
  const cleanedRule: PermissionRuleModel<any> = { ...rule };

  for (const fieldKey in cleanedRule.$data) {
    const fieldRule = Reflect.get(cleanedRule.$data, fieldKey);

    if (getIsEmpty(fieldRule)) {
      Reflect.deleteProperty(cleanedRule.$data, fieldKey);
    }
  }

  if ($and && $and.length > 0) {
    cleanedRule.$and = $and;
  }

  if ($or && $or.length > 0) {
    cleanedRule.$or = $or;
  }

  return cleanedRule;
}

function flattenRule(rule: PermissionRuleModel): PermissionRuleModel {
  let { $and, $or, ...fields } = rule;

  const fieldsKeys = Object.keys(fields);

  if (fieldsKeys.length > 0) return rule;

  if ($and?.length === 1 && !$or?.length) {
    return flattenRule($and[0]);
  }

  if ($or?.length === 1 && !$and?.length) {
    return flattenRule($or[0]);
  }

  return rule;
}

export function simplifyRule(
  rule: PermissionRuleModel<any>
): PermissionRuleModel<any> {
  let { $and = [], $or = [], $data, $relations } = rule;

  const simplifiedRelations = mapValues($relations, (relation, key) => {
    if (!relation) return;
    const simplifiedRelation = simplifyRule(relation);

    if (getIsRuleEmpty(simplifiedRelation)) {
      return;
    }

    return simplifiedRelation;
  });

  $or = $or.map((rule) => simplifyRule(rule));
  $and = $and.map((rule) => simplifyRule(rule));

  $or = $or.filter((rule) => !getIsRuleEmpty(rule));
  $and = $and.filter((rule) => !getIsRuleEmpty(rule));

  const filteredRule: PermissionRuleModel = {
    ...rule,
    $relations: simplifiedRelations,
    $or,
    $and,
  };

  const clearedRule = removeEmptyRuleParts(filteredRule);

  return flattenRule(clearedRule);
}
