export type ValueChangeInfo<T> = [before: T, after: T];

export type Changes<T> = {
  [key in keyof T]?: ValueChangeInfo<T[key]>;
};

export function computeChanges<T>(
  before: T,
  after: Partial<T>
): Changes<T> | null {
  const changes: Changes<T> = {} as any;

  for (const key in before) {
    if (before[key] === undefined || after[key] === undefined) {
      continue;
    }

    if (before[key] === after[key]) {
      continue;
    }

    const fieldChanges = [before[key], after[key]] as ValueChangeInfo<
      T[keyof T]
    >;

    changes[key as keyof T] = fieldChanges;
  }

  if (Object.keys(changes).length === 0) {
    return null;
  }

  return changes;
}

export function pickCurrentFromChanges<T>(changes: Changes<T>) {
  const before: Partial<T> = {} as any;

  for (const key in changes) {
    before[key] = changes[key]![0];
  }

  return before;
}

export function pickAfterFromChanges<T>(changes: Changes<T>) {
  const after: Partial<T> = {} as any;

  for (const key in changes) {
    after[key] = changes[key]![1];
  }

  return after;
}
