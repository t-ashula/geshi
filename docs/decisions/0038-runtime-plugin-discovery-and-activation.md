# ADR-0038: source collector plugin の発見元と利用可否制御の境界を分ける

## ステータス

提案

## 範囲

`backend`, `worker`, `plugin`, `configuration`

## コンテキスト

- 現在の `backend` は特定の external plugin package を source code で直接 import している
- [ADR-0033] により source collector plugin 契約は外部 package から参照できる公開境界として定義済みだが，plugin の発見方法はまだ `backend` 実装に埋め込まれている
- `geshi` 全体設定で plugin の利用可否を制御したいが，その設定に package 配布や import 解決の責務まで持たせると，設定と配布の責務が混ざる
- `backend` 本体，`observe-source` worker，`acquire-content` worker は同じ plugin 集合を前提に動くため，plugin 解決規則が process ごとにずれると整合が崩れる
- private package や `file:` plugin のように，本体 repository の共有依存へ直接混ぜたくない plugin も扱いたい

## 決定

- source collector plugin package の発見元は DB ではなく運用時設定とする
- plugin の依存解決と生成物作成は CLI の責務として扱う
- `backend` と worker は，生成済み plugin registry module を通じて plugin 集合を受け取る
- `geshi` 全体設定は，利用可能になった plugin のうちどれを利用対象とするかだけを制御する
- package 名や import specifier は運用時設定が扱い，全体設定は `pluginSlug` のような論理識別子だけを扱う
- built-in plugin は code 同梱の definition として保持してよく，external plugin と registry 構築時に合流してよい

## 影響

- plugin の発見責務と，app の利用方針責務を分離しやすくなる
- `backend` と worker で同じ plugin 集合を共有しやすくなる
- external plugin 追加のたびに `backend` source code へ個別 import を増やさずに済む
- private plugin や local plugin を，本体 repository の共有依存と分けて扱いやすくなる
- 一方で，運用時設定，CLI，生成物管理の責務を別途定める必要がある

## 代替案

- 全体設定 DB に package 名や import specifier を保存し，それを解決する
  - 設定と配布の責務が混ざるため採らない
- 外部 plugin を引き続き `backend` source code に静的 import で追加する
  - plugin 追加のたびに `backend` 実装変更が必要で，公開拡張点として不十分なため採らない
- `backend` や worker が運用時設定を読んで毎回 external plugin を動的 import する
  - 成立はするが，起動時責務と process 間整合が重くなるため主案にはしない

## 参考資料

- [ADR-0030] ADR-0030: geshi 全体にかかる設定は source ごとの設定から分けて管理する
- [ADR-0032] ADR-0032: source collector plugin 解決を registry interface 境界へ寄せる
- [ADR-0033] ADR-0033: source collector plugin 契約を backend から分離した外部 package として定義する
- [ADR-0037] ADR-0037: source collector plugin 一覧は backend API から frontend に公開する
- [ADR-0039] ADR-0039: source collector plugin の利用可否状態は API で公開し frontend に反映する
- [ADR-0040] ADR-0040: 運用時設定として plugin 設定の形式を定義する
- [ADR-0041] ADR-0041: external plugin 用 install / generate CLI の責務を分ける
- [ADR-0042] ADR-0042: backend と worker は生成済み plugin registry module を import する
- [design-log-0038] ADR-0038: source collector plugin の発見元と利用可否制御の境界を分ける に対するメモ
- [acceptance-0009] Plugin Runtime Discovery And Activation

[ADR-0030]: ./0030-configuration-management.md
[ADR-0032]: ./0032-source-collector-plugin-registry-boundary.md
[ADR-0033]: ./0033-source-collector-plugin-api-package-boundary.md
[ADR-0037]: ./0037-source-collector-plugin-list-api.md
[ADR-0039]: ./0039-plugin-availability-status-api-and-frontend.md
[ADR-0040]: ./0040-plugin-site-configuration-format.md
[ADR-0041]: ./0041-plugin-install-and-generate-cli.md
[ADR-0042]: ./0042-generated-plugin-registry-import-boundary.md
[design-log-0038]: ../design-log/0038-runtime-plugin-discovery-configuration-shape.md
[acceptance-0009]: ../acceptance/0009-plugin-runtime-discovery-and-activation.md
