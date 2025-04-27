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

// ワーカーのエクスポート
export { default as crawlWorker } from "./workers/crawl-worker";
export { default as downloadWorker } from "./workers/download-worker";
export { default as recordReserveWorker } from "./workers/record-reserve-worker";
export { default as recordWorker } from "./workers/record-worker";
export { default as updateWorker } from "./workers/update-worker";

// デフォルトエクスポート
import * as bull from "./bull";
import * as producer from "./workers/producer";
import crawlWorker from "./workers/crawl-worker";
import downloadWorker from "./workers/download-worker";
import recordReserveWorker from "./workers/record-reserve-worker";
import recordWorker from "./workers/record-worker";
import updateWorker from "./workers/update-worker";

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
