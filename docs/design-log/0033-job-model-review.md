# 0033 job model review

## 位置づけ

この文書は，`ADR-0033` の検討メモ置き場である．

## 0032 を踏まえた前提

[ADR-0032](../decisions/0032-collector-plugin-responsibilities.md) までで，少なくとも次が見えている．

- `scheduleObserve`
  - Geshi 本体側の job
- `observeChannel`
  - collector plugin 側の job
  - `channelId` と `force` を入力に取り，`Entry[]` を返す
- `acquireEntry`
  - collector plugin 側の job
  - `entryId` を入力に取り，`entry` と `assets` を返す
- runtime worker は backend の read-only API を読んでよい
- Geshi 側 model の更新は runtime worker では行わない
- write 系 API を呼べるのは，当面 `import job` と frontend に限る

したがって `0033` では，collector plugin の責務ではなく，

- Geshi 側 `job` model に何を持たせるか
- runtime worker の結果を `import job` がどう扱うか
- 既存の `job.md` の `payload` / `job event` をどう見直すか

を扱う．

## いま捨てる前提

以前の検討では，

- Geshi worker ごとに import 処理を持つ
- `import job` が domain model 更新 callback を呼ぶ
- `import job` と domain 更新を 1 transaction に寄せる

といった整理を置いていた．

しかし，`ADR-0010` と `ADR-0012` に立ち戻ると，

- backend API は Geshi における操作の共通入口である
- job は domain データそのものではなく，実行履歴と制御対象である

ので，`import job` が専用 callback を直接呼ぶ前提から考え始める必要は薄い．

`0033` では，まず

- runtime worker の結果を backend API 呼び出しへどう変換するか
- その変換結果を `job` model にどう表現するか

から整理し直す．

## 0033 の争点

### 1. `payload` に何を持たせるか

現時点で最初に整理すべきなのは，Geshi 側 `job.payload` の役割である．

少なくとも次を決める必要がある．

- 実行入力だけを持つのか
- import 用の手掛かりも持つのか
- backend API 呼び出しに必要な情報をどこまで持つのか

`0032` を踏まえると，当面の例は次である．

- `scheduleObserve`
  - `channelIds?: ChannelId[]`
- `observeChannel`
  - `channelId: ChannelId`
  - `force: boolean`
- `acquireEntry`
  - `entryId: EntryId`

この段では，まず次の前提で整理するのがよい．

- Geshi 側 `job.payload` は，その job の実行入力を表す
- `payload` の実体は，基本的には JSON 文字列とする
- どのような shape の JSON かは，`job.kind` に対応する job 実装側で解釈する

したがって，当面は

- `scheduleObserve`
  - `{"channelIds": [...]}`
- `observeChannel`
  - `{"channelId": "...", "force": true}`
- `acquireEntry`
  - `{"entryId": "..."}`

のような JSON を `payload` に入れる前提で考えればよい．

### `export job` と worker への引き渡し

`export job` は，Geshi 側 `job.payload` を `JSON.parse` し，BullMQ 側へ渡す raw data を組み立てる．

このとき BullMQ 側へ渡す raw data は，少なくとも次でよい．

- `geshiJobId`
- `payload`

ここで，

- `geshiJobId`
  - bridge 用の文脈情報
- `payload`
  - `JSON.parse(job.payload)` した job 固有入力

である．

ただし，worker 実装側が raw data をそのまま受ける形にすると，毎回 `geshiJobId` を業務引数として意識する必要がある．

したがって，Geshi worker の実装シグネチャは，次のように分けるのがよい．

```ts
someWorker(
  context: { geshiJobId: GeshiJobId },
  arguments: SomeWorkerPayload,
)
```

つまり，

- BullMQ 側の raw data は `{ context: { geshiJobId: GeshiJobId }, payload }`
- Geshi worker の実装インタフェースは `context` と `arguments` に分ける

という整理である．

### 2. runtime worker の結果をどう受けるか

`0032` では，runtime worker の本体結果は少なくとも次である．

