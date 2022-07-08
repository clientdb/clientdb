import { computed } from "mobx";
import { deepMemoize } from "./deepMap";

export const createArrayFirstComputed = deepMemoize(function createArrayFirstComputed<T>(array: T[]) {
  return computed((): T | null => {
    return array[0] ?? null;
  });
});
