import * as typescript from "typescript";

type TypeScript = typeof typescript;

export function primitiveToTSNode(
  factory: typescript.NodeFactory,
  v: string | number | boolean
) {
  return typeof v === "string"
    ? factory.createStringLiteral(v)
    : typeof v === "number"
    ? factory.createNumericLiteral(v + "")
    : typeof v === "boolean"
    ? v
      ? factory.createTrue()
      : factory.createFalse()
    : undefined;
}

function isValidIdentifier(k: string): boolean {
  try {
    new Function(`return {${k}:1}`);
    return true;
  } catch (e) {
    return false;
  }
}

export function objToTSNode(factory: typescript.NodeFactory, obj: object) {
  if (typeof obj === "object" && !obj) {
    throw new Error("Cannot create TS node from null");
  }

  const props: typescript.PropertyAssignment[] = Object.entries(obj)
    .filter(([_, v]) => typeof v !== "undefined")
    .map(([k, v]) =>
      factory.createPropertyAssignment(
        isValidIdentifier(k) ? k : factory.createStringLiteral(k),
        primitiveToTSNode(factory, v) ||
          (Array.isArray(v)
            ? factory.createArrayLiteralExpression(
                v
                  .filter((n) => typeof n !== "undefined")
                  .map((n) => objToTSNode(factory, n))
              )
            : objToTSNode(factory, v))
      )
    );
  return factory.createObjectLiteralExpression(props);
}

export function literalToObj(ts: TypeScript, n: typescript.Node) {
  if (ts.isNumericLiteral(n)) {
    return +n.text;
  }
  if (ts.isStringLiteral(n)) {
    return n.text;
  }
  if (n.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (n.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
}

export function objectLiteralExpressionToObj(
  ts: TypeScript,
  obj: typescript.ObjectLiteralExpression
): object {
  return obj.properties.reduce((all: Record<string, any>, prop) => {
    if (ts.isPropertyAssignment(prop) && prop.name) {
      if (ts.isIdentifier(prop.name)) {
        all[prop.name.escapedText.toString()] = literalToObj(
          ts,
          prop.initializer
        );
      } else if (ts.isStringLiteral(prop.name)) {
        all[prop.name.text] = literalToObj(ts, prop.initializer);
      }
    }
    return all;
  }, {});
}
