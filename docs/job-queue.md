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

### 録画系の拡張方向

録画系に関しては，現行の `observe-source` / `acquire-content` に加えて，少なくとも次を追加する方向を検討している．

- `recording-scheduler`
  - 録画予約を見て `record-content` を queue に投入する常駐 worker
- `record-content`
  - plugin の `record` を 1 job 分だけ実行する worker

上記は現時点では提案段階であり，現行実装にはまだ入っていない．

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

### 録画系 worker の提案中の起動像

- `recording-scheduler` は常駐 process とする
- `record-content` は常駐 worker にせず，1 job を処理したら退場する one-shot process とする
- `record-content` job 自体は `scheduledStartAt` まで待機しない
- `scheduledStartAt` は，`recording-scheduler` が queue 投入タイミングを決めるために使う
- `observe-source` は `actionKind=record` の asset に対して `record-content` job を `jobRepository` へ作るが，この時点ではまだ queue へ入れない
- `recording-scheduler` が，未実行かつ未 enqueue の `record-content` job のうち，`scheduledStartAt` が近づいたものを queue に投入する

この構成を採る理由は，録画予約件数分の worker 待機を避けつつ，必要な `record-content` process 数を「同時録画数」に近い形で見積もりやすくするためである．

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

### 録画予約(`record-content`) の提案中の流れ

1. `observe-source` worker が plugin `observe` を呼ぶ
2. plugin が asset ごとに next-action policy を返す
3. `actionKind=acquire` の asset は従来どおり `acquire-content` へ進む
4. `actionKind=record` の asset は `record-content` job として `jobRepository` に登録する
5. `recording-scheduler` が未実行・未 enqueue の `record-content` job を見る
6. `scheduledStartAt` が近づいた対象を `jobQueue` へ投入する
7. `record-content` worker process が plugin `record` を呼ぶ
8. plugin は必要なら実行 context の metadata 更新 API を使って進行情報を反映する
9. `record-content` worker は `asset` / `content` 状態を更新し，1 job 終了後に退場する

## 参考

- [Plugin](./plugin.md)
- [ADR-0048](./decisions/0048-recording-job-orchestration.md)
