/**
 * Scribe API クライアント設定
 */

export interface ScribeClientConfig {
  /**
   * Scribe API のベースURL
   * @default 'http://localhost:8002'
   */
  baseUrl: string;

  /**
   * リクエストタイムアウト（ミリ秒）
   * @default 30000
   */
  timeout: number;

  /**
   * ポーリング間隔（ミリ秒）
   * @default 2000
   */
  pollingInterval: number;

  /**
   * 最大ポーリング回数
   * @default 30
   */
  maxPollingAttempts: number;
}

/**
 * デフォルト設定
 */
export const defaultConfig: ScribeClientConfig = {
  baseUrl: "http://localhost:8002",
  timeout: 30000,
  pollingInterval: 2000,
  maxPollingAttempts: 30,
};
