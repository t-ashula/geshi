# job

## 概要

この文書は，Geshi における `job` model の仕様を表したものである．

Geshi 側 `job` の状態語彙，状態遷移，実行基盤（BullMQ）側との関係を，ここで規定する．

## 運用

- `job` model の通常の更新は，この文書に対して行う
- `job` model の大きな前提や位置づけを変更する場合は，新しい ADR で扱う
- この文書は概念 model と処理段階を扱うものであり，DB schema や BullMQ 実装そのものは直接規定しない

## 基本方針

- Geshi 側 `job` は，API と履歴参照の基準になる model として扱う
- BullMQ 側 job は，job 実行基盤上の実行単位として扱う
- Geshi 側 `job` と BullMQ 側 job は同一視しない
- Geshi 側 `job` 本体は immutable に近い形で扱う
- `job` 本体には job の定義に属する情報だけを持たせる
- 状態や実行基盤側との対応情報のような変化しうる情報は `job event` 側で扱う
- Geshi 側 `job` の保存と，BullMQ への投入は分離して扱う
- 橋渡し用 job は，重複実行されても不整合を起こしにくいように冪等に扱う

## model

### `job`

Geshi 側 `job` は，少なくとも次のような定義情報を持つ．

- `id`
- `kind`
- `payload`
- `createdAt`
- `runAfter`

`payload` は，その job の実行入力を表す JSON 文字列とする．

どのような shape の JSON かは，`kind` に対応する job 実装側で解釈する．

### `job event`

変化しうる情報は `job event` として積み上げる．

- `jobId`
- `runtimeJobId`
- `occurredAt`
- `status`
- `failureStage`
- `note`

`runtimeJobId` は実行基盤側で付与される識別子であり，未割当の段階では `null` を取りうる．

`failureStage` は，失敗がどの段階で起きたかを表すための欄であり，通常は `null` を取りうる．

少なくとも次のような値を取りうる．

- `runtime`
- `import`

`note` は短い補足情報のための欄とし，

- 何をしているか
- どこまで進んだか
- なぜ止まったかの短い要約

を入れる．

一方で，

- スタックトレース
- 詳細な障害情報

は通常のログ側に記録し，`note` には入れない．

## 現在状態

- API で返す現在状態は `job event` の集約で得る
- `job` 本体には current status や progress を持たせない
- 集約結果を view として持つかどうかは実装の問題として，この文書では規定しない

## 状態語彙

Geshi 側 `job` は，少なくとも次の状態を持つ．

- `registered`
- `scheduled`
- `queued`
- `running`
- `importing`
- `succeeded`
- `failed`

## 状態遷移

Geshi 側 `job` の状態遷移は，少なくとも次に限定する．

- `registered -> queued`
- `registered -> scheduled`
- `registered -> failed`
- `scheduled -> queued`
- `queued -> running`
- `running -> importing`
- `importing -> succeeded`
- `importing -> failed`

`succeeded / failed` は終端状態とし，終端状態から他状態へは遷移させない．

```mermaid
stateDiagram-v2
  [*] --> registered

  registered --> queued
  registered --> scheduled
  registered --> failed

  scheduled --> queued

  queued --> running

  running --> importing

  importing --> succeeded
  importing --> failed

  succeeded --> [*]
  failed --> [*]
```

## 処理段階

### 1. job を登録する

- backend で job を作成したときは，まず Geshi 側 `job` を永続化する
- その後，Geshi 側 `job.id` を引数とする `export job` を enqueue する

### 2. BullMQ への投入可否を判断する

`export job` は，Geshi 側 `job` を読んで次を判断する．

- 即時実行できる job なら，実行用 BullMQ job を enqueue する
- 実行開始条件をまだ満たさない job なら，Geshi 側 `job` を `scheduled` に更新する

BullMQ 側へ渡す raw data は，少なくとも次の形とする．

```ts
{
  context: {
    geshiJobId: string,
  },
  payload: unknown,
}
```

ここで `payload` は，`JSON.parse(job.payload)` した実行入力である．

### 3. 実行開始条件を満たした job を拾う

- `scheduled` の Geshi 側 `job` は，`export job` が実行開始条件を満たした時点で再度拾う
- `export job` が，worker 数の調整と実行用 BullMQ job の enqueue を行う

### 4. 実行中状態と progress を反映する

- BullMQ 側の実行開始や progress 変化は，`update job` によって Geshi 側 `job` へ反映する
- `queued -> running` は，BullMQ 側の実行開始を受けた `update job` によって確定する

### 5. 実行結果を書き戻す

- 実行用 BullMQ job は，Geshi 側 `job` とは切り離して扱う
- 実行結果は，終端状態専用の `import job` によって Geshi 側 `job` へ反映する

runtime worker の戻りは，少なくとも次の形とする．

```ts
interface ImportInstruction {
  operation: string
  payload: string
}

interface RuntimeJobResult {
  geshiJobId: string
  jobStatus: string
}

interface ImportJobInput {
  result: RuntimeJobResult
  importInstructions: ImportInstruction[] | null
}
```

- runtime worker が完了し，`import job` を積んだ時点で，対象の `job` は `importing` へ遷移する
- 終端状態の確定は `import job` 経由でのみ行う
- `import job` は，その後 `result.geshiJobId` と `result.jobStatus` にもとづいて Geshi 側 `job` の終端状態を更新する
- その後，`importInstructions` にもとづいて backend の write API を順に呼ぶ
- backend DB 障害のように `import job` 自体が結果反映できない場合は，`import job` を破棄せず無限リトライする
- その間，対象の `job` は `importing` に留まりうる

ここでの `succeeded / failed` は，Geshi 側 `job` の終端状態である．

したがって，

- runtime worker の正常終了は，そのまま `succeeded` を意味しない
- `succeeded` は，`import job` が必要な backend write API 呼び出しまで完了した時点で確定する
- runtime worker が正常終了しても，`import job` や backend write API 呼び出しが失敗した場合は，Geshi 側 `job` は `failed` になりうる
- その場合，Geshi 側 `job` は必ず `failed` にし，失敗段階も残す

`queued` は，すでに BullMQ 側へ投入済みであることを意味する．

したがって `scheduled` や `queued` 以降は，Geshi 側だけで直接 `failed` に更新するのではなく，

- 実行開始であれば `running`
- import 段階へ入るなら `importing`

を経由して最終状態へ進める．

## 備考

- ここで定める状態語彙は Geshi 側 `job` model のものであり，BullMQ 側 state と同一ではない
- `job event` の順序は，まず状態遷移順を優先し，同じ状態内では発生時刻で比較する
- `failed` には，実処理失敗だけでなく，橋渡し処理や投入処理が回復不能に終わった場合も含める
- `importing` は，runtime worker は完了したが，Geshi 側の終端状態はまだ確定していない段階を表す
- 同じ橋渡し用 job や event が複数回来ても，Geshi 側 `job` の状態や対応情報を壊さないようにする
- 終端状態への更新は，古い event や重複 event によって巻き戻さないようにする
- `target` は持たず，実行入力は `payload` に寄せる
- retry は，同じ意味の別 job を再投入する上位層の方針として扱い，この文書の `job` model や `job event` では持たない
- キャンセルは将来課題とし，この文書では扱わない
- progress，親子 job，worker 数調整の具体実装は後続で詰める

## 各ジョブの説明

### 観察ジョブ

Channelの観察対象に対して，新規のエントリーを収集するジョブ

### 取得ジョブ

新規のエントリーに対して，その実リソースを取得するジョブ

### 投入ジョブ

Channel にたいする観察ジョブを定期的に投入するジョブ
