import { SyncRequestContext } from "@clientdb/server/context";
import { EntityChangesPointer } from "@clientdb/server/entity/pointer";
import { doesValueMatchValueConfig } from "@clientdb/server/permissions/compareValue";
import { filterRule } from "@clientdb/server/permissions/filterRule";
import {
  getRawModelRule,
  PermissionRuleModel,
} from "@clientdb/server/permissions/model";
import { pickPermissionsRule } from "@clientdb/server/permissions/picker";
import {
  getRuleHas,
  pickFromRule,
  TraverseValueInfo,
} from "@clientdb/server/permissions/traverse";
import {
  Changes,
  pickAfterFromChanges,
  pickCurrentFromChanges,
} from "@clientdb/server/utils/changes";
import { debug } from "@clientdb/server/utils/logger";
import { applyWhereTreeToQuery } from "../where/builder";
import { buildWhereTree, RawWherePointer } from "../where/tree";
import { createBaseDeltaQuery } from "./baseQuery";

function convertValueInfoToWherePointer(
  info: TraverseValueInfo
): RawWherePointer {
  return {
    condition: info.rule,
    conditionPath: info.conditionPath,
    selector: info.selector,
  };
}

function getIsFieldValueImpactedByChange(
  info: TraverseValueInfo,
  changed: EntityChangesPointer<any>
) {
  if (info.entity !== changed.entity) return false;

  const field = info.schemaPath.at(-1)!;

  const inputValue = changed.changes[field];

  return inputValue !== undefined;
}

function getRuleWhereWithInjectedInput<T>(
  rule: PermissionRuleModel<any>,
  changedEntity: string,
  input: Partial<T>,
  context: SyncRequestContext
) {
  const userTable = context.config.userTable;

  const wherePointers = pickFromRule<RawWherePointer>(rule, {
    onValue(info) {
      if (info.entity !== changedEntity) {
        return convertValueInfoToWherePointer(info);
      }

      const field = info.schemaPath.at(-1)!;

      const inputValue = input[field as keyof T]!;

      if (inputValue === undefined) {
        return convertValueInfoToWherePointer(info);
      }

      if (info.referencedEntity === userTable) {
        return {
          condition: { $eq: inputValue },
          conditionPath: info.conditionPath,
          selector: context.db.ref("allowed_user.id"),
        };
      }

      return {
        condition: info.rule,
        conditionPath: info.conditionPath,
        selector: context.db.raw("?", [inputValue as any]),
      };
    },
  });

  return buildWhereTree(wherePointers);
}

export function getUpdateDelta(
  entity: string,
  changed: EntityChangesPointer<any>,
  context: SyncRequestContext
) {
  const rule = pickPermissionsRule(context.permissions, entity, "read");

  if (!rule) {
    throw new Error(`No read permission for ${entity}`);
  }

  const dataBefore = pickCurrentFromChanges(changed.changes);
  const dataAfter = pickAfterFromChanges(changed.changes);

  const ruleBefore = getRuleWhereWithInjectedInput(
    rule,
    changed.entity,
    dataBefore,
    context
  );
  const ruleAfter = getRuleWhereWithInjectedInput(
    rule,
    changed.entity,
    dataAfter,
    context
  );

  return {
    ruleBefore,
    ruleAfter,
  };
}

function getEntitiesImpactedByUpdate(
  changed: EntityChangesPointer<any>,
  context: SyncRequestContext
) {
  const entities: string[] = [];

  for (const entity in context.permissions) {
    const rule = pickPermissionsRule(context.permissions, entity, "read")!;

    const isImpacted = getRuleHas(rule, {
      onValue(info) {
        return getIsFieldValueImpactedByChange(info, changed);
      },
    });

    if (isImpacted) {
      entities.push(entity);
    }
  }

  return entities;
}

export function createUpdateDeltaQuery(
  changed: EntityChangesPointer<any>,
  context: SyncRequestContext
) {
  const impacted = getEntitiesImpactedByUpdate(changed, context);

  if (!impacted.length) {
    return null;
  }

  const gainedAccess = createBaseDeltaQuery({
    changed,
    context,
    deltaType: "put",
    impactedEntities: impacted,
    whereGetter: ({ context, entity, query }) => {
      const { ruleBefore, ruleAfter } = getUpdateDelta(
        entity,
        changed,
        context
      );

      return query
        .andWhere((qb) => {
          return applyWhereTreeToQuery(qb, ruleAfter, context);
        })
        .andWhereNot((qb) => {
          return applyWhereTreeToQuery(qb, ruleBefore, context);
        });
    },
  });

  const lostAccess = createBaseDeltaQuery({
    changed,
    context,
    deltaType: "delete",
    impactedEntities: impacted,
    whereGetter: ({ context, entity, query }) => {
      const { ruleBefore, ruleAfter } = getUpdateDelta(
        entity,
        changed,
        context
      );

      return query
        .andWhere((qb) => {
          return applyWhereTreeToQuery(qb, ruleBefore, context);
        })
        .andWhereNot((qb) => {
          return applyWhereTreeToQuery(qb, ruleAfter, context);
        });
    },
  });

  const query = gainedAccess.unionAll(lostAccess);

  return query;
}
