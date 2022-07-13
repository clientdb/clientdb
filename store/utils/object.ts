/**
 * It is the same as Object.keys, except it'' return typed array. Use with caution as your object might have more
 * properties than its type says.
 */
 export function typedKeys<O>(input: O): Array<keyof O> {
  return Object.keys(input) as Array<keyof O>;
}