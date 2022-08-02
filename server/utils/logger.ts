import { createFunctionWithProps } from "./functionWithProps";

enum LogLevel {
  Verbose = 0,
  Debug,
  Info,
  Warn,
  Error,
}

let enabledLogLevel = LogLevel.Info;

let logAllStack = 0;

export function logAll(condition = true) {
  if (!condition) {
    return () => void 0;
  }

  logAllStack++;

  return () => {
    logAllStack--;
  };
}

export function createLogger(name: string, isEnabled?: boolean) {
  function prepareLogs(...msgs: any[]) {
    if (msgs.length <= 1) {
      return [`[${name}]:`, msgs[0]];
    }

    const onlyStrings = msgs.every((msg) => typeof msg === "string");

    if (onlyStrings) {
      return [`[${name}]:\n`, msgs.join("\n ")];
    }

    return [`[${name}]:`, ...msgs];
  }

  function getShouldLog(level: LogLevel) {
    if (logAllStack > 0) return true;
    if (isEnabled === true) return true;
    if (isEnabled === false) {
      return level >= LogLevel.Warn;
    }

    return level >= enabledLogLevel;
  }

  function logForLevel(level: LogLevel, ...msgs: any[]) {
    if (!getShouldLog(level)) return;

    const preparedLogs = prepareLogs(...msgs);

    if (level === LogLevel.Error) {
      console.error(...preparedLogs);
    }

    if (level === LogLevel.Warn) {
      console.warn(...preparedLogs);
    }

    console.info(...preparedLogs);
  }

  function log(...msgs: any[]) {
    logForLevel(LogLevel.Info, ...msgs);
  }

  function debug(...msgs: any[]) {
    logForLevel(LogLevel.Debug, ...msgs);
  }

  function verbose(...msgs: any[]) {
    logForLevel(LogLevel.Verbose, ...msgs);
  }

  function error(...msgs: any[]) {
    logForLevel(LogLevel.Error, ...msgs);
  }

  function warn(...msgs: any[]) {
    logForLevel(LogLevel.Warn, ...msgs);
  }

  const logger = createFunctionWithProps(log, {
    debug,
    verbose,
    error,
    warn,
  });

  return logger;
}

export const log = createLogger("Log");

export function debug(...items: any[]) {
  for (const item of items) {
    console.dir(item, { depth: null });
  }
}
