import { DbSchemaModel } from "../../schema/model";
import { PermissionRule } from "../../schema/types";
import { traversePermissions } from "./traverse";

export interface JoinInfo {
  table: string;
  from: string;
  fromColumn: string;
  toColumn: string;
  alias: string;
}

export function createJoins<T>(
  entity: string,
  permissions: PermissionRule<T>,
  schema: DbSchemaModel
): JoinInfo[] {
  const joins: JoinInfo[] = [];
  traversePermissions(entity, permissions, schema, {
    onRelation({
      table,
      rule,
      relation,
      schemaPath,
      field,
      targetEntity,
      conditionPath,
    }) {
      const from = schemaPath.join("__");

      if (relation.type === "reference") {
        joins.push({
          table: targetEntity.name,
          from,
          fromColumn: relation.referenceField,
          toColumn: schema.getIdField(targetEntity.name)!,
          alias: [...schemaPath, field].join("__"),
        });
        return;
      }

      if (relation.type === "collection") {
        joins.push({
          table: targetEntity.name,
          from,
          fromColumn: schema.getIdField(table)!,
          toColumn: relation.referencedByField,
          alias: [...schemaPath, field].join("__"),
        });
        return;
      }

      throw new Error(`Unsupported relation type`);
    },
  });

  return joins;
}
