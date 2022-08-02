import { SyncRequestContext } from "@clientdb/server/context";
import { PermissionRuleModel } from "@clientdb/server/permissions/model";
import { Knex } from "knex";
import { applyWhereTreeToQuery } from "./builder";
import { createPermissionWhereConditions } from "./conditions";

type QueryBuilder = Knex.QueryBuilder;

export function applyPermissionWhereCauses(
  query: QueryBuilder,
  rule: PermissionRuleModel<any>,
  context: SyncRequestContext
) {
  const conditions = createPermissionWhereConditions(rule);

  query = applyWhereTreeToQuery(query, conditions, context);

  return query;
}
