# ADR-0023: Geshi 側 job から BullMQ への橋渡し方針を定める

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- ADR-0021 により，backend の job 実行基盤として `BullMQ` を採用した
- ADR-0022 により，BullMQ と Redis の最小 bootstrap は整った
- ただし現時点では，Geshi 側 `job` と BullMQ 側 job はまだ接続されていない
- 次に進むには，Geshi 側 `job` をどの段階で BullMQ に投入し，状態や識別子をどう対応づけるかを整理したい

## 決定

- Geshi 側 `job` を，BullMQ 側 job とは別の model として持つ
- Geshi 側 `job` の状態語彙と状態遷移は [job-model] で管理する
- backend で Geshi 側 `job` を作成した後，BullMQ 側への投入や状態反映を行うための橋渡し用 job を複数用意する
- Geshi 側 `job` の状態更新は，BullMQ worker が直接 DB を更新するのではなく，橋渡し用 job を経由して行う
- 各橋渡し用 job に渡す情報は，その動作に必要十分なものに限定する
- 各橋渡し用 job は冪等に実行できるようにする
- `running` を含む具体的な状態遷移は，`docs/job.md` に従う

## 影響

- Geshi 側 `job` と BullMQ 側 job の責務分離を，実装前に明文化できる
- backend で job を作成する段階と，BullMQ へ投入する段階とを分けられる
- 実行開始条件を持つ job と即時実行 job とを，同じ枠組みで扱える
- 実行用 BullMQ worker を，Geshi 側 DB 更新から切り離して保ちやすくなる
- 橋渡し用 job の payload を絞ることで，各処理の責務と依存を増やしすぎずに保ちやすくなる
- 重複実行や event の再配送があっても，Geshi 側 `job` を壊しにくくなる
- 後続の job API，status 語彙，progress 反映の整理を進めやすくなる

## 代替案

- Geshi 側 `job` を保存した直後に，そのまま実行用 BullMQ job を `queue.add()` する
  - 実行開始条件を持つ job を扱いにくく，保存と投入を分離しにくい
- 実行用 BullMQ worker が直接 Geshi 側 DB を更新する
  - 実行用 worker と Geshi 側 model 更新が強く結びつき，切り離しにくい
- Geshi 側 `job` と BullMQ 側 job を同一視する
  - BullMQ 依存が強くなり，後続の migration が重くなりやすい

## 備考

- 本 ADR は BullMQ bootstrap の次段として，Geshi 側 `job` との橋渡しを対象にする
- queue / worker の package 導入自体は ADR-0022 で完了している前提とする
- progress の payload，親子 job の反映，worker 数調整の具体実装は後続で詰める

## 参考資料

- [adr-0021] ADR-0021 backend のジョブ実行基盤を選定する
- [adr-0022] ADR-0022 BullMQ による job 実行基盤の初期実装を開始する
- [job-model] docs/job.md
- [design-log-0023] Design log 0023 job dispatch bridge

[adr-0021]: ./0021-backend-job-runtime-selection.md
[adr-0022]: ./0022-bullmq-bootstrap.md
[job-model]: ../job.md
[design-log-0023]: ../design-log/0023-job-dispatch-bridge.md
