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

例:

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

現時点では migration の配置や適用手順までは未確定であり，詳細は後続 ADR で整理する．

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
