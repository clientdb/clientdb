import { isEqual } from "lodash";

export type Changes<T> = {
  [key in keyof T]?: [before: T[key], after: T[key]];
};

export function pickBeforeFromChanges<T>(changes: Changes<T>): Partial<T> {
  const before: Partial<T> = {};

  for (const key in changes) {
    if (changes.hasOwnProperty(key)) {
      before[key] = changes[key]![0];
    }
  }

  return before;
}

export function pickAfterFromChanges<T>(changes: Changes<T>): Partial<T> {
  const after: Partial<T> = {};

  for (const key in changes) {
    if (changes.hasOwnProperty(key)) {
      after[key] = changes[key]![1];
    }
  }

  return after;
}

export function computeChanges<T>(dataNow: T, input: Partial<T>): Changes<T> {
  const changes: Changes<T> = {};

  for (const inputKey in input) {
    if (input.hasOwnProperty(inputKey)) {
      const inputValue = input[inputKey]!;
      if (!isEqual(inputValue, dataNow[inputKey])) {
        changes[inputKey] = [dataNow[inputKey], inputValue];
      }
    }
  }

  return changes;
}
