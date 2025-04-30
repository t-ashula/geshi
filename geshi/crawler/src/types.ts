/**
 * @geshi/crawler
 * クローラーコンポーネントの型定義
 */

/**
 * クロールジョブのペイロード
 */
export interface CrawlJobPayload {
  jobId: string;
  targetUrl: string;
  crawlType: CrawlType;
}

export interface CrawlJobResult {
  result: CrawlerResult;
  spent: number;
  success: boolean;
}

export enum CrawlType {
  RSS = "rss",
}

// TODO: more gcm type
export type CrawledEpisode = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  enclosure?: string | { url: string; length: number };
  guid: string;
  duration?: number;
};
export type CrawlerResult = {
  success: boolean;
  episodes: CrawledEpisode[];
};

/**
 * ダウンロードジョブのペイロード
 */
export interface DownloadJobPayload {
  jobId: string;
  targetUrl: string;
}

export interface DownloadJobResult {
  result: DownloaderResult;
  spent: number;
  success: boolean;
}

export type DownloaderResult = {
  success: boolean;
  size: number;
  outputPath: string;
};

/**
 * 録画予約ジョブのペイロード
 */
export interface RecordReserveJobPayload {
  jobId: string;
  recordJobParams: RecordJobParams;
}

export interface RecordReserveJobResult {
  success: boolean;
  result: RecordReserverResult;
  spent: number;
}

export type RecordReserverResult = {
  jobId: string;
};

/**
 * 録画ジョブのペイロード
 */
export interface RecordJobPayload {
  jobId: string;
  episodeId: string;
  streamUrl: string;
  startTime: string; // ISO8601 datetime
  duration?: number;
}

export interface RecordJobResult {
  success: boolean;
  spent: number;
  result: RecorderResult;
}

export type RecorderResult = {
  outputPath: string;
  duration: number;
  size: number;
  success: boolean;
};
export type RecordJobParams = Omit<RecordJobPayload, "jobId">;
export type RecorderOptions = {
  duration?: number;
};

/**
 * 更新ジョブのメッセージ
 */
export interface UpdateJobMessage {
  jobType: "crawl" | "download" | "record-reserve" | "record";
  jobId: string;
  result?:
    | CrawlJobResult
    | DownloadJobResult
    | RecordReserveJobResult
    | RecordJobResult;
  error?: string;
}

/**
 * ジョブのステータス
 */
export enum JobStatus {
  PENDING = "pending",
  WORKING = "working",
  DONE = "done",
  ERROR = "error",
}

/**
 * ジョブの種類
 */
export enum JobType {
  CRAWL = "crawl",
  DOWNLOAD = "download",
  RECORD_RESERVE = "record-reserve",
  RECORD = "record",
  UPDATE = "update",
  PRODUCE = "produce",
}
