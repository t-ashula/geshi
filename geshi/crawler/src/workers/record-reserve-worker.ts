/**
 * @geshi/crawler
 * 録画予約ワーカー
 */

import { spawn } from "child_process";
import { Job, Worker } from "bullmq";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { PrismaClient } from "@geshi/model";
import {
  updateQueue,
  recordQueue,
  QUEUE_NAMES,
  defaultConnectionOptions,
} from "../bull";
import {
  RecordReserveJobPayload,
  RecordJobPayload,
  UpdateJobMessage,
  JobType,
  RecordReserverResult,
  RecordReserveJobResult,
} from "../types";
import logger from "../logger";

// 環境変数の読み込み
dotenv.config();

// ワーカーの並行処理数
const CONCURRENCY = parseInt(
  process.env.RECORD_RESERVE_CONCURRENCY || "10",
  10,
);

// Prismaクライアントの初期化
const prisma = new PrismaClient();

// FIXME: how to get record-worker path
/**
 * record worker の spawn 用のコマンドと引数を得る
 * @returns command:
 */
function getRecordWorkerCommand(): { command: string; args: string[] } {
  const js = __dirname.includes("/dist/");
  const command = js ? "node" : "tsx";
  const ext = js ? "js" : "ts";
  const path = `${__dirname}/record-worker.${ext}`;
  return { command, args: [path] };
}

const processor = async (
  job: Job<RecordReserveJobPayload, RecordReserveJobResult>,
): Promise<RecordReserveJobResult> => {
  const startAt = Date.now();
  const { jobId, recordJobParams } = job.data;

  logger.info(`start`, { worker: JobType.RECORD_RESERVE, jobId });

  try {
    // 録画ジョブのIDを生成
    const recordJobId = uuidv4();

    // 録画ジョブのペイロードを生成
    const recordPayload: RecordJobPayload = {
      jobId: recordJobId,
      ...recordJobParams,
    };

    // jobsテーブルへ永続化
    await prisma.job.create({
      data: {
        id: recordJobId,
        type: JobType.RECORD,
        payload: recordPayload,
      },
    });

    // 録画キューにジョブを追加（遅延実行）
    await recordQueue.add(`record-${recordJobId}`, recordPayload);

    // 録画用 Worker を非同期 spawn するだけ（exit を待たない）
    const { command, args } = getRecordWorkerCommand();
    spawn(command, args, {
      stdio: "inherit",
      env: process.env,
    });
    const spent = Date.now() - startAt;
    const result: RecordReserverResult = {
      jobId: recordJobId,
    };

    // 更新キューにメッセージを追加
    const updateMessage: UpdateJobMessage = {
      jobType: JobType.RECORD_RESERVE,
      jobId,
      success: true,
      result: { result, spent },
    };

    await updateQueue.add(`update-record-reserve-${jobId}`, updateMessage);

    logger.info(`completed`, { jobId, recordJobId });
    return { result, spent };
  } catch (error) {
    logger.error(`failed`, { jobId, error });

    // 更新キューにエラーメッセージを追加
    const updateMessage: UpdateJobMessage = {
      jobType: JobType.RECORD_RESERVE,
      jobId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };

    await updateQueue.add(
      `update-record-reserve-error-${jobId}`,
      updateMessage,
    );

    // エラーを再スローしてBullMQに再試行させる
    throw error;
  }
};

const workerOptions = {
  connection: defaultConnectionOptions,
  concurrency: CONCURRENCY,
};
// 録画予約ワーカーの作成
const recordReserveWorker = new Worker<RecordReserveJobPayload, any>(
  QUEUE_NAMES.RECORD_RESERVE,
  processor,
  workerOptions,
);

// イベントハンドラの設定
// recordReserveWorker.on("completed", (job) => {});
// recordReserveWorker.on("failed", (job, error) => {});

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
