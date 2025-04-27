/**
 * @geshi/crawler
 * ダウンロードワーカー
 */

import { Worker } from "bullmq";
import type { Job } from "bullmq";

import { updateQueue, QUEUE_NAMES, defaultConnectionOptions } from "../bull";
import {
  DownloadJobPayload,
  DownloadJobResult,
  UpdateJobMessage,
  JobType,
} from "../types";

import logger from "../logger";
import { download } from "../funcs/download";

// ワーカーの並行処理数
const CONCURRENCY = 5;

const processor = async (
  job: Job<DownloadJobPayload, DownloadJobResult, string>,
): Promise<DownloadJobResult> => {
  const startAt = Date.now();
  const { jobId, targetUrl } = job.data;

  logger.info(`start`, { worker: JobType.DOWNLOAD, jobId });

  try {
    const result = await download(targetUrl);
    const spent = Date.now() - startAt;

    // 更新キューにメッセージを追加
    const updateMessage: UpdateJobMessage = {
      jobType: JobType.DOWNLOAD,
      jobId,
      success: true,
      result: { spent, result },
    };

    await updateQueue.add(`update-download-${jobId}`, updateMessage);

    logger.info(`completed`, {
      worker: JobType.DOWNLOAD,
      jobId,
      result,
    });
    return { spent, result };
  } catch (error) {
    logger.error(`failed`, { jobId, error });

    // 更新キューにエラーメッセージを追加
    const updateMessage: UpdateJobMessage = {
      jobType: JobType.DOWNLOAD,
      jobId,
      error: error instanceof Error ? error.message : String(error),
      success: false,
    };

    await updateQueue.add(`update-download-error-${jobId}`, updateMessage);

    // エラーを再スローしてBullMQに再試行させる
    throw error;
  }
};

// ダウンロードワーカーの作成
const workerOptions = {
  connection: defaultConnectionOptions,
  concurrency: CONCURRENCY,
  limiter: {
    max: 5, // 5件/秒の制限
    duration: 1000,
  },
};

const downloadWorker = new Worker<DownloadJobPayload, DownloadJobResult>(
  QUEUE_NAMES.DOWNLOAD,
  processor,
  workerOptions,
);

// イベントハンドラの設定
// downloadWorker.on("completed", (job) => {});
// downloadWorker.on("failed", (job, error) => {});

logger.info(`Download worker started with concurrency: ${CONCURRENCY}`);

export default downloadWorker;
