export type ResolvablePromise<T> = ReturnType<typeof createResolvablePromise<T>>

export function createResolvablePromise<T = void>() {
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;
  let didResolve = false;
  let didReject = false;

  function getIsComplete() {
    return didResolve || didReject;
  }

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = (value) => {
      if (getIsComplete()) return;
      didResolve = true;
      resolvePromise(value);
    };
    reject = (error) => {
      if (getIsComplete()) return;
      didReject = true;
      rejectPromise(error);
    };
  });

  return {
    promise,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    resolve: resolve!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    reject: reject!,
    getIsComplete,
  };
}

export function wait(time: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, time);
  });
}