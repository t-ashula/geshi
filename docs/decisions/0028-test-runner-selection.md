# ADR-0028: test runner を選定する

## ステータス

決定

## 範囲

リポジトリ全体

## コンテキスト

- 現在は lint と typecheck はあるが，test runner は未導入である
- backend の model module や後続の bridge 実装には unit test を入れたくなっている
- frontend / backend / cli をまたいで，どの test runner を採るかを先に整理したい

## 決定

- test runner として `Vitest` を採用する
- backend / frontend / cli の unit test は，原則として `Vitest` に統一する
- test code は `frontend/test/` `backend/test/` `cli/test/` の各領域配下に置き，`*.test.ts` で揃える
- test 実行時の TypeScript 対応，watch 実行，mock，coverage などは `Vitest` の標準機能を使う前提で整理する
- frontend 側では，Vite / Vue 構成との親和性を優先する
- backend / cli 側でも，Node.js 標準 test runner や別 runner を併用せず，まず `Vitest` に揃える
- integration test や将来の browser test への広がりも，まず `Vitest` を基点に考える

## 影響

- test 追加時にその場しのぎの runner を入れずに済む
- frontend / backend / cli で test 実行方法を揃えやすくなる
- Vite / Vue 構成との統合がしやすい
- unit test と integration test の置き方を整理しやすくなる
- CI の test 実行方法も後続で揃えやすくなる

## 代替案

- テストが必要になった箇所ごとに runner を決める
  - repository 全体の一貫性が崩れやすい
- Node.js 標準 test runner を当面使い続ける
  - frontend や将来の test 方針と分かれやすい
- `Jest` を採用する
  - 現在の Vite / Vue / TypeScript 構成に対しては相対的に重い

## 備考

- 本 ADR は test runner の選定を対象とする
- 具体的な導入，設定，script の追加は後続の実装項目で扱う

## 参考資料

- [adr-0007] ADR-0007 初期 CI を整備する
- [adr-0016] ADR-0016 frontend の UI フレームワークを選定する
- [adr-0019] ADR-0019 backend の Hono bootstrap を定める

[adr-0007]: ./0007-initial-ci.md
[adr-0016]: ./0016-frontend-ui-framework-selection.md
[adr-0019]: ./0019-backend-hono-bootstrap.md
