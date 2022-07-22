export function createLogger(name: string, isEnabled = true) {
  function log(...msgs: any[]) {
    if (!isEnabled) return;

    if (msgs.length <= 1) {
      console.info(`[${name}]:`, msgs[0]);
      return;
    }

    const onlyStrings = msgs.every((msg) => typeof msg === "string");

    if (onlyStrings) {
      console.info(`[${name}]:\n`, msgs.join("\n "));
      return;
    }

    console.info(`[${name}]:`, ...msgs);
  }

  log.if = (condition: boolean, ...msgs: any[]) => {
    if (!condition) return;
    log(...msgs);
  };

  return log;
}
