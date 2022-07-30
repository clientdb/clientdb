import { SyncRequestContext } from "@clientdb/server/context";
import { EntityPointer } from "@clientdb/server/entity/pointer";
import { pickPermissionsRule } from "@clientdb/server/permissions/picker";
import {
  mapPermissions,
  TraverseValueInfo,
} from "@clientdb/server/permissions/traverse";
import { PermissionRule } from "@clientdb/server/permissions/types";
import { resolveValuePointer } from "@clientdb/server/permissions/value";
import { applyQueryWhere } from "@clientdb/server/query/where/builder";
import {
  parseWhereTree,
  RawWherePointer,
} from "@clientdb/server/query/where/tree";
import { Knex } from "knex";
import { selectChangedEntityInRule } from "./injectId";
import { getRulePartNotImpactedBy } from "./split";

function getIsFieldPoinintToCurrentUser(
  info: TraverseValueInfo,
  context: SyncRequestContext
) {
  const userTable = context.config.userTable;

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

function createDeltaWhere(
  entity: string,
  changed: EntityPointer,
  rule: PermissionRule<any>,
  context: SyncRequestContext
) {
  const idField = context.schema.getIdField(changed.entity);

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
  changed: EntityPointer,
  context: SyncRequestContext
) {
  let rule = pickPermissionsRule(context.permissions, entity, "read")!;

  if (!rule) {
    throw new Error(`Impacted entity ${entity} has no access rules.`);
  }

  rule = selectChangedEntityInRule({
    rule: rule,
    entity,
    changed,
    schema: context.schema,
  });

  const changedEntityIdPointers = createInitialNarrowWherePointers(
    entity,
    changed.entity,
    rule,
    context
  );

  query = query.andWhere((qb) => {
    for (const changedEntityIdPointer of changedEntityIdPointers) {
      qb.orWhere(changedEntityIdPointer, "=", changed.id);
    }
  });

  const everyoneWithAccess = createDeltaWhere(entity, changed, rule, context);

  query = query.andWhere((qb) => {
    applyQueryWhere(qb, everyoneWithAccess, context);
  });

  if (entity === changed.entity) {
    return query;
  }

  let notImpactedRule = getRulePartNotImpactedBy(
    rule,
    entity,
    changed.entity,
    context.schema
  );

  const notImpactedPermission =
    !!notImpactedRule &&
    createDeltaWhere(entity, changed, notImpactedRule, context);

  if (notImpactedPermission) {
    query = query.andWhereNot((qb) => {
      applyQueryWhere(qb, notImpactedPermission, context);
    });
  }

  return query;
}
