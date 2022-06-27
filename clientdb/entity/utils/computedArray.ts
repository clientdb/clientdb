import { IComputedValueOptions, computed } from "mobx";

function getAreArraysSwallowEqual<T>(before: T[], after: T[]): boolean {
  if (before === after) return true;

  if (before.length !== after.length) return false;

  return before.every((item, index) => {
    return item === after[index];
  });
}

function getAreMaybeArraysSwallowEqual<T>(before: T, after: T): boolean {
  if (before === after) return true;

  if (Array.isArray(before) && Array.isArray(after)) {
    return getAreArraysSwallowEqual(before, after);
  }

  return false;
}

/**
 * Creates computed version of an array.
 *
 * It will return previous result, if array are swallow equal (have exactly the same set of results).
 *
 * It is helpful for example with queries, where we have to use `.filter` (which creates new array), but results are
 * often the same. Using `computedArray` in such cases will not trigger observers to re-run (or re-render) if new results
 * array is the same as previous one.
 */

export function computedArray<T>(factory: () => Array<T>, options?: IComputedValueOptions<T[]>) {
  return computed(factory, { ...options, equals: getAreArraysSwallowEqual });
}

/**
 * Similar to above, but usable in cases where we don't know if result is array.
 *
 * If it is, we'll still try to compare it like arrays, if it's not, we do default identity check.
 */
export function computedMaybeArray<T>(factory: () => T, options?: IComputedValueOptions<T>) {
  return computed(factory, { ...options, equals: getAreMaybeArraysSwallowEqual });
}
