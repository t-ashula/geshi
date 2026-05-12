# ADR-0007: api backend の初期構成

## ステータス

決定

## 範囲

api backend

## コンテキスト

- `web ui frontend` は単独で永続化や業務判断を持たず，`api backend` を利用する前提である
- `podcast rss source` 登録機能を実装するには，backend 側に API の受け口と機能別ロジックの置き場が必要になる
- 一方で，source 登録 API の個別仕様より前に，backend で採用する技術，ディレクトリ構成，責務分割を決めないと実装の置き場がぶれやすい
- 全 backend を一度に詳細化するのではなく，今回の開発項目を進められる最小限の初期構成を決めたい

## 決定

api backend の初期構成として，以下を採用する．

- `web ui frontend` や CLI からの要求を受ける HTTP API として backend を構成する
- backend の HTTP server には Hono を採用する
- backend には少なくとも HTTP の入出力，機能別ロジック，永続化アクセスの責務分割を置く
- DB アクセスは backend に集約し，frontend から DB へ直接触れない
- API は `/api/v1` prefix を持つ REST を基本とする
- source 系の API は `GET /api/v1/sources`, `GET /api/v1/sources/{slug}`, `POST /api/v1/sources` を基本とする
- 認証や権限モデルは現時点では扱わない
- リポジトリ直下の `src/` と `test/` は廃止し，backend 実装は `backend/` 配下に集約する
- backend 配下は少なくとも `src/routes`, `src/service`, `src/lib`, `src/db`, `test` に分ける
- `src/routes` は HTTP over IO を扱う
- route 実装のファイル配置は path 構造に対応させ，たとえば source 系は `src/routes/api/v1/sources.ts` に置く
- `src/service` は source 登録のような機能別ロジックを扱う
- `src/lib` は RSS パースのような，ドメインやビジネスロジックに強く結びつかない技術寄りの補助処理を扱う
- `src/db` は永続化アクセスを扱う
- 永続化の責務は backend 側に置くが，schema 定義ファイルの物理配置は当面 repo 直下の `db/` を維持する
- source 登録 API のような個別機能は，この初期構成の上に追加する

### 採用理由

- Hono は request / response を Web 標準に寄せて扱える
- Web 標準の request / response に寄せることで，handler のテストを用意しやすい
- Hono は Node.js や Cloudflare Workers を含む複数の実行基盤に対応している
- source 一覧，source 詳細，source 登録の入口は REST で素直に表現できる
- 現時点では単一利用者向けの管理機能として進めるため，認証や権限モデルを先に持ち込まない方が単純である

## 影響

- source 登録機能の backend 実装の置き場を先に揃えられる
- frontend から backend へ責務を分離しやすくなる
- 永続化アクセスや機能別ロジックが HTTP handler に混ざり続けるのを防ぎやすい
- source 一覧 / 詳細 / 登録の API 入口を早い段階で揃えられる

## 代替案

- 初回は source 登録機能だけ個別に実装し，backend 全体構成は後回しにする
  - 初速は出るが，後から責務分割や配置をそろえる手戻りが増えやすい
- frontend から直接 DB に書き込める前提で進める
  - 検証用には軽いが，`ADR-0003` の責務分離と整合しない

## 参考資料

- [ADR-0003] ADR-0003 全体アーキテクチャ
- [acceptance-0001] Acceptance 0001 Podcast RSS Source Registration
- [data-model] Data Model

[ADR-0003]: ./0003-system-architecture.md
[data-model]: ../data-model.md
[acceptance-0001]: ../acceptance/0001-source-registration-foundation.md
