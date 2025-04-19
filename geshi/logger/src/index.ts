import pino from "pino";

/**
 * ロガーのデフォルト設定
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
 * デフォルト設定で作成されたロガーインスタンス
 */
export const logger = pino(defaultOptions);

/**
 * カスタム名前空間付きのロガーを作成する
 * @param namespace - ロガーの名前空間
 * @param options - カスタムロガーオプション（オプション）
 * @returns 設定されたロガーインスタンス
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
 * 特定のモジュール用のロガーを作成する
 * @param moduleName - モジュール名
 * @returns モジュール用に設定されたロガーインスタンス
 */
export function createModuleLogger(moduleName: string): pino.Logger {
  return createLogger(`module:${moduleName}`);
}

/**
 * 特定のサービス用のロガーを作成する
 * @param serviceName - サービス名
 * @returns サービス用に設定されたロガーインスタンス
 */
export function createServiceLogger(serviceName: string): pino.Logger {
  return createLogger(`service:${serviceName}`);
}

/**
 * ログレベルを設定する
 * @param level - 設定するログレベル
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
