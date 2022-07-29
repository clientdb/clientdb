import { Knex } from "knex";
import { PermissionRule } from "../../../schema/types";
import { resolveValueInput, resolveValuePointer } from "../../../schema/utils";
import { applyQueryWhere } from "../../../utils/conditions/builder";
import {
  parseWhereTree,
  RawWherePointer,
} from "../../../utils/conditions/conditions";
import { pickPermissionsRule } from "../../change";
import { SyncRequestContext } from "../../context";
import { mapPermissions, TraverseValueInfo } from "../../permissions/traverse";
import { injectIdToPermissionRule } from "./injectId";
import { splitRuleByImpactingEntity } from "./split";

function getIsFieldPoinintToCurrentUser(
  info: TraverseValueInfo,
  context: SyncRequestContext
) {
  const userTable = context.config.userTable;
  const userIdField = context.schema.getIdField(userTable);

  const referencedEntity = context.schema.getEntityReferencedBy(
    info.table,
    info.field
  );

  if (referencedEntity?.name !== userTable) return false;

  if (!info.value.$eq) return false;

  const injectedIdToCheck = "<<id>>";

  const fakeContext: SyncRequestContext = {
    ...context,
    userId: injectedIdToCheck,
  };

  const resolvedValue = resolveValuePointer<string>(
    info.value.$eq,
    fakeContext
  );

  return resolvedValue === injectedIdToCheck;
}

function createAccessGainedWhere(
  entity: string,
  changedEntity: string,
  changedEntityId: string,
  rule: PermissionRule<any>,
  context: SyncRequestContext
) {
  const idField = context.schema.getIdField(changedEntity);
  const userTable = context.config.userTable;
  const userIdField = context.schema.getIdField(userTable);

  if (!idField) {
    throw new Error(`Impacted entity ${entity} has no id field.`);
  }

  const whereAccessedThanksTo = mapPermissions<RawWherePointer>(
    entity,
    rule,
    context.schema,
    {
      onValue(info) {
        const { table, field, conditionPath, schemaPath, value } = info;

        if (getIsFieldPoinintToCurrentUser(info, context)) {
          const pointer: RawWherePointer = {
            table: table,
            conditionPath: conditionPath,
            condition: `allowed_user.id`,
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
    }
  );

  const thanksToWhereTree = parseWhereTree(whereAccessedThanksTo);

  return thanksToWhereTree;
}

function createInitialNarrowWherePointers(
  entity: string,
  changedEntity: string,
  rule: PermissionRule<any>,
  context: SyncRequestContext
) {
  const idSelects = mapPermissions<string>(entity, rule, context.schema, {
    onValue({ table, field, conditionPath, schemaPath, value }) {
      const referencedEntity = context.schema.getEntityReferencedBy(
        table,
        field
      );

      if (referencedEntity?.name === changedEntity) {
        return `${schemaPath.join("__")}.${field}`;
      }
    },
  });

  return Array.from(new Set(idSelects));
}

export function applyDeltaWhere(
  query: Knex.QueryBuilder,
  entity: string,
  changedEntity: string,
  changedEntityId: string,
  context: SyncRequestContext
) {
  let rule = pickPermissionsRule(context.permissions, entity, "read")!;

  if (!rule) {
    throw new Error(`Impacted entity ${entity} has no access rules.`);
  }

  rule = injectIdToPermissionRule({
    entity,
    changedEntity,
    id: changedEntityId,
    rule: rule,
    schema: context.schema,
  });

  const changedEntityIdPointers = createInitialNarrowWherePointers(
    entity,
    changedEntity,
    rule,
    context
  );

  query = query.andWhere((qb) => {
    for (const changedEntityIdPointer of changedEntityIdPointers) {
      qb.orWhere(changedEntityIdPointer, "=", changedEntityId);
    }
  });

  const everyoneWithAccess = createAccessGainedWhere(
    entity,
    changedEntity,
    changedEntityId,
    rule,
    context
  );

  query = query.andWhere((qb) => {
    applyQueryWhere(qb, everyoneWithAccess, context);
  });

  if (entity === changedEntity) {
    return query;
  }

  let [impactedRule, notImpactedRule] = splitRuleByImpactingEntity(
    rule,
    entity,
    changedEntity,
    context.schema
  );

  const impactedPermission =
    !!impactedRule &&
    createAccessGainedWhere(
      entity,
      changedEntity,
      changedEntityId,
      impactedRule,
      context
    );

  const notImpactedPermission =
    !!notImpactedRule &&
    createAccessGainedWhere(
      entity,
      changedEntity,
      changedEntityId,
      notImpactedRule,
      context
    );

  if (notImpactedPermission) {
    query = query.andWhereNot((qb) => {
      applyQueryWhere(qb, notImpactedPermission, context);
    });
  }

  return query;
}
