/**
 * @geshi/crawler
 * ジョブプロデューサー
 */

import { produceQueue } from "../bull";

export const PRODUCE_ALL_JOB_NAME = "produce-all-jobs";
/**
 * produceAllJobs を5分ごとに実行するスケジュールジョブを設定
 * @returns スケジュールされたジョブの情報
 */
export async function scheduleProduceAllJobs() {
  // 5分ごとに実行するスケジュールを設定
  await produceQueue.upsertJobScheduler(
    PRODUCE_ALL_JOB_NAME,
    // TODO: separate job
    // run every 10 minutes
    { pattern: "*/10 * * * *" },
    {
      name: "repeat-produce-all-jobs",
      opts: {
        removeOnComplete: true, // 完了したジョブは削除
        removeOnFail: true, // 失敗したジョブも削除
      },
    },
  );
}

/**
 * スケジューラーを閉じる
 */
export async function closeSchedulers() {
  await produceQueue.close();
}
