import { Knex } from "knex";
import { DbSchemaModel } from "../../../schema/model";
import { PermissionRule } from "../../../schema/types";
import { mapPermissions } from "../../permissions/traverse";

export interface JoinInfo {
  table: string;
  from: string;
  fromColumn: string;
  toColumn: string;
  alias: string;
}

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
          fromColumn: relation.referenceField,
          toColumn: schema.getIdField(targetEntity.name)!,
          alias: [...schemaPath, field].join("__"),
        };
      }

      if (relation.type === "collection") {
        return {
          table: targetEntity.name,
          from,
          fromColumn: schema.getIdField(table)!,
          toColumn: relation.referencedByField,
          alias: [...schemaPath, field].join("__"),
        };
      }

      throw new Error(`Unsupported relation type`);
    },
  });
}

export function applyJoins(query: Knex.QueryBuilder, joins: JoinInfo[]) {
  for (const join of joins) {
    const { toColumn, fromColumn, alias, from, table } = join;
    query = query.leftJoin(
      `${join.table} as ${alias}`,
      `${from}.${fromColumn}`,
      "=",
      `${alias}.${toColumn}`
    );
  }

  return query;
}

export function applyPermissionNeededJoins<T>(
  query: Knex.QueryBuilder,
  entity: string,
  rule: PermissionRule<T>,
  schema: DbSchemaModel
) {
  const joins = createPermissionNeededJoins(entity, rule, schema);
  return applyJoins(query, joins);
}
