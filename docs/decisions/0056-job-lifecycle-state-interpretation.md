# ADR-0056: job lifecycle を `planned` を含む状態語彙へ再定義する

## ステータス

決定

## 範囲

`api backend`, `job`, `worker`, `db`

## コンテキスト

- `jobs.status` は現在 `queued` / `running` / `succeeded` / `failed` の 4 値を持つ
- しかし `record-content` では，`observe-source` が job row を作った時点ではまだ実 queue へ投入せず，後から `recording-scheduler` が queue へ流す
- そのため現在の `queued` は，少なくとも次の 2 つの意味を兼ねている
  - geshi DB 上では予約済みだが，まだ実 queue へ投入していない
  - 実 queue へ投入済みだが，worker がまだ着手していない
- 一方で `observe-source` や `acquire-content` などは，job row 作成直後に queue へ投入するため，上記 2 状態の差が見えにくい
- この曖昧さのままでは，repository query，UI 表示，scheduler の対象選定，および将来の状態追加議論が局所最適になりやすい

## 決定

- `jobs.status` に `planned` を追加し，job lifecycle を `planned` / `queued` / `running` / `succeeded` / `failed` へ再定義する
- 各状態の意味は次のとおりとする
  - `planned`
    - geshi DB 上では予約済みだが，まだ実 queue へ投入していない
    - `queue_job_id` は `null`
  - `queued`
    - 実 queue へ投入済みだが，worker はまだ `running` に遷移していない
    - `queue_job_id` は `not null`
  - `running`
    - worker が担当 job を取得して実行中である
    - 原則として `queue_job_id` は `not null`
  - `succeeded` / `failed`
    - 終端状態
- `recording-scheduler` が対象にするのは，「未投入予約」である `planned` な `record-content` job とする
- `observe-source` や `acquire-content` のように即時 enqueue する job も，job row 作成時はいったん `planned` とし，queue へ投入できたら `queued` へ遷移させる
- `queue_job_id` は補助情報ではなく，`planned` と `queued` を区別する整合条件の一部として扱う
- repository / service / document では，`queued` という語を「実 queue へ投入済み」の意味に限定する
- `jobs.status` の DB enum，repository 型，API 表現，および query は上記語彙へ追従させる
- 上記に伴い，`status = queued` かつ `queue_job_id is null` の row は移行後は作らない
- 将来 queue 非依存 job を導入する可能性は残すが，少なくとも現時点の worker orchestration 対象 job では上記整合条件を守る

## 影響

- migration が必要になる
  - `jobs.status` enum に `planned` を追加する
  - 既存の `status = queued and queue_job_id is null` を `planned` へ移す
- repository API は，`planned` と `queued` を明示的に使い分ける命名へ寄せる必要がある
- `recording-scheduler` や重複判定は，`queued` 全体ではなく `planned` / `queued` を区別して query する必要がある
- UI や API 表示で job 状態を出すとき，「予約済み」と「投入済み待機中」をそのまま区別できる

## 代替案

- `status` は増やさず，`queued` の内部を `queue_job_id` で論理解釈する
  - 当座の説明としては可能だが，repository query，UI 表示，scheduler の対象選定で毎回補助条件が必要になり，状態語彙として弱いため採らない
- `queued` は「実 queue に投入済み」だけを表すと定義し，未投入予約は別テーブルへ逃がす
  - 録画予約だけのために別主体を導入すると，job 正本が分散し，ADR-0054 の `jobs.payload` 正本化とも噛み合いにくいため採らない
- `queue_job_id` を補助情報とみなし，状態解釈には使わない
  - 現実に未投入予約と投入済み待機中を区別する情報が失われ，`recording-scheduler` の対象定義が不自然になるため採らない

## 参考資料

- [ADR-0010] ADR-0010: source クロールの実行基盤として job queue を導入する
- [ADR-0048] ADR-0048: 録画系 acquire は専用 job orchestration と複数 worker 前提で扱う
- [ADR-0054] ADR-0054: job の実行入力は `jobs.payload` に保持する
- [Job Queue] Job Queue

[ADR-0010]: ./0010-source-crawl-job-queue.md
[ADR-0048]: ./0048-recording-job-orchestration.md
[ADR-0054]: ./0054-job-payload-owned-by-job-row.md
[Job Queue]: ../job-queue.md
