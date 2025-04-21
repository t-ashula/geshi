/**
 * @geshi/crawler
 * ダウンロードワーカー
 */

import { Worker } from "bullmq";
import axios from "axios";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import dotenv from "dotenv";
import { updateQueue, QUEUE_NAMES } from "./bull";
import { DownloadJobPayload, UpdateJobMessage, JobType } from "./types";
// eslint-disable-next-line import/no-unresolved
import { createModuleLogger } from "@geshi/logger";
const logger = createModuleLogger("crawler");

// 環境変数の読み込み
dotenv.config();

// ワーカーの並行処理数
const CONCURRENCY = 5;

// ダウンロード先ディレクトリ
const DOWNLOAD_DIR =
  process.env.DOWNLOAD_DIR || path.join(process.cwd(), "downloads");

// ディレクトリが存在しない場合は作成
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

/**
 * ファイルをダウンロードする
 * @param url ダウンロード元URL
 * @param outputPath 出力先パス
 * @returns ダウンロード結果
 */
async function downloadFile(
  url: string,
  outputPath: string,
): Promise<{ success: boolean; size: number }> {
  try {
    const writer = fs.createWriteStream(outputPath);

    const response = await axios({
      method: "GET",
      url,
      responseType: "stream",
      headers: {
        "User-Agent": "Geshi-Crawler/1.0",
      },
      timeout: 30000, // 30秒タイムアウト
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", async () => {
        const stats = await promisify(fs.stat)(outputPath);
        resolve({ success: true, size: stats.size });
      });

      writer.on("error", (err) => {
        // エラー時はファイルを削除
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    });
  } catch (error) {
    logger.error(`Error downloading file from ${url}:`, error);
    // エラー時はファイルを削除（存在する場合）
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    throw error;
  }
}

// ダウンロードワーカーの作成
const downloadWorker = new Worker<DownloadJobPayload, any>(
  QUEUE_NAMES.DOWNLOAD,
  async (job) => {
    logger.info(`Processing download job: ${job.id}`);
    const { jobId, episodeId, mediaUrl } = job.data;

    try {
      // ファイル名を生成（URLのパス部分の最後の要素を使用）
      const urlObj = new URL(mediaUrl);
      const fileName = path.basename(urlObj.pathname);

      // 出力先パスを生成
      const outputPath = path.join(DOWNLOAD_DIR, `${episodeId}_${fileName}`);

      // ファイルをダウンロード
      const downloadResult = await downloadFile(mediaUrl, outputPath);

      // 結果を生成
      const result = {
        episodeId,
        mediaUrl,
        outputPath,
        sizeBytes: downloadResult.size,
        downloadedAt: new Date().toISOString(),
        success: true,
      };

      // 更新キューにメッセージを追加
      const updateMessage: UpdateJobMessage = {
        jobType: JobType.DOWNLOAD,
        jobId,
        result,
      };

      await updateQueue.add(`update-download-${jobId}`, updateMessage);

      logger.info(
        `Download job completed: ${job.id}, size: ${downloadResult.size} bytes`,
      );
      return result;
    } catch (error) {
      logger.error(`Download job failed: ${job.id}`, error);

      // エラー結果を生成
      const errorResult = {
        episodeId,
        mediaUrl,
        error: error instanceof Error ? error.message : String(error),
        downloadedAt: new Date().toISOString(),
        success: false,
      };

      // 更新キューにエラーメッセージを追加
      const updateMessage: UpdateJobMessage = {
        jobType: JobType.DOWNLOAD,
        jobId,
        result: errorResult,
      };

      await updateQueue.add(`update-download-error-${jobId}`, updateMessage);

      // エラーを再スローしてBullMQに再試行させる
      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
    },
    concurrency: CONCURRENCY,
    limiter: {
      max: 5, // 5件/秒の制限
      duration: 1000,
    },
  },
);

// イベントハンドラの設定
downloadWorker.on("completed", (job) => {
  logger.info(`Download job ${job.id} has completed successfully`);
});

downloadWorker.on("failed", (job, error) => {
  logger.error(`Download job ${job?.id} has failed with error:`, error);
});

logger.info(`Download worker started with concurrency: ${CONCURRENCY}`);

export default downloadWorker;
