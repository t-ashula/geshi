# ADR-0006: source 登録に向けた web ui frontend の初期構成

## ステータス

決定

## 範囲

web ui frontend

## コンテキスト

- `geshi` は `web ui frontend` を閲覧，検索，管理画面の入口として持つ方針である
- `v0.4.0` では `frontend/` に Vue + Vite を置く構成を採っていた
- 今回も `podcast rss source` 登録画面を実装するには，frontend の技術と配置を先に揃えておく必要がある
- `podcast rss source` 登録画面を作る前に，管理画面を置く器と最小責務を定めないと，画面単位の判断が先に散らばる

## 決定

web ui frontend の初期構成として，以下を採用する．

- frontend の UI フレームワークには Vue を採用する
- frontend の build / dev 基盤には Vite を採用する
- frontend は backend と分離した独立の構成要素として置く
- リポジトリ直下の `src/` と `test/` は廃止し，frontend と backend に責務を分ける
- frontend は SPA として構成する
- frontend の責務は画面表示，入力受付，backend API 呼び出し結果の反映までに限定する
- source の正規化，重複判定，登録可否判断は frontend の責務に入れない
- 初期段階では，Router，状態管理，UI コンポーネントライブラリは最初から一括導入せず，必要になった時点で追加する
- frontend は `frontend/` 配下に置き，その中は Vue / Vite の作法に沿って整理する
- 見た目の意味でのデザイン方針はこの ADR のスコープ外とし，別途扱う

### 採用理由

- `v0.4.0` で採っていた Vue + Vite 構成を踏襲できる
- Vue は管理画面や一覧中心の UI を構成しやすい
- Vite は Vue と組み合わせやすく，frontend の最小 bootstrap を作りやすい
- backend API と素直につなぎやすい
- frontend を独立領域に置くことで，backend と責務分離しやすい
- source 一覧，詳細，登録のような複数画面へ拡張しやすい

## 影響

- source 登録画面の議論を，frontend の責務に沿って整理できる
- backend API や DB 設計と独立して，画面側が持つべき境界を先にレビューできる
- `v0.4.0` と連続性のある frontend 構成で進めやすくなる
- 実装前に frontend の置き場と責務漏れを減らせる

## 代替案

- source 登録画面の仕様だけを先に決めて，frontend 全体構成は後回しにする
  - 初速は出るが，画面追加時に責務や配置がぶれやすい
- Nuxt を採用する
  - Vue 系ではあるが，backend に Hono を置く今回の構成では役割が重なりやすい
- frontend を backend に同居させる
  - 配置は減るが，責務分離が曖昧になりやすい

## 参考資料

- [ADR-0003] ADR-0003 全体アーキテクチャ
- [ADR-0007] ADR-0007 api backend の初期構成
- [v0.4.0-adr-0016] v0.4.0 ADR-0016 frontend の UI フレームワークを選定する
- [v0.4.0-adr-0020] v0.4.0 ADR-0020 Vue による frontend 初期実装を開始する
- [development] Development
- [acceptance-0001] Acceptance 0001 Podcast RSS Source Registration

[ADR-0003]: ./0003-system-architecture.md
[ADR-0007]: ./0007-api-backend-initial-architecture.md
[v0.4.0-adr-0016]: https://github.com/t-ashula/geshi/blob/v0.4.0/docs/decisions/0016-frontend-ui-framework-selection.md
[v0.4.0-adr-0020]: https://github.com/t-ashula/geshi/blob/v0.4.0/docs/decisions/0020-frontend-vue-bootstrap.md
[development]: ../development.md
[acceptance-0001]: ../acceptance/0001-source-registration-foundation.md
