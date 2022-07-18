import { ObservableMap, autorun, observable, runInAction } from "mobx";

import {
  CACHED_COMPUTED_ALIVE_TIME,
  cachedComputedWithoutArgs,
} from "@clientdb/core";

import { runObserved } from "./utils";

describe("lazyComputed", () => {
  it("returns proper value", () => {
    const getter = jest.fn(() => 42);
    const value = cachedComputedWithoutArgs(getter);

    expect(value.get()).toBe(42);
  });

  it("is not computing value until requested", () => {
    const getter = jest.fn(() => 42);
    cachedComputedWithoutArgs(getter);

    expect(getter).toBeCalledTimes(0);
  });

  it("is will keep value in cache, if is observed", (done) => {
    runObserved(() => {
      const getter = jest.fn(() => 42);
      const value = cachedComputedWithoutArgs(getter);

      value.get();

      expect(getter).toBeCalledTimes(1);

      expect(value.get()).toBe(42);
      expect(getter).toBeCalledTimes(1);
      done();
    });
  });

  it("will not call getter 2nd time if value changes, but is not requested", () => {
    const finalValue = observable.box(1);

    const getter = jest.fn(() => finalValue.get());
    const value = cachedComputedWithoutArgs(getter);

    expect(value.get()).toBe(1);

    expect(getter).toBeCalledTimes(1);

    runInAction(() => {
      finalValue.set(2);
    });

    expect(getter).toBeCalledTimes(1);

    expect(value.get()).toBe(2);

    expect(getter).toBeCalledTimes(2);
  });

  it("will properly inform observer about updates", () => {
    const finalValue = observable.box(1);

    const getter = jest.fn(() => finalValue.get());
    const value = cachedComputedWithoutArgs(getter);

    const watcher = jest.fn(() => {
      return value.get();
    });

    const dispose = autorun(watcher);

    expect(watcher).toBeCalledTimes(1);

    runInAction(() => {
      finalValue.set(2);
    });

    expect(watcher).toBeCalledTimes(2);
    dispose();
  });

  it("will keep cache in autorun if other value is updated", () => {
    const finalValue = observable.box(1);
    const otherValue = observable.box(1);

    const getter = jest.fn(() => finalValue.get());
    const value = cachedComputedWithoutArgs(getter);

    const watcher = jest.fn(() => {
      return otherValue.get() + value.get();
    });

    const dispose = autorun(watcher);

    expect(watcher).toBeCalledTimes(1);
    expect(getter).toBeCalledTimes(1);

    runInAction(() => {
      otherValue.set(2);
    });

    expect(watcher).toBeCalledTimes(2);
    expect(getter).toBeCalledTimes(1);

    runInAction(() => {
      finalValue.set(2);
    });

    expect(watcher).toBeCalledTimes(3);
    expect(getter).toBeCalledTimes(2);

    dispose();
  });

  it("gets most recent value after disposing", async () => {
    jest.useFakeTimers();

    const meanings = new ObservableMap();
    meanings.set("life", -2);
    const realMeaning = cachedComputedWithoutArgs(
      () => meanings.get("life") + 2
    );

    let values: number[] = [];
    const watcher = () => {
      values.push(realMeaning.get());
    };
    const dispose = autorun(watcher);

    runInAction(() => {
      meanings.set("life", 40);
    });

    dispose();

    expect(values).toEqual(expect.arrayContaining([0, 42]));
    values = [];

    autorun(watcher);

    jest.advanceTimersByTime(CACHED_COMPUTED_ALIVE_TIME);

    runInAction(() => {
      meanings.set("life", 1335);
    });

    expect(values).toEqual(expect.arrayContaining([42, 1337]));
  });
});
