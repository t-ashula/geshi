# ADR-0011: source クロールを plugin 境界で拡張可能にする

## ステータス

決定

## 範囲

`crawler`, `api backend`

## コンテキスト

- [acceptance-0002] では，クロール本体が plugin 境界を持ち，`source` に応じて実行ロジックを差し替えられることを受け入れ条件にしている
- `geshi` は podcast RSS 以外にも streaming や一般 feed を扱う前提であり，取得方式の差分を本体の条件分岐へ寄せ続けると保守しづらい
- `source` は継続対象として共通化されているが，実際の取得方法と `content` 候補の抽出方法は source 種別ごとに異なる

## 決定

- プラグイン機構を含めた仕様を [plugin-doc] にまとめる
- プラグインでは backend の domain model を直接更新せず，プラグインの呼び出し側で適切に処理する

### source collector plugin

- クロール用のプラグインとして `source collector plugin` を追加する
- source collector plugin は外部ソースへアクセスし `content` 候補の抽出を担う，`observe` と `content` から実際に保存（ダウンロード・録画）を担う `acquire` からなる
- `content` 候補には，少なくとも source との対応付け，一意判定に使う外部識別子または URL，表示に必要な title / publishedAt 相当の情報を含める

### podcast rss collector plugin

- podcast RSS のクロールは，標準 plugin の最初の対象として扱う
- `observe` に `source` （RSS の URL など）を渡して，`content` 候補の一覧を得る
- `acquire` に `content` （少なくとも実音声ファイルの URL）を渡して，`asset` 候補を得る
  - 実音声ファイルなどの `storage` への書き込みは呼び出し側で行い，`acquire` ではテンポラリディレクトリなどを活用しファイルに保存する

## 影響

- source 種別の追加時に，本体の責務肥大化を抑えやすくなる
- podcast RSS を最初の plugin として切り出すことで，後続 source 追加の足場になる
- テスト対象も plugin 単位へ分けやすくなる
- plugin 入出力契約として，`content` 候補に何を必須で含めるかを backend 側と揃える必要がある
- `content` の重複判定，保存時の upsert / snapshot 方針は，本体側で別途詰める必要がある
- asset / storage を伴う取得処理は，今回の最小経路のあとで別途整理する必要がある

## 代替案

- `crawler` 本体に source 種別ごとの条件分岐を追加し続ける
  - 実装初期は単純だが，方式追加のたびに責務集中が進むため採らない
- source 種別ごとに完全に別サービスへ分離する
  - 境界は明確になるが，現段階では運用コストと初期実装コストが高いため採らない

## 参考資料

- [ADR-0003] ADR-0003 全体アーキテクチャ
- [ADR-0005] ADR-0005 データモデルを主体テーブルと履歴テーブルで構成する
- [acceptance-0002] Acceptance 0002 Source Crawl Foundation
- [design-log-0011] Design Log 0011
- [plugin-doc] Plugin

[ADR-0003]: ./0003-system-architecture.md
[ADR-0005]: ./0005-data-model.md
[acceptance-0002]: ../acceptance/0002-source-crawl-foundation.md
[design-log-0011]: ../design-log/0011-source-crawl-plugin-responsibilities.md
[plugin-doc]: ../plugin.md
