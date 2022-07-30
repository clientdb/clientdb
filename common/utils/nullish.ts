export type Nullish = null | undefined;

export function isNotNullish<T>(input: T | Nullish): input is T {
  return !isNullish(input);
}

export function isNullish(input: unknown): input is Nullish {
  return input === null || input === undefined;
}
