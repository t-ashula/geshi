# ADR-0072: 途中で停止した source crawl を検知して回復する

## ステータス

決定

## 範囲

`api backend`, `job`, `worker`, `operations`

## コンテキスト

- `observe-source` job が `running` のまま残り，その後の定期クロール投入が止まった
- 対象 `observe-source` job は geshi 側 `jobs.status=running` だが，対応する `queue_job_id` は `pgboss.job` に存在しない
- 定期クロール job 自体は成功し続けていたため，障害は scheduler process の停止ではなく，source 単位の crawl が途中状態に閉じ込められたことにある
- 現行の重複抑止は `jobs.status in ('planned', 'queued', 'running')` を広く active とみなすため，取り残された `running` job がある source を再投入しない
- 一方で，queue に存在しないことだけを根拠に job を失敗へ落とすと，投入途中や未投入予約など正常な過渡状態を壊す
- したがって今回の設計対象は，queue-backed job 全般の一般回収ではなく，source crawl が途中で死んだことを検知する方法と，検知後に crawl を再開できる状態へ戻す方法に限定する

## 決定

### 途中停止の検知

- 検知対象は，periodic crawl 対象の source に紐づく `observe-source` job とする
- source crawl が途中で停止した疑いは，次の条件で検知する
  - source の periodic crawl が有効である
  - その source の最新 `observe-source` job が `running` のまま残っている
  - その job が `queue_job_id` を持つ
  - 対応する queue job が `pgboss.job` 上の `created` / `retry` / `active` に存在しない
  - その job より新しい terminal な `observe-source` job が存在しない
- この検知は「この source の crawl が止まっている」という source 単位の異常検知であり，即座に job を failed にしてよいという判定とは分ける
- `planned` job は，この検知の根拠に使わない
- `queued` job は，worker takeover が確認できていないため，この検知の主対象にしない

### リカバリ

- 検知された source については，取り残された `running observe-source` job を終状態へ収束させたうえで，新しい `observe-source` job を投入可能にする
- 回収時は，対象 job を `failed` にし，`retryable=false` とする
- failure message には「source crawl が queue 上に存在しない running job により停止していたため回収した」ことが分かる内容を残す
- job metadata には cleanup reason, cleanedUpAt, sourceId, queueJobId, detectedBy を残す
- 回収対象は，検知条件を満たす最新 `observe-source` job に限定する
- `acquire-content` など follow-up job の回収は，source crawl の再開に必要な場合だけ別条件で扱う
- source crawl の再開は次回の source crawl scheduler に任せ，回収処理内では `observe-source` を即時 enqueue しない
- 回収処理は `stale source crawl reconciliation` として切り出し，scheduler は source 選定前にそれを呼び出す
- 古い `running` job を残したまま新規 job だけを投入することは避ける

## 影響

- 「periodic crawl は動いているが，特定 source だけ再投入されない」状態を検知できる
- 検知と回収を source crawl に限定するため，queue-backed job 全般へ雑な自動回収規則を広げずに済む
- `planned` や `queued` の過渡状態を誤って failed 化しにくい
- `running` job を failed に落とすには，queue 不在だけでなく，source 単位で crawl が止まっていることと十分な経過時間を確認する必要がある
- 回収後の再投入は次回 scheduler tick まで待つため，即時復旧ではなく安全な再開を優先する
- cleanup metadata が残るため，後から通常の worker failure ではなく stale source crawl recovery だったことを追える

## 代替案

- queue に存在しない `queued` / `running` job を一律 failed にする
  - source crawl の停止検知より範囲が広く，正常な投入途中や worker takeover 前の状態を壊しうるため採らない
- heartbeat を追加して worker 生存を定期更新する
  - worker 実装に timer と liveness 管理を持ち込み，今回の source crawl 回復に対して設計が重いため採らない
- periodic crawl の重複抑止だけを緩め，古い `running` job を残したまま新規 observe を投入する
  - 古い途中状態が残り続け，後続の運用判断や UI 表示を悪化させるため採らない
- 手動 SQL で都度 `failed` に直す
  - 今回の復旧には使えるが，再発検知と通常運用の仕組みにならないため採らない

## 参考資料

- [ADR-0010] ADR-0010: source クロールの実行基盤として job queue を導入する
- [ADR-0029] ADR-0029: 定期クロール job は source 設定を走査して observe-source を投入する
- [ADR-0054] ADR-0054: job の実行入力は `jobs.payload` に保持する
- [ADR-0056] ADR-0056: job lifecycle を `planned` を含む状態語彙へ再定義する
- [design-log-0072] Design Log 0072

[ADR-0010]: ./0010-source-crawl-job-queue.md
[ADR-0029]: ./0029-periodic-source-crawl-scheduling.md
[ADR-0054]: ./0054-job-payload-owned-by-job-row.md
[ADR-0056]: ./0056-job-lifecycle-state-interpretation.md
[design-log-0072]: ../design-log/0072-missing-queue-job-reconciliation.md
