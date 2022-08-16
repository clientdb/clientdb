export type FunctionWithProps<A extends any[], R, Props> = ((...args: A) => R) &
  Props;

export function createFunctionWithProps<A extends any[], R, Props>(
  fn: (...args: A) => R,
  props: Props
) {
  function callback(...args: A) {
    return fn(...args);
  }

  Object.assign(callback, props);

  return callback as FunctionWithProps<A, R, Props>;
}
