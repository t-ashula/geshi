/**
 * @geshi/crawler
 * 録画ワーカー
 */

import { Worker, Job } from "bullmq";
import dotenv from "dotenv";

import { updateQueue, QUEUE_NAMES, defaultConnectionOptions } from "../bull";
import { recordHLS } from "../funcs/record";
import {
  RecordJobPayload,
  RecordJobResult,
  UpdateJobMessage,
  JobType,
} from "../types";
import logger from "../logger";

// 環境変数の読み込み
dotenv.config();

// ワーカーの並行処理数（録画は process 並列にするので 1）
const CONCURRENCY = 1;

const processor = async (
  job: Job<RecordJobPayload, RecordJobResult>,
): Promise<RecordJobResult> => {
  const startAt = Date.now();
  const { jobId, streamUrl, duration } = job.data;

  logger.info(`start`, { jobId });

  try {
    // HLS録画を実行
    const options = { duration };
    const result = await recordHLS(streamUrl, options);
    // TODO: result.success === false case
    const spent = Date.now() - startAt;

    // 更新キューにメッセージを追加
    const jobResult = { result, spent, success: true };
    const updateMessage: UpdateJobMessage = {
      jobType: JobType.RECORD,
      jobId,
      result: jobResult,
    };

    await updateQueue.add(`update-record-${jobId}`, updateMessage);

    logger.info(`completed`, { jobId, size: result.size });

    // 録画ジョブ完了後にプロセスを終了
    setTimeout(() => {
      logger.info("Record job worker exiting...");
      process.exit(0);
    }, 1000);
    return jobResult;
  } catch (error) {
    logger.error(`Record job failed: ${job.id}`, error);

    // 更新キューにエラーメッセージを追加
    const updateMessage: UpdateJobMessage = {
      jobType: JobType.RECORD,
      jobId,
      error: error instanceof Error ? error.message : String(error),
    };

    await updateQueue.add(`update-record-error-${jobId}`, updateMessage);

    // エラー発生時にプロセスを終了（エラーコード1）
    setTimeout(() => {
      logger.error("Record job worker exiting with error...");
      process.exit(1);
    }, 1000);

    throw error;
  }
};

const workerOptions = {
  connection: defaultConnectionOptions,
  concurrency: CONCURRENCY,
};

// 録画ワーカーの作成
const recordWorker = new Worker<RecordJobPayload, RecordJobResult>(
  QUEUE_NAMES.RECORD,
  processor,
  workerOptions,
);

// イベントハンドラの設定
// recordWorker.on("completed", (job) => {});
// recordWorker.on("failed", (job, error) => {});

logger.info(`Record worker started with concurrency: ${CONCURRENCY}`);

export default recordWorker;
