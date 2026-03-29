# ADR-0033: job model の見直し

## ステータス

提案

## 範囲

`backend/`

## コンテキスト

- [ADR-0024] では，Geshi 側 `job` の定義情報の一つとして「対象 resource は何か」を置いた
- その整理は [`docs/job.md`](../job.md) では `target` として表現されている
- [ADR-0032] までで，runtime の job と `import job` の関係が揃った
- 一方で，現行の `docs/job.md` には
  - `target`， `payload` の詳細
  - `export job` / `import job` の bridge 段階
  - bridge 段階を含む状態語彙
  が十分に反映されていない
- したがって，`job` model を collector workflow ででてきた課題に合わせて見直す必要がある

## 決定

- Geshi 側 `job.target` は廃止する
- job の実行入力は `payload` に寄せる
- Geshi 側 `job.payload` は，基本的に JSON 文字列とする
- `job.kind` に対応する job 実装側が，`payload` の JSON shape を解釈する
- `export job` は，`job.payload` を `JSON.parse` し，BullMQ 側へ `{ context, payload }` を渡す
  - `context` には少なくとも `geshiJobId` (geshi.job.id) を含める
  - Geshi worker の実装シグネチャは `worker(context, arguments)` の形で扱う
- runtime worker の戻りは，少なくとも次を持つ
  - `result`
    - `geshiJobId`
    - `jobStatus`
  - `importInstructions`
    - `null` または `[{ operation, payload }]`
- `importInstructions` の `operation` は backend の write API 名そのものを使う
- 終端状態の確定は `import job` 経由でのみ行う
- runtime worker が完了し，`import job` を積んだ時点で，Geshi 側 `job` は `importing` へ遷移する
- `import job` は，まず `result` にもとづいて Geshi 側 `job` の終端状態を更新し，その後 `importInstructions` にもとづいて backend の write API を呼ぶ
- backend DB 障害のように `import job` 自体が結果反映できない場合，`import job` は破棄せず無限リトライする
- その間，Geshi 側 `job` は `importing` に留まりうる
- runtime worker 自体は成功していても，`import job` または backend write API 呼び出しが失敗した場合は，Geshi 側 `job` を必ず `failed` にする
- `failed` になった時には，失敗が `runtime` と `import` のどちらで起きたかも Geshi 側に残せるようにする
- retry は，同じ意味の別 job を再投入する上位層の方針として扱い，`job` model や `job event` の属性としては持たない
- `job event` には，runtime worker の開始・正常終了・異常終了に加えて，必要なら bridge 段階の進行も残してよい
- ただし，bridge 段階のうち `importing` だけは `status` に入れる
  - その後，`import job` の結果として `succeeded` / `failed` に着地する

## 影響

- `target` に依存しない job model に整理できる
- collector workflow の `scheduleObserve` / `observeChannel` / `acquireEntry` を，`payload` ベースで素直に表現できる
- Geshi worker と BullMQ worker の bridge で必要な情報が，`context` と `payload` に分離される
- `import job` が backend の write API を呼ぶ前提が明確になる
- import 失敗で job が宙に浮くことを避けやすくなる
- 失敗理由と再投入方針を分けて扱いやすくなる
- `docs/job.md` の model 定義，`payload`，`target`，処理段階の説明を更新する必要がある
- キャンセルは将来課題として別途整理する必要がある

## 代替案

- `target` を補助参照として残す
  - collector workflow では `payload` だけで十分であり，用途が弱い
- `import job` に callback や自由な URL / body 組み立てを持たせる
  - backend API を共通入口とする既存方針と整合しにくい
- bridge 段階を `status` ではなく別 field で持つ
  - 将来的な案としてはありうるが，現時点では `importing` を status に含める方が単純である

## 参考資料

- [adr-0024] ADR-0024 Geshi 側 job model と永続化方針を定める
- [job-model] docs/job.md
- [adr-0031] ADR-0031 backend での情報収集とそのアーキテクチャ
- [adr-0032] ADR-0032 collector plugin の責務
- [design-log-0033] Design log 0033 job model review

[adr-0024]: ./0024-job-model-and-persistence.md
[job-model]: ../job.md
[adr-0031]: ./0031-backend-collection-architecture.md
[adr-0032]: ./0032-collector-plugin-responsibilities.md
[design-log-0033]: ../design-log/0033-job-model-review.md
