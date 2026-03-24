# backend development

## 目的

- `backend/` の最小 HTTP API 開発を始めるための手順をまとめる

## 前提

- Node.js 22 以上
- 依存パッケージが install 済みであること

## 起動

- 開発時は次を使う

```sh
npm run backend:dev
```

- 単発起動は次を使う

```sh
npm run backend:start
```

- 必要なら `HOST` と `PORT` を指定できる

```sh
HOST=127.0.0.1 PORT=3000 npm run backend:start
```

## 確認

- 起動後に次へアクセスする

```text
GET /health
```

- 想定する応答は次の通り

```json
{"ok":true}
```

## 構成

- `backend/src/index.ts`
  - Node.js 上の起動エントリ
- `backend/src/app.ts`
  - Hono アプリケーション生成
- `backend/src/routes/health.ts`
  - 最小 route

## 備考

- 認証，永続化，job 実行基盤，domain 固有 route はまだ含めない
- route は `backend/src/routes/` 以下に追加していく
