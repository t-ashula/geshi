# 0037 job store bootstrap

## 位置づけ

この文書は，`ADR-0037` の検討メモ置き場である．

## 決めること

- `job` テーブルの最小カラムを決める
- `job_event` テーブルの最小カラムを決める
- `job` と `job_event` の主キー，外部キー，index を決める
- `job.md` の model と PostgreSQL の型対応を決める
- 最初の実 migration に `jobs` / `job_events` を追加する
- 最小の `pg` read / write 実装を置く
- `job` / `job_event` を扱う最小 backend API の責務とインタフェースを決める

## 決めたこと

- `job.id` は UUID v7 とする
- `job_event.job_id` は `job.id` を参照する UUID とする
- `job.kind` は `text` とし，index を付ける
- `job.payload` は PostgreSQL では `jsonb` で持つ
- `job.run_after` は nullable とする
- `job_event.runtime_job_id` は nullable `text` とし，index を付ける
- `job_event.status` は `text` とする
- `job_event.failure_stage` は nullable `text` とする
- `job_event.note` は長さ制限なしの `text` とする
- `job` の current status は table に持たず，`job_event` 集約だけで扱う
- `job_event` には順序の tie-break 用に surrogate key を持たせる
  - ただし，これはイベント本来の発生順序そのものではなく，DB 内の安定した並びのために使う
- 最低限の index は次を持つ
  - `jobs(kind)`
  - `jobs(run_after)`
  - `job_events(job_id)`
  - `job_events(runtime_job_id)`
  - `job_events(job_id, occurred_at desc, id desc)`
- 最初の `pg` 実装で作る
  - insert job
  - append job event
  - get job by id
  - list jobs
- `createJob`
  - `job` を 1 件作成する
  - `registered` の `job_event` も同時に積む
- `getJob`
  - `job` 本体と，現在状態に必要な `job_event` 集約を返す
- `listJobs`
  - `job` 一覧と，現在状態に必要な `job_event` 集約を返す
- `appendJobEvent`
  - `job_event` を 1 件追加する
- `getJob` / `listJobs` が current status を SQL 集約で返す
  - N+1 に気をつける
- `appendJobEvent` は append-only とし，最低限 `job` の存在だけを前提にする
  - 状態遷移の厳密な妥当性検証は，最初の bootstrap では DB 制約に持ち込まない

## 現時点の見立て

### backend API

BullMQ bridge や worker 実装そのものは `0038` にわける

## まだ決まっていないこと

- `job` テーブルの最小カラム確定版
- `job_event` テーブルの最小カラム確定版
