# ADR-0037: job と job event を PostgreSQL で実装する

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- `ADR-0033` で，Geshi 側 `job` model と BullMQ bridge の意味論は整理できた
- `ADR-0035` と `ADR-0036` で，`BackendStore` の物理実体と migration 運用も決まった
- 次に実装へ進むには，まず `job` 連携に必要な保存構造と最小 read / write を進める必要がある
- あわせて，それを扱う最小の backend API もなければ，Geshi 側 `job` を実際に使い始められない

## 決定

- Geshi 側 `job` model と `job event` model を PostgreSQL 上で実装する
- `BackendStore` の最初の保存対象は `job` / `job event` とする
- `job` / `job event` を扱う最小の backend API を追加する
  - `createJob`
  - `appendJobEvent`
  - `getJob`
  - `listJobs`

## 影響

- `job` / `job event` を対象に，最初の実テーブル設計と保存実装を進める前提が固まる
- collector 系 model より先に，BullMQ bridge と接続する足場を作れる
- store 実装だけでなく，job 登録・参照の最小 API まで一緒に進める前提になる

## 参考資料

- [adr-0033] ADR-0033 job model の見直し
- [adr-0035] ADR-0035 BackendStore の物理実体として PostgreSQL を採用する
- [adr-0036] ADR-0036 BackendStore 実装では ORM を採用せず runtime は pg, migration は dbmate を使う
- [job-model] docs/job.md

[adr-0033]: ./0033-job-model-review.md
[adr-0035]: ./0035-backend-store-physical-selection.md
[adr-0036]: ./0036-backend-store-orm-and-migration-policy.md
[job-model]: ../job.md
