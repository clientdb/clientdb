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
import { getIsRelationImpactedBy } from "./relation";

function getDoesRuleDirectlyDependOn(
  rule: PermissionRule<any>,
  ruleEntity: string,
  impactingEntity: string,
  context: SyncRequestContext
) {
  const { $and, $or, ...fields } = rule;

  for (const fieldKey in fields) {
    const referencedEntity = context.schema.getEntityReferencedBy(
      ruleEntity,
      fieldKey
    );

    if (referencedEntity?.name === impactingEntity) {
      return true;
    }
  }

  return false;
}

function groupByFilter<T>(items: T[], filter: (item: T) => boolean) {
  const passing: T[] = [];
  const failing: T[] = [];

  for (const item of items) {
    if (filter(item)) {
      passing.push(item);
    } else {
      failing.push(item);
    }
  }

  return [passing, failing] as const;
}

function splitRuleByDependingOn(
  rule: PermissionRule<any>,
  impactedEntity: string,
  ruleEntity: string,
  context: SyncRequestContext
): readonly [PermissionRule<any>, PermissionRule<any> | null] {
  const { $and, $or, ...fields } = rule;

  if (getDoesRuleDirectlyDependOn(rule, ruleEntity, impactedEntity, context)) {
    return [rule, null];
  }

  if (!$or) {
    return [rule, null];
  }

  if ($or.length === 1) {
    splitRuleByDependingOn($or[0], impactedEntity, ruleEntity, context);
    return [rule, null];
  }

  const [dependingOr, notDependingOr] = groupByFilter($or, (rule) => {
    return getDoesRuleDirectlyDependOn(
      rule,
      ruleEntity,
      impactedEntity,
      context
    );
  });

  if (dependingOr.length > 0 && notDependingOr.length > 0) {
    return [
      { ...rule, $or: dependingOr },
      { ...rule, $or: notDependingOr },
    ] as const;
  }

  // Still not decided
  for (const orRule of $or) {
    const [depending, notDepending] = splitRuleByDependingOn(
      orRule,
      impactedEntity,
      ruleEntity,
      context
    );

    if (depending) {
      return [
        { ...rule, $or: [depending] },
        { ...rule, $or: notDepending ? [notDepending] : [] },
      ];
    }
  }

  return [rule, null] as const;
}

function createExactEntityWhereComparsion(
  impactedEntity: string,
  changedEntity: string,
  changedEntityId: string,
  context: SyncRequestContext,
  compare: "=" | "!="
) {
  const accessRules = pickPermissionsRule(
    context.permissions,
    impactedEntity,
    "read"
  );

  if (!accessRules) {
    throw new Error(`Impacted entity ${impactedEntity} has no access rules.`);
  }

  const idField = context.schema.getIdField(changedEntity);

  if (!idField) {
    throw new Error(`Impacted entity ${impactedEntity} has no id field.`);
  }

  const whereAccessedThanksTo = mapPermissions<RawWherePointer>(
    impactedEntity,
    accessRules,
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
          condition:
            compare === "="
              ? {
                  $eq: changedEntityId,
                }
              : {
                  $ne: changedEntityId,
                },
        };

        return pointer;
      },
    }
  );

  if (changedEntity === impactedEntity) {
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

function createExactEntityWhere(
  impactedEntity: string,
  changedEntity: string,
  changedEntityId: string,
  context: SyncRequestContext
) {
  const thanksToWhereTree = createExactEntityWhereComparsion(
    impactedEntity,
    changedEntity,
    changedEntityId,
    context,
    "="
  );

  const evenWithoutWhereTree = createExactEntityWhereComparsion(
    impactedEntity,
    changedEntity,
    changedEntityId,
    context,
    "!="
  );

  return {
    thanksToWhereTree,
    evenWithoutWhereTree,
  };
}

export function applyExactEntityWhere(
  query: Knex.QueryBuilder,
  impactedEntity: string,
  changedEntity: string,
  changedEntityId: string,
  context: SyncRequestContext
) {
  const { thanksToWhereTree, evenWithoutWhereTree } = createExactEntityWhere(
    impactedEntity,
    changedEntity,
    changedEntityId,
    context
  );

  query = query.andWhere((qb) => {
    applyQueryWhere(qb, thanksToWhereTree, context);
  });

  if (changedEntity !== impactedEntity) {
    query = query.andWhereNot((qb) => {
      applyQueryWhere(qb, evenWithoutWhereTree, context);
    });
  }

  return query;
}
