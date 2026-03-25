# 0021 backend job runtime selection

## 位置づけ

この文書は，ADR-0021 で backend の job 実行基盤を選定するにあたり，先に論点と候補を整理するための Design log である．

## この ADR で整理したいこと

- queue を採るかどうか
- scheduler をどう扱うか
- worker を backend とどう分けるか
- Geshi の `job` データモデルと，job 実行基盤の内部表現の関係をどう扱うか
- 将来の migration を過度に重くしないために，どこを抽象化しておくべきか

## 背景となる前提

- Geshi では，複数種別の長時間処理を job として扱う
- job の起動トリガや実行制御は backend に閉じたい
- 外部 scheduler は backend の API / CLI を起動するトリガに留めたい
- `job` は API 上で状態参照や履歴参照の resource として見せたい

## 主要な論点

### 1. Geshi の `job` と job 実行基盤側の job を同一視するか

ここが最も重要である．

- 既存の queue / worker 基盤を採ると，job 実行基盤側に独自の job 概念が入る
- Geshi 側にも API や履歴参照のための `job` モデルがある
- この 2 つを同一視しようとすると，job 実行基盤依存が強くなりやすい
- 完全に別物とすると，対応づけ層が必要になる

### 2. 既存基盤の楽さを取るか，自前実装の一貫性を取るか

- 既存基盤を使うと，queue，retry，lock，同時実行数制御，worker 管理が楽になる
- 一方で，Geshi の `job` モデルと job 実行基盤側モデルのずれが出る
- 自前実装だと model はきれいに合わせやすいが，実装と保守が重い

### 3. migration の重さをどう抑えるか

- job 実行基盤をあとで差し替えると，保存形式，job id，状態遷移，再試行の扱いが変わりやすい
- この差し替えコストを減らすには，job 実行基盤に依存する部分を backend 内部の adapter に閉じる必要がある

### 4. 可変的な同時実行数を持つ job を固定前提にできるか

- 実行時刻や対象数によって，同時刻に必要な実行数が大きく変わる job がありうる
- そのため，最初から固定数の worker だけを前提にする job 実行基盤は相性が悪い
- 少なくともこうした job については，必要に応じて実行数を増やせるか，worker 数の増減を運用側で吸収しやすい仕組みが必要である
- 逆に，固定数 worker でしか運用できない前提の基盤は，この時点で有力候補にしにくい

可変的な同時実行数を持つ job の要件から導かれる job 実行基盤側要件としては，少なくとも次が必要になる．

- 任意のタイミングで worker を追加できる
- 任意のタイミングで worker を減らしても，既存 worker や他 job に破壊的影響を出しにくい
- 複数 worker が同じ queue に動的に参加できる
- job 取得が排他的である
- worker 消失時に job を再取得または再実行できる
- worker が強いメモリ内状態に依存せず，増減しやすい

## 候補

### Node.js 向け job 実行基盤候補

比較対象として，少なくとも次を候補に置ける．

- `BullMQ`
  - Redis ベースの job 実行基盤
  - Node.js ではかなり定番寄り
  - queue と worker を分けやすいが，Geshi の `job` とは別の job 実行基盤側 job を持つ前提になる
  - worker は `new Worker(queueName, handler)` を起動する Node.js プロセスとして持つ
- `pg-boss`
  - PostgreSQL ベースの job 実行基盤
  - Redis を増やさずに済む可能性がある
  - DB 寄りで扱いやすいが，録画系の柔軟な worker 運用との相性は比較が必要
  - worker は `boss.start()` の後に `boss.work(queue, handler)` を登録する Node.js プロセスとして持つ
- `Graphile Worker`
  - PostgreSQL ベースの job runner
  - queue と worker を DB 側に寄せやすい
  - GraphQL 前提ではないが，Geshi の用途に合うかは少し検討が必要
  - worker は `graphile-worker` CLI か `run()` を使う Node.js プロセスとして起動する
  - task 実装は `tasks/` 配下のファイルか task executor 関数で持つ
- `Agenda`
  - MongoDB ベースの job scheduler / runner
  - 今の Geshi では MongoDB 前提を増やす理由が弱い
