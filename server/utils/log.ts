function json(input: unknown) {
  return JSON.stringify(
    input,
    (key, value) => {
      if (typeof value === "function") {
        return `function ${value.name}()`;
      }

      return value;
    },
    2
  );
}

export function debug(...input: any[]) {
  console.info("DEBUG", ...input.map((single) => json(single)));
}
