# ログガイドライン

## 基本方針

- 実装言語を問わず，形式を一定に保つためにも `print` や `console.log`
  でのログ出力は行わないこと
  - Geshi では backend / cli の運用上の出力は `logger` を使うこと
- 公序良俗に反しない表現を心がけること
- パスワードや秘密情報はどの severity に対しても出さないこと
- API の返り値など外部から取得した値をそのままダンプすることは避けること
- どこの処理でなんのログかわかるメッセージとすること
- ログの出力は構造化し，機械的な処理をしやすくすること

## 文法上の方針

### メッセージのない変数だけの出力はしない

- どこのコードで何を出力したいのかを明確にする
- 特に JavaScript / TypeScript では `[object Object]` になり得る
- ロガーによるファイル名や行番号の記録では実行環境によって差があり，統一性を欠く

### ログメッセージ用の変数を用いない

- 変数だけのログを避けるルールとの混乱を避けるため，logger に直接文字列を書く
- 特別な状況下で動的に組み立てるときには用いてもよい

```ts
// bad
const logMessage = "API called.";
logger.debug(logMessage);

// good
logger.debug("API called.");

// not recommended
if (env.DEBUG) {
  logger.debug("messages:");
  for (const l of lines) {
    logger.debug(l);
  }
}
```

### メッセージを過去形にする

- 「〇〇が終わった」を記録する
- API や関数呼び出しが実行されたことを明確にするためである
- 特に記録したい処理の開始を「〇〇を開始した」としてもよい
  - 関数のエントリポイント
  - 大量・長時間の処理が予想される箇所

```ts
// bad
logger.debug("crawl page");

// good
logger.info("page crawled.");
```

```ts
function someLongBatch(lines){
  logger.info("some long batch started.", { lines: lines.length });
  // long long code
}
```

### 変数の出力を文章中に埋めない

- 値によってメッセージの長さがばらつくのを抑制する
- どの文字列をどの変数が出力したのかを明確にする
- 構造化が可能であればその方法を選ぶ

```ts
// bad
logger.debug(`crawling ${url} started`);

// good
logger.debug("page crawled.", { url });
```

### `Error` を message に埋め込まない

- `Error` は message に文字列化せず，metadata 側に渡す
- 例外名，message，stack などを後で扱いやすくするためである

```ts
// bad
logger.error(`job failed: ${error}`);

// good
logger.error("job failed.", { error });
```

## logger interface

backend / cli では，少なくとも次の interface を前提に扱う．

- `debug(message, metadata?)`
- `info(message, metadata?)`
- `warn(message, metadata?)`
- `error(message, metadata?)`
- `child(bindings)`

`metadata` は `Record<string, unknown>` を基本とする．

## Severity

レベルはロガーによって微妙に異なる呼び方になるが，
`debug` < `info` < `warn` < `error` の順に緊急度が高いものとして扱う．

### debug

- 出力してなくても通常動作確認には不要なものに使う
- API のレスポンスやリクエストのダンプ
- 関数の細かな内部状態

### info

- 正常動作時にどこまで動作したかを確認するために必要な情報を出す
- API の結果が返ってきた
- 何らかのひとかたまりの処理が終了した，または開始した

### warn

- 例外をキャッチしたが，そのまま続行しても問題ない場合に使う
- optional な処理に失敗した
- 想定内のフォールバックを使った

### error

- 例外をキャッチしてそのまま続行できない場合に使う
- 処理を中断して終了処理に入るときに使う
- 必要な外部リソースに接続できなかった
- 想定外の失敗が起きた

## child logger

- request 単位
- job 単位
- worker 単位

のように，共通 metadata を束ねたい場合は `child` を使う．

```ts
const jobLogger = logger.child({ jobId, kind });
jobLogger.info("job started.");
```
