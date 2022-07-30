import { SyncRequestContext } from "@clientdb/server/context";
import { PermissionRule } from "@clientdb/server/permissions/types";
import { Knex } from "knex";
import { applyQueryWhere } from "./builder";
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
