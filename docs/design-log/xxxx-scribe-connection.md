# Design Log xxxx

`scribe` 連携タスクの開始時点メモ．

## この段階の狙い

- `scribe` 連携をどの責務境界へ置くかを先に整理する
- 実装前に設定，secret，失敗モードの論点を固定する
- `scribe` 固有仕様を内部契約へ漏らさない方針を確認する

## 現時点の前提

- `scribe` 本体は `/home/office/src/github.com/t-ashula/scribe` にある Python 3.12+ / FastAPI 実装である
- `scribe` API は `POST /transcribe` と `GET /transcribe/{request_id}`，`POST /summarize` と `GET /summarize/{request_id}` を持つ
- `transcribe` は `audio/x-wav` upload を受け，Redis / RQ で非同期 job を処理し，結果は 24 時間 TTL で保持される
- `geshi` には `backend`, worker, CLI, source collector plugin という複数の呼び出し主体がある
- `scribe` 接続が source ごとに変わる設定なのか，アプリケーション全体で共有する運用設定なのかは，まだ明示されていない
- `/home/office/src/github.com/t-ashula/geshi/tmp/v0.3.0/packages/scribe-client` に TypeScript client の残骸がある

## client 残骸の観察

- `tmp/v0.3.0/packages/scribe-client` は `transcribe`, `getTranscription`, `summarize`, `getSummary` を持つ
- upload の multipart 組み立てや polling 処理は参考になる
- 一方で，既定 base URL は `http://localhost:8002` で，`scribe` README の起動例 `8000` と食い違う
- `getTranscription(..., false)` と `getSummary(..., false)` は `done` 以外を例外にしており，`pending` / `working` / `error` を値として扱えない
- 現行 `geshi` へ持ち込むなら，reference implementation として読み，API 差分と状態表現を見直したうえで再設計する方が安全である

## この段階で決めたいこと

- 最初の `scribe` 呼び出し主体をどこに置くか
- `scribe` の polling 型 job を `geshi` 側のどの job / state に対応づけるか
- `scribe` が返す情報のうち，`geshi` 内部で正本として保持するものは何か
- timeout, retry, circuit breaker 相当の失敗制御をどこで担うか
- 可観測性として何を log / metric に残すか
- test でどこまで fake / stub 化するか

## いったん避けること

- `scribe` SDK や API の具体 shape をそのまま内部型として定義すること
- `source` や `collector setting` へ credential や endpoint を直接入れること
- `tmp/v0.3.0/packages/scribe-client` を現行 API との差分確認なしに復活させること
- 複数 use case を同時に開くこと

## open questions

- `scribe` は `geshi` に対して transcript，metadata enrichment，検索補助，あるいは別種の機能のどれを提供するのか
- 呼び出しは同期 API と非同期 job のどちらが自然か
- `scribe` 側の rate limit や job model を `geshi` 側でどこまで吸収する必要があるか
- `scribe` 結果を DB へ永続化する場合，既存 data model へどの単位で反映するか
- source collector plugin から `scribe` を呼ぶ必要が本当にあるか
- `geshi` 側で音声形式変換を担う必要があるか
