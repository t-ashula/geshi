# ADR-0036: BackendStore 実装では ORM を採用せず runtime は pg, migration は dbmate を使う

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- `ADR-0035` で，`BackendStore` の物理実体として PostgreSQL を採用した
- 次に，runtime から PostgreSQL へどう接続するかと，schema 変更をどう管理するかを決める必要がある
- 現時点では，ORM による model / schema 中心の抽象を入れるより，PostgreSQL を素直に使う方がよい

## 決定

- `BackendStore` 実装では ORM を採用しない
- runtime から PostgreSQL へ接続するために `pg` を使う
- migration 管理には `dbmate` を使う
- migration ファイルは `backend/db/migrations/` に置く
- schema dump は `backend/db/schema.sql` に出力する
- migration の接続先は `DATABASE_URL` で渡す
- 開発時の migration 適用は `npm run db:migrate:*` から行う
- schema 定義の source of truth は migration SQL とする

## 影響

- PostgreSQL の schema や SQL を ORM の抽象に合わせずに素直に設計できる
- migration は SQL 中心で管理する前提になる
- migration の配置と接続方法が揃う
- backend 実装と migration 運用を同じ Node プロジェクト内で扱いやすくなる
- query の型安全性や補助 abstraction は，必要になった時点で別途整理する必要がある

## 参考資料

- [adr-0035] ADR-0035 BackendStore の物理実体として PostgreSQL を採用する

[adr-0035]: ./0035-backend-store-physical-selection.md
