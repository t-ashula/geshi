/**
 * @geshi/crawler
 * ジョブプロデューサー
 */

import { v4 as uuidv4 } from "uuid";
import { Worker } from "bullmq";
import { PrismaClient, Channel, Episode } from "@geshi/model";
import {
  crawlQueue,
  defaultConnectionOptions,
  downloadQueue,
  QUEUE_NAMES,
  recordReserveQueue,
} from "../bull";

import {
  CrawlJobPayload,
  DownloadJobPayload,
  RecordReserveJobPayload,
  JobType,
  CrawlType,
  RecordJobPayload,
} from "../types";

import logger from "../logger";

// Prismaクライアントの初期化
const prisma = new PrismaClient();

/**
 * チャンネル一覧を取得
 * @returns チャンネル一覧
 */
export async function listChannels(): Promise<Channel[]> {
  return prisma.channel.findMany();
}

/**
 * エピソード一覧を取得
 * @param options 取得オプション
 * @returns エピソード一覧
 */
export async function listEpisodes(options?: {
  channelId?: string;
  limit?: number;
  offset?: number;
}): Promise<Episode[]> {
  return prisma.episode.findMany({
    where: options?.channelId ? { channelId: options.channelId } : undefined,
    take: options?.limit,
    skip: options?.offset,
    orderBy: { publishedAt: "desc" },
  });
}

/**
 * クロールジョブを生成してキューに追加
 * @param channels クロール対象のチャンネル一覧
 */
export async function produceCrawlJobs(channels: Channel[]): Promise<void> {
  for (const channel of channels) {
    const jobId = uuidv4();

    // ジョブペイロードの生成
    const payload: CrawlJobPayload = {
      jobId,
      crawlType: CrawlType.RSS, // TODO: use channel info.
      targetUrl: channel.rssUrl,
    };

    // jobsテーブルへ永続化
    await prisma.job.create({
      data: {
        id: jobId,
        type: JobType.CRAWL,
        payload: payload,
      },
    });

    // キューにジョブを追加
    await crawlQueue.add(`crawl-${jobId}`, payload);

    logger.info(`Crawl job created`, { id: channel.id, title: channel.title });
  }
}

/**
 * ダウンロードジョブを生成してキューに追加
 * @param episodes ダウンロード対象のエピソード一覧
 */
export async function produceDownloadJobs(episodes: Episode[]): Promise<void> {
  for (const episode of episodes) {
    // 静的なメディアファイルのみダウンロード対象とする
    if (episode.type !== "static") {
      continue;
    }

    const jobId = uuidv4();

    // ジョブペイロードの生成
    const payload: DownloadJobPayload = {
      jobId,
      targetUrl: episode.audioUrl,
    };

    // jobsテーブルへ永続化
    await prisma.job.create({
      data: {
        id: jobId,
        type: JobType.DOWNLOAD,
        payload: payload,
      },
    });

    // キューにジョブを追加
    await downloadQueue.add(`download-${jobId}`, payload);

    logger.info(`Download job created`, {
      id: episode.id,
      title: episode.title,
    });
  }
}
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
  const startGap = 5 * 60 * 1000;
  return Math.max(0, delay - startGap);
}

// TODO:
/**
 * 録画時間を計算する．不定の場合 0
 * @param _episode
 * @returns 録画時間（秒）
 */
function getDuration(_episode: Episode): number {
  return 0;
}
/**
 * 録画予約ジョブを生成してキューに追加
 * @param episodes 録画予約対象のエピソード一覧
 */
export async function produceRecordReserveJobs(
  episodes: Episode[],
): Promise<void> {
  for (const episode of episodes) {
    // TODO: 対象の抽出は model 側に持っていく
    // 予約可能なエピソードのみ対象とする（scheduledAtが設定されていて、かつ未来の日時）
    if (
      episode.type !== "live" ||
      !episode.scheduledAt ||
      episode.scheduledAt <= new Date()
    ) {
      continue;
    }

    const jobId = uuidv4();

    // 実際の録画ジョブのためのパラメータを渡す
    const recordJobParams: Omit<RecordJobPayload, "jobId"> = {
      episodeId: episode.id,
      streamUrl: episode.audioUrl,
      startTime: episode.scheduledAt.toISOString(),
      duration: getDuration(episode),
    };
    // ジョブペイロードの生成
    const payload: RecordReserveJobPayload = {
      jobId,
      recordJobParams,
    };

    // jobsテーブルへ永続化
    await prisma.job.create({
      data: {
        id: jobId,
        episodeId: episode.id,
        type: JobType.RECORD_RESERVE,
        payload: payload,
      },
    });

    // キューにジョブを追加
    const delay = scheduleRecordJob(episode.scheduledAt.toISOString());
    await recordReserveQueue.add(`record-reserve-${jobId}`, payload, { delay });

    logger.info(
      `Record reserve job created for episode: ${episode.title} (${episode.id})`,
    );
  }
}

/**
 * すべてのジョブを生成してキューに追加
 */
export async function produceAllJobs(): Promise<void> {
  try {
    // チャンネル一覧を取得
    const channels = await listChannels();

    // クロールジョブを生成
    await produceCrawlJobs(channels);

    // エピソード一覧を取得（最新100件）
    const episodes = await listEpisodes({ limit: 100 });

    // ダウンロードジョブを生成
    await produceDownloadJobs(episodes);

    // 録画予約ジョブを生成
    await produceRecordReserveJobs(episodes);

    logger.info("All jobs produced successfully");
  } catch (error) {
    logger.error("Error producing jobs:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const produceWorker = new Worker<void, void>(
  QUEUE_NAMES.PRODUCE,
  async (_job) => {
    produceAllJobs();
  },
  {
    connection: defaultConnectionOptions,
    concurrency: 1,
  },
);

export default produceWorker;
