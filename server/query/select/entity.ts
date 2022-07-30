import { DbSchemaModel } from "@clientdb/schema";
import { SyncRequestContext } from "@clientdb/server/context";
import { pickPermission } from "@clientdb/server/permissions/picker";
import { EntityReadPermissionConfig } from "@clientdb/server/permissions/types";
import { QueryBuilder } from "@clientdb/server/query/types";

interface Input {
  entity: string;
  context: SyncRequestContext;
  alias: string;
}

function getAllEntityFields(entity: string, schema: DbSchemaModel) {
  const entityData = schema.getEntity(entity);

  if (!entityData) {
    throw new Error(`Entity ${entity} not found`);
  }

  return entityData.attributes.map((field) => field.name);
}

export function createEntityDataSelect({ entity, context, alias }: Input) {
  const db = context.db;
  const permission = pickPermission(context.permissions, entity, "read");

  if (!permission) {
    throw new Error(`No read permission for ${entity}`);
  }

  const allowedFields =
    permission.fields ?? getAllEntityFields(entity, context.schema);

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
