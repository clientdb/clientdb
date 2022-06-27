// Like `keyof`, but will exclude keys that has 'never' value.
type ExistingKeys<T> = {
  [Key in keyof T]-?: T[Key] extends never ? never : Key;
}[keyof T];

// Will remove 'never' value fields from { foo: string, bar: never } => { foo: string }
type ExcludeNever<T> = Pick<T, ExistingKeys<T>>;

/**
 * PickByPartialMatch<{ foo: string, bar?: string }, void> -> { bar?: string }
 */
type PickByPartialMatch<T, V> = ExcludeNever<{
  [key in keyof T]: V extends T[key] ? T[key] : never;
}>;

/**
 * PickOptional<{ foo: string, bar?: string }> -> { bar?: string }
 */
type PickOptional<T> = PickByPartialMatch<T, null | void>;

/**
 * Create type when optional (null or ?) values must be explicitly filled,
 *
 * eg. PartialWithExplicitOptionals<{ foo?: Maybe<string>, bar: string }> = { foo: string | null, bar: string }
 */
export type PartialWithExplicitOptionals<T> = Required<PickOptional<T>> & Partial<T>;
