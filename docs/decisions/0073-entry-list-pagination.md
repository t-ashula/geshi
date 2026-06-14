# ADR-0073: entry 一覧 API は cursor ベースのページングを持つ

## ステータス

決定

## 範囲

`api backend`, `web ui frontend`

## コンテキスト

- 現在の `GET /api/v1/contents` は query parameter を持たず，entry 一覧を全件返している
- browse UI もこの全件 response を前提にしており，entry 数の増加に比例して初回表示の転送量，描画量，再読込コストが増える
- entry 一覧の表示順は `published_at desc`, `created_at desc` であり，閲覧中にも先頭側へ新しい entry が追加されうる
- この状態で offset ベースのページングを採ると，先頭側の挿入によって page 境界がずれ，同じ entry の重複取得や未取得 entry の取りこぼしが起こりやすい
- 一方で browse 体験としては，「新しい順の一覧を少しずつ継ぎ足して読む」ことができればよく，ランダムな page 番号ジャンプまでは必須ではない

## 決定

entry 一覧取得 API は，offset ではなく cursor ベースのページングを持つ．

### API 形状

- `GET /api/v1/contents` は `limit` と `cursor` を受け取れるようにする
- `cursor` 未指定時は先頭ページを返す
- response は entry 配列だけでなく，続きを取得するための `nextCursor` を含む pagination metadata を返す
- `nextCursor` が `null` のときは，その時点で続きが無いことを表す
- `cursor` の内部表現は client に公開しない opaque token とする

### continuation の基準

- page continuation は，一覧の sort order と同じ境界で決める
- sort order は現行互換を維持し，`publishedAt desc`, `createdAt desc`, `id desc` を正規の順序とする
- `id` は，同じ timestamp を持つ複数 entry を安定して並べる tie-breaker として加える
- `cursor` は，少なくとも最後に返した entry の sort key を復元できる情報を持つ
- `publishedAt` が `null` の entry を含む場合も，server 側で定義した並び順と同じ規則で continuation を判定する

### frontend の扱い

- frontend は先頭ページだけを初回表示に使い，続きを読むときだけ次ページを取得する
- 取得済み page は一覧末尾へ追記し，既存の entry detail 導線は `contentId` ベースのまま維持する
- pagination 状態は browse 画面の状態として持ち，全件再取得前提の state はやめる
- 継ぎ足すためのボタン，もしくはスクロールに伴って継ぎ足すようにする

### 今回固定すること / しないこと

- 今回固定するのは entry 一覧取得のページング境界と API 契約である
- filter, source 単位絞り込み，全文検索，双方向スクロールは本 ADR の対象外とする
- page size の default 値と上限値は実装時に決めてよいが，API 契約として明示する

## 影響

- backend は route, endpoint, service, repository で paginated response と cursor 解釈を扱う必要がある
- frontend は `listContents(): ContentListItem[]` 前提をやめ，pagination metadata を持つ response を扱う必要がある
- 新着 entry が追加される運用でも，既取得一覧の続きを比較的安定して読める
- 一方で，任意の page 番号へ飛ぶ UI や「総件数を即時に知る」要件は，この方式だけでは直接は満たさない

## 代替案

- `offset` / `limit` だけを追加する
  - 実装は軽いが，新着挿入で page 境界がずれやすく，一覧継続取得との相性が悪いため採らない
- 全件取得のまま frontend だけで virtualize する
  - 描画量は抑えられても，転送量と初回待ち時間は減らないため採らない
- page 番号ベースの固定 page API にする
  - offset 案と同じく，変動する新着一覧の continuation と相性が悪いため採らない

## 参考資料

- [ADR-0007] ADR-0007: api backend の初期構成
- [ADR-0027] ADR-0027: web ui frontend の browse state を URL に写す
- [Acceptance-0015] Acceptance-0015 Entry List Pagination

[ADR-0007]: ./0007-api-backend-initial-architecture.md
[ADR-0027]: ./0027-web-ui-browse-state-routing.md
[Acceptance-0015]: ../acceptance/0015-entry-list-pagination.md
