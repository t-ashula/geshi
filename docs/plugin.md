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
- plugin 固有の継続状態が必要な場合でも，plugin 自身が永続化を直接行わない

### 配置

現時点の source collector plugin 実装配置は `backend/src/plugins/` 配下とする

- `backend/src/plugins/index.ts`
- `backend/src/plugins/collector/podcast-rss.ts`

## source collector plugin

### 役割

- 外部 source へアクセスする
- source 登録前の初期データを確認 (`inspect`)
- source から `content` 候補を抽出 (`observe`)
- 必要に応じて実ファイルを取得 (`acquire`)

### plugin state

- source collector plugin は，必要に応じて plugin 固有の継続状態を扱ってよい
- plugin state は，plugin が所有する JSON serialize 可能な任意の object とする
- property 名，値の意味，versioning，互換性，秘匿方法は plugin の責務とする
- backend は plugin state の意味を解釈せず，呼び出し時の受け渡しと保存を担う
- plugin は plugin state を input として受け取り，必要に応じて次回実行用の state を output として返してよい
- plugin は plugin state を直接永続化しない
- plugin state は source collector plugin ごとではなく，`collector setting` 単位で独立して保持される
- backend は observe 実行の開始前に current plugin state を plugin へ渡してよい
- backend は observe 実行で domain model への反映が成立した後に，plugin が返した次回実行用 state を保存する

### `supports`

- source collector plugin は，与えられた `sourceUrl` を扱えるかどうかを `supports` で判定してよい
- `supports` は plugin 自身の知識で applicability を返す API である
- `supports` は source 登録前の候補絞り込みや事前 validation に使ってよい

### `inspect`

- source 登録前に，入力された URL から登録用の初期データを返す
- plugin は source 種別ごとの取得と解釈を担い，backend はその結果を API 表現へ変換する
- 現段階では呼び出し先 plugin の選択規則は定義せず，呼び出し側が対象 plugin を固定してよい

- 入力
  - source の取得先 URL
  - plugin 固有 option
  - plugin 固有 state
  - logger
  - abort signal
- 出力
  - source 登録フォームの初期値に必要なデータ
    - 正規化済み URL
    - sourceSlug
    - title
    - description
- または inspect 非対応 / 非 RSS / 解釈不能などの失敗結果

### `observe`

- source の取得先を読んで コンテンツ一覧を返す
  - `content` モデルや `contentSnapshot` もでる自体のリストではなく，呼び出し側でそれらのモデルに適切に分離する
- backend はこの結果を `content` と `contentSnapshot` の保存に使う

- 入力
  - source の取得先 URL
  - plugin 固有 option
  - plugin 固有 state
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
  - 必要に応じて次回実行用の plugin 固有 state
    - backend は content / asset 候補の反映が成立した後にこれを保存する

### `acquire`

- 対象 `content` をもとに実ファイルを取得する
- plugin は必要に応じて一時ディレクトリへ成果物を書き出す
- backend はその結果を `asset` や `storage` に保存する

- 入力
  - 対象 `content`
  - 取得元 URL または外部識別子
  - plugin 固有 option
  - plugin 固有 state
  - logger
  - abort signal
  - 一時ディレクトリパス
- 出力
  - `storage` に移す，一時ディレクトリへ書き出した成果物一覧
  - `asset` 保存に必要な metadata
  - 必要に応じて次回実行用の plugin 固有 state

## `podcast-rss` collector plugin

### 取得元

- plugin が読む取得先は `source.url` とする
- backend は `source.url` を `sourceUrl` として plugin へ渡す
- plugin 固有の追加設定が必要な場合は `collectorSettingSnapshot.config` を使う

### `observe`

- preview で扱う feed 解釈規則と可能な限り揃える
- RSS feed を取得する
- feed item を列挙する
- 各 item から `content` 候補を作る

### `acquire`

- podcast episode に対応する実ファイルを取得する
- 取得した成果物は一時ディレクトリへ出力する
- backend はその結果を `asset` 保存へ使う
