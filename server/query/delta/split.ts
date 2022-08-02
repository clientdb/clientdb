import { SchemaEntityRelation } from "@clientdb/schema";
import { filterRule } from "@clientdb/server/permissions/filterRule";
import { PermissionRuleModel } from "@clientdb/server/permissions/model";
import { getIsRuleEmpty } from "@clientdb/server/permissions/simplifyRule";
import {
  getRuleHas,
  TraverseValueInfo,
} from "@clientdb/server/permissions/traverse";

function getIsValueImpactedBy(info: TraverseValueInfo, impactedBy: string) {
  if (info.entity === impactedBy) return true;

  let parent: PermissionRuleModel | null = info.parentRule;

  while (parent) {
    if (parent.$entity === impactedBy) return true;

    parent = parent.$parent;
  }

  return info.referencedEntity === impactedBy;
}

function getIsRuleImpactedBy(
  rule: PermissionRuleModel<any>,
  impactedBy: string
) {
  const isImpacted = getRuleHas(rule, {
    onRelation(info) {
      return info.entity === impactedBy;
    },
    onValue(info) {
      return getIsValueImpactedBy(info, impactedBy);
    },
  });

  return isImpacted;
}

export function getRulePartNotImpactedBy(
  rule: PermissionRuleModel<any>,
  changedEntity: string
) {
  const notImpactedRulePart = filterRule(rule, (rule) => {
    return !getIsRuleImpactedBy(rule, changedEntity);
  });

  if (getIsRuleEmpty(notImpactedRulePart)) {
    return null;
  }

  return notImpactedRulePart;
}
