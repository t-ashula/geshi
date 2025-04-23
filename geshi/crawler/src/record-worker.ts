/**
 * @geshi/crawler
 * 録画ワーカー
 */

import { Worker } from "bullmq";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createModuleLogger } from "@geshi/logger";
import { updateQueue, QUEUE_NAMES } from "./bull";
import { RecordJobPayload, UpdateJobMessage, JobType } from "./types";

const logger = createModuleLogger("crawler");

// 環境変数の読み込み
dotenv.config();

// ワーカーの並行処理数（録画は負荷が高いため1に制限）
const CONCURRENCY = 1;

// 録画の最大時間（秒）
const MAX_RECORD_DURATION = parseInt(
  process.env.MAX_RECORD_DURATION || "7200",
  10,
); // デフォルト2時間

// 録画ファイルの出力先ディレクトリ
const RECORD_OUTPUT_DIR =
  process.env.RECORD_OUTPUT_DIR || path.join(process.cwd(), "recordings");

// ディレクトリが存在しない場合は作成
if (!fs.existsSync(RECORD_OUTPUT_DIR)) {
  fs.mkdirSync(RECORD_OUTPUT_DIR, { recursive: true });
}

/**
 * FFmpegを使用してHLS録画を実行する
 * @param streamUrl 録画対象のストリームURL
 * @param outputPath 出力先パス
 * @returns 録画結果
 */
function recordHLS(
  streamUrl: string,
  outputPath: string,
): Promise<{ success: boolean; size: number }> {
  return new Promise((resolve, reject) => {
    // FFmpegコマンドの引数
    const args = [
      "-i",
      streamUrl,
      "-c",
      "copy", // コーデックをコピー（変換なし）
      "-t",
      MAX_RECORD_DURATION.toString(), // 最大録画時間
      "-y", // 既存ファイルを上書き
      outputPath,
    ];

    logger.info(`Starting FFmpeg recording: ffmpeg ${args.join(" ")}`);

    // FFmpegプロセスを起動
    const ffmpeg = spawn("ffmpeg", args);

    // 標準出力のログ
    ffmpeg.stdout.on("data", (data) => {
      logger.info(`FFmpeg stdout: ${data}`);
    });

    // 標準エラー出力のログ
    ffmpeg.stderr.on("data", (data) => {
      logger.info(`FFmpeg stderr: ${data}`);
    });

    // プロセス終了時の処理
    ffmpeg.on("close", async (code) => {
      if (code === 0) {
        try {
          // ファイルサイズを取得
          const stats = fs.statSync(outputPath);
          resolve({ success: true, size: stats.size });
        } catch (error) {
          logger.error(`Error getting file stats: ${error}`);
          reject(error);
        }
      } else {
        logger.error(`FFmpeg process exited with code ${code}`);
        reject(new Error(`FFmpeg process exited with code ${code}`));
      }
    });

    // エラー発生時の処理
    ffmpeg.on("error", (error) => {
      logger.error(`FFmpeg process error: ${error}`);
      reject(error);
    });

    // プロセス終了時のクリーンアップ
    const cleanup = () => {
      try {
        ffmpeg.kill("SIGTERM");
      } catch (error) {
        logger.error(`Error killing FFmpeg process: ${error}`);
      }
    };

    // プロセス終了シグナルのハンドリング
    process.on("SIGTERM", cleanup);
    process.on("SIGINT", cleanup);
  });
}

// 録画ワーカーの作成
const recordWorker = new Worker<RecordJobPayload, any>(
  QUEUE_NAMES.RECORD,
  async (job) => {
    logger.info(`Processing record job: ${job.id}`);
    const { jobId, episodeId, streamUrl, outputPath } = job.data;

    try {
      // HLS録画を実行
      const recordResult = await recordHLS(streamUrl, outputPath);

      // 結果を生成
      const result = {
        episodeId,
        streamUrl,
        outputPath,
        sizeBytes: recordResult.size,
        recordedAt: new Date().toISOString(),
        success: true,
      };

      // 更新キューにメッセージを追加
      const updateMessage: UpdateJobMessage = {
        jobType: JobType.RECORD,
        jobId,
        result,
      };

      await updateQueue.add(`update-record-${jobId}`, updateMessage);

      logger.info(
        `Record job completed: ${job.id}, size: ${recordResult.size} bytes`,
      );

      // 録画ジョブ完了後にプロセスを終了
      setTimeout(() => {
        logger.info("Record job worker exiting...");
        process.exit(0);
      }, 1000);

      return result;
    } catch (error) {
      logger.error(`Record job failed: ${job.id}`, error);

      // エラー結果を生成
      const errorResult = {
        episodeId,
        streamUrl,
        outputPath,
        error: error instanceof Error ? error.message : String(error),
        recordedAt: new Date().toISOString(),
        success: false,
      };

      // 更新キューにエラーメッセージを追加
      const updateMessage: UpdateJobMessage = {
        jobType: JobType.RECORD,
        jobId,
        result: errorResult,
      };

      await updateQueue.add(`update-record-error-${jobId}`, updateMessage);

      // エラー発生時にプロセスを終了（エラーコード1）
      setTimeout(() => {
        logger.error("Record job worker exiting with error...");
        process.exit(1);
      }, 1000);

      throw error;
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
    },
    concurrency: CONCURRENCY,
  },
);

// イベントハンドラの設定
recordWorker.on("completed", (job) => {
  logger.info(`Record job ${job.id} has completed successfully`);
});

recordWorker.on("failed", (job, error) => {
  logger.error(`Record job ${job?.id} has failed with error:`, error);
});

logger.info(`Record worker started with concurrency: ${CONCURRENCY}`);

export default recordWorker;
