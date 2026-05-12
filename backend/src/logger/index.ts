import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { Logger as PinoLogger } from "pino";
import pino, { destination } from "pino";

export type LogMetadata = Record<string, unknown>;

export interface Logger {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata): void;
  child(bindings: LogMetadata): Logger;
}

const DEFAULT_LOG_FILE_PATH = ".geshi/logs/geshi.log";
const destinationByPath = new Map<string, ReturnType<typeof destination>>();

export function createLogger(bindings: LogMetadata = {}): Logger {
  return wrapLogger(
    pino(
      {
        base: bindings,
        formatters: {
          level(label) {
            return {
              level: label,
            };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      resolveLoggerDestination(),
    ),
  );
}

export function createNoopLogger(): Logger {
  return {
    child() {
      return createNoopLogger();
    },
    debug() {},
    error() {},
    info() {},
    warn() {},
  };
}

function wrapLogger(logger: PinoLogger): Logger {
  return {
    child(bindings) {
      return wrapLogger(logger.child(bindings));
    },
    debug(message, metadata) {
      logger.debug(metadata ?? {}, message);
    },
    error(message, metadata) {
      logger.error(metadata ?? {}, message);
    },
    info(message, metadata) {
      logger.info(metadata ?? {}, message);
    },
    warn(message, metadata) {
      logger.warn(metadata ?? {}, message);
    },
  };
}

function resolveLoggerDestination() {
  if (isTestRuntime()) {
    return undefined;
  }

  const logFilePath = process.env.GESHI_LOG_FILE_PATH ?? DEFAULT_LOG_FILE_PATH;
  const existingDestination = destinationByPath.get(logFilePath);

  if (existingDestination !== undefined) {
    return existingDestination;
  }

  mkdirSync(dirname(logFilePath), {
    recursive: true,
  });
  const createdDestination = destination({
    dest: logFilePath,
    sync: false,
  });
  destinationByPath.set(logFilePath, createdDestination);
  return createdDestination;
}

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}
