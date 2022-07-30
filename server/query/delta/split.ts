import { DbSchemaModel, SchemaEntityRelation } from "@clientdb/schema";
import { deepFilterRule } from "@clientdb/server/permissions/filterRule";
import { getIsRuleEmpty } from "@clientdb/server/permissions/simplifyRule";
import { getHasPermission } from "@clientdb/server/permissions/traverse";
import { PermissionRule } from "@clientdb/server/permissions/types";

function getIsRelationImpactedBy(
  relation: SchemaEntityRelation,
  changedEntity: string
) {
  if (relation.type === "reference" && relation.target === changedEntity) {
    return true;
  }

  if (relation.type === "collection" && relation.target === changedEntity) {
    return true;
  }

  return false;
}

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

export function getRulePartNotImpactedBy(
  rule: PermissionRule<any>,
  entity: string,
  changedEntity: string,
  schema: DbSchemaModel
) {
  const notImpactedRulePart = deepFilterRule(
    rule,
    entity,
    (rule, ruleEntity) => {
      return !getIsRuleImpactedBy(rule, ruleEntity, changedEntity, schema);
    },
    schema
  );

  if (getIsRuleEmpty(notImpactedRulePart)) {
    return null;
  }

  return notImpactedRulePart;
}
