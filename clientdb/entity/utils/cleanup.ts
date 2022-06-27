

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
 *   cleanup.add(createTimeout());
 *   cleanup.add(createEvent());
 *
 *   return cleanup.clean;
 * })
 */
export function createCleanupObject() {
  const cleanups = new Set<Cleanup>();
  const cleanupObject = {
    clean() {
      const cleanupsList = [...cleanups];

      cleanupsList.forEach((cleanup) => {
        cleanups.delete(cleanup);
        cleanup();
      });
    },
    cleanOne(cleanup: Cleanup) {
      if (!cleanups.has(cleanup)) return false;

      cleanups.delete(cleanup);

      cleanup();
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
