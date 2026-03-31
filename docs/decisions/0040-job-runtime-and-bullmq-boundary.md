# ADR-0040: job runtime と BullMQ 実装境界を分離する

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- [ADR-0038] により，backend では `export job` / `update job` / `import job` を bridge job として扱う
- その実装を進める中で，`JobApi` や route から BullMQ の queue や `Queue` 作成を直接見せると，backend 側の責務と runtime 実装詳細が混ざることが分かった
- 一方で，BullMQ 側では bridge job ごとの queue 名や `Queue` 作成方法を共有しないと，runtime, worker, dashboard で同じ対応表が分散する
- したがって，`job runtime` という抽象と `BullMQ` 実装の境界を明確にする必要がある

## 決定

- backend 側は `JobRuntime` interface に依存し，BullMQ の queue を直接扱わない
- `JobRuntime` は bridge job を投入する責務を持つ
  - 対象は `export` / `update` / `import`
- `JobApi.createJob` は backend 側 `job` の保存に加えて，`JobRuntime` へ `export job` を投入する
- `JobRuntime` の factory は `createJobRuntime({ kind, options })` とし，実装選択は `kind` で表す
  - 現時点では `kind: "bullmq"` のみを持つ
- BullMQ 実装は `createBullmqRuntime(options)` とし，Redis 接続設定は `options` から受け取る
- BullMQ 実装で共有するのは bridge job queue の物理名である
  - `job-export`
  - `job-update`
  - `job-import`
- BullMQ 実装側では，bridge job kind と queue 名の対応を一箇所に置く
  - runtime
  - worker
  - dashboard
  はこの対応を共有する
- `update job` と `import job` への投入は functional worker wrapper から `JobRuntime` 経由で行う

## 影響

- route や `JobApi` から BullMQ の queue が見えなくなる
- bridge job の投入先は `JobRuntime` に集約される
- BullMQ 実装の都合である queue 名や Redis 接続設定は，`job runtime` の抽象境界の内側に寄る
- runtime 実装差し替え時には `JobRuntime` 実装を差し替えればよく，backend 側 API の責務は保ちやすくなる

## 参考資料

- [adr-0038] ADR-0038: job bridge worker の責務を再整理する
- [adr-0039] ADR-0039: backend の test を unit / mid / integration に分離する

[adr-0038]: ./0038-job-bridge-worker-bootstrap.md
[adr-0039]: ./0039-backend-test-separation.md
