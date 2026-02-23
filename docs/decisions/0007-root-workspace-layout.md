# ADR-0007: npm workspace 構成を `packages/` 配下へ再編する

## ステータス

決定

## 範囲

全体

## コンテキスト

- 現状の TypeScript workspace は `geshi/` 配下にあり、リポジトリルートとの二重構造になっている
- `scribe/` を submodule 化した結果、ルートには Python サービスと TypeScript workspace が並立し、役割の見通しをさらに明確化する必要がある
- npm workspace の一般的な運用では、各パッケージを `packages/` 配下に配置して構造を統一することが多い

## 決定

- TypeScript 側の workspace パッケージを `packages/` 配下へ移動する
  - `packages/crawler`
  - `packages/logger`
  - `packages/model`
  - `packages/scribe-client`
  - `packages/ui`
- ルート `package.json` を workspace の起点として維持し、`workspaces` は `packages/*` を参照する
- 既存の `@geshi/scribe` パッケージ名は維持し、ディレクトリ名のみ `scribe-client` に変更する
- `scribe/`（Python submodule）は `packages/` 配下に移さず、現行どおりルート直下に配置する

## 影響

- ディレクトリ構成が標準的になり、新規参加者が理解しやすくなる
- CI / dependabot / tsconfig paths / docker-compose / README などの参照パス更新が必要になる
- 既存スクリプトやドキュメントで `geshi/` 前提の記述は移行対応が必要になる

## 代替案

- 現状の `geshi/` 配下構成を維持する
- ルート直下に各 workspace を展開し、`packages/` は採用しない

## 備考

- 本 ADR は再編方針を定める。実施時は別PRで移行手順とロールバックを明示する

## 参考資料

- [adr-0000] ADR-0000 ADR ドキュメントフォーマットと設計ログ
- [adr-0004] ADR-0004 geshi (TypeScript) と scribe API (Python) の分離
- [adr-0006] ADR-0006 scribe を別リポジトリ化し submodule として参照する

[adr-0000]: ./0000-adr-format.md
[adr-0004]: ./0004-separation-between-geshi-and-scribe-api.md
[adr-0006]: ./0006-scribe-submodule-migration.md
