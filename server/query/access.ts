import { SyncRequestContext } from "@clientdb/server/context";
import { applyPermissionNeededJoins } from "@clientdb/server/permissions/joins";
import { pickPermissionsRule } from "@clientdb/server/permissions/picker";
import { PermissionOperationType } from "@clientdb/server/permissions/types";
import { EntityPointer } from "../entity/pointer";
import { PermissionRuleModel } from "../permissions/model";
import { applyEntityIdSelect } from "./select/entity";
import { QueryBuilder } from "./types";
import { applyPermissionWhereCauses } from "./where/permissions";

export function createBasePermissionMapQuery<T>(
  rule: PermissionRuleModel<T>,
  context: SyncRequestContext
) {
  const { db } = context;

  let rootQuery = db.from(`${rule.$entity}`);

  rootQuery = applyPermissionNeededJoins(rootQuery, rule);

  rootQuery = applyPermissionWhereCauses(rootQuery, rule, context);

  return rootQuery;
}

export function createAccessQuery<T>(
  context: SyncRequestContext,
  entity: string,
  operation: PermissionOperationType = "read"
) {
  const rule = pickPermissionsRule(context.permissions, entity, operation);

  if (!rule) return null;

  let query = createBasePermissionMapQuery(rule, context);

  query = applyEntityIdSelect(query, entity, context.schema);

  query = query.limit(1);

  return query;
}

export function applySingleItemWhere(
  query: QueryBuilder,
  entity: EntityPointer,
  context: SyncRequestContext
) {
  const idField = context.schema.getIdField(entity.entity);

  if (!idField) {
    throw new Error(`No id field found for ${entity.entity}`);
  }

  const idSelectColumn = `${entity.entity}.${idField}`;

  query = query.andWhere(`${idSelectColumn}`, "=", entity.id);

  return query;
}

export function createAccessItemQuery<T>(
  context: SyncRequestContext,
  entity: EntityPointer,
  operation: PermissionOperationType = "read"
) {
  let entityAccessQuery = createAccessQuery(context, entity.entity, operation);

  if (!entityAccessQuery) return null;

  entityAccessQuery = applySingleItemWhere(entityAccessQuery, entity, context);

  return entityAccessQuery;
}
