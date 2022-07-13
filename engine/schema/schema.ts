export interface SchemaEntity {
  name: string;
  idField: string;
  attributes: SchemaEntityAttribute[];
  relations: SchemaEntityRelation[];
}

export type SchemaEntityAttributeType = string;

export interface SchemaEntityAttribute {
  name: string;
  type: SchemaEntityAttributeType;
  isNullable: boolean;
}

export type SchemaEntityReferenceRelation = {
  type: "reference";
  name: string;
  isNullable: boolean;
  referencedEntity: string;
  referenceField: string;
};

export type SchemaEntityListRelation = {
  type: "collection";
  name: string;
  referencedByEntity: string;
  referencedByField: string;
};

export type SchemaEntityRelation =
  | SchemaEntityReferenceRelation
  | SchemaEntityListRelation;

export interface DbSchema {
  entities: SchemaEntity[];
}
