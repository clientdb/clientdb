import { Knex } from "knex";
import { PermissionRule } from "../../../schema/types";
import { applyQueryWhere } from "../../../utils/conditions/builder";
import { SyncRequestContext } from "../../context";
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
