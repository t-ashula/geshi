# ADR-0008: crawler 拡張に Connector 分離型を採用する

## ステータス

決定

## 範囲

`packages/crawler`, `packages/model`

## コンテキスト

- crawler は現在 RSS を中心に構成されており、任意サイトへの対応を段階的に拡張したい
- 要望は crawl だけでなく download / recording を含むチャンネル単位の拡張へ広がっている
- 先に plugin 実装方式だけを決めると、DB モデル（channel と crawlType の関係）と整合しない可能性が高い
- 将来的には plugin 群の別 package 化も視野に入れたい

## 決定

- crawler 拡張の中核データモデルとして `source/connector` 分離型を採用する
  - `channel` は取得設定の参照（`source`）のみを持つ
  - 実装種別は `connector` 側で保持する
- plugin の登録方式は静的レジストリ方式を採用する
  - 未登録 key は fail-fast とする
- capability 表現は機能別 plugin key 方式を採用する
  - `crawl_plugin_key`
  - `download_plugin_key`
  - `record_plugin_key`
- plugin 公開境界は crawler 内部詳細へ依存させず、将来的な別 package 化を可能にする

## 要件整理

### 機能要件

- crawl は RSS 以外の任意サイトから `CrawledEpisode` 相当の情報を生成できること
- download はチャンネル単位で有効化・無効化を切り替えられること
- recording はチャンネル単位で有効化・無効化を切り替えられること
- 1 つのチャンネルに対して crawl / download / recording の実装組み合わせを選択できること
- 新しい plugin（または connector）を追加しても既存チャンネルの挙動を壊さないこと

### データモデル要件

- チャンネルと処理実装の紐付けを、単一 enum だけに依存しないこと
- 追加 plugin のたびに DB マイグレーションが必須にならないこと
- 実行時に「どの実装・どの設定」で処理したか追跡できること（監査可能性）

### 非機能要件

- plugin 単位で失敗率・処理時間・再試行回数を観測できること
- plugin 単位でテストを分離し、最小単位で検証できること
- 将来の別 package 化時に API 破壊を局所化できる境界を持つこと

### 運用要件

- plugin の追加・差し替え手順を docs で定義できること
- ロールバック時にチャンネル設定単位で旧実装へ戻せること
- 障害時に「チャンネル起因」か「plugin 起因」かを切り分けられること

## 設計案比較（決定時点）

| 観点 | `channel` 直結型 | `source/connector` 分離型 |
| --- | --- | --- |
| モデルの単純さ | 高い | 中程度 |
| plugin 追加時の DB 変更 | 発生しやすい | 発生しにくい |
| crawl/download/recording の組み合わせ表現 | チャンネル列が増えやすい | connector 構成で表現しやすい |
| 設定再利用（複数 channel 共有） | しづらい | しやすい |
| 監査可能性（どの実装・設定で処理したか） | 追加実装が必要 | connector バージョン管理で取りやすい |
| 段階移行コスト | 低い | 中〜高 |
| 将来の別 package 化 | 境界が曖昧になりやすい | 境界を保ちやすい |

- 要件適合性を優先し、`source/connector` 分離型を採用する

## 影響

- `channel` と plugin 実装の結合を弱め、機能追加時の変更点を局所化できる
- `crawl/download/recording` をチャンネル単位で組み合わせやすくなる
- plugin 単位の監視・テスト・責務分離を進めやすくなる
- `source/connector` という中間モデル導入により、初期実装コストは増える

## 代替案

- 要件整理を省略して plugin 方式を先に固定する
  - 初速は速いが、DB モデルや運用要件との不整合が発生しやすい
- 任意サイト対応を crawler 外の別サービスとして先に分離する
  - 境界は明確だが、現段階では運用コストが高い

## 備考

- 実装詳細（スキーマ詳細、plugin API 詳細、ジョブ payload 詳細）は後続 ADR で定義する
- 実データがない前提のため、データ移行・後方互換は本決定の前提条件に含めない
- 現時点の非目標
  - すべてのサイトを自動抽出する汎用エンジンの即時実装
  - headless browser 前提の常時クロール設計

## 参考資料

- [adr-0000] ADR-0000 ADR ドキュメントフォーマットと設計ログ
- [adr-0007] ADR-0007 npm workspace 構成を `packages/` 配下へ再編する
- [adr-0009] ADR-0009 Connector 分離型 crawler の実装仕様（提案）

[adr-0000]: ./0000-adr-format.md
[adr-0007]: ./0007-root-workspace-layout.md
[adr-0009]: ./0009-crawler-connector-implementation-spec.md
