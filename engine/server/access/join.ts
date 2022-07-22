import { DbSchemaModel } from "../../schema/model";
import { WherePermission } from "../../schema/types";
import { traversePermissions } from "./traverse";

function getJoinColumns(from: string, to: string, schema: DbSchemaModel) {
  const entitySchema = schema.getEntity(from);

  if (!entitySchema) throw new Error(`Entity ${from} not found`);

  const relations = schema.getRelationsBetween(from, to);

  if (relations.length === 0) {
    throw new Error(`No relation between ${from} and ${to}`);
  }

  if (relations.length > 1) {
    throw new Error(
      `Multiple relations between ${from} and ${to} are not supported`
    );
  }

  const [relation] = relations;

  if (relation.type === "reference") {
    const targetEntityIdField = schema.getIdField(relation.referencedEntity)!;
    return [relation.referenceField, targetEntityIdField] as const;
  }

  if (relation.type === "collection") {
    return [entitySchema.idField, relation.referencedByField] as const;
  }

  throw new Error(`Unsupported relation type`);
}

export interface JoinInfo {
  fromTable: string;
  toTable: string;
  fromColumn: string;
  toColumn: string;
  alias: string;
}

export function createJoins<T>(
  entity: string,
  permissions: WherePermission<T>,
  schema: DbSchemaModel
): JoinInfo[] {
  const joins: JoinInfo[] = [];
  traversePermissions(entity, permissions, schema, {
    onRelation({ key, path, relation }) {
      const [fromColumn, toColumn] = getJoinColumns(entity, key, schema);

      joins.push({
        fromTable: entity,
        toTable: key,
        fromColumn: fromColumn,
        toColumn: toColumn,
        alias: `${path.join("__")}`,
      });
    },
  });

  return joins;
}
