import { createFunctionWithProps } from "./functionWithProps";

enum LogLevel {
  Verbose = 0,
  Debug,
  Info,
  Warn,
  Error,
}

let logLevel = LogLevel.Info;

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
    if (isEnabled === true) return true;
    if (isEnabled === false) return false;

    return level >= logLevel;
  }

  function logForLevel(level: LogLevel, ...msgs: any[]) {
    if (!isEnabled) return;
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
