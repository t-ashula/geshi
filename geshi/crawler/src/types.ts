/**
 * @geshi/crawler
 * クローラーコンポーネントの型定義
 */

/**
 * クロールジョブのペイロード
 */
export interface CrawlJobPayload {
  jobId: string;
  channelId: string;
  rssUrl: string;
}

/**
 * ダウンロードジョブのペイロード
 */
export interface DownloadJobPayload {
  jobId: string;
  episodeId: string;
  mediaUrl: string;
}

/**
 * 録画予約ジョブのペイロード
 */
export interface RecordReserveJobPayload {
  jobId: string;
  episodeId: string;
  streamUrl: string;
  startTime: string;
  options?: {
    quality?: "low" | "medium" | "high";
    duration?: number;
    endTime?: string;
  };
}

/**
 * 録画ジョブのペイロード
 */
export interface RecordJobPayload {
  jobId: string;
  episodeId: string;
  streamUrl: string;
  outputPath: string;
}

/**
 * 更新ジョブのメッセージ
 */
export interface UpdateJobMessage {
  jobType: "crawl" | "download" | "record-reserve" | "record";
  jobId: string;
  result: any;
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
}
