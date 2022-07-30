import { Knex } from "knex";
import { mapPermissions } from "./traverse";
import { applyQueryJoins, JoinInfo } from "@clientdb/server/query/joins";
import { DbSchemaModel } from "@clientdb/schema";
import { PermissionRule } from "./types";

export function createPermissionNeededJoins<T>(
  entity: string,
  rule: PermissionRule<T>,
  schema: DbSchemaModel
): JoinInfo[] {
  return mapPermissions<JoinInfo>(entity, rule, schema, {
    onRelation({ table, rule, relation, schemaPath, field, targetEntity }) {
      const from = schemaPath.join("__");

      if (relation.type === "reference") {
        return {
          table: targetEntity.name,
          from,
          fromColumn: relation.field,
          toColumn: schema.getIdField(targetEntity.name)!,
          alias: [...schemaPath, field].join("__"),
        };
      }

      if (relation.type === "collection") {
        return {
          table: targetEntity.name,
          from,
          fromColumn: schema.getIdField(table)!,
          toColumn: relation.field,
          alias: [...schemaPath, field].join("__"),
        };
      }

      throw new Error(`Unsupported relation type`);
    },
  });
}

export function applyPermissionNeededJoins<T>(
  query: Knex.QueryBuilder,
  entity: string,
  rule: PermissionRule<T>,
  schema: DbSchemaModel
) {
  const joins = createPermissionNeededJoins(entity, rule, schema);
  return applyQueryJoins(query, joins);
}
