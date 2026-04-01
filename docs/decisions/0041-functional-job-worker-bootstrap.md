# ADR-0041: job/db 連携テスト用の functional job worker を追加する

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- [ADR-0038] により，bridge job と functional job worker の責務は整理された
- [ADR-0040] により，backend 側 `JobApi` と `JobRuntime` と BullMQ 実装境界も整理された
- しかし現時点では，functional job worker 自体はまだ実体を持たず，`export job` / `update job` / `import job` の流れを実 DB と結び付けて確認する足場がない
- したがって，最初の functional job worker を追加し，job と DB との連携を確認できるようにする必要がある

## 決定

- 最初の functional job worker として，job/db 連携テスト用 worker を追加する
- この worker は，functional job worker wrapper と `update job` / `import job` の流れを実 backend 実装と結び付けて確認するための足場として扱う
- この worker は，実運用機能より前に，job runtime から backend store までの接続確認を優先する
- 疎通確認は，test 用 PostgreSQL / Redis を用意した上で，
  - 疎通確認用 worker を起動し，
  - backend の `JobApi` から `createJob()` を行い，
  - `job` / `job_event` / runtime queue / import 反映を観察する形で行う
- worker は `backend/src/job/workers/` 配下に置き，`health-check.ts` と `HealthCheck` の名称を揃える
  - 初期段階では，ワーカーとしては何もせず，info と debug でログにメッセージを残すだけとする
  - 今後の機能実装で必要に応じて，ワーカーで行うことを調整する
- functional job worker 自体は BullMQ 固有 API に依存させない
  - worker 実装は `context` / `payload` / `FunctionalJobOutput` に依存する
  - BullMQ 固有の job object や hook は wrapper や runtime 実装側に閉じる

## 影響

- bridge job だけでは見えにくい runtime から backend への連携を確認しやすくなる
- 後続の `observe` / `acquire` 系 functional job worker 実装の最小パターンを先に作れる
- test 用 PostgreSQL / Redis の起動と worker 起動を含む mid ないし integration の確認手順が必要になる
- 疎通確認用 worker の入力，DB 反映内容，終了条件は後続で詰める必要がある
- worker 実装を BullMQ 固有都合から切り離して保ちやすくなる

## 参考資料

- [adr-0038] ADR-0038: job bridge worker の責務を再整理する
- [adr-0040] ADR-0040: job runtime と BullMQ 実装境界を分離する
- [acceptance-0041] 0041 functional job worker bootstrap 受け入れ条件

[adr-0038]: ./0038-job-bridge-worker-bootstrap.md
[adr-0040]: ./0040-job-runtime-and-bullmq-boundary.md
[acceptance-0041]: ../acceptance/0041-functional-job-worker-bootstrap.md
