# ADR-0043: backend の query 層に Kysely を導入する

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- `ADR-0035` で，`BackendStore` の物理実体として PostgreSQL を採用した
- `ADR-0036` では，初期実装を優先して ORM を採用せず，runtime は `pg`，migration は `dbmate` とした
- その後，`ADR-0037` を起点に `job` / `job event` の PostgreSQL 実装が入り，backend 側に SQL を伴う read / write が継続的に増え始めた
- 現状の `pg` 直書きでも小規模実装は進められるが，query の増加に伴って次の点が重くなる
  - select 結果と TypeScript 側 model の対応を毎回手で維持する必要がある
  - join や filter が増えるほど，column 名の typo や nullable の取り扱い漏れを review で拾いにくい
  - SQL 文字列，行型，変換処理が近い責務なのに分散しやすい
- 一方で，schema の source of truth は引き続き migration SQL に置きたい
- したがって，schema 管理を ORM に寄せ切るのではなく，PostgreSQL と SQL 中心の運用を維持しながら，runtime query の型安全性と composability を補う層が必要である

## 決定

- backend の runtime query 層には `Kysely` を導入する
- PostgreSQL driver としては引き続き `pg` を使い，`Kysely` はその上に載せる
- migration 管理は引き続き `dbmate` を使う
- schema 定義の source of truth は，引き続き `backend/db/migrations/` の migration SQL とする
- `backend/db/schema.sql` の dump 運用も維持する
- `Kysely` は主に次の責務に使う
  - select / insert / update / delete の query 構築
  - result row の型付け
  - backend 内の table / column 参照の型安全化
- DDL や migration は `Kysely` に寄せず，SQL ファイル中心で管理する
- `Kysely` で表現しにくい query や PostgreSQL 固有機能は，必要に応じて raw SQL を併用してよい
- `ADR-0036` のうち「ORM を採用しない」「runtime は `pg` を直接使う」という判断は，本 ADR が採択された時点で置き換える
  - 一方で `dbmate` と migration SQL を source of truth にする判断は維持する

## 影響

- backend の query 実装で，table / column 参照や result shape の不整合を型で早めに検出しやすくなる
- store 実装で，query 構築と row mapping を `pg` 直書きより整理しやすくなる
- schema-first ORM への全面移行は避けつつ，raw SQL 一辺倒だった運用を緩和できる
- `Kysely` 用の database type 定義や helper を backend 側で整備する必要がある
- 既存の `pg` 直書き箇所は，必要な範囲から段階的に `Kysely` へ寄せる移行計画が必要になる

## 代替案

- `pg` 直書きを継続する
  - 依存追加は不要だが，query 数の増加に対して型安全性と組み立ての見通しが改善しない
- Prisma や Drizzle など schema-first 寄りの ORM / toolkit を採用する
  - migration，schema 定義，生成物の運用まで見直すことになり，現行の `dbmate` / SQL 中心運用からの変更範囲が大きい

## 参考資料

- [adr-0035] ADR-0035 BackendStore の物理実体として PostgreSQL を採用する
- [adr-0036] ADR-0036 BackendStore 実装では ORM を採用せず runtime は pg, migration は dbmate を使う
- [adr-0037] ADR-0037 job と job event を PostgreSQL で実装する

[adr-0035]: ./0035-backend-store-physical-selection.md
[adr-0036]: ./0036-backend-store-orm-and-migration-policy.md
[adr-0037]: ./0037-job-store-bootstrap.md
