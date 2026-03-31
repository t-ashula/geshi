# Geshi

Geshi は，収集，保存，検索を扱うためのアプリケーションである．

## 開発環境

必要なもの:

- Node.js 22 以上
- Docker / Docker Compose

依存パッケージのインストール:

```bash
npm install
```

開発用 PostgreSQL の起動:

```bash
docker compose up -d postgres
```

開発用 Redis の起動:

```bash
docker compose up -d redis
```

状態確認:

```bash
docker compose ps
```

停止:

```bash
docker compose down
```

## backend

backend の開発起動:

```bash
npm run backend:dev
```

worker の開発起動:

```bash
npm run backend:worker:dev
```

## migration

`dbmate` は `npm run` 経由で使える．

- migration ファイルは `backend/db/migrations/` に置く
- 接続先は `DATABASE_URL` で渡す
- schema 定義の source of truth は migration SQL とする
- schema dump は `backend/db/schema.sql` に出力する

例:

```bash
export DATABASE_URL=postgres://geshi:geshi@127.0.0.1:5432/geshi
```

dbmate 自体の help:

```bash
npm run dbmate -- --help
```

migration の基本操作:

```bash
npm run db:migrate:status
npm run db:migrate:up
npm run db:migrate:down
npm run db:migrate:new -- create_example_table
```

## frontend

frontend の開発起動:

```bash
npm run frontend:dev
```

## テストと検査

型検査:

```bash
npm run typecheck
```

lint:

```bash
npm run lint
```

test:

```bash
npm test
```

backend unit test:

```bash
npm run test:unit:back
```

backend mid test:

```bash
docker compose up -d postgres
npm run test:mid:back
```

`test:mid:back` は実 PostgreSQL に接続する．
接続先は `TEST_DATABASE_URL` を優先し，未指定時は
`postgres://geshi:geshi@127.0.0.1:5432/geshi` を使う．

test 用 schema は一時 schema として作成し，
`backend/db/schema.sql` を流し込んで初期化する．
