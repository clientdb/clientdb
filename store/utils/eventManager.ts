import { runInAction } from "mobx";
import { createCleanupObject } from "./cleanup";
import { IS_DEV } from "./dev";

type EventHandler<T extends unknown[]> = (...args: T) => void;

type Unsubscribe = () => void;

export type EventsEmmiter<EventsMap extends Record<string, unknown[]>> = {
  on<N extends keyof EventsMap>(
    name: N,
    handler: EventHandler<EventsMap[N]>
  ): Unsubscribe;
  onOneOf<N extends keyof EventsMap>(
    names: Array<N>,
    handler: EventHandler<EventsMap[N]>
  ): Unsubscribe;
  emit<N extends keyof EventsMap>(name: N, ...data: EventsMap[N]): void;
};

const DEV_DEBUG_EVENTS = false;

export function createEventsEmmiter<
  EventsMap extends Record<string, unknown[]>
>(debug?: string): EventsEmmiter<EventsMap> {
  const subscribersMap = new Map<
    keyof EventsMap,
    Set<EventHandler<unknown[]>>
  >();

  function getHandlersForEvent<N extends keyof EventsMap>(
    name: N
  ): Set<EventHandler<EventsMap[N]>> {
    const existingSet = subscribersMap.get(name);

    if (existingSet) return existingSet;

    const newSet = new Set<EventHandler<unknown[]>>();

    subscribersMap.set(name, newSet);

    return newSet;
  }

  function on<N extends keyof EventsMap>(
    name: N,
    handler: EventHandler<EventsMap[N]>
  ) {
    const listeners = getHandlersForEvent(name);

    listeners.add(handler);

    return () => {
      listeners.delete(handler);
    };
  }

  function onOneOf<N extends keyof EventsMap>(
    names: N[],
    handler: EventHandler<EventsMap[N]>
  ) {
    const cleanup = createCleanupObject();

    for (const name of names) {
      cleanup.next = on(name, handler);
    }

    return () => {
      cleanup.clean();
    };
  }

  function emit<N extends keyof EventsMap>(name: N, ...data: EventsMap[N]) {
    if (IS_DEV && DEV_DEBUG_EVENTS && debug) {
      console.warn(`Event [${debug}]`, name, data);
    }

    runInAction(() => {
      const listeners = getHandlersForEvent(name);

      listeners.forEach((listener) => {
        listener(...data);
      });
    });
  }

  return {
    on,
    onOneOf,
    emit,
  };
}
