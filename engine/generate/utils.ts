import * as ts from "typescript";
import { Expression, factory as $ts, SyntaxKind } from "typescript";

export function propSignature(name: string, typeNode: ts.TypeNode) {
  const prop = $ts.createPropertySignature(
    undefined,
    name,
    undefined,
    typeNode
  );

  return prop;
}

export function simplePropSignature(name: string, type: string) {
  return propSignature(
    name,
    $ts.createTypeReferenceNode($ts.createIdentifier(type), undefined)
  );
}

export function exportedInterface(name: string, props: ts.PropertySignature[]) {
  const interfaceNode = $ts.createInterfaceDeclaration(
    undefined,
    [$ts.createModifier(SyntaxKind.ExportKeyword)],
    $ts.createIdentifier(name),
    undefined,
    undefined,
    props
  );

  return interfaceNode;
}

export function importMany(from: string, items: string[]) {
  const importSpecifiers = items.map((item) => {
    return $ts.createImportSpecifier(
      false,
      undefined,
      $ts.createIdentifier(item)
    );
  });
  return $ts.createImportDeclaration(
    undefined,
    undefined,
    $ts.createImportClause(
      false,
      undefined,
      $ts.createNamedImports(importSpecifiers)
    ),
    $ts.createStringLiteral(from),
    undefined
  );
}

export function exportedType(name: string, node: ts.TypeReferenceNode) {
  return $ts.createTypeAliasDeclaration(
    undefined,
    [$ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    $ts.createIdentifier(name),
    undefined,
    node
  );
}

export function exportConstNode(name: string, value: Expression) {
  const declaration = $ts.createVariableDeclaration(
    name,
    undefined,
    undefined,
    value
  );

  const constDefinition = $ts.createVariableDeclarationList(
    [declaration],
    ts.NodeFlags.Const
  );

  const exportedConstDefinition = $ts.createVariableStatement(
    [$ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    constDefinition
  );

  return exportedConstDefinition;
}
