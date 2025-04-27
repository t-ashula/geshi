/**
 * @geshi/crawler
 * 更新ワーカー
 */

import { Worker } from "bullmq";
import dotenv from "dotenv";

import { PrismaClient } from "@geshi/model";
import { QUEUE_NAMES } from "../bull";
import { UpdateJobMessage, JobType, JobStatus } from "../types";
import logger from "../logger";

// 環境変数の読み込み
dotenv.config();

// ワーカーの並行処理数
const CONCURRENCY = parseInt(process.env.UPDATE_CONCURRENCY || "10", 10);

const prisma = new PrismaClient();

/**
 * クロール結果を適用する
 * @param jobId ジョブID
 * @param result クロール結果
 */
async function applyCrawlResult(jobId: string, result: any): Promise<void> {
  logger.info(`Applying crawl result for job: ${jobId}`);

  try {
    // ジョブを完了状態に更新
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: result.success ? JobStatus.DONE : JobStatus.ERROR,
        result,
        finishedAt: new Date(),
      },
    });

    // 成功した場合のみエピソード処理
    if (result.success && result.episodes && result.episodes.length > 0) {
      const { channelId, episodes } = result;

      // チャンネル情報を取得
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
      });

      if (!channel) {
        throw new Error(`Channel not found: ${channelId}`);
      }

      // 各エピソードを処理
      for (const episode of episodes) {
        // エピソードのGUIDまたはリンクを使用して一意性を確保
        const episodeIdentifier = episode.guid || episode.link;

        if (!episodeIdentifier) {
          logger.warn("Episode without identifier, skipping:", episode.title);
          continue;
        }

        // 既存のエピソードを検索
        const existingEpisode = await prisma.episode.findFirst({
          where: {
            channelId,
            slug: episodeIdentifier,
          },
        });

        if (existingEpisode) {
          logger.info(`Episode already exists: ${episode.title}`);
          continue;
        }

        // 公開日時をパース
        let publishedAt = new Date();
        try {
          if (episode.pubDate) {
            publishedAt = new Date(episode.pubDate);
          }
        } catch (error) {
          logger.warn(
            `Invalid date format: ${episode.pubDate}, using current date, ${error}`,
          );
        }

        // メディアURLを取得
        let audioUrl = "";
        if (episode.enclosure && episode.enclosure.$.url) {
          audioUrl = episode.enclosure.$.url;
        } else if (episode.enclosure && typeof episode.enclosure === "string") {
          audioUrl = episode.enclosure;
        }

        // 新規エピソードを作成
        await prisma.episode.create({
          data: {
            slug: episodeIdentifier,
            channelId,
            title: episode.title || "Untitled Episode",
            publishedAt,
            audioUrl,
            type: "static", // 静的なメディアファイル
          },
        });

        logger.info(`Created new episode: ${episode.title}`);
      }
    }
  } catch (error) {
    logger.error(`Error applying crawl result for job ${jobId}:`, error);
    throw error;
  }
}

/**
 * ダウンロード結果を適用する
 * @param jobId ジョブID
 * @param result ダウンロード結果
 */
async function applyDownloadResult(jobId: string, result: any): Promise<void> {
  logger.info(`Applying download result for job: ${jobId}`);

  try {
    // ジョブを完了状態に更新
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: result.success ? JobStatus.DONE : JobStatus.ERROR,
        result,
        finishedAt: new Date(),
      },
    });

    // 成功した場合のみエピソード更新
    if (result.success && result.episodeId && result.sizeBytes) {
      // エピソードのサイズを更新
      await prisma.episode.update({
        where: { id: result.episodeId },
        data: {
          sizeBytes: result.sizeBytes,
        },
      });

      logger.info(
        `Updated episode size: ${result.episodeId}, size: ${result.sizeBytes} bytes`,
      );
    }
  } catch (error) {
    logger.error(`Error applying download result for job ${jobId}:`, error);
    throw error;
  }
}

/**
 * 録画予約結果を適用する
 * @param jobId ジョブID
 * @param result 録画予約結果
 */
async function applyRecordReserveResult(
  jobId: string,
  result: any,
): Promise<void> {
  logger.info(`Applying record reserve result for job: ${jobId}`);

  try {
    // ジョブを完了状態に更新
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: result.success ? JobStatus.DONE : JobStatus.ERROR,
        result,
        finishedAt: new Date(),
      },
    });

    // 特に追加のデータベース更新は不要
    // 録画ジョブは既に作成済み
  } catch (error) {
    logger.error(
      `Error applying record reserve result for job ${jobId}:`,
      error,
    );
    throw error;
  }
}

/**
 * 録画結果を適用する
 * @param jobId ジョブID
 * @param result 録画結果
 */
async function applyRecordResult(jobId: string, result: any): Promise<void> {
  logger.info(`Applying record result for job: ${jobId}`);

  try {
    // ジョブを完了状態に更新
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: result.success ? JobStatus.DONE : JobStatus.ERROR,
        result,
        finishedAt: new Date(),
      },
    });

    // 成功した場合のみエピソード更新
    if (result.success && result.episodeId && result.sizeBytes) {
      // エピソードのサイズを更新
      await prisma.episode.update({
        where: { id: result.episodeId },
        data: {
          sizeBytes: result.sizeBytes,
        },
      });

      logger.info(
        `Updated episode size: ${result.episodeId}, size: ${result.sizeBytes} bytes`,
      );
    }
  } catch (error) {
    logger.error(`Error applying record result for job ${jobId}:`, error);
    throw error;
  }
}

// 更新ワーカーの作成
const updateWorker = new Worker<UpdateJobMessage, void>(
  QUEUE_NAMES.UPDATE,
  async (job) => {
    logger.info(`Processing update job: ${job.id}`);
    const { jobType, jobId, result } = job.data;

    try {
      // ジョブタイプに応じた処理を実行
      switch (jobType) {
        case JobType.CRAWL:
          await applyCrawlResult(jobId, result);
          break;
        case JobType.DOWNLOAD:
          await applyDownloadResult(jobId, result);
          break;
        case JobType.RECORD_RESERVE:
          await applyRecordReserveResult(jobId, result);
          break;
        case JobType.RECORD:
          await applyRecordResult(jobId, result);
          break;
        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }

      logger.info(`Update job completed: ${job.id}`);
    } catch (error) {
      logger.error(`Update job failed: ${job.id}`, error);
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
updateWorker.on("completed", (job) => {
  logger.info(`Update job ${job.id} has completed successfully`);
});

updateWorker.on("failed", (job, error) => {
  logger.error(`Update job ${job?.id} has failed with error:`, error);
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

logger.info(`Update worker started with concurrency: ${CONCURRENCY}`);

export default updateWorker;
