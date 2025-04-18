/**
 * @geshi/crawler
 * クロールワーカー
 */

import { Worker } from "bullmq";
import axios from "axios";
import { parseStringPromise } from "xml2js";
import dotenv from "dotenv";
import { updateQueue, QUEUE_NAMES } from "./bull";
import { CrawlJobPayload, UpdateJobMessage, JobType } from "./types";

// 環境変数の読み込み
dotenv.config();

// ワーカーの並行処理数
const CONCURRENCY = 5;

/**
 * RSSフィードをフェッチして解析する
 * @param rssUrl RSSフィードのURL
 * @returns 解析結果
 */
async function fetchRss(rssUrl: string): Promise<any> {
  try {
    const response = await axios.get(rssUrl, {
      headers: {
        "User-Agent": "Geshi-Crawler/1.0",
      },
      timeout: 10000, // 10秒タイムアウト
    });

    // XMLをJSONに変換
    const result = await parseStringPromise(response.data, {
      explicitArray: false,
      trim: true,
    });

    return result;
  } catch (error) {
    console.error(`Error fetching RSS from ${rssUrl}:`, error);
    throw error;
  }
}

/**
 * RSSフィードから新規エピソードを抽出する
 * @param rssData RSSフィードのデータ
 * @returns 新規エピソードのリスト
 */
function extractEpisodes(rssData: any): any[] {
  try {
    // RSSフィードの形式によって適切に処理
    // 一般的なRSSフィードの場合
    if (rssData.rss && rssData.rss.channel && rssData.rss.channel.item) {
      const items = Array.isArray(rssData.rss.channel.item)
        ? rssData.rss.channel.item
        : [rssData.rss.channel.item];

      return items.map((item) => ({
        title: item.title,
        link: item.link,
        description: item.description,
        pubDate: item.pubDate,
        enclosure: item.enclosure,
        guid: item.guid,
      }));
    }

    // Podcastの場合（iTunes拡張）
    if (
      rssData.rss &&
      rssData.rss.channel &&
      rssData.rss.channel["itunes:item"]
    ) {
      const items = Array.isArray(rssData.rss.channel["itunes:item"])
        ? rssData.rss.channel["itunes:item"]
        : [rssData.rss.channel["itunes:item"]];

      return items.map((item) => ({
        title: item.title || item["itunes:title"],
        link: item.link,
        description: item.description || item["itunes:summary"],
        pubDate: item.pubDate,
        enclosure: item.enclosure,
        guid: item.guid,
        duration: item["itunes:duration"],
      }));
    }

    // その他のフォーマットの場合は空配列を返す
    console.warn("Unknown RSS format:", Object.keys(rssData));
    return [];
  } catch (error) {
    console.error("Error extracting episodes:", error);
    return [];
  }
}

// クロールワーカーの作成
const crawlWorker = new Worker<CrawlJobPayload, any>(
  QUEUE_NAMES.CRAWL,
  async (job) => {
    console.log(`Processing crawl job: ${job.id}`);
    const { jobId, channelId, rssUrl } = job.data;

    try {
      // RSSフィードをフェッチ
      const rssData = await fetchRss(rssUrl);

      // エピソードを抽出
      const episodes = extractEpisodes(rssData);

      // 結果を生成
      const result = {
        channelId,
        rssUrl,
        fetchedAt: new Date().toISOString(),
        episodes,
        success: true,
      };

      // 更新キューにメッセージを追加
      const updateMessage: UpdateJobMessage = {
        jobType: JobType.CRAWL,
        jobId,
        result,
      };

      await updateQueue.add(`update-crawl-${jobId}`, updateMessage);

      console.log(
        `Crawl job completed: ${job.id}, found ${episodes.length} episodes`,
      );
      return result;
    } catch (error) {
      console.error(`Crawl job failed: ${job.id}`, error);

      // エラー結果を生成
      const errorResult = {
        channelId,
        rssUrl,
        fetchedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        success: false,
      };

      // 更新キューにエラーメッセージを追加
      const updateMessage: UpdateJobMessage = {
        jobType: JobType.CRAWL,
        jobId,
        result: errorResult,
      };

      await updateQueue.add(`update-crawl-error-${jobId}`, updateMessage);

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
    limiter: {
      max: 10, // 10件/秒の制限
      duration: 1000,
    },
  },
);

// イベントハンドラの設定
crawlWorker.on("completed", (job) => {
  console.log(`Crawl job ${job.id} has completed successfully`);
});

crawlWorker.on("failed", (job, error) => {
  console.error(`Crawl job ${job?.id} has failed with error:`, error);
});

console.log(`Crawl worker started with concurrency: ${CONCURRENCY}`);

export default crawlWorker;
