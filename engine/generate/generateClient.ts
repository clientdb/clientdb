import * as ts from "typescript";
import { Expression, factory, SyntaxKind } from "typescript";
import { pgTypeToTsType } from "../introspection/pg/pgTsTypes";
import {
  DbSchema,
  SchemaEntity,
  SchemaEntityAttribute,
  SchemaEntityListRelation,
  SchemaEntityReferenceRelation,
} from "../schema/schema";
import { createLookup } from "../utils/createLookup";
import { formatTypeScript } from "../utils/prettier";
import { upperFirst } from "../utils/string";
import { objToTSNode } from "../utils/tsAST";

function prepareEntityNames(entity: SchemaEntity) {
  const upper = upperFirst(entity.name);
  return {
    kind: entity.name,
    className: upper,
    entityDeclaration: entity.name + "Entity",
    entityType: upper + "Entity",
    dataInterface: upper + "Data",
    relationsInterface: upper + "Relations",
  };
}

function propSignature(name: string, typeNode: ts.TypeNode) {
  const prop = factory.createPropertySignature(
    undefined,
    name,
    undefined,
    typeNode
  );

  return prop;
}

function simplePropSignature(name: string, type: string) {
  return propSignature(
    name,
    factory.createTypeReferenceNode(factory.createIdentifier(type), undefined)
  );
}

function attributePropSignature(attr: SchemaEntityAttribute) {
  const tsType = pgTypeToTsType(attr.type);

  return simplePropSignature(attr.name, tsType);
}

function refPropSignature(
  attr: SchemaEntityReferenceRelation,
  ctx: GenerateClientContext
) {
  const names = ctx.getNames(attr.referencedEntity)!;

  const prop = factory.createPropertySignature(
    undefined,
    factory.createIdentifier(attr.name),
    undefined,
    factory.createTypeReferenceNode(
      factory.createIdentifier(names.entityType),
      undefined
    )
  );

  return prop;
}

function collectionType(entity: SchemaEntity) {
  const names = prepareEntityNames(entity);

  return factory.createTypeReferenceNode(
    factory.createIdentifier("Collection"),
    [
      factory.createTypeReferenceNode(
        factory.createIdentifier(names.entityType),
        undefined
      ),
    ]
  );
}

function listPropSignature(
  attr: SchemaEntityListRelation,
  ctx: GenerateClientContext
) {
  const collectionOfEntity = collectionType(
    ctx.getEntityByName(attr.referencedByEntity)!
  );

  const prop = factory.createPropertySignature(
    undefined,
    factory.createIdentifier(attr.name),
    undefined,
    collectionOfEntity
  );

  return prop;
}

function exportedInterface(name: string, props: ts.PropertySignature[]) {
  const interfaceNode = factory.createInterfaceDeclaration(
    undefined,
    [factory.createModifier(SyntaxKind.ExportKeyword)],
    factory.createIdentifier(name),
    undefined,
    undefined,
    props
  );

  return interfaceNode;
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
    factory.createLiteralTypeNode(factory.createStringLiteral(names.kind))
  );

  const dataInterface = exportedInterface(names.dataInterface, [
    kindProp,
    ...attributeMembers,
  ]);
  const relationsInterface = exportedInterface(names.relationsInterface, [
    ...relationMembers,
  ]);

  return [dataInterface, relationsInterface] as const;
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

function importMany(from: string, items: string[]) {
  const importSpecifiers = items.map((item) => {
    return factory.createImportSpecifier(
      false,
      undefined,
      factory.createIdentifier(item)
    );
  });
  return factory.createImportDeclaration(
    undefined,
    undefined,
    factory.createImportClause(
      false,
      undefined,
      factory.createNamedImports(importSpecifiers)
    ),
    factory.createStringLiteral(from),
    undefined
  );
}

function entityDeclaration(entity: SchemaEntity, ctx: GenerateClientContext) {
  const names = prepareEntityNames(entity);

  const entityDeclaration = factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(names.entityDeclaration),
          undefined,
          undefined,
          factory.createCallExpression(
            factory.createIdentifier("createEntityFromSchema"),
            [
              factory.createTypeReferenceNode(
                factory.createIdentifier(names.dataInterface),
                undefined
              ),
              factory.createTypeReferenceNode(
                factory.createIdentifier(names.relationsInterface),
                undefined
              ),
            ],
            [
              factory.createIdentifier("schema"),
              factory.createStringLiteral(names.kind),
            ]
          )
        ),
      ],
      ts.NodeFlags.Const
    )
  );

  const entityType = factory.createTypeAliasDeclaration(
    undefined,
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier(names.entityType),
    undefined,
    factory.createTypeReferenceNode(
      factory.createIdentifier("EntityByDefinition"),
      [
        factory.createTypeQueryNode(
          factory.createIdentifier(names.entityDeclaration),
          undefined
        ),
      ]
    )
  );

  return [entityDeclaration, entityType];
}

function exportConstNode(name: string, value: Expression) {
  const declaration = factory.createVariableDeclaration(
    name,
    undefined,
    undefined,
    value
  );

  const constDefinition = factory.createVariableDeclarationList(
    [declaration],
    ts.NodeFlags.Const
  );

  return constDefinition;
}

type GenerateClientContext = ReturnType<typeof createGenerateClientContext>;

function printTs(nodes: ts.NodeArray<ts.Node>) {
  const sourceFile = ts.createSourceFile(
    "__.ts",
    "",
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS
  );

  const printer = ts.createPrinter({ removeComments: false });

  const outputFile = printer.printList(
    ts.ListFormat.MultiLine,
    nodes,
    sourceFile
  );

  return formatTypeScript(outputFile);
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

  const schemaObjectNode = exportConstNode(
    "schema",
    objToTSNode(factory, schema)
  );

  const nodes = factory.createNodeArray([
    imports,
    ...entityInterfaces.flat(),
    schemaObjectNode,
    ...entityDeclarations.flat(),
  ]);

  const output = printTs(nodes);

  console.log(output);
}
