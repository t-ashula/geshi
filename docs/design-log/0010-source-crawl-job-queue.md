# Design Log 0010

`ADR-0010` の補足メモ．

## この段階の論点

- source クロールを非同期実行する job queue として，どの実装を採るか
- queue のために新しい運用依存を増やすか
- 手動起動と内部 scheduler からの起動要求を，同じ基盤で受けられるか
- 失敗理由，再試行，状態追跡を backend から扱いやすいか

## 現時点の採用案

- 採用案は `pg-boss`

### 理由

- 現在の repo は `PostgreSQL + Node.js` を前提にしており，Redis は導入していない
- source 登録までは PostgreSQL を中心に構成しており，queue 導入だけのために新しい常駐基盤を増やさない方が自然である
- `pg-boss` は PostgreSQL 上で job queue を構成できる
- 遅延実行，再試行，cron，dead letter，相当の機能を最初から持つ
- 既存の DB transaction と近い場所で job を投入できるため，backend 主導の操作と整合を取りやすい
- queue 実装に進捗 API が薄くても，進捗やログを backend 側の job event に寄せれば，source クロール初期基盤として成立させやすい
- 初回クロールのような API 起点 job と，継続クロールのような内部 scheduler 起点 job を同じ runtime に揃えやすい

## 比較メモ

### `pg-boss`

- PostgreSQL ベースで追加インフラを増やさずに導入できる
- queue の job 永続化を既存 DB 運用へ寄せられる
- source 登録や将来の backend API からの起動と相性がよい
- backend 内の scheduler job から継続クロールを積み続ける構成とも相性がよい
- 一方で，queue 用 schema や migration の扱いを backend 側で整理する必要がある

### `BullMQ`

- 機能は豊富で一般的な採用例も多い
- ただし Redis が前提になる
- 現時点の `geshi` では，queue 導入のためだけに Redis を追加する設計コストが先に立つ
- 長時間 job の progress event や dashboard 運用では依然として有力である
- 高スループットや複雑な workflow を強く必要とする段階になれば，再評価余地はある

### `Graphile Worker`

- これも PostgreSQL ベースであり，追加インフラを増やさない点はよい
- 一方で，現段階では `geshi` の backend 主導の queue API としては，`pg-boss` の方が enqueue / retry / schedule の直接性が高い
- 第一候補には置かないが，PostgreSQL ベース候補としては有力である

## この段階で固定すること

- job queue は Redis ではなく PostgreSQL ベースを優先する
- queue 状態の標準語彙は，backend 側では少なくとも `queued`，`running`，`succeeded`，`failed` を持つ
- queue 実装固有の内部状態は，必要なら backend 側の状態語彙へ写像して扱う
- 手動クロール起動と内部 scheduler からの実行要求は，同じ job queue 基盤で扱う
- progress や詳細ログは queue 実装固有 API ではなく，backend 側の job event として扱う
- source クロールの初期 queue 実装としては `pg-boss` を採る
- source ごとの継続クロールは，永続的な scheduler job が個別クロール job を投入する形を基本とする

## `pg-boss` 導入時にまず整理すべきこと

`pg-boss` の導入で先に詰めるべきことは，機能一般ではなく，`observe-source` queue を動かすための実装と運用の最小単位である．

- `observe-source` worker の実装方法
- `observe-source` worker の起動方法
- backend から `observe-source` job をどう投入するか
- `pgboss` schema と app 側 schema をどう分離するか

## `observe-source` worker の実装単位

`pg-boss` でいう worker 実装は，`observe-source` queue に対して `work()` で登録される処理系一式である．

pg-boss の README を見る限り，

```ts
// producer 側
const boss = new PgBoss("postgres://user:pass@host/database");
const queue = "some-queue";
await boss.start();
await boss.send(queue, { arg1: "read me" });
```

```ts
// consumer 側
const boss = new PgBoss("postgres://user:pass@host/database");
const queue = "some-queue";
await boss.start();
await boss.work(queue, async ([job]) => {
  console.log(`received job ${job.id} with data ${JSON.stringify(job.data)}`);
});
```

とすれば

```plain
received job 1 with data {"arg1":"read me"}
```

とでてきそう．

なので，crawler 用には以下の整理が必要

- `observe-source` worker の entrypoint
  - `PgBoss` を初期化する
  - `boss.start()` を呼ぶ
  - `boss.work("observe-source", handler)` を登録する
- `observe-source` handler
  - payload を受ける
  - plugin を呼ぶ
  - backend 保存処理を呼ぶ
- `observe-source` payload 型
  - この queue が受ける job 入力型

## `boss.start()` を誰がいつ呼ぶか

`boss.start()` は，その process が `PgBoss` runtime を使い始める前に 1 回呼ぶ．

今回の前提では 2 箇所ある．

- backend process
  - `observe-source` job を `send()` する前に呼ぶ
- `observe-source` worker process
  - `observe-source` queue を `work()` する前に呼ぶ

つまり `start()` は queue を使う process ごとに必要であり，worker だけの責務ではない．

## `observe-source` worker process の起動

worker process 自体も queue ごとに分ける．

- backend
  - HTTP API を処理する process
- `observe-source` worker
  - `observe-source` queue だけを処理する process

ローカルでも deploy でも，起動単位は `observe-source` worker 専用 command とする．

## backend からの job 投入

backend は `observe-source` queue にだけ job を積む．

- backend 起動時に `PgBoss` を初期化する
- backend 起動時に `boss.start()` を呼ぶ
- route / service から `boss.send("observe-source", payload)` する
- 返された `jobId` を状態追跡に使う

## pg boss schema の扱い

pg boss では pgboss schema にテーブルを作ってるようなので，アプリはデフォルトの public schema から出ないか kgt\_ prefix をつけた schema とすることで共存はできそう

## この段階でまだ残ること

- queue 状態の参照 API をいつ切るか
- scheduler job の粒度を source 単位にするか，まとめて走査する job にするか
- 録画系のような厳しい時刻指定や長時間実行 job まで，同じ runtime で扱うか

## docs への整理先

- job queue runtime と worker 配置の現時点の整理は [job-queue](../job-queue.md) に寄せる
- ADR は判断だけを残し，runtime の構成説明は `docs/job-queue.md` で更新していく

## 参考資料

- `pg-boss`: [pg-boss official repository](https://github.com/timgit/pg-boss)
- `Graphile Worker`: [official documentation](https://worker.graphile.org/docs)
- `BullMQ`: [official documentation](https://docs.bullmq.io/guide/queue)
