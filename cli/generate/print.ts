import * as ts from "typescript";
import { formatTypeScript } from "../utils/prettier";

export function printTs(nodes: ts.NodeArray<ts.Node>) {
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
