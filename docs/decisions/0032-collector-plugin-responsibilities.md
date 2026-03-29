# ADR-0032: collector plugin の責務

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- [ADR-0031] では，backend の情報収集において `channel` と `collector` を分ける方針を導入した
- ただし，`collector` plugin が Geshi 側 `job` model や BullMQ runtime にどこまで依存してよいかは，まだ整理されていない
- `job model` の見直しに進む前に，collector plugin と runtime の境界を先に固める必要がある

## 決定

- Geshi 側の collector workflow では，次の 3 種類の job を組み合わせる
  - 投入ジョブ: `scheduleObserve`
    - Geshi 本体側のジョブとする
    - 観察対象となる `Channel` とその `Collector` を拾い，投入設定にもとづいて `observeChannel` を登録する
  - 観察ジョブ: `observeChannel`
    - plugin 側でのジョブとする
    - 対象の `Channel` と `Collector` を入力として対象（RSS URL, API など）を観察し，`Entry` 一覧を結果として返す
    - `uniqueId` などを使って新規候補かどうかを事前判定してよい
  - 取得ジョブ: `acquireEntry`
    - plugin 側でのジョブとする
    - 対象の `Entry` と `Collector` を入力として利用対象データを取得し，`Entry` と `Asset` を結果として返す
- collector plugin 側の runtime worker は，backend の read-only API だけを利用してよい
- collector plugin 側の runtime worker は，`AssetStore` への read / write を行ってよい
- collector plugin 側の job は，Geshi 側 model を直接更新しない
- `Entry` の作成，取得ジョブの登録，`Asset` の作成のような Geshi 側 model の更新は，`import job` が backend の write API を呼んで行う
- `scheduleObserve` は細かい投入判定を持たず，固定周期で `observeChannel` を投入する
  - 実際に観察しに行くか，何もせず終了するかの判断は `observeChannel` が行う
- 当面，Geshi 側が意味を知る観察周期設定として次を持つ
  - 観察周期
  - 観察周期の決め方
- 観察周期の決め方は，少なくとも次の値を取る
  - `interval`
  - `manual`
- `Collector` の固定フィールドは，当面少なくとも次を持つ
  - `pluginId`
  - `observeScheduleKind`
  - `observeInterval`
  - `config`
- feed URL や外部 service 上の ID のような収集固有設定は，原則として `Collector.config` に入れる
- ただし API 表現では，collector 側に保持された値が `Channel` の値として見えていてよい
- collector workflow のために，backend には少なくとも次の API 境界が必要である
  - runtime worker が利用する read-only API
  - `import job` が利用する write API

## 影響

- collector plugin 側の job は，外部 system を触り，plugin を実行し，結果を返すところまでに責務を限定しやすくなる
- Geshi 側 model の更新は backend API と import 処理へ寄せる前提になる
- Geshi 本体側の `scheduleObserve` は単純になる一方で，何もせず終了する `observeChannel` job が増えうる
- 観察実行条件の判断は `observeChannel` 側へ閉じることになる
- 観察周期とその決め方は，plugin 固有設定ではなく Geshi 側が意味を知る設定として保持する必要がある
- runtime worker 用の read-only API と，`import job` 用の write API を backend 側に追加設計する必要がある

## 代替案

- `scheduleObserve` が細かい投入判定を持つ
  - 無駄な `observeChannel` job は減るが，観察実行条件の情報と判断が `scheduleObserve` と `observeChannel` に分かれて複雑になる
- collector plugin の job が Geshi 側 model を直接更新する
  - runtime job と domain model 更新の境界が曖昧になりやすいため採らない

## 参考資料

- [adr-0031] ADR-0031 backend での情報収集とそのアーキテクチャ
- [job-model] docs/job.md
- [design-log-0032] Design log 0032 collector plugin responsibilities

[adr-0031]: ./0031-backend-collection-architecture.md
[job-model]: ../job.md
[design-log-0032]: ../design-log/0032-collector-plugin-responsibilities.md
