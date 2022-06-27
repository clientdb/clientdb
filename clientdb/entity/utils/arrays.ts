/**
 * Optimized way to pick items that are present in both arrays
 */
 export function getArraysCommonPart<T extends object>(itemsA: T[], itemsB: T[]) {
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

export function areArraysShallowEqual<T>(a: T[], b: T[]) {
  if (a === b) return true;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (!Array.isArray(a)) return false;

  if (a.length !== b.length) return false;

  return a.every((item, index) => item === b[index]);
}