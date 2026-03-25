# backend bullmq development

## 目的

- `backend/` で BullMQ と Redis の最小構成を使って queue / worker / dashboard を確認する

## 前提

- Node.js 22 以上
- Docker と Docker Compose が使えること
- 依存パッケージが install 済みであること

## 起動手順

1. Redis を起動する

    ```sh
    npm run redis:up
    ```

2. backend API を起動する

    ```sh
    npm run backend:start
    ```

3. 別ターミナルで worker を起動する

    ```sh
    npm run backend:worker:start
    ```

## 動作確認

- queue へ ping job を追加する

```sh
curl -X POST http://127.0.0.1:3000/dev/jobs/ping
```

- Bull dashboard を開く

```text
http://127.0.0.1:3000/admin/queues
```

## 構成

- `compose.yaml`
  - Redis
- `backend/src/bullmq/config.ts`
  - Redis 接続設定
- `backend/src/bullmq/queues.ts`
  - queue 定義
- `backend/src/bullmq/worker.ts`
  - worker 定義
- `backend/src/worker.ts`
  - worker 起動エントリ
- `backend/src/routes/jobs.ts`
  - 最小 enqueue route
- `backend/src/routes/dashboard.ts`
  - `bull-board` の Hono 組み込み

## 備考

- これは BullMQ bootstrap 用の最小構成であり，Geshi 側 `job` モデルとの統合はまだ含まない
