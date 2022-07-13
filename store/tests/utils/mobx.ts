import { autorun } from "mobx";

export function runObserved<T>(callback: () => T) {
  const dispose = autorun(() => {
    callback();
  });

  dispose();
}

export function autorunOnce(callback: () => void) {
  const stop = autorun(callback);
  stop();
}
