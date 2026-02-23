import axios from "axios";
import { parseStringPromise } from "xml2js";
import logger from "../logger";
import { USER_AGENT } from "../const";
import { CrawlType, CrawlerResult, CrawledEpisode } from "../types";

type XmlObj<RootName extends string, InnerType> = {
  [K in RootName]: InnerType;
};

// TODO: use rss-parser
type RssObject = {
  channel: {
    item: Array<{
      title: string;
      link: string;
      description: string;
      pubDate: string;
      enclosure: string;
      guid: string;
    }>;
  } & Record<string, unknown>;
};
type RssJson = XmlObj<"rss", RssObject>;

async function crawl(
  targetUrl: string,
  crawlType: CrawlType,
): Promise<CrawlerResult> {
  switch (crawlType) {
    case CrawlType.RSS: {
      const rssData = await fetchRss(targetUrl);
      const episodes = extractEpisodes(rssData);
      return { success: true, episodes };
    }
    default:
      // TODO: success: false ?
      return { success: true, episodes: [] };
  }
}
/**
 * RSSフィードをフェッチして解析する
 * @param rssUrl RSSフィードのURL
 * @returns 解析結果
 */
async function fetchRss(rssUrl: string): Promise<RssJson> {
  try {
    const response = await axios.get(rssUrl, {
      headers: {
        "User-Agent": USER_AGENT,
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
    logger.error(`Error fetching RSS from ${rssUrl}:`, error);
    throw error;
  }
}

/**
 * RSSフィードから新規エピソードを抽出する
 * @param rssObject RSSフィードのデータ
 * @returns 新規エピソードのリスト
 */
function extractEpisodes(rssObject: RssJson): CrawledEpisode[] {
  try {
    // RSSフィードの形式によって適切に処理
    // 一般的なRSSフィードの場合
    if (rssObject.rss && rssObject.rss.channel && rssObject.rss.channel.item) {
      const items = Array.isArray(rssObject.rss.channel.item)
        ? rssObject.rss.channel.item
        : [rssObject.rss.channel.item];

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
      rssObject.rss &&
      rssObject.rss.channel &&
      rssObject.rss.channel["itunes:item"]
    ) {
      const items = Array.isArray(rssObject.rss.channel["itunes:item"])
        ? rssObject.rss.channel["itunes:item"]
        : [rssObject.rss.channel["itunes:item"]];

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
    logger.warn(`Unknown RSS format:${Object.keys(rssObject)}`);
    return [];
  } catch (error) {
    logger.error(`Error extracting episodes: ${error}`);
    return [];
  }
}

export { crawl };
