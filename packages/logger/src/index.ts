import pino from "pino";

/**
 * Default logger options
 */
const defaultOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  },
};

/**
 * Logger instance created with default options
 */
export const logger = pino(defaultOptions);

/**
 * Create a logger with a custom namespace
 * @param namespace - Logger namespace
 * @param options - Custom logger options (optional)
 * @returns Configured logger instance
 */
export function createLogger(
  namespace: string,
  options?: pino.LoggerOptions,
): pino.Logger {
  return logger.child({
    namespace,
    ...options,
  });
}

/**
 * Create a logger for a specific module
 * @param moduleName - Module name
 * @returns Logger instance configured for the module
 */
export function createModuleLogger(moduleName: string): pino.Logger {
  return createLogger(`module:${moduleName}`);
}

/**
 * Create a logger for a specific service
 * @param serviceName - Service name
 * @returns Logger instance configured for the service
 */
export function createServiceLogger(serviceName: string): pino.Logger {
  return createLogger(`service:${serviceName}`);
}

/**
 * Set the log level
 * @param level - Log level to set
 */
export function setLogLevel(level: pino.LevelWithSilent): void {
  logger.level = level;
}

export default {
  logger,
  createLogger,
  createModuleLogger,
  createServiceLogger,
  setLogLevel,
};
