import {
  CachedComputedOptions,
  cachedComputedWithoutArgs,
  CachedComputed,
} from "./cachedComputedWithoutArgs";
import { createDeepMap } from "./deepMap";
import { IS_DEV } from "./dev";

function isArrayMethodInlineCall(...args: any[]) {
  if (!args[2] || !Array.isArray(args[2])) return false;
  if (typeof args[1] !== "number") return false;

  return true;
}

interface Options<T> extends CachedComputedOptions<T> {
  equalCompareArgs?: boolean;
}

/**
 * Creates 'lazy computed', but with possibility of using multiple arguments
 */
export function cachedComputed<A extends any[], T>(
  getter: (...args: A) => T,
  options: Options<T> = {}
) {
  // For easier debugging - try to get name of getter function
  const getterName = getter.name || undefined;

  // TODO: cleanup map entries after lazy is disposed
  const map = createDeepMap<CachedComputed<T>>({
    checkEquality: options?.equalCompareArgs ?? false,
  });

  function getComputedForArgs(...args: A) {
    return map.getOrCreate(args, () =>
      cachedComputedWithoutArgs(() => getter(...args), {
        name: getterName,
        ...options,
      })
    );
  }

  function getValue(...args: A) {
    /**
     * This is guard for breaking cache by calling array methods inline.
     *
     * eg. const cachedIsItemBig = cachedComputed(item => item.isBig);
     *
     * and then doing things like
     * array.filter(cachedIsItemBig) instead of array.filter(item => cachedIsItemBig(item))
     *
     * those 2 seem exactly the same and it is very easy to not notice it, but in first case, 'cachedIsItemBig' will actually be called with 3 arguments instead of 1
     * as array.filter, or similar methods (map, etc) call with (item, index, arrayItself).
     *
     * We had performance regressions multiple times because of forgetting about it, so here is a warning for exactly this case.
     */
    if (IS_DEV && isArrayMethodInlineCall(...args)) {
      console.warn(
        `You might be using cached computed directly as array filter function or other array method. It will break caching. Use items.filter(item => cachedFunction(item)) instead of items.filter(cachedFunction)`
      );
    }
    return getComputedForArgs(...args).get();
  }

  return getValue;
}
