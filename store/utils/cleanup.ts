import { runInAction } from "mobx";

export type CleanupOrder = "from-first" | "from-last";

export type CleanupObject = ReturnType<typeof createCleanupObject>;

export type Cleanup = () => void;
export type MaybeCleanup = Cleanup | void | undefined;

/**
 * Useful for cases when we have to clean multiple things in effects.
 *
 * ```ts
 * useEffect(() => {
 *   const cleanup = createCleanupObject();
 *
 *   cleanup.next = createTimeout();
 *   cleanup.next = createEvent();
 *
 *   return cleanup.clean;
 * })
 */
export function createCleanupObject() {
  const cleanups = new Set<Cleanup>();

  const cleanupObject = {
    clean() {
      /**
       * We start cleaning up from last items added. It is the same as eg, react effect where children effects are cleaned up before parents.
       *
       * Rationale is that cleanups added last might depend on something created before and if we clean them first, they might not be able to clean up properly.
       */
      const cleanupsList = [...cleanups].reverse();
      cleanups.clear();

      runInAction(() => {
        cleanupsList.forEach((cleanup) => {
          cleanup();
        });
      });
    },
    cleanOne(cleanup: Cleanup) {
      if (!cleanups.has(cleanup)) return false;

      cleanups.delete(cleanup);

      cleanup();

      return true;
    },
    set next(cleanupToAdd: MaybeCleanup | void) {
      if (!cleanupToAdd) return;

      cleanups.add(cleanupToAdd);
    },
    get size() {
      return cleanups.size;
    },
  };

  return cleanupObject;
}
