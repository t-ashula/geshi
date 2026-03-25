# 0023 job dispatch bridge

## 位置づけ

この文書は，ADR-0023 で Geshi 側 `job` と BullMQ 側 job の橋渡し方針を定めるにあたり，状態語彙と処理段階を整理するための Design log である．

## 整理したい論点

- Geshi 側 `job` にどの状態を持たせるか
- Geshi 側 `job` の作成と，BullMQ への投入をどう分離するか
- 実行開始条件を持つ job をどう扱うか
- BullMQ worker から Geshi 側 DB 更新をどこまで分離するか

## 現時点の整理

### 1. Geshi 側 `job` に状態語彙を持たせる

Geshi 側 `job` には，少なくとも次の状態を持たせる前提で整理する．

- `registered`
- `scheduled`
- `queued`
- `running`
- `cancelling`
- `succeeded`
- `failed`
- `cancelled`

この状態語彙は Geshi 側 model のものであり，BullMQ 側の state とは同一視しない．

状態遷移は，ADR 本文ではなく `docs/job.md` 側を正本として管理する．

### 2. job 作成直後には実行用 BullMQ job を直接 enqueue しない

backend で job を作成した時点では，

1. Geshi 側 `job` を DB に保存する
2. その `job.id` を引数とする `export job` を enqueue する

までを行う．

`export job` は，Geshi 側 `job` を読んで次を判断する．

- 即時実行できる job なら，実行用 BullMQ job を enqueue する
- 実行開始条件をまだ満たさない job なら，Geshi 側 `job` を `scheduled` に更新する

### 3. `scheduled` を拾う常駐処理を別に持つ

実行開始条件を持つ job については，橋渡し用 BullMQ job だけでは足りない．

- `scheduled` の Geshi 側 `job` を拾う
- 実行可能時刻や条件を確認する
- 必要な worker 数を調整する
- 実行用 BullMQ job を enqueue する

ための常駐処理を，`scheduler job` として別に持つ前提で整理する．

### 4. 実行中状態と progress は `update job` で反映する

BullMQ 側の実行開始や progress 変化は，`update job` で Geshi 側 `job` に反映する前提にする．

- `queued -> running` は，BullMQ 側の実行開始を受けた `update job` によって確定する
- progress の途中反映は，終端状態の書き戻しとは分けて扱う

### 5. 実行用 BullMQ worker から Geshi 側 DB 更新を直接行わない

実行用 BullMQ job は，Geshi 側 `job` とは切り離して扱う．

- 実行用 BullMQ worker は実際の処理に集中する
- 終了後は終端状態専用の `import job` を enqueue する
- `import job` が Geshi 側 `job` を `succeeded` / `failed` / `cancelled` などへ更新する

この形なら，実行用 worker と Geshi 側 DB 更新を強く結びつけずに済む．

### 6. cancel 要求は `cancelling` を経由させる

backend が cancel 要求を受けた場合は，

1. Geshi 側 `job` を `cancelling` に更新する
2. BullMQ 側へ cancel 要求を出す `cancel job` を enqueue する

という流れにする．

`cancel job` は，

- waiting / delayed の job を queue から除去する
- active の job には cancellation を要求する

役割を持つ．

ただし `cancelling` は，最終的に `cancelled` だけへ着地するとは限らない．

- `cancelling -> cancelled`
- `cancelling -> succeeded`
- `cancelling -> failed`

を許す前提で整理する．

## この整理の利点

- Geshi 側 `job` を API と履歴参照の基準にしやすい
- 即時実行 job と実行開始条件を持つ job を同じ枠組みで扱える
- BullMQ 側 job を実行単位として閉じ込めやすい
- 実行用 worker を DB 更新責務から分離できる
- `update` と `import` を分けることで，非終端更新と終端更新を分離できる
- cancel 要求と最終結果確定とを分けられる

## まだ残っている論点

- 親子 job や flow を Geshi 側 model にどこまで反映するか
- worker 数調整の具体実装をどこに置くか
- `update job` と `import job` にどういう payload を渡すか
