import { Knex } from "knex";
import { PermissionRule } from "../../../schema/types";
import { applyQueryWhere } from "../../../utils/conditions/builder";
import {
  parseWhereTree,
  RawWherePointer,
} from "../../../utils/conditions/conditions";
import { pickPermissionsRule } from "../../change";
import { SyncRequestContext } from "../../context";
import { getHasPermission, mapPermissions } from "../../permissions/traverse";
import { deepFilterRule } from "./deepFilterRule";
import { getIsRelationImpactedBy } from "./relation";
import { getIsRuleEmpty } from "./simplifyRule";
import { splitRuleByImpactingEntity } from "./split";

function getIsRuleImpactedBy(
  rule: PermissionRule<any>,
  ruleEntity: string,
  impactedBy: string,
  context: SyncRequestContext
) {
  return getHasPermission(ruleEntity, rule, context.schema, {
    onRelation(info) {
      return getIsRelationImpactedBy(info.relation, impactedBy);
    },
    onValue(info) {
      const referencedEntity = context.schema.getEntityReferencedBy(
        info.table,
        info.field
      )?.name;

      return referencedEntity === impactedBy;
    },
  });
}

function createAccessGainedWhere(
  entity: string,
  changedEntity: string,
  changedEntityId: string,
  rule: PermissionRule<any>,
  context: SyncRequestContext
) {
  const idField = context.schema.getIdField(changedEntity);

  if (!idField) {
    throw new Error(`Impacted entity ${entity} has no id field.`);
  }

  const whereAccessedThanksTo = mapPermissions<RawWherePointer>(
    entity,
    rule,
    context.schema,
    {
      onValue({ table, field, conditionPath, schemaPath, value }) {
        const referencedEntity = context.schema.getEntityReferencedBy(
          table,
          field
        );

        if (referencedEntity?.name === context.config.userTable) {
          // return;
          const pointer: RawWherePointer = {
            table: table,
            conditionPath: conditionPath,
            condition: { $isNull: false },
            select: `${schemaPath.join("__")}.${field}`,
          };

          return pointer;
        }

        const pointer: RawWherePointer = {
          table: table,
          conditionPath: conditionPath,
          condition: value,
          select: `${schemaPath.join("__")}.${field}`,
        };

        return pointer;
      },
      onRelation({ relation, schemaPath, field, conditionPath, table }) {
        const isImpacted = getIsRelationImpactedBy(relation, changedEntity);

        if (!isImpacted) return;

        const pointer: RawWherePointer = {
          table,
          conditionPath,
          select: `${[...schemaPath, field].join("__")}.${idField}`,
          condition: {
            $eq: changedEntityId,
          },
        };

        return pointer;
      },
    }
  );

  if (changedEntity === entity) {
    whereAccessedThanksTo.push({
      condition: { $eq: changedEntityId },
      conditionPath: [],
      select: `${changedEntity}.${idField}`,
      table: changedEntity,
    });
  }

  const thanksToWhereTree = parseWhereTree(whereAccessedThanksTo);

  return thanksToWhereTree;
}

function json(input: unknown) {
  return JSON.stringify(
    input,
    (key, value) => {
      if (typeof value === "function") {
        return `function ${value.name}()`;
      }

      return value;
    },
    2
  );
}

export function applyAccessGainedWhere(
  query: Knex.QueryBuilder,
  entity: string,
  changedEntity: string,
  changedEntityId: string,
  context: SyncRequestContext
) {
  const accessRules = pickPermissionsRule(context, entity, "read");

  if (!accessRules) {
    throw new Error(`Impacted entity ${entity} has no access rules.`);
  }

  let [impactedRule, notImpactedRule] = splitRuleByImpactingEntity(
    accessRules,
    entity,
    changedEntity,
    context.schema
  );

  if (!impactedRule && !notImpactedRule) {
    impactedRule = accessRules;
  }

  const impactedPermission = createAccessGainedWhere(
    entity,
    changedEntity,
    changedEntityId,
    impactedRule! ?? accessRules,
    context
  );

  const notImpactedPermission = createAccessGainedWhere(
    entity,
    changedEntity,
    changedEntityId,
    notImpactedRule,
    context
  );

  const hasNotImpactedRule = !getIsRuleEmpty(notImpactedRule);

  if (hasNotImpactedRule) {
    query = query.andWhere((qb) => {
      qb.orWhere((qb) => {
        applyQueryWhere(qb, impactedPermission, context);
      }).orWhere((qb) => {
        applyQueryWhere(qb, notImpactedPermission, context);
      });
    });
  }

  query = query.andWhere((qb) => {
    applyQueryWhere(qb, impactedPermission, context);
  });

  return query;
}
