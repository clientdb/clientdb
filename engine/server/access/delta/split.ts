import { DbSchemaModel } from "../../../schema/model";
import { PermissionRule } from "../../../schema/types";
import { deepLog } from "../../../utils/log";
import { SyncRequestContext } from "../../context";
import { getHasPermission } from "../../permissions/traverse";
import { deepFilterRule } from "./deepFilterRule";
import { getIsRelationImpactedBy } from "./relation";

function getIsRuleImpactedBy(
  rule: PermissionRule<any>,
  ruleEntity: string,
  impactedBy: string,
  schema: DbSchemaModel
) {
  const isImpacted = getHasPermission(ruleEntity, rule, schema, {
    onRelation(info) {
      return getIsRelationImpactedBy(info.relation, impactedBy);
    },
    onValue(info) {
      if (info.table === impactedBy) return true;

      const referencedEntity = schema.getEntityReferencedBy(
        info.table,
        info.field
      )?.name;

      return referencedEntity === impactedBy;
    },
  });

  return isImpacted;
}

export function splitRuleByImpactingEntity(
  rule: PermissionRule<any>,
  entity: string,
  impactedBy: string,
  schema: DbSchemaModel
) {
  const impactedRulePart = deepFilterRule(
    rule,
    entity,
    (rule, ruleEntity) => {
      return getIsRuleImpactedBy(rule, ruleEntity, impactedBy, schema);
    },
    schema
  );

  const notImpactedRulePart = deepFilterRule(
    rule,
    entity,
    (rule, ruleEntity) => {
      return !getIsRuleImpactedBy(rule, ruleEntity, impactedBy, schema);
    },
    schema
  );

  return [impactedRulePart, notImpactedRulePart] as const;
}
