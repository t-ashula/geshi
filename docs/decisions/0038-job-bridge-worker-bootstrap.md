# ADR-0038: job bridge worker の責務を再整理する

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- [adr-0033] で，Geshi 側 `job` model と BullMQ bridge の意味論を整理した
- しかし [adr-0033] と [job-model] の整理だけでは，
  - `export job` が `runtimeJobId` をどう反映するか
  - `scheduled` job を誰が再度拾うか
  - 録画系の delayed 実行で必要な worker 数調整を誰が担うか
  が十分に閉じていなかった
- 特に，`scheduler job` を外した整理では，`scheduled` job を再判定して runtime に投入する責務が曖昧になった
‐ `export job` が runtime 側で非同期なのにもかかわらず同期的で readonly な振る舞いかのようになった
- したがって，`export job` / `scheduler job` / `update job` / `import job` の責務をここでやり直して整理する

## 決定

- backend が `createJob` を行う時は，まず Geshi 側 `job` と初期 `job event` を保存し，`export job` を enqueue する
- `export job` は job id を input に取り，backend から対象の Geshi 側 `job` を取得する
- `export job` は `registered` 状態の job を対象にし，
  - 実行開始条件をまだ満たさない job について `scheduled` の `job event` を記録する
  - 実行開始条件を満たした job について runtime queue へ functional job を enqueue し，`queued` の `job event` を `runtimeJobId` 付きで記録する

- [adr-0033] で整理した `scheduler job` を bridge worker として復活させる
- `scheduler job` は定期起動される
- `scheduler job` は current status が `scheduled` の Geshi 側 `job` を対象にする
- `scheduler job` は，実行開始条件を満たした `scheduled` job について
  - 必要な functional job の worker 数を調整する
  - runtime queue へ functional job を enqueue し，`queued` の `job event` を `runtimeJobId` 付きで記録する
- `scheduler job` の責務はここで決めるが，実装は後続に回す

- `update job` は，functional job の worker wrapper から渡された進行中変化を Geshi 側 `job event` に追記する責務に留める
- `import job` は，`importing` 反映，backend write API 呼び出し，終端状態反映を担う
- functional job の worker wrapper は
  - 実行開始時に `update job` へ `running` を渡す
  - 正常終了時に `import job` へ `result + importInstructions` を渡す
  - 例外終了時に `import job` へ `jobStatus = failed` と `failureStage = runtime` を渡す

## 影響

- `export job` は `registered` の初回判定に責務を絞れる
- delayed 実行の再判定と worker 数調整を `scheduler job` に戻せる
- `runtimeJobId` を知る bridge worker が `queued` 反映を起動する前提が明確になる
- `update job` の hook を BullMQ 固有 event に依存させず，runtime 差し替え時の前提を軽くできる
- `job.md` の処理段階と bridge worker の実装スコープを揃えやすくなる

## 代替案

- `scheduler job` を復活させず，`export job` を定期起動して `registered` / `scheduled` の両方を処理する
  - `registered` の初回判定と `scheduled` の再判定が混ざり，録画系で必要な worker 数調整の責務も曖昧になる
- `scheduler job` は `scheduled` job を見つけた後，`export job(geshiJobId)` を enqueue する
  - `scheduler job` が担うべき worker 数調整と実行開始処理を `export job` に逃がしてしまう

## 備考

### 用語

- backend: geshi 本体
- runtime: bullmq などの job 実行系
- bridge worker/job : backend と runtime とをつなげる runtime 側の job
- functional job : geshi の機能として必要な job

## 参考資料

- [adr-0033] ADR-0033 job model の見直し
- [adr-0037] ADR-0037 job と job event を PostgreSQL で実装する
- [job-model] docs/job.md
- [design-log-0038] Design log 0038 job bridge worker bootstrap

[adr-0033]: ./0033-job-model-review.md
[adr-0037]: ./0037-job-store-bootstrap.md
[job-model]: ../job.md
[design-log-0038]: ../design-log/0038-job-bridge-worker-bootstrap.md
