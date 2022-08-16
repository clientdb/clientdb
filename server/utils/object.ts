type Key = keyof any;

export function mapValues<K extends Key, V, NV>(
  input: Record<K, V>,
  mapper: (value: V, key: K) => NV
): Record<K, NV> {
  const output: Record<K, NV> = {} as Record<K, NV>;

  for (const key in input) {
    const resultValue = mapper(input[key], key);

    if (resultValue === undefined) continue;
    output[key] = resultValue;
  }

  return output;
}
