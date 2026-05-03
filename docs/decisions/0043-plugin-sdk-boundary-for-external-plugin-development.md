# ADR-0043: 外部 plugin 開発のために plugin author 向け SDK 境界を分離する

## ステータス

決定

## 範囲

`plugin`, `sdk`, `package`, `developer-experience`

## コンテキスト

- external plugin を完全に別 repository として開発する場合，plugin author は型情報と契約定義を本体側から import する必要がある
- 現在の plugin 契約は `@geshi/sdk` に置いているが，今後 `init(context)` のような初期化境界や host interface を追加する余地がある
- 一方で，external plugin が `geshi` 本体 repository 全体へ依存する形は重く，依存境界としても大きすぎる
- plugin discovery や install / generate の仕組みとは別に，plugin author がどの package 群へ依存して開発するかを整理する必要がある

## 決定

- external plugin 開発者が依存する境界は，`geshi` 本体 repository 全体ではなく plugin author 向け SDK として分離する
- plugin author 向け契約は，`@geshi/sdk` を中心とした SDK 境界として扱う
- `backend` や worker も，plugin 契約に関する型や interface は可能な限り同じ SDK 境界へ依存する
- plugin author が本体実装詳細へ依存しなくても開発できることを優先する
- host から plugin へ注入する interface を今後追加する場合も，本体固有 module ではなく SDK 境界へ置く

## 影響

- external plugin を別 repository で開発しやすくなる
- plugin author が依存すべき最小 package 群を明確にしやすくなる
- 本体と external plugin の間で共有すべき契約を安定化しやすくなる
- 一方で，SDK に何を入れて何を本体実装詳細へ残すかの整理が別途必要になる

## 代替案

- `@geshi/sdk` を置かず，足りない型は本体 repository から直接 import させる
  - 本体への依存境界が大きすぎるため採らない
- plugin author 向け package を細かく分割せず，本体 repository 配下の内部 module を外部 plugin から参照させる
  - 内部構造がそのまま外部契約になってしまうため採らない
- plugin discovery と SDK 境界を同一 ADR でまとめて決める
  - 論点が大きく異なるため採らない

## 参考資料

- [ADR-0033] ADR-0033: source collector plugin 契約を backend から分離した外部 package として定義する
- [ADR-0038] ADR-0038: source collector plugin の発見は runtime 設定で行い利用可否は全体設定で制御する
- [ADR-0040] ADR-0040: 運用時設定として plugin 設定の形式を定義する
- [ADR-0041] ADR-0041: external plugin 用 install / generate CLI の責務を分ける
- [ADR-0042] ADR-0042: backend と worker は生成済み plugin registry module を import する

[ADR-0033]: ./0033-source-collector-plugin-api-package-boundary.md
[ADR-0038]: ./0038-runtime-plugin-discovery-and-activation.md
[ADR-0040]: ./0040-plugin-site-configuration-format.md
[ADR-0041]: ./0041-plugin-install-and-generate-cli.md
[ADR-0042]: ./0042-generated-plugin-registry-import-boundary.md
