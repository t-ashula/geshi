# Design Log xxxx

`scribe` 連携タスクの開始時点メモ．

## この段階の狙い

- `scribe` 連携をどの責務境界へ置くかを先に整理する
- 実装前に設定，secret，失敗モードの論点を固定する
- `scribe` 固有仕様を内部契約へ漏らさない方針を確認する

## 現時点の前提

- repository 内には `scribe` 専用の実装や文書はまだ存在しない
- `geshi` には `backend`, worker, CLI, source collector plugin という複数の呼び出し主体がある
- `scribe` 接続が source ごとに変わる設定なのか，アプリケーション全体で共有する運用設定なのかは，まだ明示されていない

## この段階で決めたいこと

- 最初の `scribe` 呼び出し主体をどこに置くか
- `scribe` が返す情報のうち，`geshi` 内部で正本として保持するものは何か
- timeout, retry, circuit breaker 相当の失敗制御をどこで担うか
- 可観測性として何を log / metric に残すか
- test でどこまで fake / stub 化するか

## いったん避けること

- `scribe` SDK や API の具体 shape をそのまま内部型として定義すること
- `source` や `collector setting` へ credential や endpoint を直接入れること
- 複数 use case を同時に開くこと

## open questions

- `scribe` は `geshi` に対して transcript，metadata enrichment，検索補助，あるいは別種の機能のどれを提供するのか
- 呼び出しは同期 API と非同期 job のどちらが自然か
- `scribe` 側の rate limit や job model を `geshi` 側でどこまで吸収する必要があるか
- `scribe` 結果を DB へ永続化する場合，既存 data model へどの単位で反映するか
- source collector plugin から `scribe` を呼ぶ必要が本当にあるか
