import { DbSchema } from "./schema";

export function createSchemaModel(schema: DbSchema) {
  function getEntity(name: string) {
    const entity = schema.entities.find((e) => e.name === name);
    if (!entity) {
      return null;
    }
    return entity;
  }

  function getAttribute(entityName: string, name: string) {
    const entity = getEntity(entityName);
    const attribute = entity?.attributes.find((a) => a.name === name);
    if (!attribute) {
      return null;
    }
    return attribute;
  }

  function getIdField(entityName: string) {
    const entity = getEntity(entityName);
    if (!entity) {
      return null;
    }
    return entity.idField;
  }

  function getRelation(entityName: string, name: string) {
    const entity = getEntity(entityName);
    const relation = entity?.relations.find((r) => r.name === name);
    if (!relation) {
      return null;
    }
    return relation;
  }

  function getRelationByColumn(tableName: string, column: string) {
    const entity = getEntity(tableName);

    if (!entity) return null;

    const relation = entity.relations.find((relation) => {
      if (relation.type !== "reference") return false;

      return relation.field === column;
    });

    if (relation?.type !== "reference") return null;

    return relation;
  }

  function getEntityReferencedBy(tableName: string, column: string) {
    const relation = getRelationByColumn(tableName, column);

    if (relation) {
      return getEntity(relation.target);
    }

    if (column === getIdField(tableName)) {
      return getEntity(tableName);
    }

    return null;
  }

  function getFieldTargetEntity(entityName: string, field: string) {
    const relation = getRelation(entityName, field);

    if (!relation) return null;

    if (relation.type === "reference") {
      return getEntity(relation.target);
    }

    if (relation.type === "collection") {
      return getEntity(relation.target);
    }

    throw new Error(`Unsupported relation type`);
  }

  function getRelationsBetween(from: string, to: string) {
    if (from === to) {
      return [];
    }

    const fromSchema = getEntity(from);

    if (!fromSchema) {
      return [];
    }

    return fromSchema.relations.filter((relation) => {
      if (relation.type === "reference" && relation.target === to) {
        return true;
      }

      if (relation.type === "collection" && relation.target === to) {
        return true;
      }

      return false;
    });
  }

  return {
    get entities() {
      return schema.entities;
    },
    getEntity,
    getAttribute,
    getRelation,
    getIdField,
    getRelationsBetween,
    getEntityReferencedBy,
    getFieldTargetEntity,
  };
}

export type DbSchemaModel = ReturnType<typeof createSchemaModel>;