- `Bree`
  - cron / worker thread 寄りの task runner
  - queue 基盤というよりスケジュール実行寄りで，Geshi の `job` 管理には少し弱い
  - `new Bree({ jobs: [...] })` を起動するプロセスで，job ごとに worker thread / child process を使う
- `Temporal`
  - workflow engine としては強い
  - ただし Geshi の現段階ではかなり重い

### 候補ごとの worker 起動モデルの見方

現時点で重要なのは，「worker 数を自動で増減してくれるか」ではなく，必要に応じて worker プロセスを追加起動しやすい job 実行基盤かどうかである．

- `BullMQ`
  - `node some-worker.js` 的に専用 worker プロセスを増やしやすい
  - 追加 worker は同じ queue に参加できる
- `pg-boss`
  - `node some-worker.js` 的に専用 worker プロセスを増やしやすい
  - `boss.work()` を登録したプロセスを必要数増やす運用になる
- `Graphile Worker`
  - `graphile-worker ...` や `run()` を起動するプロセスを増やす形になる
  - CLI / library どちらでも専用 worker プロセスとして扱える
- `Bree`
  - queue worker を増やすというより，スケジューラ本体が各 job 用 worker thread を起動する発想である
  - Geshi の `job` resource と結びつけるには少し距離がある

この観点では，少なくとも `BullMQ`，`pg-boss`，`Graphile Worker` は，「必要に応じて単発の Node.js worker プロセスを追加起動する」運用が可能であり，可変的な同時実行数を持つ job の前提と必ずしも矛盾しない．

### 候補 1. BullMQ のような既存 queue / worker 基盤を採用する

概要:

- queue，worker，retry，同時実行数制御は既存基盤に任せる
- Geshi の `job` モデルとは別に，runtime 側 job を持つ
- 両者の対応づけは adapter 層で吸収する

利点:

- 実行基盤を自前で持たずに済む
- retry や worker 管理がかなり楽になる
- 長時間処理を早く実装しやすい

懸念:

- Geshi の `job` モデルと二重化する
- Redis など追加インフラが必要になりやすい
- runtime 差し替え時に adapter と保存形式の migration が必要になる

### 候補 2. queue / worker 基盤は採るが，Geshi の `job` モデルを runtime 側に寄せる

概要:

- `job` の状態や識別子を runtime 側にかなり寄せて設計する
- アプリ側 model を薄くして，実行基盤とのずれを減らす

利点:

- 二重管理は減る
- 実装初期は素直に進みやすい

懸念:

- framework 依存が強くなる
- runtime 変更時の migration がかなり重くなる
- API 上の `job` resource が runtime 都合に引っ張られやすい

### 候補 3. job runtime を自前で実装する

概要:

- Geshi の `job` モデルをそのまま実行基盤と結びつける
- queue，retry，lock，同時実行数制御なども自前で持つ

利点:

- model の一貫性は最も高い
- API と永続化と runtime のずれを減らしやすい

懸念:

- 実装と保守が重い
- 障害時の挙動や retry 制御を自前で担保する必要がある
- 今の段階では過剰投資になりやすい

## 現時点の見立て

現時点では，候補 1 が最も現実的である．

つまり，

- 既存の queue / worker 基盤は利用する
- Geshi の `job` モデルとは別物として扱う
- 対応づけは adapter 層で吸収する

という方向である．

その代わり，後の migration を軽くするために，少なくとも次は守る必要がある．

- runtime 固有の job id をそのまま API の中心にしない
- API 上の `job` resource は Geshi 側 model を基準にする
- queue 基盤への依存は backend 内部の境界に閉じる
- retry や状態遷移の観測に必要な情報は，アプリ側でも保持できるようにする

## BullMQ に寄る理由

現時点では，次の要件をまとめて満たしやすい候補として `BullMQ` が優勢である．

- 既存の Node.js job 実行基盤として十分に枯れている
- 専用 worker プロセスを `node some-worker.js` 的に追加起動しやすい
- 進捗更新と event を扱いやすい
- 親子 job や fan-out / fan-in を flow として扱える
- 子 job 単位の retry を job 実行基盤側で持てる

一方で `pg-boss` は，

- PostgreSQL に寄せられる点は魅力だが
- 親子関係や進捗集約を Geshi 側で自前実装する比重が高くなりやすい

