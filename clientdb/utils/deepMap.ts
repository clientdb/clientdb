import { EqualValueReuser, createReuseValueGroup } from "./createEqualReuser";

const targetSymbol = { symbol: Symbol("target") };
const equalReuserSymbol = { symbol: Symbol("equalReuserSymbol") };
const undefinedSymbol = { symbol: Symbol("undefined") };

interface Options {
  /**
   * Allows getting the same value for equal keys. eg.
   *
   * deepMap.get([{foo: 2}])
   * deepMap.get([{foo: 2}])
   *
   * Both would return the same ref value, even tho those are identical, but different ref objects as input
   */
  checkEquality?: boolean;
  useWeakMap?: boolean;
}

type AnyMap = Map<unknown, unknown>;

/**
 * Creates map that can hold value arbitrarily deep.
 *
 * usage:
 *
 * const foo = createDeepMap<number>();
 *
 * foo.get([a,b,c,d,e,f], () => {
 *   // will be called only if value does not exist yet
 *   return 42;
 * }); // 42
 */
export function createDeepMap<V>({ checkEquality = false, useWeakMap = false }: Options = {}) {
  const MapToUse = useWeakMap ? WeakMap : Map;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = new MapToUse<any, unknown>();
  if (checkEquality) {
    root.set(equalReuserSymbol, createReuseValueGroup());
  }

  function getFinalTargetMap(path: unknown[]) {
    let currentTarget = root;

    for (let part of path) {
      if (part === undefined) part = undefinedSymbol;
      if (checkEquality) {
        const currentReuser = currentTarget.get(equalReuserSymbol) as EqualValueReuser;
        part = currentReuser(part);
      }

      if (currentTarget.has(part)) {
        currentTarget = currentTarget.get(part) as AnyMap;
        continue;
      }

      const nestedMap = new MapToUse();

      if (checkEquality) {
        nestedMap.set(equalReuserSymbol, createReuseValueGroup());
      }

      currentTarget.set(part, nestedMap);

      currentTarget = nestedMap;
    }

    return currentTarget;
  }

  function has(path: unknown[]) {
    const targetMap = getFinalTargetMap(path);

    return targetMap.has(targetSymbol);
  }

  function set(path: unknown[], value: V) {
    const targetMap = getFinalTargetMap(path);

    targetMap.set(targetSymbol, value);
  }

  function get(path: unknown[]) {
    const targetMap = getFinalTargetMap(path);

    return targetMap.get(targetSymbol) as V | undefined;
  }

  function getOrCreate(path: unknown[], factory: () => V) {
    const targetMap = getFinalTargetMap(path);

    if (targetMap.has(targetSymbol)) {
      return targetMap.get(targetSymbol) as V;
    }

    const newResult = factory();

    targetMap.set(targetSymbol, newResult);

    return newResult;
  }

  return { getOrCreate, has, set, get };
}

/**
 * Lodash memoize is based on serialization and is only using first arguments as cache keys
 */
export function deepMemoize<A extends unknown[], R>(callback: (...args: A) => R, options?: Options) {
  const deepMap = createDeepMap<R>(options);

  return function getMemoized(...args: A): R {
    return deepMap.getOrCreate(args, () => callback(...args));
  };
}

export function weakMemoize<A extends object[], R>(callback: (...args: A) => R) {
  const deepMap = createDeepMap<R>({ useWeakMap: true });

  return function getMemoized(...args: A): R {
    return deepMap.getOrCreate(args, () => callback(...args));
  };
}
