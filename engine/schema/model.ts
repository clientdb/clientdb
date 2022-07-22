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

      return relation.referenceField === column;
    });

    if (relation?.type !== "reference") return null;

    return relation;
  }

  function getEntityReferencedBy(tableName: string, column: string) {
    const relation = getRelationByColumn(tableName, column);

    if (!relation) return null;

    return getEntity(relation.referencedEntity);
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
      if (relation.type === "reference" && relation.referencedEntity === to) {
        return true;
      }

      if (
        relation.type === "collection" &&
        relation.referencedByEntity === to
      ) {
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
  };
}

export type DbSchemaModel = ReturnType<typeof createSchemaModel>;
