import { SyncRequestContext } from "@clientdb/server/context";
import { PermissionRule } from "@clientdb/server/permissions/types";
import { applyQueryWhere } from "@clientdb/server/utils/conditions/builder";
import { Knex } from "knex";
import { createPermissionWhereConditions } from "./conditions";

type QueryBuilder = Knex.QueryBuilder;

export function applyPermissionWhereCauses(
  query: QueryBuilder,
  entity: string,
  permission: PermissionRule<any>,
  context: SyncRequestContext
) {
  const conditions = createPermissionWhereConditions(
    entity,
    permission,
    context.schema
  );

  query = applyQueryWhere(query, conditions, context);

  return query;
}
