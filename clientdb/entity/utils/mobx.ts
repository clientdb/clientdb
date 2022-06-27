import { action, untracked } from "mobx";

/**
 * Escape hatch for using mobx observables outside of observers without mobx warning
 */
 export function runUntracked<T>(getter: () => T): T {
  const inActionGetter = action(() => untracked(() => getter()));

  return inActionGetter();
}