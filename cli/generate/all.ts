import { factory as $ts } from "typescript";
import { pgTypeToTsType } from "../introspection/pg/pgTsTypes";
import {
  DbSchema,
  SchemaEntity,
  SchemaEntityAttribute,
  SchemaEntityListRelation,
  SchemaEntityReferenceRelation,
} from "../schema/schema";
import { createLookup } from "../utils/createLookup";
import { upperFirst } from "../utils/string";
import { objToTSNode } from "../utils/tsAST";
import { printTs } from "./print";

import {
  exportConstNode,
  exportedInterface,
  exportedType,
  importMany,
  propSignature,
  simplePropSignature,
} from "./utils";

function prepareEntityNames(entity: SchemaEntity) {
  const upper = upperFirst(entity.name);
  return {
    kind: entity.name,
    className: upper,
    entityDeclaration: entity.name + "Entity",
    entityType: upper + "Entity",
    dataInterface: upper + "Data",
    viewInterface: upper + "View",
  };
}

function attributePropSignature(attr: SchemaEntityAttribute) {
  const tsType = pgTypeToTsType(attr.type);

  return simplePropSignature(attr.name, tsType);
}

function refPropSignature(
  attr: SchemaEntityReferenceRelation,
  ctx: GenerateClientContext
) {
  const names = ctx.getNames(attr.target)!;

  const prop = $ts.createPropertySignature(
    undefined,
    $ts.createIdentifier(attr.name),
    undefined,
    $ts.createTypeReferenceNode(
      $ts.createIdentifier(names.entityType),
      undefined
    )
  );

  return prop;
}

function collectionType(entity: SchemaEntity) {
  const names = prepareEntityNames(entity);

  return $ts.createTypeReferenceNode($ts.createIdentifier("Collection"), [
    $ts.createTypeReferenceNode(
      $ts.createIdentifier(names.entityType),
      undefined
    ),
  ]);
}

function listPropSignature(
  attr: SchemaEntityListRelation,
  ctx: GenerateClientContext
) {
  const collectionOfEntity = collectionType(ctx.getEntityByName(attr.target)!);

  const prop = $ts.createPropertySignature(
    undefined,
    $ts.createIdentifier(attr.name),
    undefined,
    collectionOfEntity
  );

  return prop;
}

function entityInterface(entity: SchemaEntity, ctx: GenerateClientContext) {
  const attributeMembers = entity.attributes.map((attr) => {
    return attributePropSignature(attr);
  });

  const names = prepareEntityNames(entity);

  const relationMembers = entity.relations.map((attr) => {
    if (attr.type === "reference") {
      return refPropSignature(attr, ctx);
    }

    if (attr.type === "collection") {
      return listPropSignature(attr, ctx);
    }

    throw new Error("Unknown relation type");
  });

  const kindProp = propSignature(
    "__kind",
    $ts.createLiteralTypeNode($ts.createStringLiteral(names.kind))
  );

  const dataInterface = exportedInterface(names.dataInterface, [
    kindProp,
    ...attributeMembers,
  ]);
  const relationsInterface = exportedInterface(names.viewInterface, [
    ...relationMembers,
  ]);

  const fullInterface = exportedInterface(names.className, [
    kindProp,
    ...attributeMembers,
    ...relationMembers,
  ]);

  return [dataInterface, relationsInterface, fullInterface] as const;
}

function createGenerateClientContext(schema: DbSchema) {
  const getEntityByName = createLookup(
    schema.entities,
    (entity) => entity.name
  );

  function getNames(name: string) {
    return prepareEntityNames(getEntityByName(name)!);
  }

  return {
    schema,
    getEntityByName,
    getNames,
  };
}

function entityDeclaration(entity: SchemaEntity, ctx: GenerateClientContext) {
  const names = prepareEntityNames(entity);

  const createEntityExpression = $ts.createCallExpression(
    $ts.createIdentifier("createEntityFromSchema"),
    [
      $ts.createTypeReferenceNode(
        $ts.createIdentifier(names.dataInterface),
        undefined
      ),
      $ts.createTypeReferenceNode(
        $ts.createIdentifier(names.viewInterface),
        undefined
      ),
    ],
    [$ts.createIdentifier("schema"), $ts.createStringLiteral(names.kind)]
  );

  const entityDeclaration = exportConstNode(
    names.entityDeclaration,
    createEntityExpression
  );

  const entityType = exportedType(
    names.entityType,
    $ts.createTypeReferenceNode($ts.createIdentifier("EntityByDefinition"), [
      $ts.createTypeQueryNode(
        $ts.createIdentifier(names.entityDeclaration),
        undefined
      ),
    ])
  );

  return [entityDeclaration, entityType] as const;
}

type GenerateClientContext = ReturnType<typeof createGenerateClientContext>;

function fullSchemaInterface(schema: DbSchema, ctx: GenerateClientContext) {
  const entitiesMap = schema.entities.map((entity) => {
    const names = prepareEntityNames(entity);
    return simplePropSignature(entity.name, names.className);
  });

  return exportedInterface("Schema", [...entitiesMap]);
}

function entitiesArray(schema: DbSchema) {
  const identifiers = schema.entities.map((entity) => {
    const names = prepareEntityNames(entity);
    return $ts.createIdentifier(names.entityDeclaration);
  });

  return exportConstNode(
    "entities",
    $ts.createArrayLiteralExpression(identifiers)
  );
}

export function generateClient(schema: DbSchema) {
  const ctx = createGenerateClientContext(schema);

  const imports = importMany("clientdb", [
    "createEntityFromSchema",
    "EntityByDefinition",
    "Collection",
  ]);

  const entityInterfaces = schema.entities.map((entity) => {
    return entityInterface(entity, ctx);
  });

  const entityDeclarations = schema.entities.map((entity) => {
    return entityDeclaration(entity, ctx);
  });

  const schemaObjectNode = exportConstNode("schema", objToTSNode($ts, schema));

  const schemaInterface = fullSchemaInterface(schema, ctx);

  const entities = entitiesArray(schema);

  const nodes = $ts.createNodeArray([
    imports,
    schemaInterface,
    ...entityInterfaces.flat(),
    schemaObjectNode,
    ...entityDeclarations.flat(),
    entities,
  ]);

  const output = printTs(nodes);

  console.info(output);
}
