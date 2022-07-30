import { format } from "prettier";

export function formatTypeScript(code: string) {
  return format(code, { parser: "typescript" });
}
