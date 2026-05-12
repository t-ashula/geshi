# ADR-0054: job の実行入力は `jobs.payload` に保持する

## ステータス

決定

## 範囲

`api backend`, `job`, `worker`, `db`

## コンテキスト

- `jobs` は geshi 側で job の状態，実行履歴，失敗理由，queue job id を保持する主体である
- 一方で，job が実際に何を実行するために作られたかを表す payload は `jobs` row に一貫して保存されていなかった
- `acquire-content` など一部の job は，payload を pg-boss に渡すだけで，geshi DB の `jobs` row からは復元できなかった
- `record-content` は scheduler が後から queue へ投入する都合で，例外的に `metadata.core.payload` に payload を保存していた
- しかし `metadata` は worker が `replaceMetadata()` で更新する可変領域であり，そこに実行入力の正本を置くと，後から何を実行する job だったか分からなくなる
- また `jobs.source_id` は一部の source 起点 job を探すための派生情報だったが，payload に source 情報が含まれる job では二重管理になっていた
- ADR-0053 のように同じ対象に対する重複 job を制御するには，job が持つ実行入力を安定して参照できる必要がある

## 決定

- `jobs` table に `payload jsonb not null default '{}'::jsonb` を持たせる
- `payload` は job 作成時点の実行入力を表す正本とする
- `metadata` は cleanup 理由，plugin 引数，進捗，実行結果補助など，job の実行中または実行後に変わりうる補助情報に限定する
- `jobs.kind` は job / queue の種類を表す識別子として扱う
- job の種類ごとの payload 構造を前提にした read API や query は，`jobs.kind` と `jobs.payload` の組み合わせを根拠にしてよい
- `record-content` の queue payload は `metadata.core.payload` ではなく `jobs.payload` に保存する
- `recording-scheduler` は `jobs.payload` から `record-content` の enqueue payload を復元する
- `jobs.source_id` は job row の正規カラムから外す
- source 起点 job の source id が必要な場合は，`kind = 'observe-source'` の `payload.source.id` を参照する

## 影響

- `JobRepository.createJob()` は payload を受け取り，`jobs.payload` に保存する
- `JobListItem` は `payload` を含む
- job 詳細 API は，metadata とは別に payload を返す
- `record-content` の重複判定は `metadata.core.payload.asset.id` ではなく `jobs.payload.asset.id` を読む
- `observe-source` の active / latest 判定は `jobs.source_id` ではなく `jobs.payload.source.id` を読む
- 既存の job 作成箇所は，作成時点で queue payload が分かる場合に `payload` を保存する必要がある

## 代替案

- 引き続き `metadata.core.payload` に実行入力を保存する
  - metadata は可変領域なので，実行入力の監査性が弱くなるため採らない
- job 種別ごとに必要な列を `jobs` に増やす
  - `record-content` や `observe-source` だけなら単純だが，job 種別が増えるほど sparse な列が増えるため採らない
- `source_id` のような派生列を追加し続ける
  - payload と二重管理になり，どちらを正とするかが曖昧になるため採らない
- payload は pg-boss 側だけに保存する
  - geshi DB から job の実行入力を復元できず，queue 実装への依存も強くなるため採らない

## 参考資料

- [ADR-0053] ADR-0053: 同じ asset に対する同種 job の重複生成を許容する条件を明示する

[ADR-0053]: ./0053-follow-up-job-creation-from-observed-assets.md
