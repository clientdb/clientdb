import { DbSchemaModel } from "../../schema/model";
import { WherePermission } from "../../schema/types";
import { traversePermissions } from "./traverse";

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

export function createUserSelects<T>(
  entity: string,
  permissions: WherePermission<T>,
  schema: DbSchemaModel,
  userTable: string
): string[] {
  const userIdField = schema.getIdField(userTable);

  if (!userIdField) {
    throw new Error(`User table ${userTable} has no id field`);
  }

  const userSelects: string[] = [];
  traversePermissions(entity, permissions, schema, {
    onValue({ key, table, selectPath }) {
      const isPointingToUserId = getIsFieldPointingToUserId(
        table,
        key,
        schema,
        userTable
      );

      if (getIsFieldPointingToUserId(table, key, schema, userTable)) {
        userSelects.push(selectPath);
      }
    },
  });

  return userSelects;
}
