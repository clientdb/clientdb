import { EntitiesSchema } from "./EntitiesSchema";
import { SchemaEntityInput } from "./schema";
import { EntitySchemaInput } from "./types";

export class EntitySchema {
  constructor(
    private input: SchemaEntityInput,
    public readonly schema: EntitiesSchema
  ) {}

  get name() {
    return this.input.name;
  }

  get idField() {
    return this.input.idField;
  }

  get allAttributeNames() {
    return this.attributes.map((a) => a.name);
  }

  get relations() {
    return this.input.relations;
  }

  get attributes() {
    return this.input.attributes;
  }

  get referenceRelations() {
    return this.input.relations.filter((r) => r.type === "reference");
  }

  get collectionRelations() {
    return this.input.relations.filter((r) => r.type === "collection");
  }

  getAttribute(name: string) {
    const attribute = this.input.attributes.find((a) => a.name === name);

    if (!attribute) return null;

    return attribute;
  }

  hasAttribute(name: string) {
    return !!this.getAttribute(name);
  }

  hasRelation(name: string) {
    return !!this.getRelation(name);
  }

  assertAttribute(name: string) {
    const attribute = this.getAttribute(name);

    if (!attribute) {
      throw new Error(`Attribute ${name} not found`);
    }

    return attribute;
  }

  getRelation(name: string) {
    const relation = this.input.relations.find((r) => r.name === name);

    if (!relation) return null;

    return relation;
  }

  assertRelation(name: string) {
    const relation = this.getRelation(name);

    if (!relation) {
      throw new Error(`Relation ${name} not found`);
    }

    return relation;
  }

  getReferencedEntity(field: string) {
    if (field === this.idField) {
      return this;
    }

    const relation = this.getRelation(field);

    if (relation) {
      return this.schema.assertEntity(relation.target);
    }

    const referenceRelation = this.referenceRelations.find(
      (r) => r.field === field
    );

    if (referenceRelation) {
      return this.schema.assertEntity(referenceRelation.target);
    }

    return null;
  }
}
