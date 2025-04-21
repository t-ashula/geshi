/**
 * @geshi/crawler
 * 録画予約ワーカー
 */

import { Worker } from "bullmq";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import dotenv from "dotenv";
// eslint-disable-next-line import/no-unresolved
import { PrismaClient } from "@geshi/model";
import { updateQueue, recordQueue, QUEUE_NAMES } from "./bull";
import {
  RecordReserveJobPayload,
  RecordJobPayload,
  UpdateJobMessage,
  JobType,
  JobStatus,
} from "./types";
// eslint-disable-next-line import/no-unresolved
import { createModuleLogger } from "@geshi/logger";
const logger = createModuleLogger("crawler");

// 環境変数の読み込み
dotenv.config();

// ワーカーの並行処理数
const CONCURRENCY = parseInt(
  process.env.RECORD_RESERVE_CONCURRENCY || "10",
  10,
);

// 録画ファイルの出力先ディレクトリ
const RECORD_OUTPUT_DIR =
  process.env.RECORD_OUTPUT_DIR || path.join(process.cwd(), "recordings");

// Prismaクライアントの初期化
const prisma = new PrismaClient();

/**
 * 録画ジョブの開始時間をスケジュールする
 * @param startTime 開始時間（ISO8601形式）
 * @returns スケジュール時間（ミリ秒）
 */
function scheduleRecordJob(startTime: string): number {
  const startDate = new Date(startTime);
  const now = new Date();

  // 開始時間までの待機時間（ミリ秒）
  const delay = Math.max(0, startDate.getTime() - now.getTime());

  // 開始5分前に録画ジョブを開始
  return Math.max(0, delay - 5 * 60 * 1000);
}

// 録画予約ワーカーの作成
const recordReserveWorker = new Worker<RecordReserveJobPayload, any>(
  QUEUE_NAMES.RECORD_RESERVE,
  async (job) => {
    logger.info(`Processing record reserve job: ${job.id}`);
    const { jobId, episodeId, streamUrl, startTime, options } = job.data;

    try {
      // 録画ジョブのIDを生成
      const recordJobId = uuidv4();

      // 出力ファイル名を生成
      const outputFileName = `${episodeId}_${new Date(startTime).toISOString().replace(/:/g, "-")}.mp4`;
      const outputPath = path.join(RECORD_OUTPUT_DIR, outputFileName);

      // 録画ジョブのペイロードを生成
      const recordPayload: RecordJobPayload = {
        jobId: recordJobId,
        episodeId,
        streamUrl,
        outputPath,
      };

      // jobsテーブルへ永続化
      await prisma.job.create({
        data: {
          id: recordJobId,
          episodeId,
          type: JobType.RECORD,
          status: JobStatus.PENDING,
          payload: recordPayload as any,
        },
      });

      // 録画開始時間までの遅延を計算
      const delay = scheduleRecordJob(startTime);

      // 録画キューにジョブを追加（遅延実行）
      await recordQueue.add(`record-${recordJobId}`, recordPayload, {
        delay,
      });

      // 結果を生成
      const result = {
        episodeId,
        streamUrl,
        startTime,
        recordJobId,
        scheduledAt: new Date().toISOString(),
        executionTime: new Date(Date.now() + delay).toISOString(),
        options,
        success: true,
      };

      // 更新キューにメッセージを追加
      const updateMessage: UpdateJobMessage = {
        jobType: JobType.RECORD_RESERVE,
        jobId,
        result,
      };

      await updateQueue.add(`update-record-reserve-${jobId}`, updateMessage);

      logger.info(
        `Record reserve job completed: ${job.id}, scheduled for: ${new Date(Date.now() + delay).toISOString()}`,
      );
      return result;
    } catch (error) {
      logger.error(`Record reserve job failed: ${job.id}`, error);

      // エラー結果を生成
      const errorResult = {
        episodeId,
        streamUrl,
        startTime,
        error: error instanceof Error ? error.message : String(error),
        scheduledAt: new Date().toISOString(),
        success: false,
      };

      // 更新キューにエラーメッセージを追加
      const updateMessage: UpdateJobMessage = {
        jobType: JobType.RECORD_RESERVE,
        jobId,
        result: errorResult,
      };

      await updateQueue.add(
        `update-record-reserve-error-${jobId}`,
        updateMessage,
      );

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
  },
);

// イベントハンドラの設定
recordReserveWorker.on("completed", (job) => {
  logger.info(`Record reserve job ${job.id} has completed successfully`);
});

recordReserveWorker.on("failed", (job, error) => {
  logger.error(`Record reserve job ${job?.id} has failed with error:`, error);
});

// 終了時にPrismaクライアントを切断
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

logger.info(`Record reserve worker started with concurrency: ${CONCURRENCY}`);

export default recordReserveWorker;
