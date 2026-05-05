# Plugin

この文書は，`geshi` の plugin に関する現行仕様を記す．

## 目的

- plugin 機構を定義する
- source collector plugin の共通仕様を定義する
- `podcast-rss` の現行仕様を定義する

## plugin 機構

- plugin は特定の拡張点に対する実装単位である
- plugin は識別子として `pluginSlug` を持つ

## 用語

- 組み込みプラグイン
  - `geshi` 本体 repository に実装を同梱し，本体 code から直接扱う plugin を指す
  - 典型例は `backend/src/plugins/collector/podcast-rss/` 配下の `podcast-rss` である
- 組み込みパッケージプラグイン
  - `geshi` 本体 repository に同梱されているが，source code 上は独立 package として管理される plugin を指す
  - 典型例は `packages/geshi-plugin-go-jp-rss/` のような plugin package である
  - repository には同梱されているが，`backend` が個別 source import で固定参照することは前提にしない
- 外部パッケージプラグイン
  - `geshi` 本体 repository の外で配布・保守され，運用時設定と install / generate を通じて利用される plugin を指す
  - private package, git URL, `file:` package を含んでよい
  - `geshi` 本体から見れば，生成済み plugin registry module を通じて利用される package plugin である

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

### `observe` の返り値

- `observe` は asset ごとに next-action policy を返す
- core 側が見る next-action policy は，少なくとも次を含む
  - `actionKind`
    - `acquire`
    - `record`
  - `scheduledStartAt`
- `arguments`
  - 後続 job にそのまま引き継ぐ plugin 固有引数 object
- `observe-source` はこの値を見て，
  - すぐ取得する asset
  - 予約実行する録画 asset
    を分けて扱う
- `observe-source` は next-action policy の `arguments` を後続 job の `jobs.metadata.plugin.arguments` へ引き継ぐ
- 録画条件の詳細や終了判定など，source 固有の知識は core 側 policy に持ち込まず plugin 側へ残す

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

### `record`

- 録画系 source collector plugin は，`acquire` とは別に `record` API を持つ
- `record` は source 固有の録画手順を plugin 側に閉じ込めるための API である
- plugin は，録画開始後の取得手順，終了判定，必要なら中間生成物の扱いや結合も含めて担う
- core 側の `record-content` job は，plugin の `record` を呼ぶ
- `record` の input には，`jobs.metadata.plugin.arguments` から復元した `arguments` を含める

### 共通実行 context

- plugin API は，共通の実行 context を受け取る
- この context は，`record` だけの特例ではなく，`observe` / `acquire` を含む plugin API 全体で共有する
- context には，少なくとも metadata 更新 API を含めてよい
- plugin が更新できる範囲は `jobs.metadata.plugin` 配下に限る
- `arguments` は実行開始時に worker から通常 input として渡し，実行中の進行情報更新は context 経由で行う
- metadata の正本保存は core 側が担い，plugin は必要な進行情報を生成して更新 API へ渡す

## 外部 plugin 開発

### 依存境界

- 外部 source collector plugin は，`geshi` 本体 repository 全体ではなく `@geshi/sdk` に依存して開発する
- plugin author は，少なくとも次を `@geshi/sdk` から import できればよい
  - `PluginManifest`
  - `SourceCollectorPlugin`
  - `SourceCollectorPluginDefinition`
  - `supports` / `inspect` / `observe` / `acquire` の input / output 型
- plugin は `backend` の内部 module や repository / service / endpoint / DB 型へ依存しない

### module 形

- 外部 plugin package は，source collector plugin として扱われる module entry を 1 つ持つ
- その module は，少なくとも `manifest` と `definition` を export する
- `definition` は `SourceCollectorPluginDefinition` を満たし，`manifest` と `plugin` を含む

```ts
import type {
  PluginManifest,
  SourceCollectorPlugin,
  SourceCollectorPluginDefinition,
} from "@geshi/sdk";

export const manifest: PluginManifest = {
  apiVersion: "1",
  capabilities: [
    {
      kind: "source-collector",
      sourceKind: "feed",
    },
  ],
  displayName: "Example External Feed",
  pluginSlug: "example-external-feed",
};

export const plugin: SourceCollectorPlugin = {
  async supports(_input) {
    return { supported: true };
  },
  async inspect(input) {
    return {
      description: null,
      title: "Example External Feed",
      url: input.sourceUrl,
    };
  },
  async observe(_input) {
    return { contents: [] };
  },
  async acquire(_input) {
    throw new Error("Not implemented");
  },
};

export const definition: SourceCollectorPluginDefinition = {
  manifest,
  plugin,
};
```

### 運用時設定との関係

- 外部 plugin package 自体の導入は，運用時設定 `geshi.config.js` の `plugin.packages` によって行う
- `geshi` はその設定をもとに install / generate し，生成済み plugin registry module から外部 plugin を読む
- plugin author は，本体の static import 一覧へ自分の plugin を追加することを前提にしない

### 参考実装

- 外部 package 例: [test/fixtures/external-plugins/example-feed-plugin](/home/office/src/github.com/t-ashula/geshi/test/fixtures/external-plugins/example-feed-plugin/package.json:1)
- package plugin 例: [packages/geshi-plugin-go-jp-rss](/home/office/src/github.com/t-ashula/geshi/packages/geshi-plugin-go-jp-rss/package.json:1)
- SDK: [packages/geshi-sdk/src/index.ts](/home/office/src/github.com/t-ashula/geshi/packages/geshi-sdk/src/index.ts:1)

## 参考資料

- [ADR-0047] ADR-0047: `observe` 結果は asset ごとの next-action policy を含める
- [ADR-0048] ADR-0048: 録画系 acquire は専用 job orchestration と複数 worker 前提で扱う

[ADR-0047]: ./decisions/0047-observed-asset-next-action-policy.md
[ADR-0048]: ./decisions/0048-recording-job-orchestration.md

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
