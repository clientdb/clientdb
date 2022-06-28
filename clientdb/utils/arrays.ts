import { sortBy } from "lodash";

/**
 * Optimized way to pick items that are present in both arrays
 */
export function getTwoArraysCommonPart<T extends object>(
  itemsA: T[],
  itemsB: T[]
) {
  // Use weekset as it has O(1) .has call cost
  const weakA = new WeakSet(itemsA);
  const weakB = new WeakSet(itemsB);

  const results: T[] = [];

  // Iterate on shorter array when comparing
  if (itemsA.length > itemsB.length) {
    for (const itemB of itemsB) {
      if (weakA.has(itemB)) results.push(itemB);
    }
  } else {
    for (const itemA of itemsA) {
      if (weakB.has(itemA)) results.push(itemA);
    }
  }

  return results;
}

export function getArraysCommonPart<T extends object>(...arrays: Array<T[]>) {
  if (arrays.length === 0) return [];
  if (arrays.length === 1) return arrays[0];

  const fromShortest = sortBy(arrays, (array) => array.length);

  const [first, ...arraysToCheck] = fromShortest;

  const remainingItems = new Set(first);

  for (const nextArray of arraysToCheck) {
    for (const remainingItem of remainingItems) {
      if (!nextArray.includes(remainingItem)) {
        remainingItems.delete(remainingItem);

        if (remainingItems.size === 0) return [];
      }
    }
  }

  return Array.from(remainingItems);
}

export function areArraysShallowEqual<T>(a: T[], b: T[]) {
  if (a === b) return true;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (!Array.isArray(a)) return false;

  if (a.length !== b.length) return false;

  return a.every((item, index) => item === b[index]);
}

export function moveElementToStart<T>(items: T[], item: T) {
  const itemIndex = items.indexOf(item);

  if (itemIndex === -1 || itemIndex === 0) return;

  const currentItemAtStart = items[0];

  items[0] = item;
  items[itemIndex] = currentItemAtStart;
}

export function getMaxBy<T>(items: T[], getter: (item: T) => number) {
  return items.reduce((max, item) => {
    const value = getter(item);

    if (value > max) return value;

    return max;
  }, -Infinity);
}
