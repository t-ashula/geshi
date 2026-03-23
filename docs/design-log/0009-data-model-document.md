# 0009 Data Model Document

## 位置づけ

この文書は，`docs/models.md` を具体化する過程で立った案と，その変更経過を残すための Design log である．

## 経過

### 1. 初期案

最初は，媒体ごとに個別公開物を分けて考えていた．

- podcast / streaming の個別コンテンツは `episode`
- feed の個別コンテンツは `article`

この案では，

- 再生や録画，文字起こしを伴う媒体は `episode`
- 本文抽出と全文検索を伴う媒体は `article`

という整理を想定していた．

### 2. `episode` の下に複数モデルを置く案

次に，podcast の各回に音声とテキストが共存することを踏まえ，次の案を検討した．

- `episode` を公開物の中心に置く
- その下に `article`，`audio`，`transcript` を置く

この案では，

- podcast の各回は `episode`
- 音声ファイルは `audio`
- 配信回の説明文や本文は `article`
- 外部 API による文字起こしは `transcript`

という整理を想定していた．

### 3. `audio` と `article` の扱いを見直し

この案を進める中で，次の点が論点になった．

- `audio` では動画付きコンテンツを含みにくい
- `media` のような名前は広すぎる
- `article` と `transcript` は同じレイヤーに置きにくい

ここで，音声・動画・HTML・本文テキストなどを，同じ「保存対象の実体」として扱う方向が候補になった．

### 4. `episode -> asset -> derivative` 案

その結果，現在は次の案を採っている．

- 個別公開物は，当面すべて `episode`
- `episode` の下に `asset[]`
- `asset` の下に `derivative[]`
- `derivative.kind` として `transcript`，`translation`，`summary`，`notes` などを表現する

この案では，

- podcast の各回，streaming の各放送回，feed の各記事や各エントリを `episode`
- 音声ファイル，録画ファイル，HTML，本文テキスト，画像などを `asset`
- 文字起こし，要約，翻訳，ノートなどを `derivative`

として扱う．

### 5. `derivative` だけでは `transcript` を表しきれない論点

その後，`derivative` を共通の派生物レイヤーとして置く方針自体はよいが，`transcript` には種別固有の構造がある，という論点が出た．

特に音声系の文字起こしでは，

- 何分何秒から何分何秒まで
- その区間のテキストは何か

というセグメント単位のデータを持ちたい．

このため，現在は，

- `derivative` は共通の派生物メタデータを持つ
- ただし `transcript` のような種別は，必要に応じて専用の詳細モデルを持つ

という方向を採る．

### 6. `feed` を RSS 専用にしない論点

さらに，`streaming` と RSS を持たない定期音声配信を考えると，`feed` を RSS 専用のモデルとして扱うのは狭すぎる，という論点が出た．

具体的には，次のような入口がある．

- streaming の放送予定取得用 URL
- 個別番組ページの URL
- 録画対象を得るための補助 API
- RSS を持たない音声配信の一覧ページ

このため，現在は，

- `channel` は継続的に追跡する公開単位
- `feed` は更新取得や取得補助の入口一般

として扱う方向を採る．

`feed.kind` としては，たとえば `rss`，`schedule`，`listing`，`api` などを想定する．

## 現時点で残っている論点

- `episode` という名前で記事系コンテンツまで無理なく扱えるか
- 本文系 `asset` の粒度をどう分けるか
- `derivative` を記事系 `asset` にも正式に適用するか
- `transcript` の詳細モデルをどの粒度で持つか
- `feed.kind` をどこまで一般化するか