- `observeChannel`
  - `Entry[]`
- `acquireEntry`
  - `entry`
  - `assets`

一方で，それを `import job` がどう受け取り，

- どの write API を呼ぶか
- どの payload で呼ぶか

という「import への指示」の形はまだ決めていない．

ここでは少なくとも次を決める必要がある．

- runtime worker の結果をそのまま `import job` へ渡すのか
- `import job` 用に別 payload を作るのか
- backend API 呼び出しは `job.kind` ごとに決め打ちするのか

現時点では，runtime worker の戻りは，少なくとも次の 2 つに分けて持つのがよい．

- `result`
- `importInstruction`

ここで，

- `result`
  - Geshi 側 `job` の状態反映に必要な最小情報
- `importInstruction`
  - backend の write API を呼ぶための指示
  - 複数回の write がありうるので配列にする
  - write が不要な job もあるので `null` を取りうる

である．

つまり，runtime worker の戻りは概念上，次の形でよい．

```ts
interface ImportInstruction {
  operation: BackendApiName;
  payload: string; // JSON.stringify(...)
}

interface RuntimeJobResult {
  geshiJobId: GeshiJobId;
  jobStatus: JobStatus;
}

interface ImportJobInput {
  result: RuntimeJobResult;
  importInstructions: ImportInstruction[] | null;
}
```

の形にする．

このとき `import job` は，まず

- `result.geshiJobId`
- `result.jobStatus`

を使って Geshi 側 `job` の状態を更新する．

そのうえで，状態に応じて `importInstructions` にもとづく backend の write API を順に呼ぶ．

ここで重要なのは，runtime worker が返す `jobStatus` をそのまま Geshi 側の終端状態とみなさないことである．

少なくとも意味論としては，

- runtime worker の正常終了は，「import 可能な結果が返った」ことを意味する
- Geshi 側 `job` が `succeeded` になるのは，`import job` が必要な write API 呼び出しまで完了した後である
- runtime worker が正常終了しても，`import job` や backend write API 呼び出しが失敗したなら，Geshi 側 `job` は `failed` になりうる
- したがって，runtime worker 自体は成功していても，import 失敗時は Geshi 側 `job` を必ず `failed` にしないと job が宙に浮く

ただし，backend DB 障害のように `import job` 自体が Geshi 側 `job` を更新できない場合は別である．

この場合，

- `import job` は破棄せず，BullMQ 側で無限リトライする
- その間，Geshi 側 `job` は `importing` に留まりうる

とするのがよい．

この前提に立つなら，終端状態の確定は `import job` 経由でのみ行うのがよい．

つまり，

- runtime worker が完了した時点では，直接 `succeeded` / `failed` にしない
- runtime worker が `import job` を積んだ時点で，対象の Geshi 側 `job` は `importing` へ遷移する
- その後 `import job` が終端状態を確定する

とする．

ここで大事なのは，

- callback を直接持ち込まない
- raw の URL / query / body を自由に組み立てさせない
- backend API の操作名とその引数に制限する

また，`operation` は backend API の名称そのままにしておくのがよい．

そうすると，

- `import job` 側で別名対応表を持たずに済む
- backend API の write 操作を変える時には，job 側も慎重に合わせて見直す前提になる

ことである．

当面の例は次である．

- `observeChannel`
  - `importInstructions = [{ operation: "registerObservedEntries", payload: JSON.stringify({ channelId, entries }) }]`
- `acquireEntry`
  - `importInstructions = [{ operation: "registerAcquiredEntry", payload: JSON.stringify({ entryId, entry, assets }) }]`

したがって，`0033` では「import の際の backend への指示は `operation + payload` で表す」を前提に進める．

注: `scheduleObserve` ではドメインモデルの書換を想定していないので，`importInstructions = null` を想定する．

### 3. `target` は廃止する

`job.md` には依然として `target` が残っているが，`0032` までの整理では不要である．

- `scheduleObserve`
  - `channelIds?` を payload に持てばよい
