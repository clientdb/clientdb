import { IComputedValueOptions, Reaction, createAtom } from "mobx";

import { createSharedInterval, sharedDefer } from "./sharedDefer";

export type CachedComputed<T> = {
  get(): T;
  dispose(): void;
};

export const CACHED_COMPUTED_ALIVE_TIME = 15 * 1000;

/**
 * Normally we keep not used computed alive for KEEP_ALIVE_TIME_AFTER_UNOBSERVED time.
 *
 * Very often, however - we have 'cascade' of computed's one using another. One being disposed instantly causes other one
 * to not be observed. In such case we don't want to wait KEEP_ALIVE_TIME_AFTER_UNOBSERVED for each 'cascade' level.
 *
 * Thus we'll set this flag to true when disposing lazy computed to avoid waiting if other computed becomes unobserved during cascade.
 */
let isDisposalCascadeRunning = false;

export interface CachedComputedOptions<T> extends IComputedValueOptions<T> {
  debugId?: string;
}

const sharedDisopseInterval = createSharedInterval(CACHED_COMPUTED_ALIVE_TIME);

/**
 * This is computed that connect advantages of both 'keepAlive' true and false of normal computed:
 *
 * - we keep cached version even if it is not observed
 * - we keep this lazy meaning value is never re-computed if not requested
 *
 * It provided 'dispose' method, but will also dispose itself automatically if not used for longer than KEEP_ALIVE_TIME_AFTER_UNOBSERVED
 */
export function cachedComputedWithoutArgs<T>(
  getter: () => T,
  options: CachedComputedOptions<T> = {}
): CachedComputed<T> {
  const { name = "CachedComputed", equals, debugId } = options;

  // return computed(getter, options);

  let latestValue: T;
  let needsRecomputing = true;
  let currentReaction: Reaction | null;

  const updateSignal = createAtom(
    name,
    () => {
      sharedDisopseInterval.remove(dispose);
    },
    handleBecameUnobserved
  );

  function handleBecameUnobserved() {
    // It became unobserved as result of other lazyComputed disposing. We don't need to wait for 'keep alive' time
    if (isDisposalCascadeRunning) {
      // Use timeout to avoid max-call-stack in case of very long computed>computed dependencies chains

      sharedDefer(dispose);
      return;
    }

    sharedDisopseInterval.add(dispose);
  }

  // Will initialize reaction to watch that dependencies changed or re-use previous reaction if the same computed used multiple times
  function getOrCreateReaction() {
    if (currentReaction) {
      return currentReaction;
    }

    currentReaction = new Reaction(name, () => {
      // Dependencies it is tracking got outdated.
      // Set flag so on next value request we'll do full re-compute
      needsRecomputing = true;
      // Make observers re-run
      updateSignal.reportChanged();
    });

    return currentReaction;
  }

  function dispose() {
    try {
      sharedDisopseInterval.remove(dispose);
      // If other computed values become unobserved as result of this one being disposed - let them know so they instantly dispose in cascade
      isDisposalCascadeRunning = true;

      // It was already disposed
      if (!currentReaction) {
        return;
      }

      needsRecomputing = true;

      currentReaction.dispose();

      currentReaction = null;
    } finally {
      isDisposalCascadeRunning = false;
    }
  }

  let currentComputingError: null | unknown = null;

  const recomputeValueIfNeeded = () => {
    // No dependencies did change since we last computed.
    if (!needsRecomputing) {
      return;
    }

    let newValue: T;
    // We need to re-compute
    getOrCreateReaction().track(() => {
      // Assign new value so it can be reused. Also we're tracking getting it so reaction knows if dependencies got outdated
      try {
        newValue = getter();
        currentComputingError = null;
      } catch (error) {
        currentComputingError = error;
      }
    });

    // Inform value is up to date
    needsRecomputing = false;

    if (!equals) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      latestValue = newValue!;
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (!equals(latestValue, newValue!)) {
      latestValue = newValue!;
    }
  };

  return {
    dispose,
    get() {
      // This is final 'getter'
      // If value is outdated - recompute it now (on demand - in lazy way)

      const isObserved = updateSignal.reportObserved();

      // ! This value is used, but outside of mobx observers world. Dont initiate reactions to avoid memory leak - simply return value without cache.
      if (!isObserved) {
        // We already have value - no need to re-compute it even tho it is not observed context
        if (!needsRecomputing) {
          return latestValue;
        }

        return getter();
      }

      recomputeValueIfNeeded();

      if (currentComputingError !== null) {
        throw currentComputingError;
      }

      return latestValue;
    },
  };
}
