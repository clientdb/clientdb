import { DbSchemaModel } from "@clientdb/schema";
import { mapPermissions } from "@clientdb/server/permissions/traverse";
import { PermissionRule } from "@clientdb/server/permissions/types";
import {
  parseWhereTree,
  RawWherePointer,
} from "@clientdb/server/utils/conditions/conditions";

export function createPermissionWhereConditions<T>(
  entity: string,
  permissions: PermissionRule<T>,
  schema: DbSchemaModel
) {
  const wherePointers = mapPermissions(entity, permissions, schema, {
    onValue({ schemaPath, value, conditionPath, field, table }) {
      const pointer: RawWherePointer = {
        table: table,
        conditionPath: conditionPath,
        condition: value,
        select: `${schemaPath.join("__")}.${field}`,
      };

      return pointer;
    },
  });

  return parseWhereTree(wherePointers);
}
