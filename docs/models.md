# データモデル仕様

## 概要

この文書は，Geshi のデータモデル仕様である．

モデル設計原則に基づいて，API や Protocol として依存すべきインタフェースを規定する．

## 運用

- データモデル仕様の通常の更新は，この文書に対して行う
- データモデルの大きな前提や位置づけを変更する場合は，新しい ADR で扱う
- この文書はAPI レベルのインタフェースを扱うものであり，DB テーブル，検索インデックス，ファイル配置などの実装そのものは直接規定しない
- 永続化実装では，必要に応じて 1 モデルを複数の保存構造に分けたり，逆に複数モデルを 1 つの保存構造にまとめたりしてよい

## モデル

### `Channel`

`Channel` は，継続的に追う管理対象を表す．

- 管理対象としての情報に留め，plugin 名や plugin 設定のような収集実行設定は直接持たず， `Collector` で吸収する．
- 無効なチャンネルを扱う必要が出た場合 `channel.enable = false` ではなく，`DisabledChannel` のようなモデルとして扱う

#### プロパティ

- `id`
  - 内部的な識別子
- `slug`
  - 外部向けの識別子
- `name`
  - 表示用でもある名称
- `kind`
  - どういう種類のチャンネルかで，ひとまずは以下の3種類
  - `"podcast"` | `"streaming"` | `"rss"`
- `note`
  - チャンネルの説明
- `collector`
  - 対応する `Collector` モデル

### `Collector`

`Collector` は，`channel` をどう観察し，どう取得するかを表す．

#### プロパティ

- `id`
  - 内部的な識別子
- `slug`
  - 外部向けの識別子
- `channel`
  - 処理する `Channel` モデル
- `pluginId`
  - ジョブを実装してる plugin の識別子
- `observeScheduleKind`
  - 観察周期の決め方
  - `"interval"` | `"manual"`
- `observeInterval`
  - `observeScheduleKind = "interval"` のときの観察周期
- `config`
  - plugin に渡すための設定
  - collector/plugin の実装ごとに好きに決めてよい

`Collector` は収集実行設定の保持責務を持つ．

RSS の feed URL のように，API からは `Channel` の値として見えていてほしいものがあっても，物理的な保持は `Collector` 側でよい．

### `Entry`

`Entry` は，継続監視の中で見つける個別の記事・エピソードなどを表す．

#### プロパティ

- `id`
  - 内部的な識別子
- `slug`
  - 外部向けの識別子
- `channel`
  ‐ 取得元の `Channel`
- `title`
  ‐ エントリーのタイトル
- `status`
  - Entry の状態．「見つけてきて取得が予定されてる」「取得済」「失敗済」
  - `"scheduled"` | `"acquired"` | `"failed"`
- `publishedAt`
  - 公開日時（推定も含む）
- `sourceUrl`
  - 個別エピソードか記事ページなどがある場合の個別リソースへの URL
- `uniqueId`
  - Channel (collector) が提供する，一意性を担保しうる識別子（文字列）
  - episode:GUID とか，collector で新規のエントリーかどうかの判定に使う

### `Asset`

`Asset` は，`Entry` に対応する取得済み実データを表す．

#### プロパティ

- `id`
  - 内部的な識別子
- `slug`
  - 外部向けの識別子
- `entry`
  - 対応する `Entry` モデル
- `kind`
  - どういう種類のデータか
  - `"audio"` | `"video"` | `"text"`
- `sourceUrl`
  - 取得元の URL がある場合の参照先
