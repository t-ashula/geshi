/**
 * @geshi/crawler
 * BullMQのキュー設定
 */

import { Queue } from "bullmq";
import dotenv from "dotenv";
import {
  CrawlJobPayload,
  DownloadJobPayload,
  RecordReserveJobPayload,
  RecordJobPayload,
  UpdateJobMessage,
} from "./types";

// 環境変数の読み込み
dotenv.config();

// Redis接続設定
export const defaultConnectionOptions = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
};

// キュー名の定義
export const QUEUE_NAMES = {
  PRODUCE: "produce",
  CRAWL: "crawl",
  DOWNLOAD: "download",
  RECORD_RESERVE: "record-reserve",
  RECORD: "record",
  UPDATE: "update",
};

// BullMQのQueueインスタンス定義
export const produceQueue = new Queue<void>(QUEUE_NAMES.PRODUCE, {
  connection: defaultConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

export const crawlQueue = new Queue<CrawlJobPayload>(QUEUE_NAMES.CRAWL, {
  connection: defaultConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

export const downloadQueue = new Queue<DownloadJobPayload>(
  QUEUE_NAMES.DOWNLOAD,
  {
    connection: defaultConnectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
  },
);

export const recordReserveQueue = new Queue<RecordReserveJobPayload>(
  QUEUE_NAMES.RECORD_RESERVE,
  {
    connection: defaultConnectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
  },
);

export const recordQueue = new Queue<RecordJobPayload>(QUEUE_NAMES.RECORD, {
  connection: defaultConnectionOptions,
  defaultJobOptions: {
    attempts: 1, // 録画は再試行しない
  },
});

export const updateQueue = new Queue<UpdateJobMessage>(QUEUE_NAMES.UPDATE, {
  connection: defaultConnectionOptions,
  defaultJobOptions: {
    attempts: 5, // 更新は重要なので再試行回数を多めに
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
});

export const queues = {
  produceQueue,
  crawlQueue,
  downloadQueue,
  recordReserveQueue,
  recordQueue,
  updateQueue,
};
