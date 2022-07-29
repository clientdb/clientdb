import { DbSchemaModel } from "../../../schema/model";
import { SchemaEntityRelation } from "../../../schema/schema";
import { PermissionRule } from "../../../schema/types";
import { debug } from "../../../utils/log";
import { SyncRequestContext } from "../../context";
import { getHasPermission } from "../../permissions/traverse";
import { deepFilterRule } from "./deepFilterRule";
import { getIsRuleEmpty } from "./simplifyRule";

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

function iterateWithPrevious<T>(items: T[]) {
  const entries = items.map((item, index) => {
    return [item, items[index - 1] ?? null] as [T, T | null];
  });

  return entries;
}

function getIsSchemaPathImpactedByEntity(
  path: string[],
  changedEntity: string,
  schema: DbSchemaModel
) {
  for (const [segment, previousSegment] of iterateWithPrevious(path)) {
    if (!previousSegment) {
      if (segment === changedEntity) return true;
      continue;
    }

    const referencedEntity = schema.getEntityReferencedBy(
      previousSegment,
      segment
    );

    if (referencedEntity?.name === changedEntity) return true;
  }

  return false;
}

function getIsRuleImpactedBy(
  rule: PermissionRule<any>,
  ruleEntity: string,
  impactedBy: string,
  schema: DbSchemaModel
) {
  const impactedByIdField = schema.getIdField(impactedBy);

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

  return [
    getIsRuleEmpty(impactedRulePart) ? null : impactedRulePart,
    getIsRuleEmpty(notImpactedRulePart) ? null : notImpactedRulePart,
  ] as const;
}
