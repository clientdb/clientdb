
import { CachedComputedOptions, cachedComputedWithoutArgs } from "./cachedComputedWithoutArgs";
import { createDeepMap } from "./deepMap";
import { IS_DEV } from "./dev";

export type LazyComputed<T> = {
  get(): T;
  dispose(): void;
};

/**
 * Creates 'lazy computed', but with possibility of using multiple arguments
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cachedComputed<A extends any[], T>(getter: (...args: A) => T, options: CachedComputedOptions<T> = {}) {
  // For easier debugging - try to get name of getter function
  const getterName = getter.name || undefined;

  // TODO: cleanup map entries after lazy is disposed
  const map = createDeepMap<LazyComputed<T>>();
  function getComputed(...args: A) {
    return map.getOrCreate(args, () =>
      cachedComputedWithoutArgs(() => getter(...args), { name: getterName, ...options })
    );
  }

  function getValue(...args: A) {
    if (IS_DEV && args[2] && Array.isArray(args[2])) {
      console.warn(
        `You might be using cached computed directly as filter function. It will break caching. Use items.filter(item => cached(item)) instead of items.filter(cached)`
      );
    }
    return getComputed(...args).get();
  }

  return getValue;
}
