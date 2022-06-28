/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
const getKeys = Object.keys;
const hasOwnProperty = Object.prototype.hasOwnProperty;
const isArray = Array.isArray;

/**
 * Simplified version of isEqual that compares plain objects.
 *
 * plain object - any json-like object eg. const foo = { bar: ['baz'] };
 *
 * It is way faster than eg lodash one (10-20x), but has limitations eg. will not detect circular objects, will not compare Sets or Maps etc. and simply return it is not equal.
 */
export function isPlainObjectEqual(x: any, y: any): boolean {
  if (x === y) return true;

  if (typeof x === "object" && typeof y === "object" && x !== null && y !== null) {
    if (isArray(x)) {
      if (isArray(y)) {
        let xLength = x.length,
          yLength = y.length;

        if (xLength !== yLength) return false;

        while (xLength--) {
          if (!isPlainObjectEqual(x[xLength], y[xLength])) return false;
        }

        return true;
      }

      return false;
    } else if (isArray(y)) {
      return false;
    } else {
      let xKeys = getKeys(x),
        xLength = xKeys.length,
        yKeys = getKeys(y),
        yLength = yKeys.length;

      if (xLength !== yLength) return false;

      while (xLength--) {
        const key = xKeys[xLength],
          xValue = x[key],
          yValue = y[key];

        if (!isPlainObjectEqual(xValue, yValue)) return false;

        if (yValue === undefined && !hasOwnProperty.call(y, key)) return false;
      }
    }

    return true;
  }

  return x !== x && y !== y;
}
