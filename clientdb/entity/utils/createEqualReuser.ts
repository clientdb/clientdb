import { isPlainObjectEqual } from "./isPlainObjectEqual";
import { isPrimitive } from "./primitive";

/**
 * Useful if we want to re-use ref to equal value.
 *
 * eg.
 *
 * const reuse = createEqualValueReuser()
 * const a = reuse({foo: 2});
 * const b = reuse({foo: 2});
 *
 * a === b // true
 *
 * const a = {foo: 2}
 * const b = {foo: 2}
 *
 * a === b // ! false
 *
 */
export function createReuseValueGroup() {
  const values = new Set<unknown>();

  function getOrReuse<T>(value: T): T {
    if (isPrimitive(value)) {
      return value;
    }

    for (const existingValue of values) {
      if (isPlainObjectEqual(existingValue, value)) {
        return existingValue as T;
      }
    }

    values.add(value);

    return value;
  }

  return getOrReuse;
}

export type EqualValueReuser = ReturnType<typeof createReuseValueGroup>;
