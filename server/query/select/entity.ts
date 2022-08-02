import { DbSchemaModel } from "@clientdb/schema";
import { SyncRequestContext } from "@clientdb/server/context";
import { pickPermission } from "@clientdb/server/permissions/picker";
import {
  ReadPermission,
  PermissionOperationType,
} from "@clientdb/server/permissions/types";
import { QueryBuilder } from "@clientdb/server/query/types";

interface Input {
  entity: string;
  context: SyncRequestContext;
  alias: string;
}

export function createEntityDataSelect({ entity, context, alias }: Input) {
  const db = context.db;
  const permission = pickPermission(context.permissions, entity, "read");

  if (!permission) {
    throw new Error(`No read permission for ${entity}`);
  }

  const allowedFields = permission.fields as string[];

  const jsonFieldsSpec = allowedFields
    .map((field) => {
      const selector = db.ref(`${entity}.${field}`);
      // TODO: This is part of knex.select, so no direct risk of SQL injection, but ${field} could be sanitized
      return `'${field}', ${selector}`;
    })
    .join(", ");

  const aliasRef = db.ref(alias);
  return context.db.raw(`json_build_object(${jsonFieldsSpec}) as ${aliasRef}`);
}

export function applyEntityIdSelect(
  query: QueryBuilder,
  entity: string,
  schema: DbSchemaModel
) {
  const idField = schema.getIdField(entity);

  if (!idField) {
    throw new Error(`No id field found for ${entity}`);
  }

  return query.select(query.client.ref(`${entity}.${idField}`));
}

export function applyEntityDataSelect(
  query: QueryBuilder,
  entity: string,
  context: SyncRequestContext,
  operation: PermissionOperationType
) {
  if (operation === "remove") {
    return applyEntityIdSelect(query, entity, context.schema);
  }

  const permission = pickPermission(context.permissions, entity, operation);

  if (!permission) {
    return applyEntityIdSelect(query, entity, context.schema);
  }

  if (!permission.fields) {
    return query.select(query.client.ref(`${entity}.*`));
  }

  const selectFields = permission.fields.map((field) => {
    return `${entity}.${field}`;
  });

  return query.select(selectFields);
}
