# ADR-0005: データモデルを主体テーブルと履歴テーブルで構成する

## ステータス

決定

## 範囲

全体

## コンテキスト

- `geshi` は podcast，streaming，feed を継続的に収集し，保存し，あとから閲覧・検索・再利用する個人用アーカイブである
- `geshi` は将来的に複数 user が同じ source を共有しつつ，購読関係や整理状態は user ごとに持てるようにしたい
- 収集対象には feed のようなテキスト主体のものと，podcast や streaming のようなメディア主体のものが混在する
- 同じ source から複数の content が発生し，1 つの content が複数の asset や transcript を持ちうる
- source や content の可変属性には履歴を追いたいものが含まれる
- `updatedAt` だけでは「何がどう変わったか」を保持できず，履歴要件を満たせない
- 早い段階でモデルの中心を定めておかないと，収集処理，保存方式，検索 API の責務がぶれやすい

## 決定

データモデルは，当面，主体テーブルと履歴テーブルで構成する

### 主体テーブル

- `user`
  - 利用主体を表す
- `subscription`
  - user が source を購読している現在の関係を表す
- `source`
  - 継続収集の共有対象を表す
- `collection`
  - user が subscription を整理する単位を表す
- `content`
  - 閲覧・検索の基本単位を表す
- `asset`
  - content に属する実ファイルや派生ファイルを表す
- `transcript`
  - asset から得られた文字起こし・抽出テキストを表す

### 履歴テーブル

- `subscriptionEvent`
  - subscribe / unsubscribe の履歴を表す
- `sourceSnapshot`
  - source の可変属性のある時点の状態を表す
- `contentSnapshot`
  - content の可変属性のある時点の状態を表す

### user / subscription / source を分ける

- `user` は利用主体とする
- `source` は共有可能な収集対象とする
- `subscription` は user が source を購読している現在の関係とする
- source 登録時には subscription も同時に発生する前提で扱う
- unsubscribe では current relationship を解除し，履歴は `subscriptionEvent` に残す
- 1 つの `source` は複数の `subscription` から参照されうる

### source と content を分ける

- `source` は継続購読・巡回の対象とする
- `content` は閲覧・再生・検索・保存の基本単位とする
- 1 つの `source` は複数の `content` を持つ

### collection は subscription を整理する

- `collection` は user に属する
- `collection` は source ではなく subscription を整理する
- collection 階層は将来拡張できる形を許容するが，当面の UI 要件は 1 階層とする

### content を中心に関連情報をぶら下げる

- `asset` は `content` に属する
- `transcript` は `asset` に属する
- タグ，メモ，検索インデックスなども，まず `content` を基点に関連づける

### metadata とファイル本体を分ける

- DB などの metadata ストアには主体テーブルと履歴テーブルの識別子と属性を保存する
- メディア本体や HTML snapshot などのファイルは `storage` 側に保存する
- `asset` は metadata 側からファイル保存先を参照する

### 履歴が必要な属性は snapshot に分ける

- `source` や `content` の可変属性は主体テーブルへ上書きせず，snapshot として保持する
- 主体テーブルは識別子，種別，状態などの安定した属性を持つ
- URL，title，summary，description など履歴を追いたい属性は snapshot 側に持つ
- 履歴要件の代替として `updatedAt` は使わない

### source 種別ごとの差異は subtype で吸収する

- podcast / streaming / feed の共通項は同じモデルに載せる
- 種別固有の属性は subtype や補助属性として扱う
- source 種別ごとに完全に別テーブル・別モデルへ分断しない

### 検索単位は content を基本とする

- 一覧表示，詳細表示，検索結果の主単位は `content` とする
- transcript や asset の内容で検索しても，最終的には関連する `content` に集約して返せるようにする

詳細な属性や関連は [data-model] に記す．

## 影響

- crawler は `source` を起点に収集処理を組みやすくなる
- user ごとの購読関係や整理状態を source 本体から分けて扱いやすくなる
- source や content の変化を snapshot として保存できる
- backend は `content` を基準に API と検索結果を設計しやすくなる
- storage は `asset` を単位にファイル管理しやすくなる
- transcript や検索インデックスを後から追加しやすい

## 代替案

- podcast / streaming / feed ごとに完全に別モデルにする
  - 種別ごとの実装は単純だが，横断検索や共通 UI を作りにくい
- source と content を分けず，取得物をすべて 1 単位で扱う
  - 初期実装は軽いが，継続収集と個別閲覧の責務が混ざりやすい
- source と user の関係を直接 source 側へ埋め込む
  - source 共有や user ごとの整理状態を表しにくいため採らない
- 可変属性を主体テーブルに上書きし，`updatedAt` だけを持つ
  - 現在値は見やすいが，履歴要件を満たしにくい
- ファイル本体も metadata ストア側に寄せる
  - 単純だが，大きなメディアや派生ファイルの扱いに不向き

## 備考

- 本 ADR は主要エンティティと履歴の扱いを定めるものであり，DB スキーマ詳細や index 設計までは定めない

## 参考資料

- [adr-0003] ADR-0003 全体アーキテクチャ
- [data-model] Data Model

[adr-0003]: ./0003-system-architecture.md
[data-model]: ../data-model.md
