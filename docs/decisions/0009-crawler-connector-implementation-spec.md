# ADR-0009: Connector 分離型 crawler の実装仕様

## ステータス

提案

## 範囲

`packages/crawler`, `packages/model`

## コンテキスト

- ADR-0008 で crawler 拡張の中核モデルとして `source/connector` 分離型を採用した
- 実装着手には、データモデルと型・plugin API の具体仕様が必要である
- 本時点では実データがないため、移行互換よりも実装の一貫性を優先できる

## 決定

- 実装は以下の仕様で段階導入する
  - model: `Source`, `Connector` を追加し `Channel` は `source_id` を参照する
  - crawler: static registry で plugin key を解決する
  - payload/result: plugin 実行メタデータを必須で保持する

## 実装仕様

### データモデル

- `Connector`
  - `id`
  - `name`
  - `version`
  - `crawl_plugin_key`（nullable）
  - `download_plugin_key`（nullable）
  - `record_plugin_key`（nullable）
  - `crawl_config`（JSON, nullable）
  - `download_config`（JSON, nullable）
  - `record_config`（JSON, nullable）
- `Source`
  - `id`
  - `slug`
  - `title`
  - `connector_id`
  - `entry_url`（取得起点 URL）
  - `metadata`（JSON, nullable）
- `Channel`
  - `source_id` を追加
  - plugin 種別を表す列は持たない

### 型仕様（crawler）

- `PluginCapability = "crawl" | "download" | "record"`
- `PluginRef`
  - `key: string`
  - `version: string`
  - `capability: PluginCapability`
- `CrawlJobPayload` に追加
  - `connectorId: string`
  - `pluginRef: PluginRef`
- `DownloadJobPayload` に追加
  - `pluginRef: PluginRef`
- `RecordReserveJobPayload` に追加
  - `pluginRef: PluginRef`

### plugin API

- `CrawlerPlugin`
  - `key`
  - `version`
  - `capability = "crawl"`
  - `run(input): Promise<CrawlerResult>`
- `DownloaderPlugin`
  - `key`
  - `version`
  - `capability = "download"`
  - `run(input): Promise<DownloaderResult>`
- `RecorderPlugin`
  - `key`
  - `version`
  - `capability = "record"`
  - `run(input): Promise<RecorderResult>`
- plugin は静的レジストリに登録する

### Producer / Worker の責務

- producer
  - `Channel -> Source -> Connector` を解決する
  - 機能別 plugin key の登録有無を検証する
  - 未登録 key は queue へ投入せず `JobStatus.ERROR` で記録する
- worker
  - `pluginRef` と config を受け取り実行する
  - capability 不一致は即失敗にする
  - `pluginKey/version` をログへ必ず出す
- updater
  - `Job.result` に監査メタデータを保存する
  - 必須項目: `pluginKey`, `pluginVersion`, `capability`, `configHash`

### 失敗時の扱い

- `plugin_not_registered`
- `plugin_capability_mismatch`
- `invalid_connector_config`
- `plugin_runtime_error`

上記を識別可能なエラー分類として `Job.result` に保存する

### テスト項目

- registry 解決（正常/未登録）
- config 検証（正常/不正）
- producer のジョブ生成（機能有効/無効）
- worker の capability 検証
- updater の監査メタデータ保存
- 既存 RSS の回帰

## 影響

- 実装フェーズでの判断余地を減らし、設計ブレを抑えられる
- 初期導入で model / crawler の変更範囲が広くなる

## 代替案

- 0008 の決定を維持したまま、実装仕様をコードレビューで都度決める
  - 初動は速いが、実装差分の整合が崩れやすい

## 備考

- 本 ADR は実装仕様の提案であり、採択後に実装 PR を開始する
- 実データ移行はスコープ外とする

## 参考資料

- [adr-0000] ADR-0000 ADR ドキュメントフォーマットと設計ログ
- [adr-0008] ADR-0008 crawler 拡張に Connector 分離型を採用する

[adr-0000]: ./0000-adr-format.md
[adr-0008]: ./0008-crawl-plugin-architecture.md