ため，現時点では `BullMQ` に比べて優先度が下がる．

ただし，まだ未決定の論点がある．

- Geshi 上の `job` モデルと BullMQ 側の job をどう対応づけるか
- API 上の `job` resource をどこまでアプリ側 model として持つか
- BullMQ 固有の状態や id を，どこまで Geshi 側に露出させるか

## Geshi `job` と BullMQ job の対応づけ案

現時点で最も素直なのは，Geshi 側 `job` と BullMQ 側 job を別物として持ち，対応づける案である．

### 基本方針

- API や履歴参照の基準になるのは Geshi 側 `job`
- 実際の queue / worker job 実行基盤の基準になるのは BullMQ 側 job
- 両者は BullMQ job id などの対応情報で結びつける

### Geshi 側 `job` に持ちたいもの

- 何の job か
- どの queue に流すか
- 対象 resource は何か
- 入力パラメータは何か
- 現在状態は何か
- 対応する BullMQ job id は何か

### enqueue の流れ

厳密な同一トランザクションは，DB と Redis をまたぐため前提にしない．

そのため，結果整合性を前提に，次の流れを採るのが自然である．

1. Geshi 側 `job` を DB に保存する
2. 初期状態は `pending_dispatch` のように扱う
3. その後 BullMQ に `queue.add(...)` する
4. 成功したら Geshi 側 `job` に BullMQ job id を保存し，状態を `queued` にする
5. 失敗したら `dispatch_failed` のような状態にする

### この案の利点

- API は Geshi 側 `job` を一貫して見ればよい
- BullMQ job は backend 内部の job 実行基盤実装として閉じ込めやすい
- enqueue 失敗時も Geshi 側に履歴が残る
- 再送や再試行の起点を Geshi 側 `job` で持ちやすい

### まだ未決定の点

- Geshi 側 `job.status` の語彙をどこまで BullMQ の状態に寄せるか
- BullMQ の progress や event を Geshi 側 `job` にどう反映するか
- 親子 job を Geshi 側でも表現するか，BullMQ flow に閉じるか

## 全 job を別段階投入に統一する案

当初は一部の job だけを特別扱いし，Geshi 側 `job` と BullMQ job の橋渡しを考えていたが，現時点では全 job を同じ方式で扱う方が自然である．

### 直接 `queue.add()` しない理由

- `queue.add()` 直後に空いている worker が job を実行してしまうと，実行開始条件を満たす前に走る可能性がある
- 一部の job は，実行時刻や必要な worker 数を考慮する必要がある
- 一部の job だけ即 enqueue を避けると，その job だけ別経路になってしまう
- `crawl`，`transcribe`，検索更新も含めて，「Geshi 側 `job` が正本で，job 実行基盤への投入は別段階」とした方が状態管理が揃う

### 共通の 3 層

現時点では，全 job について少なくとも次の 3 層に分かれると考えるのが自然である．

- Geshi 側 `job`
  - 予約や対象，状態の正本
- 別段階の投入処理
  - 投入対象を監視する
  - job 種別ごとの投入条件を判断する
  - BullMQ への投入可否を決める
- BullMQ job
  - 実際の実行単位

### この方式の見え方

- 実行時刻を待つ必要がある job は，その条件を満たした時点で投入する
- 依存関係を持つ job は，前段の完了を見て投入する
- ほぼ即時実行でよい job も，同じ投入段階を通して enqueue する

この前提だと，BullMQ は「Geshi 全体の job 正本」ではなく，「共通の job 実行基盤」として使う方が自然である．

### 3層方式の利点

- Geshi 側 `job` を常に API と履歴参照の基準にできる
- job 種別ごとに投入条件だけを変えればよい
- 一部の job だけ特別な経路を持たずに済む
- BullMQ 側との対応づけと event 反映の考え方を統一できる

## 次に ADR 本文へ戻すときの論点

- queue / worker 基盤を採るかどうか
- job 実行基盤と Geshi `job` の関係をどう定義するか
- adapter 層を必須とするか
- Redis など追加インフラを許容するか
- scheduler を job 実行基盤側に持たせるか，外部トリガ + backend 制御に留めるか
- 固定 worker 数前提の job 実行基盤を許容するか
