import type { Logger as PinoLogger } from "pino";
import pino from "pino";

export interface Logger {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata): void;
  child(bindings: LogMetadata): Logger;
}

export type LogMetadata = Record<string, unknown>;

export function createLogger(bindings: LogMetadata = {}): Logger {
  return wrapLogger(
    pino({
      base: bindings,
      formatters: {
        level(label) {
          return { level: label };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    }),
  );
}

function wrapLogger(logger: PinoLogger): Logger {
  return {
    debug(message, metadata) {
      logger.debug(metadata ?? {}, message);
    },
    info(message, metadata) {
      logger.info(metadata ?? {}, message);
    },
    warn(message, metadata) {
      logger.warn(metadata ?? {}, message);
    },
    error(message, metadata) {
      logger.error(metadata ?? {}, message);
    },
    child(bindings) {
      return wrapLogger(logger.child(bindings));
    },
  };
}
