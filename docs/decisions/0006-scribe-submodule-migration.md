# ADR-0006: scribe を別リポジトリ化し submodule として参照する

## ステータス

決定

## 範囲

全体

## コンテキスト

- 現状は TypeScript monorepo（`geshi/`）と Python サービス（`scribe/`）が同一リポジトリに同居している
- 言語・依存管理・CI が異なるため、変更検知、ビルド整合、運用責務が複雑化しやすい
- `geshi` 側は HTTP API 契約で `scribe` を利用しており、ソース同居は必須ではない

## 決定

- `scribe/` は独立リポジトリへ分離し、当リポジトリでは Git submodule として `scribe/` 配下に配置する
- `geshi/` 側は TypeScript workspace から `scribe` パッケージを除外する
- `geshi` と `scribe` の統合点は HTTP API 契約とする（`/transcribe`, `/summarize`）
- `geshi/scribe`（TypeScript API クライアント）は `geshi` 側に残す
- CI は `geshi` と `scribe` を分離し、必要時のみ submodule の pin 更新を行う

## 影響

- 言語別の依存管理と CI を分離でき、変更影響範囲が明確になる
- `geshi` 側の build/lint/test から Python 実装要因を切り離せる
- submodule 更新運用（clone/init/update, pin 更新レビュー）が新たに必要になる

## 代替案

- 同一リポジトリ維持のまま CI とディレクトリ規約だけを改善する
- `scribe` を subtree で取り込む

## 備考

- 本 ADR は移行方針と作業順序を定義する。詳細手順は PR でチェックリスト化する

## 参考資料

- [adr-0004] ADR-0004 geshi (TypeScript) と scribe API (Python) の分離
- [root-compose] docker-compose.yml
- [geshi-workspaces] geshi/package.json
- [geshi-tsconfig-base] geshi/tsconfig.base.json
- [scribe-ci] Scribe CI workflow

[adr-0004]: ./0004-separation-between-geshi-and-scribe-api.md
[root-compose]: ../../docker-compose.yml
[geshi-workspaces]: ../../geshi/package.json
[geshi-tsconfig-base]: ../../geshi/tsconfig.base.json
[scribe-ci]: ../../.github/workflows/scribe-ci.yml
