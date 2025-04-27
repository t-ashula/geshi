/**
 * @geshi/crawler
 * クロールワーカー
 */

import { Worker } from "bullmq";
import type { Job } from "bullmq";
import { updateQueue, QUEUE_NAMES, defaultConnectionOptions } from "../bull";
import { crawl } from "../funcs/crawl";
import {
  CrawlJobPayload,
  CrawlJobResult,
  UpdateJobMessage,
  JobType,
} from "../types";
import logger from "../logger";

// ワーカーの並行処理数
const CONCURRENCY = 5;

const processor = async (
  job: Job<CrawlJobPayload, CrawlJobResult>,
): Promise<CrawlJobResult> => {
  const startAt = Date.now();
  const { jobId, targetUrl, crawlType } = job.data;
  logger.info(`start`, { worker: JobType.CRAWL, jobId });

  try {
    // TODO: crawl return Either<Error, CrawlerResult>
    const result = await crawl(targetUrl, crawlType);

    const spent = Date.now() - startAt;
    // 更新キューにメッセージを追加
    const updateMessage: UpdateJobMessage = {
      jobType: JobType.CRAWL,
      jobId,
      result: { result, spent },
      success: true,
    };

    await updateQueue.add(`update-crawl-${jobId}`, updateMessage);

    logger.info(`completed`, {
      worker: JobType.CRAWL,
      jobId,
      count: result.episodes.length,
    });
    return { result, spent };
  } catch (error) {
    logger.error(`failed. error=${error}`, { jobId, error });

    // 更新キューにエラーメッセージを追加
    const updateMessage: UpdateJobMessage = {
      jobType: JobType.CRAWL,
      jobId,
      error: error instanceof Error ? error.message : String(error),
      success: false,
    };

    await updateQueue.add(`update-crawl-error-${jobId}`, updateMessage);

    // エラーを再スローしてBullMQに再試行させる
    throw error;
  }
};

// クロールワーカーの作成
const workerOptions = {
  connection: defaultConnectionOptions,
  concurrency: CONCURRENCY,
  limiter: {
    max: 10, // 10件/秒の制限
    duration: 1000,
  },
};

const crawlWorker = new Worker<CrawlJobPayload, CrawlJobResult>(
  QUEUE_NAMES.CRAWL,
  processor,
  workerOptions,
);

// イベントハンドラの設定
// crawlWorker.on("completed", (job) => {});
// crawlWorker.on("failed", (job, error) => {});

logger.info(`Crawl worker started with concurrency: ${CONCURRENCY}`);

export default crawlWorker;