- `observeChannel`
  - `channelId` と `force` を payload に持てばよい
- `acquireEntry`
  - `entryId` を payload に持てばよい

したがって `0033` では，`target` は廃止し，job の実行入力は `payload` に寄せる前提で進める．

### 4. `job event` に何を持たせるか

runtime worker の結果や import の進行を追うには，`job event` に何を残すかも見直しが必要である．

少なくとも次を整理する必要がある．

- `runtimeJobId` だけで足りるか
- backend API 呼び出し結果の要約を `note` に残すのか
- import に失敗した場合の情報をどこまで持つか
- 再投入方針を job model の外へどう出すか

現時点では，`job event` はあくまで Geshi 側 `job` の状態変化と，必要なら Geshi 側 bridge 段階の進行を表すものとして扱うのがよい．

したがって，少なくとも次を前提にする．

- BullMQ 側 runtime worker が
  - 実際に開始した
  - 正常終了した
  - 異常終了した
  というタイミングで，`update job` 経由で Geshi 側 `job event` を積む
- runtime worker が完了し，`import job` を積んだ時点では，対象の `geshiJobId` に対して `importing` を積む
- ここで動くのは BullMQ runtime 側の補足タイミングであり，`update job` 自体の開始終了は `job event` にしない
- `import job` 自体の開始終了は `job event` にしない
- progress 系の `job event` は必要に応じて追加してよい

この整理では，

- `job event` は Geshi 側 `job` の状態遷移と，必要最小限の bridge 段階の補足履歴
- `update job` 自体のライフサイクルは通常のログや runtime 側管理

として分ける．

少なくとも失敗時には，

- `status = failed`
- `failureStage`
- 失敗要約

を Geshi 側 `job event` か，それと同等の参照可能な場所に残す必要がある．

`failureStage` は少なくとも

- `runtime`
- `import`

を区別できる必要がある．

一方で `retryable` は，失敗 event の属性として決まるというより，job の種類や入力条件にもとづく上位層の再投入方針として最初から決まっている場合がある．

たとえば， ライブの録画・録音なので，その時点を逃したら再実行不能のように，失敗 event だけではなく job の性質が効く．
また，今の整理では retry は「同じ job をそのまま再開する」ではなく，「同じ意味の別 job を再投入する」ことになる．
したがって，`retryable` は `job event` にも `job` 本体にも持たせず，同じ意味の別 job を再投入する上位層の方針として job model の外で扱う方がよい．

## 整理順

いまの段階では，次の順で進めるのがよい．

1. `payload` の役割
2. runtime worker の結果と `import job` の入出力
3. `target` 廃止の反映
4. `job event` に残す情報

## 誰がどの遷移を動かすか

状態遷移として何がありうるかと，その遷移を誰が起こすかは分けて考える必要がある．

ここでは，プレーヤーを次に限定して整理する．

- backend 本体
- `export job`
- `update job`
- `import job`
- job 自体

現時点では，少なくとも次の対応で整理するのがよい．

- backend 本体
  - `registered`
    - job を新規作成した時点

- `export job`
  - `registered -> queued`
    - 即時実行できる job を BullMQ へ enqueue した時
  - `registered -> scheduled`
    - 即時実行せず，将来実行に回すと判断した時
  - `scheduled -> queued`
    - 実行開始条件を満たした scheduled job を BullMQ へ enqueue した時
  - `registered -> failed`
    - export 自体が回復不能に失敗した時

- `update job`
  - `queued -> running`
    - BullMQ 側の実行開始を受けた時
  - `running -> importing`
    - runtime job が完了し，import 段階へ入る時

- `import job`
  - `importing -> succeeded`
    - import と backend write API 呼び出しまで成功した時
  - `importing -> failed`
    - import または backend write API 呼び出しが失敗した時

この整理では，

- `scheduled` / `queued` から直接 `failed` に行かない
- 終端状態の確定は `import job` が担う

という意味論を前提にする．

キャンセルは，将来課題として別途整理するものとし，この文書では扱わない．
