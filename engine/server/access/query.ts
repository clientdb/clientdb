import { PermissionOperationType, PermissionRule } from "../../schema/types";
import { createLogger } from "../../utils/logger";
import { pickPermission, pickPermissionsRule } from "../change";
import { SyncRequestContext } from "../context";
import { applyPermissionNeededJoins } from "./join/permissions";
import { applyEntityDataSelect, applyEntityIdSelect } from "./select/kinds";
import { applyPermissionWhereCauses } from "./where/permissions";

const log = createLogger("Permission query", false);

function createBasePermissionMapQuery<T>(
  entity: string,
  rule: PermissionRule<T>,
  context: SyncRequestContext
) {
  const { db } = context;

  let rootQuery = db.from(`${entity}`);

  rootQuery = applyPermissionNeededJoins(
    rootQuery,
    entity,
    rule,
    context.schema
  );

  rootQuery = applyPermissionWhereCauses(rootQuery, entity, rule, context);

  return rootQuery;
}

export function createAccessQuery<T>(
  context: SyncRequestContext,
  entity: string,
  operation: PermissionOperationType = "read"
) {
  const permission = pickPermissionsRule(
    context.permissions,
    entity,
    operation
  );

  if (!permission) return null;

  let query = createBasePermissionMapQuery(entity, permission, context);

  query = applyEntityIdSelect(query, entity);

  query = query.limit(1);

  return query;
}

export function createInitialLoadQuery<T>(
  context: SyncRequestContext,
  entity: string
) {
  const permission = pickPermission(context, entity, "read");

  if (!permission) return null;

  let query = createBasePermissionMapQuery(entity, permission.rule, context);

  query = applyEntityDataSelect(query, entity, permission);

  query = query.groupBy(`${entity}.${context.schema.getIdField(entity)}`);

  log("init", query.toString(), { permission });

  return query;
}
