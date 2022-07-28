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

export type SchemaEntityRelationBase = {
  name: string;
  target: string;
  field: string;
};

export type SchemaEntityReferenceRelation = SchemaEntityRelationBase & {
  type: "reference";
  isNullable: boolean;
};

export type SchemaEntityListRelation = SchemaEntityRelationBase & {
  type: "collection";
};

export type SchemaEntityRelation =
  | SchemaEntityReferenceRelation
  | SchemaEntityListRelation;

export interface DbSchema {
  entities: SchemaEntity[];
}
