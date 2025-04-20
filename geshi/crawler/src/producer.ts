/**
 * @geshi/crawler
 * ジョブプロデューサー
 */

import { v4 as uuidv4 } from "uuid";
// eslint-disable-next-line import/no-unresolved
import { PrismaClient, Channel, Episode } from "@geshi/model";
import { crawlQueue, downloadQueue, recordReserveQueue } from "./bull";
import {
  CrawlJobPayload,
  DownloadJobPayload,
  RecordReserveJobPayload,
  JobStatus,
  JobType,
} from "./types";

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
      channelId: channel.id,
      rssUrl: channel.rssUrl,
    };

    // jobsテーブルへ永続化
    await prisma.job.create({
      data: {
        id: jobId,
        channelId: channel.id,
        type: JobType.CRAWL,
        status: JobStatus.PENDING,
        payload: payload as any,
      },
    });

    // キューにジョブを追加
    await crawlQueue.add(`crawl-${jobId}`, payload);

    console.log(
      `Crawl job created for channel: ${channel.title} (${channel.id})`,
    );
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
      episodeId: episode.id,
      mediaUrl: episode.audioUrl,
    };

    // jobsテーブルへ永続化
    await prisma.job.create({
      data: {
        id: jobId,
        channelId: episode.channelId,
        episodeId: episode.id,
        type: JobType.DOWNLOAD,
        status: JobStatus.PENDING,
        payload: payload as any,
      },
    });

    // キューにジョブを追加
    await downloadQueue.add(`download-${jobId}`, payload);

    console.log(
      `Download job created for episode: ${episode.title} (${episode.id})`,
    );
  }
}

/**
 * 録画予約ジョブを生成してキューに追加
 * @param episodes 録画予約対象のエピソード一覧
 */
export async function produceRecordReserveJobs(
  episodes: Episode[],
): Promise<void> {
  for (const episode of episodes) {
    // 予約可能なエピソードのみ対象とする（scheduledAtが設定されていて、かつ未来の日時）
    if (
      episode.type !== "live" ||
      !episode.scheduledAt ||
      episode.scheduledAt <= new Date()
    ) {
      continue;
    }

    const jobId = uuidv4();

    // ジョブペイロードの生成
    const payload: RecordReserveJobPayload = {
      jobId,
      episodeId: episode.id,
      streamUrl: episode.audioUrl,
      startTime: episode.scheduledAt.toISOString(),
      options: {
        quality: "high",
        duration: 60 * 60, // デフォルト1時間
      },
    };

    // jobsテーブルへ永続化
    await prisma.job.create({
      data: {
        id: jobId,
        channelId: episode.channelId,
        episodeId: episode.id,
        type: JobType.RECORD_RESERVE,
        status: JobStatus.PENDING,
        payload: payload as any,
      },
    });

    // キューにジョブを追加
    await recordReserveQueue.add(`record-reserve-${jobId}`, payload);

    console.log(
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

    console.log("All jobs produced successfully");
  } catch (error) {
    console.error("Error producing jobs:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

export default {
  listChannels,
  listEpisodes,
  produceCrawlJobs,
  produceDownloadJobs,
  produceRecordReserveJobs,
  produceAllJobs,
};
