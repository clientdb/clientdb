export type Primitive = string | number | bigint | boolean | symbol | null | undefined;

export function isPrimitive(input: unknown): input is Primitive {
  if (typeof input === "object" || typeof input === "function") {
    return input === null;
  }

  return true;
}

export function isNotPrimitive(input: unknown): input is object {
  if (typeof input === "object" || typeof input === "function") {
    return true;
  }

  return input !== null;
}
