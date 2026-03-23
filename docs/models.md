# データモデル

## 概要

この文書は，Geshi のデータモデル仕様の正本である．

Geshi が扱う `podcast`，`streaming`，`feed` の共通要素と差分を，ここで管理する．

## 運用

- データモデル仕様の通常の更新は，この文書に対して行う
- データモデルの大きな前提や位置づけを変更する場合は，新しい ADR で扱う
- この文書は概念モデルを扱うものであり，DB テーブル，検索インデックス，ファイル配置などの永続化実装そのものは直接規定しない
- 永続化実装では，必要に応じて 1 モデルを複数の保存構造に分けたり，逆に複数モデルを 1 つの保存構造にまとめたりしてよい

## 基本方針

- Geshi のデータモデルは，公開上の単位と，収集・保存上の技術単位を分けて考える
- `source`，`channel`，`program`，`episode` は，主に公開物やそのまとまりを表す
- `feed`，`asset`，`derivative` は，主に取得，保存，再利用のための補助的な単位を表す
- `podcast`，`streaming`，`feed` の 3 種を完全に同一化するのではなく，共通化できる部分だけを揃える
- 個別公開物は，媒体をまたいで当面 `episode` を中心モデルとして扱う
- feed 記事の本文や episode ページ本文のようなテキスト実体は，独立公開物ではなく `asset` として扱う

## 対象

この文書では，少なくとも次のようなモデルを扱う想定である．

- `source`
- `channel`
- `feed`
- `program`
- `episode`
- `asset`
- `derivative`

## 各モデルの概要

### `source`

収集対象の大きな出所を表す．

たとえば podcast 配信元，streaming の放送元，feed のサイトやサービスのような，「どこから取ってくるか」の単位である．

1 つの `source` は，複数の `channel` を持ちうる．

### `channel`

継続的に追跡する公開単位を表す．

podcast 番組，streaming のチャンネルや番組枠，RSS feed を持つ定期配信，RSS を持たない定期配信など，更新を継続監視する対象を表現するためのモデルである．

Geshi において，購読や監視の基本単位になるモデルである．

### `feed`

更新情報を取得するための配信単位を表す．

RSS / Atom の URL，番組表取得用の URL，個別ページ一覧の URL，補助的な API endpoint など，更新取得や取得補助の入口を保持する．`channel` と 1 対 1 とは限らず，取得のための技術的な単位として扱う．

`feed` は公開物そのものではなく，更新を検知するための入口である．

`feed.kind` としては，たとえば `rss`，`schedule`，`listing`，`api` などの種別を想定する．

### `program`

streaming や放送型コンテンツにおける編成上の番組を表す．

定期番組や放送枠のように，個々の配信回より一段上の単位が必要な場合に使う．podcast や feed では不要な場合もある．

`program` は必須ではなく，streaming で編成上のまとまりを明示したい場合に導入する．

### `episode`

個別の配信回，公開回，録画対象回のような，時系列上の 1 件を表す．

podcast の各回，streaming の各放送回，あるいは公開日時を持つ個別コンテンツを共通的に表現する中心モデル候補である．

音声・動画コンテンツに関しては，`episode` が再生や関連実体参照の基点になる．

### `asset`

保存対象となる実ファイルや外部実体を表す．

音声ファイル，録画ファイル，取得した HTML，本文テキスト，サムネイルなど，`episode` にひもづく実体データを表現する．

1 つの `episode` が，複数の `asset` を持つことを許容する．

### `derivative`

`asset` から派生した二次データを表す．

文字起こし，翻訳，要約，ノートなど，元の `asset` を加工して得られた情報をここにぶら下げる．

Geshi 自体は文字起こしエンジンを持たず，外部 API の結果を `derivative` として保存し，再生や検索に利用する．

`derivative.kind` としては，少なくとも `transcript`，`translation`，`summary`，`notes` のような種別を想定する．

ただし，`transcript` のように種別固有の詳細構造が必要なものは，`derivative` の共通メタデータとは別に，専用の詳細モデルを持てるようにする．

たとえば `transcript` では，セグメント単位で

- 開始時刻
- 終了時刻
- テキスト

のようなデータを持てる方が扱いやすい．

## モデル間の大まかな関係

最も基本的な関係は次の通りである．

- `source` は複数の `channel` を持ちうる
- `channel` は 0 個以上の `feed` を持ちうる
- `channel` は 0 個以上の `program` を持ちうる
- `channel` または `program` は 0 個以上の `episode` を持ちうる
- `episode` は 0 個以上の `asset` を持ちうる
- `asset` は 0 個以上の `derivative` を持ちうる
- `derivative` は，必要に応じて種別ごとの詳細データを持ちうる

厳密な関連の向きや必須性は，今後の詳細化で詰める．ただし，公開物の中心は `episode` に置き，`feed`，`asset`，`derivative` はそれを支える補助モデルとする．

## 媒体ごとの使い分け

### podcast

- `source`: 配信元やネットワーク
- `channel`: 番組
- `feed`: podcast 用 RSS や配信一覧 URL
- `episode`: 各配信回
- `asset`: 音声ファイル，画像など
- `derivative`: 文字起こし，要約，翻訳など

### streaming

- `source`: 放送元や配信サービス
- `channel`: チャンネルや追跡対象
- `feed`: 番組表 URL，個別番組 URL，補助 API など
- `program`: 番組枠や編成上のまとまり
- `episode`: 各放送回，録画回
- `asset`: 録画ファイル，サムネイルなど
- `derivative`: 文字起こし，要約，翻訳など

### feed

- `source`: サイトやサービス
- `channel`: 継続購読する更新対象
- `feed`: RSS / Atom や一覧取得 URL
- `episode`: 個別記事や個別エントリ
- `asset`: 取得 HTML，本文テキスト，添付画像など
- `derivative`: 要約やノートなど

## 現時点での共通化方針

- `podcast`，`streaming`，`feed` の個別コンテンツは，当面すべて `episode` で扱う
- `feed` は RSS 専用モデルではなく，更新取得や取得補助の入口一般として扱う
- `episode` の下に `asset` を置き，さらにその下に `derivative` を置く
- `transcript`，`translation`，`summary`，`notes` などは，まず `derivative.kind` として扱う
- ただし `transcript` のように時間区間などの種別固有データが必要なものは，専用の詳細モデルを持てるようにする
- feed 記事の本文や podcast 各回の紹介文は，独立した `article` ではなく `asset` として保持する
- 検索は，将来的に `episode`，`derivative`，関連メタデータを横断できる形を目指す
