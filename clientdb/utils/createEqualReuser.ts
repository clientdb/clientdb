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
export function createValueReuser() {
  const values: unknown[] = [];

  function getOrReuse<T>(targetValue: T): T {
    if (isPrimitive(targetValue)) {
      return targetValue;
    }

    if (values.includes(targetValue)) {
      return targetValue;
    }

    for (const [index, existingValue] of values.entries()) {
      if (isPlainObjectEqual(existingValue, targetValue)) {
        /**
         * Move existing value to start of array so it will be found faster next time
         */
        if (index === 0) return existingValue as T;

        const currentFirstValue = values[0];
        values[0] = existingValue;
        values[index] = currentFirstValue;
        return existingValue as T;
      }
    }

    values.unshift(targetValue);

    return targetValue;
  }

  return getOrReuse;
}

export type EqualValueReuser = ReturnType<typeof createValueReuser>;
