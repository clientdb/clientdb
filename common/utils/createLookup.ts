export function createLookup<T, K>(items: T[], keyGetter: (item: T) => K) {
  const lookup = new Map<K, T>();

  for (const item of items) {
    const key = keyGetter(item);
    lookup.set(key, item);
  }

  return function get(key: K) {
    return lookup.get(key);
  };
}
