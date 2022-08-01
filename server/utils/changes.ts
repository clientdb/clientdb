export type ValueChangeInfo<T> = [before: T, after: T];

export type Changes<T> = {
  [key in keyof T]?: ValueChangeInfo<T>;
};

export function computeChanges<T>(
  before: T,
  after: Partial<T>
): Changes<T> | null {
  const changes: Changes<T> = {} as any;

  for (const key in before) {
    if (before[key] !== after[key]) {
      changes[key] = [before[key], after[key]] as any as ValueChangeInfo<T>;
    }
  }

  if (Object.keys(changes).length === 0) {
    return null;
  }

  return changes;
}
