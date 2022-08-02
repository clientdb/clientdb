import { SyncRequestContext } from "@clientdb/server/context";
import { EntityPointer } from "@clientdb/server/entity/pointer";
import { PermissionRuleModel } from "@clientdb/server/permissions/model";
import { pickPermissionsRule } from "@clientdb/server/permissions/picker";
import {
  pickFromRule,
  TraverseValueInfo,
} from "@clientdb/server/permissions/traverse";
import { resolveValuePointer } from "@clientdb/server/permissions/value";
import { applyWhereTreeToQuery } from "@clientdb/server/query/where/builder";
import {
  parseWhereTree,
  RawWherePointer,
} from "@clientdb/server/query/where/tree";
import { Knex } from "knex";
import { createChangedEntityWhere } from "./changedWhere";
import { getRulePartNotImpactedBy } from "./split";

function getIsFieldPoinintToCurrentUser(
  info: TraverseValueInfo,
  context: SyncRequestContext
) {
  const userTable = context.config.userTable;

  if (info.referencedEntity !== userTable) return false;

  if (!info.rule.$eq) return false;

  const injectedIdToCheck = "<<id>>";

  const fakeContext: SyncRequestContext = {
    ...context,
    userId: injectedIdToCheck,
  };

  const resolvedValue = resolveValuePointer<string>(info.rule.$eq, fakeContext);

  return resolvedValue === injectedIdToCheck;
}

function createDeltaWhere(
  entity: string,
  changed: EntityPointer,
  rule: PermissionRuleModel<any>,
  context: SyncRequestContext
) {
  const idField = context.schema.getIdField(changed.entity);

  if (!idField) {
    throw new Error(`Impacted entity ${entity} has no id field.`);
  }

  const deltaWherePointers = pickFromRule<RawWherePointer>(rule, {
    onValue(info) {
      const { entity, selector, conditionPath, schemaPath, rule } = info;

      if (getIsFieldPoinintToCurrentUser(info, context)) {
        const pointer: RawWherePointer = {
          conditionPath: conditionPath,
          condition: `allowed_user.id`,
          select: selector,
        };

        return pointer;
      }

      const pointer: RawWherePointer = {
        conditionPath: conditionPath,
        condition: rule,
        select: selector,
      };

      return pointer;
    },
  });

  const deltaWhereTree = parseWhereTree(deltaWherePointers);

  return deltaWhereTree;
}

export function applyDeltaWhere(
  query: Knex.QueryBuilder,
  entity: string,
  changed: EntityPointer,
  context: SyncRequestContext
) {
  const rule = pickPermissionsRule(context.permissions, entity, "read")!;

  if (!rule) {
    throw new Error(`Impacted entity ${entity} has no access rules.`);
  }

  const changedWhereTree = createChangedEntityWhere(changed, rule);

  console.log("AFTER", entity, changed, query.toString());

  const everyoneWithAccess = createDeltaWhere(entity, changed, rule, context);

  query = query
    .andWhere((qb) => {
      applyWhereTreeToQuery(qb, changedWhereTree, context);
    })
    .andWhere((qb) => {
      applyWhereTreeToQuery(qb, everyoneWithAccess, context);
    });

  if (entity === changed.entity) {
    return query;
  }

  const notImpactedRule = getRulePartNotImpactedBy(rule, changed.entity);

  const notImpactedPermission =
    !!notImpactedRule &&
    createDeltaWhere(entity, changed, notImpactedRule, context);

  if (notImpactedPermission) {
    query = query.andWhereNot((qb) => {
      applyWhereTreeToQuery(qb, notImpactedPermission, context);
    });
  }

  return query;
}
