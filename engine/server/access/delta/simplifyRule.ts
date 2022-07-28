import { PermissionRule } from "../../../schema/types";

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

export function getIsRuleEmpty(rule: PermissionRule) {
  const { $and, $or, ...fields } = rule;

  if (Object.keys(fields).length > 0) return false;

  if ($and?.some(getIsRuleEmpty)) return false;
  if ($or?.some(getIsRuleEmpty)) return false;

  return true;
}

function removeEmptyRuleParts(rule: PermissionRule) {
  const { $and, $or, ...fields } = rule;
  const cleanedRule: PermissionRule<any> = {};

  for (const fieldKey in fields) {
    const fieldRule = fields[fieldKey]!;

    if (getIsEmpty(fieldRule)) continue;

    cleanedRule[fieldKey] = fieldRule;
  }

  if ($and && $and.length > 0) {
    cleanedRule.$and = $and;
  }

  if ($or && $or.length > 0) {
    cleanedRule.$or = $or;
  }

  return cleanedRule;
}

function flattenRule(rule: PermissionRule): PermissionRule {
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

export function simplifyRule(rule: PermissionRule<any>): PermissionRule<any> {
  let { $and = [], $or = [], ...fields } = rule;

  $or = $or.map((rule) => simplifyRule(rule));
  $and = $and.map((rule) => simplifyRule(rule));

  $or = $or.filter((rule) => !getIsRuleEmpty(rule));
  $and = $and.filter((rule) => !getIsRuleEmpty(rule));

  const filteredRule: PermissionRule = { $or, $and, ...fields };

  const clearedRule = removeEmptyRuleParts(filteredRule);

  return flattenRule(clearedRule);
}
