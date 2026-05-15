# ADR-0063: transcript chunk の外部 ASR 通信は timeout を持ち終状態へ収束させる

## ステータス

決定

## 範囲

`api backend`, `job`, `operations`

## コンテキスト

- [ADR-0044] と [ADR-0046] により，transcript は backend job から外部 ASR を request / poll する構成を採っている
- 現行の `transcript-chunk` job は，job 開始時点で `jobs.status=running` と `transcript_chunks.status=running` を保存してから外部 ASR へ進む
- 外部 ASR 側が `pending` / `working` を返し続ける場合の polling timeout 方針は `ADR-0046` で整理済みだが，HTTP request 自体が返らない場合の扱いは実装上明確ではなかった
- 実際に `POST /transcribe` または `GET /transcribe/{request_id}` がぶら下がると，worker process 自体は生きていても chunk job が await したまま戻らず，`running` のまま取り残される
- この状態では transcript 本体も `running` に張り付き，既存の retry 導線に乗らない
- worker 再起動だけでは，`running` に取り残された transcript chunk を自動で再投入しない実装になっている

## 決定

- `transcript-chunk` から外部 ASR へ出す HTTP request は，request 単位の timeout を必須とする
- timeout は polling loop の外側に置き，`POST` と `GET` の両方で `fetch()` 自体が返らない状態を検出できるようにする
- request timeout が発生した chunk は，`transcript_chunks.status=timed_out` として永続化する
- request timeout が発生した job row は，`jobs.status=failed` とし，failure message に timeout 理由を残す
- timeout を含む外部 ASR 通信 failure は，chunk の終状態更新後に transcript 集約処理を進める
- 集約時に `queued` / `running` の chunk が残っていなければ，1 つでも `failed` または `timed_out` がある transcript は `failed` に収束させる
- timeout の分類は adapter 境界で行ってよいが，呼び出し側は少なくとも「retry 可能な外部通信 failure として chunk を終状態へ落とす」責務を持つ
- 今回は `scribe` client に timeout を追加するが，この方針は将来の transcript provider にも適用する

## 影響

- worker process が生きていても transcript chunk が永遠に `running` へ張り付く状態を減らせる
- transcript 本体が `running` のまま retry 不可能になる事故を減らせる
- timeout が `failed` / `timed_out` として永続化されるため，UI や運用時の原因把握がしやすくなる
- provider 側の一時不調で transcript 全体が `failed` へ収束するため，partial success は依然として扱わない
- worker 再起動だけで自動復旧するわけではなく，retry 導線または別途 recovery 方針は引き続き必要である

## 代替案

- 外部 ASR request に HTTP timeout を設けず，polling loop 側の timeout だけに任せる
  - `fetch()` 自体が返らない場合に終状態へ収束できないため採らない
- timeout 時も chunk を `running` のまま残し，worker 再起動後の再開に期待する
  - 現行実装では自動再開されず，retry 導線も塞がるため採らない
- timeout を adapter 側だけで握りつぶし，job / transcript state には反映しない
  - 外部通信 failure が永続状態へ反映されず，運用上観測できないため採らない

## 参考資料

- [ADR-0044] ADR-0044: scribe 連携は adapter 境界に閉じ込める
- [ADR-0046] ADR-0046: transcript 要求と scribe polling は backend job で扱う

[ADR-0044]: ./0044-scribe-integration-boundary.md
[ADR-0046]: ./0046-transcript-job-orchestration.md
