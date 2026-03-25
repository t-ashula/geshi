# 0022 bullmq bootstrap

## 目的

- `backend/` に BullMQ を導入し，Redis と最小 queue / worker / producer / dashboard を使って動作確認できる状態を作る

## 検収条件

- BullMQ と Redis の最小接続がある
- Docker Compose で Redis を起動できる
- queue の最小定義がある
- worker の最小起動構成がある
- producer 相当の最小 enqueue 経路がある
- `bull-board` が Hono 経由で利用可能である
- backend 用の npm script が追加されている
- 開発手順を示す文書がある
- `npm run lint` と `npm run typecheck` と `npm run build` が通る
