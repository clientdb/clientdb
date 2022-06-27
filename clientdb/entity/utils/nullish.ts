export type Nullish = null | undefined;

export function isNotNullish<T>(input: T | Nullish): input is T {
  return !isNullish(input);
}

export function isNullish(input: unknown): input is Nullish {
  return input === null || input === undefined;
}

export type Falsy = false | 0 | "" | null | undefined;

export function isNotFalsy<T>(input: T | Falsy): input is T {
  return !isFalsy(input);
}

export function isFalsy(input: unknown): input is Falsy {
  return !input;
}
