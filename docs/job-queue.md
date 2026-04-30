# Job Queue

この文書は，`geshi` の job queue と worker process 配置の現時点の整理を記す．

## 目的

- `pg-boss` を使う非同期実行基盤の責務を明確にする
- `backend`，`worker`，`plugin` の境界を分ける
- job の流れと，実装配置の基本方針を揃える

## 役割

### backend

- job 投入 API を持つ
- domain model の保存責務を持つ

### worker

- `pg-boss` から job を受け取る
- job payload を解釈する
- worker 実行に必要な情報を enqueue 時点の payload から受け取る
- 対応 plugin を解決する
- 一時ディレクトリを払い出す
- plugin を呼ぶ
- 必要なら一時成果物を storage へ移す
- backend 本体へ import 用 payload を渡す
- job 状態を更新する

### plugin

- 収集処理だけを担う
- backend の domain model を直接更新しない

## 実装配置

queue ごとの worker process 実装を `backend` 配下に置く．

- `backend/src/workers/observe-source/main.ts`
  - `observe-source` worker process の起動入口
  - `PgBoss` を初期化し，`observe-source` queue を購読する
- `backend/src/workers/observe-source/handle.ts`
  - `observe-source` job handler の本体

backend と `observe-source` worker は別 process として起動する．

## 起動

最低限必要なのは次の 2 process である．

- backend process
  - HTTP API を処理する
  - `boss.send()` を読んで job を投入する
- `observe-source` worker process
  - `observe-source` queue を処理する

ローカルでも deploy でも，`observe-source` worker は専用 command で起動する前提にする．

ローカル開発では，個別 command に加えて `npm run worker:start` で
`acquire-content` と `observe-source` をまとめて起動してよい．

## job の流れ

クロール(`observe-source`) の場合

1. frontend または CLI が backend に初回クロール要求を送る
2. backend が `observe-source` job を enqueue する
3. enqueue payload には worker 実行に必要な情報を含める
4. `observe-source` worker が job を受ける
5. worker が payload の情報から plugin 入力を組み立てる
6. worker が RSS plugin の `observe` を起動する
7. plugin の `observe` が コンテンツ候補一覧を返す
8. worker が backend の api をよぶ
9. backend が `content` と `content snapshot` を保存する

## 参考

- [Plugin](./plugin.md)
