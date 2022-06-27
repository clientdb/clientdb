import { typedKeys } from "./object";

export function getChangedData<D>(now: D, before: D): Partial<D> {
  const changedData: Partial<D> = {};

  typedKeys(before).forEach((key) => {
    const valueBefore = before[key];
    const valueNow = now[key];

    if (valueBefore === valueNow) return;

    changedData[key] = valueNow;
  });

  return changedData;
}
