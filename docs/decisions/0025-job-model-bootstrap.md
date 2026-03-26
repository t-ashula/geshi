# ADR-0025: Geshi 側 job model の初期実装を開始する

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- ADR-0023 により，Geshi 側 `job` と BullMQ 側 job の橋渡し方針は決まった
- ADR-0024 により，Geshi 側 `job` 本体と `job event` の整理，永続化方針は決まった
- 次に進むには，Geshi 側 `job` / `job event` を，永続化や BullMQ への依存から切り離した形でコード上に置く必要がある

## 決定

- Geshi 側 `job` / `job event` は，永続化実装や BullMQ 実装から独立した model module として置く
- `job` / `job event` の型定義は，`docs/job.md` と ADR-0024 に従う
- 状態語彙と状態遷移は，model module 側で明示的に制約する
- bridge job から使う更新規則は，DB や ORM に依存しない純粋な関数として表現する
- 終端状態の巻き戻し防止と冪等性の前提は，model module 側の責務として扱う
- 永続化，ORM，migration，BullMQ との接続は，この model module の外側に置く

## 影響

- bridge job 実装の前提となる型と更新規則をコード側に持てる
- 永続化実装より前に，model と更新ルールを独立に確認できる
- DB や BullMQ の都合で `job` / `job event` の型や遷移規則が崩れにくくなる
- 後続の repository や bridge job は，この model module を利用する側として実装できる
- 後続の永続化や integration test を段階的に進めやすくなる

## 代替案

- bridge job や永続化実装の中で，`job` / `job event` の型や更新規則を都度書く
  - 実装箇所ごとに表現がぶれやすい
- `job` / `job event` の model を ORM entity や DB schema と一体で置く
  - 永続化都合に引っ張られやすく，bridge job でも使い回しにくい

## 備考

- 本 ADR は Geshi 側 `job` model のコード上の置き方と責務分離を対象とする
- 具体的な DB 実装や BullMQ との本格統合は後続で扱う

## 参考資料

- [adr-0023] ADR-0023 Geshi 側 job から BullMQ への橋渡し方針を定める
- [adr-0024] ADR-0024 Geshi 側 job model と永続化方針を定める
- [job-model] docs/job.md

[adr-0023]: ./0023-job-dispatch-bridge.md
[adr-0024]: ./0024-job-model-and-persistence.md
[job-model]: ../job.md
