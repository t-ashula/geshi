# ADR-0026: Geshi 側 job bridge の初期実装を開始する

## ステータス

却下

## 範囲

`backend/`

## コンテキスト

- ADR-0023 により，Geshi 側 `job` から BullMQ への橋渡し方針は決まった
- ADR-0024 により，Geshi 側 `job` 本体と `job event` の整理，永続化方針は決まった
- ADR-0025 により，Geshi 側 `job` / `job event` の model module はコード上に置かれた
- 次に進むには，bridge job 群のうち最小限の骨格を実装し，後続の永続化や BullMQ 統合を受ける置き場を作る必要がある

## 決定

- `export` / `update` / `import` / `cancel` / `scheduler` を，Geshi 側 `job` bridge の役割として扱う
- この段階では，各 bridge の責務を表す関数や module の骨格だけを置く
- bridge module は Geshi 側 `job` model module を利用し，状態語彙や遷移規則を再定義しない
- 永続化実装や BullMQ 実装は bridge module の外側に置き，この段階では stub に留める
- bridge module ごとの input は，その動作に必要十分な情報に限定する

## 影響

- 後続の repository 実装や BullMQ 統合の置き場を先に作れる
- bridge job ごとの責務をコード上で分離しやすくなる
- Geshi 側 `job` model と bridge 実装の境界を保ちやすくなる

## 代替案

- 永続化実装や BullMQ 統合が決まるまで bridge module を作らない
  - 後続で責務分離が曖昧なまま実装が進みやすい
- 1 つの module に bridge job 群をまとめる
  - 役割ごとの入力と責務が混ざりやすい

## 備考

- 本 ADR は破棄する
- bridge module の初期実装は，現時点では呼び出し側となる永続化層や handler が存在せず，コードとしての居場所を定義できなかった
- そのため bridge 実装は行わず，必要な前提が整った時点で改めて検討する

## 参考資料

- [adr-0023] ADR-0023 Geshi 側 job から BullMQ への橋渡し方針を定める
- [adr-0024] ADR-0024 Geshi 側 job model と永続化方針を定める
- [adr-0025] ADR-0025 Geshi 側 job model の初期実装を開始する
- [job-model] docs/job.md

[adr-0023]: ./0023-job-dispatch-bridge.md
[adr-0024]: ./0024-job-model-and-persistence.md
[adr-0025]: ./0025-job-model-bootstrap.md
[job-model]: ../job.md
