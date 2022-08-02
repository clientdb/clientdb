import { DbSchemaModel } from "@clientdb/schema";
import { applyQueryJoins, JoinInfo } from "@clientdb/server/query/joins";
import { Knex } from "knex";
import { debug } from "../utils/logger";
import { getRawModelRule, PermissionRuleModel } from "./model";
import { pickFromRule } from "./traverse";

function removeLast<T>(items: T[]) {
  return items.slice(0, -1);
}

export function createPermissionNeededJoins<T>(
  baseRule: PermissionRuleModel<T>
): JoinInfo[] {
  const schema = baseRule.$schema;

  return pickFromRule<JoinInfo>(baseRule, {
    onRelation({ entity, rule, selector, schemaPath }) {
      if (schemaPath.length <= 1) return;

      const parentEntity = rule.$parent?.$entity!;

      const relationName = schemaPath.at(-1)!;

      const relation = schema.getRelation(parentEntity, relationName)!;

      if (!parentEntity) return;

      const selfSelector = removeLast(schemaPath).join("__");

      if (relation.type === "reference") {
        return {
          from: selfSelector,
          fromColumn: relation.field,
          toColumn: rule.$schema.getIdField(entity)!,
          to: entity,
          alias: selector,
        };
      }

      if (relation.type === "collection") {
        return {
          from: selfSelector,
          fromColumn: rule.$schema.getIdField(entity)!,
          toColumn: relation.field,
          to: entity,
          alias: selector,
        };
      }

      throw new Error(`Unsupported relation type`);
    },
  });
}

export function applyPermissionNeededJoins<T>(
  query: Knex.QueryBuilder,
  rule: PermissionRuleModel<T>
) {
  const joins = createPermissionNeededJoins(rule);
  return applyQueryJoins(query, joins);
}
