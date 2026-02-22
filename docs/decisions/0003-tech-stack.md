# ADR-0003: 現状の技術スタック

## ステータス

決定

## 範囲

全体

## コンテキスト

- 本リポジトリは `geshi/`（TypeScript）と `scribe/`（Python）で構成される
- 技術要素は実装上すでに存在するが、ADR として明文化されていない
- 運用・採用判断の前提を揃えるため、現時点の技術スタックを遡及的に規定する

## 決定

- 言語・ランタイム
  - `geshi/`: TypeScript（Node.js）
  - `scribe/`: Python 3.12+
- パッケージ・ビルド
  - `geshi/`: npm workspaces
  - `scribe/`: uv（`pyproject.toml` ベース）
- Web/API
  - UI: SvelteKit（`geshi/ui`）
  - API: FastAPI（`scribe`）
- 非同期処理
  - `geshi/crawler`: BullMQ
  - `scribe`: RQ / RQ Scheduler
- データストア
  - PostgreSQL
  - Redis
- データアクセス
  - Prisma（`geshi/model`）
- 開発・テスト
  - TypeScript 側: ESLint / Prettier / Vitest
  - Python 側: uv / Ruff / MyPy / Pytest
- 実行・ローカル統合環境
  - Docker / Docker Compose を利用可能とする

## 影響

- 技術選定の前提が ADR として一元管理される
- 新規 ADR での「変更対象」と「現状維持」を判断しやすくなる
- 将来の技術変更は、本 ADR を参照しつつ差分 ADR で管理できる

## 備考

- 本 ADR は現状実装の追認であり、新規採用判断を行うものではない

## 参考資料

- [root-readme] README
- [geshi-package-json] geshi/package.json
- [scribe-pyproject] scribe/pyproject.toml
- [compose] docker-compose.yml
- [adr-0000] ADR-0000 ADR ドキュメントフォーマットと設計ログ

[root-readme]: ../../README.md
[geshi-package-json]: ../../geshi/package.json
[scribe-pyproject]: ../../scribe/pyproject.toml
[compose]: ../../docker-compose.yml
[adr-0000]: ./0000-adr-format.md
