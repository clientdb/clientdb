import { Knex } from "knex";
import {
  EntityReadPermissionConfig,
  PermissionRule,
} from "../../../schema/types";
import { SyncRequestContext } from "../../context";
import { createUserSelects } from "./userSelect";

type QueryBuilder = Knex.QueryBuilder;

function applySelects(query: QueryBuilder, selects: string[]) {
  for (const select of selects) {
    query = query.select(select);
  }

  return query;
}

export function applyEntityIdSelect(query: QueryBuilder, entity: string) {
  return query.select(`${entity}.id`);
}

export function applyEntityDataSelect(
  query: QueryBuilder,
  entity: string,
  permission: EntityReadPermissionConfig<any>
) {
  const { fields } = permission;

  if (!fields) {
    return query.select(`${entity}.*`);
  }

  const selectFields = fields.map((field) => {
    return `${entity}.${field}`;
  });

  return query.select(selectFields);
}

export function applyAllowedUsersSelect(
  query: QueryBuilder,
  entity: string,
  permission: PermissionRule<any>,
  context: SyncRequestContext
) {
  const userSelects = createUserSelects(
    entity,
    permission,
    context.schema,
    "user"
  );

  query = applySelects(query, userSelects);

  return query;
}
