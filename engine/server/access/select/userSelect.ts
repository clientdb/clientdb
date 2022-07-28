import { DbSchemaModel } from "../../../schema/model";
import { PermissionRule } from "../../../schema/types";
import { SyncRequestContext } from "../../context";
import { mapPermissions } from "../../permissions/traverse";

function getIsFieldPointingToUserId(
  table: string,
  field: string,
  schema: DbSchemaModel,
  userTable: string
) {
  const userIdField = schema.getIdField(userTable);

  if (!userIdField) {
    throw new Error(`User table ${userTable} has no id field`);
  }

  if (table === userTable && field === userIdField) {
    return true;
  }

  const maybeUserEntity = schema.getEntityReferencedBy(table, field);

  return maybeUserEntity?.name === userTable;
}

export function getPermissionUserSelects<T>(
  entity: string,
  rule: PermissionRule<T>,
  context: SyncRequestContext
): string[] {
  const {
    schema,
    config: { userTable },
  } = context;
  const userIdField = schema.getIdField(userTable);

  if (!userIdField) {
    throw new Error(`User table ${userTable} has no id field`);
  }

  return mapPermissions<string>(entity, rule, schema, {
    onValue({ field, table, value, schemaPath }) {
      const isPointingToUserId = getIsFieldPointingToUserId(
        table,
        field,
        schema,
        userTable
      );

      if (isPointingToUserId) {
        return `${schemaPath.join("__")}.${field}`;
      }
    },
  });
}
