/**
 * @geshi/crawler
 * クローラーコンポーネント
 */

// 型定義のエクスポート
export * from "./types";

// BullMQキューのエクスポート
export {
  queues,
  produceQueue,
  crawlQueue,
  downloadQueue,
  recordReserveQueue,
  recordQueue,
  updateQueue,
  QUEUE_NAMES,
} from "./bull";

// プロデューサーのエクスポート
export {
  listChannels,
  listEpisodes,
  produceCrawlJobs,
  produceDownloadJobs,
  produceRecordReserveJobs,
  produceAllJobs,
} from "./producer";

// ワーカーのエクスポート
export { default as crawlWorker } from "./crawl-worker";
export { default as downloadWorker } from "./download-worker";
export { default as recordReserveWorker } from "./record-reserve-worker";
export { default as recordWorker } from "./record-worker";
export { default as updateWorker } from "./update-worker";

// デフォルトエクスポート
import * as bull from "./bull";
import * as producer from "./producer";
import crawlWorker from "./crawl-worker";
import downloadWorker from "./download-worker";
import recordReserveWorker from "./record-reserve-worker";
import recordWorker from "./record-worker";
import updateWorker from "./update-worker";

export default {
  bull,
  producer,
  workers: {
    crawlWorker,
    downloadWorker,
    recordReserveWorker,
    recordWorker,
    updateWorker,
  },
};
