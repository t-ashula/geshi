# Logging

この文書は，Geshi の backend / worker における logging のガイドラインを記す．

## 基本方針

- 運用上の出力は `console` ではなく共通 logger を使う
- ログは構造化し，message と metadata を分ける
- `pino` を使う場合も，log level は `30` のような数値ではなく `info` のような文字列で出力する
- 秘密情報や token を出力しない
- 外部入力や API 応答全体をそのままダンプしない
- どの処理のログかが message だけで分かるようにする
- job / source / plugin など，後で追跡に必要な識別子は metadata に載せる

## メッセージの方針

### message は短い定型文にする

- 可変値を message に埋め込まず，metadata に分ける
- message は検索しやすいように，処理内容を一定の表現で書く

```ts
// bad
logger.info(`source ${sourceId} observed`);

// good
logger.info("source observed.", { sourceId });
```

### 基本は過去形で，済んだことを記録する

- message は，原則として完了した事実を過去形で記録する
- 何が起きたかを後から追いやすくするためである
- ただし，長時間処理や外部 I/O の開始点では，開始ログを現在形または started で記録してよい

```ts
// bad
logger.info("source observe.");

// good
logger.info("source observed.", { sourceId });
```

```ts
logger.info("observe job started.", { jobId, sourceId, pluginSlug });
logger.info("observe job completed.", { jobId, sourceId, pluginSlug });
```

### 変数だけを出力しない

- `logger.info(value)` のような，意味の分からない出力をしない
- 何を記録したいのかを message で明示する

```ts
// bad
logger.info(sourceId);

// good
logger.info("source selected.", { sourceId });
```

### `Error` を message に埋め込まない

- `Error` は metadata 側へ渡す
- 例外名，message，stack を機械的に扱いやすくする

```ts
// bad
logger.error(`job failed: ${error}`);

// good
logger.error("job failed.", { error, jobId });
```

### 開始と完了は必要な箇所だけ記録する

- 長時間 job や外部 I/O の前後では，開始と完了を記録してよい
- 細かすぎる step ごとの info log は避ける

```ts
logger.info("observe job started.", { jobId, sourceId, pluginSlug });
logger.info("observe job completed.", { jobId, sourceId, pluginSlug });
```

## Metadata の方針

- metadata は `Record<string, unknown>` 相当を基本とする
- 識別子，件数，duration，URL 種別，status など，検索や集計に使う値を優先して載せる
- 同じ値を message と metadata の両方へ重複して書かない
- URL や title のような外部由来の値は，必要最小限だけを載せる

### よく使う metadata

- `jobId`
- `sourceId`
- `pluginSlug`
- `contentId`
- `assetId`
- `queueJobId`
- `status`
- `durationMs`

## Severity

`debug` < `info` < `warn` < `error` の順に重要度が高いものとして扱う．

### `debug`

- 通常運用ではなく，調査時にだけ欲しい詳細情報
- 一時的な内部状態
- 件数や分岐結果の細かな確認

### `info`

- 正常系で，処理の進行や完了を追うために必要な情報
- worker の開始
- job の開始 / 完了
- 外部取得の成功

### `warn`

- 失敗はあったが，処理全体は継続できる場合
- フォールバックを使った場合
- 想定内の欠損データを無視した場合

### `error`

- 処理継続ができず，中断や失敗扱いに入る場合
- 外部取得に失敗した場合
- 保存や queue 処理で失敗した場合

## Child Logger

共通 metadata を束ねたいときは `child` を使う．

- process 単位
- request 単位
- worker 単位
- job 単位
- plugin 呼び出し単位

```ts
const jobLogger = logger.child({
  jobId,
  pluginSlug,
  sourceId,
});

jobLogger.info("observe job started.");
```

## 非対象

- frontend の browser console 出力はこの文書の主対象外とする
- 一時的なデバッグ出力は許容される場合があるが，運用コードへ残さない
