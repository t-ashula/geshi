/**
 * @geshi/crawler
 * クローラーモジュール
 */

import { createModuleLogger } from "logger";

// クローラーモジュール用のロガーを作成
const logger = createModuleLogger("crawler");

export interface CrawlerOptions {
  url: string;
  // 他のオプションをここに追加
}

export type CrawlerResult = {
  url: string;
  data: string;
};

/**
 * クローラー関数
 * @param options クローラーオプション
 * @returns 取得したデータ
 */
export async function crawler(options: CrawlerOptions): Promise<CrawlerResult> {
  // ロガーを使用してクロール開始を記録
  logger.info({ url: options.url }, "クロール開始");

  try {
    // 実際のクロール処理をここに実装
    // 現在はサンプルデータを返すだけ
    const result = { url: options.url, data: "Sample data" };

    // 成功したらログに記録
    logger.info({ url: options.url }, "クロール成功");

    return result;
  } catch (error) {
    // エラーが発生した場合はログに記録
    logger.error(
      { url: options.url, error },
      "クロール中にエラーが発生しました",
    );
    throw error;
  }
}

export default {
  crawler,
};
