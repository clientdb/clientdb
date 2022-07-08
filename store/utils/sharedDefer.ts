import { runInAction } from "mobx";

type Lambda = () => void;

const pendingCallbacks: Lambda[] = [];

let isScheduled = false;

function flush() {
  const callbacksCopy = pendingCallbacks.slice();
  pendingCallbacks.length = 0;

  isScheduled = false;

  for (const callback of callbacksCopy) {
    callback();
  }
}

export function sharedDefer(callback: Lambda) {
  pendingCallbacks.push(callback);

  if (isScheduled) return;

  isScheduled = true;
  setTimeout(flush, 0);
}

export function createSharedInterval(time: number) {
  const pendingItems = new Set<Lambda>();

  function add(callback: Lambda) {
    pendingItems.add(callback);
  }

  function remove(callback: Lambda) {
    pendingItems.delete(callback);
  }

  function flush() {
    const itemsList = Array.from(pendingItems);
    pendingItems.clear();

    runInAction(() => {
      for (const item of itemsList) {
        item();
      }
    });
  }

  setInterval(flush, time);

  return {
    add,
    remove,
  };
}
