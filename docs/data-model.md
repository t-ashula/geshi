# Data Model

この文書は `geshi` のデータモデルを記す．

## 目的

- 収集系，保存系，閲覧系で共有する主要エンティティを明確にする
- podcast / streaming / feed を横断して扱える基本単位を定める
- metadata とファイル本体の責務を分ける
- 履歴が必要な属性をどこで保持するかを定める

## 構成

データモデルは次の 2 層で構成する．

- 主体テーブル
  - 現在の識別対象と安定した状態を表す
- 履歴テーブル
  - 可変属性の各時点の状態を表す

## 主体テーブル

### source

継続的に収集する対象を表す．

例:

- podcast 番組
- streaming channel
- RSS / Atom feed

主な属性:

- `id`
- `slug`
- `kind`
- `url`
- `urlHash`
- `createdAt`

### content

source から収集される個別の内容単位を表す．

例:

- podcast episode
- 1 回分の stream
- feed article

主な属性:

- `id`
- `sourceId`
- `kind`
- `publishedAt`
- `collectedAt`
- `status`
  - `discovered`
  - `stored`
  - `failed`
- `createdAt`

### asset

content にひもづく実ファイルや派生ファイルを表す．

例:

- audio file
- video file
- thumbnail
- html snapshot
- subtitle file

主な属性:

- `id`
- `contentId`
- `kind`
  - `audio`
  - `video`
  - `image`
  - `html`
  - `subtitle`
  - `pdf`
  - `other`
- `sourceUrl`
- `storageKey`
- `mimeType`
- `byteSize`
- `checksum`
- `createdAt`

### transcript

文字起こしや抽出テキストを表す．

主な属性:

- `id`
- `assetId`
- `kind`
  - `transcript`
  - `ocr`
  - `extracted-text`
- `language`
- `body`
- `createdAt`

## 履歴テーブル

### sourceSnapshot

source の可変属性のある時点の状態を表す．

主な属性:

- `id`
- `sourceId`
- `version`
- `title`
- `description`
- `recordedAt`

補足:

- `version` は `sourceId` ごとの版番号とする
- どの値がいつ有効だったかを追えるようにする

### contentSnapshot

content の可変属性のある時点の状態を表す．

主な属性:

- `id`
- `contentId`
- `version`
- `title`
- `summary`
- `recordedAt`

## 関連

- 1 `source` : N `content`
- 1 `content` : N `asset`
- 1 `asset` : N `transcript`
- 1 `source` : N `sourceSnapshot`
- 1 `content` : N `contentSnapshot`

## 設計上の原則

### source は継続対象

- source は購読・巡回・再収集の単位とする
- source 自体は閲覧単位ではなく，content を生む上位単位とする
- source の固定属性は主体テーブルに置く

### content は閲覧と検索の中心

- 一覧，詳細，検索結果の主単位は content とする
- feed article も stream archive も同じく content として扱う

### asset は storage 参照を持つ

- metadata 側には保存先参照だけを持つ
- ファイル本体は storage に置く
- `sourceUrl` は取得元情報として asset に持つ
- `sourceUrl` は asset の一意制約には使わない

### 可変属性は履歴テーブルに保持する

- `source` や `content` の履歴が必要な属性は snapshot 側に持つ
- 現在値だけを主体テーブルへ上書きしない
- `updatedAt` で履歴要件を代替しない
- URL のように source の固定属性として扱うものは snapshot に持たない

### transcript は後付け可能にする

- 収集時点で transcript がなくても content を保存できる
- transcript は非同期に追加できる

## 画面・API への見え方

### 一覧

- source 配下の content を時系列や検索条件で一覧する
- 一覧表示には必要に応じて最新 snapshot を結合する

### 詳細

- 1 つの content に対して最新 snapshot，asset，asset 配下の transcript をまとめて表示する

### 検索

- transcript や本文の一致から content を引く
- 検索結果には source 情報も添える
