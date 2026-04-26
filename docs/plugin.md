# Plugin

この文書は，`geshi` の plugin に関する現行仕様を記す．

## 目的

- plugin 機構を定義する
- source collector plugin の共通仕様を定義する
- `podcast-rss` の現行仕様を定義する

## plugin 機構

- plugin は特定の拡張点に対する実装単位である
- plugin は識別子として `pluginSlug` を持つ

## 責務境界

### backend

- `source` と (crawl の) plugin とを紐づけを管理する
- domain model を更新する

### plugin

- backend の domain model を直接更新しない
- 呼び出し側の責任で backend のモデルへ変換したり保存したりする

### 配置

現時点の source collector plugin 実装配置は `backend/src/plugins/` 配下とする

- `backend/src/plugins/index.ts`
- `backend/src/plugins/collector/podcast-rss.ts`

## source collector plugin

### 役割

- 外部 source へアクセスする
- source から `content` 候補を抽出 (`observe`)
- 必要に応じて実ファイルを取得 (`acquire`)

### `observe`

- source の取得先を読んで コンテンツ一覧を返す
  - `content` モデルや `contentSnapshot` もでる自体のリストではなく，呼び出し側でそれらのモデルに適切に分離する
- backend はこの結果を `content` と `contentSnapshot` の保存に使う

- 入力
  - source の取得先 URL
  - plugin 固有 option
  - logger
  - abort signal
  - 一時ディレクトリパス
- 出力
  - `content` 保存に必要なデータ
    - 外部識別子
    - kind
    - publishedAt
    - status
  - `contentSnapshot` 保存に必要なデータ
    - title
    - summary

### `acquire`

- 対象 `content` をもとに実ファイルを取得する
- plugin は必要に応じて一時ディレクトリへ成果物を書き出す
- backend はその結果を `asset` や `storage` に保存する

- 入力
  - 対象 `content`
  - 取得元 URL または外部識別子
  - plugin 固有 option
  - logger
  - abort signal
  - 一時ディレクトリパス
- 出力
  - `storage` に移す，一時ディレクトリへ書き出した成果物一覧
  - `asset` 保存に必要な metadata

## `podcast-rss` collector plugin

### 取得元

- plugin が読む取得先は `source.url` とする
- backend は `source.url` を `sourceUrl` として plugin へ渡す
- plugin 固有の追加設定が必要な場合は `collectorSettingSnapshot.config` を使う

### `observe`

- RSS feed を取得する
- feed item を列挙する
- 各 item から `content` 候補を作る

### `acquire`

- podcast episode に対応する実ファイルを取得する
- 取得した成果物は一時ディレクトリへ出力する
- backend はその結果を `asset` 保存へ使う
