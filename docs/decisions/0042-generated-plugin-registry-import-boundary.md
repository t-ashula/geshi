# ADR-0042: backend と worker は生成済み plugin registry module を import する

## ステータス

決定

## 範囲

`backend`, `worker`, `plugin`, `build`

## コンテキスト

- external plugin を runtime で都度動的 import する設計は成立するが，process ごとの整合や起動時責務が重くなりやすい
- [ADR-0041] の提案では，external plugin 用に generate CLI を持つ
- `backend` と worker は同じ plugin 集合を前提に動くため，共通の生成物を読む方が整合を取りやすい
- 生成済み registry module を固定入口にすれば，`backend` / worker は個別 external plugin package 名を知らずに済む

## 決定

- `backend` と worker は，各 external plugin package を個別 import するのではなく，生成済み plugin registry module を静的 import する
- 生成済み module は，external plugin definitions または registry 初期化済みの entry point として扱う
- built-in plugin と external plugin は，この生成済み import 入口の直後に合流させてよい
- built-in plugin は generate 対象に含めず，本体同梱の definition として別経路で扱ってよい
- 生成済み module と metadata の配置先は，運用時設定で与えられた plugin 出力先 directory を起点に解決する
- generate 未実行や生成失敗時の起動時挙動は，CLI 側方針と整合して扱う

## 影響

- runtime の import 責務を軽くできる
- process 間の plugin 集合の整合を取りやすい
- 個別 external plugin package 名を `backend` / worker が知らずに済む
- 一方で，生成物管理と build / startup flow の設計が必要になる

## 代替案

- `backend` / worker が運用時設定を読んで毎回 external plugin を動的 import する
  - 成立はするが，起動時責務と process 間整合が重くなるため採らない
- metadata だけ生成し，definition は runtime import する
  - 生成と実行の責務が分離しきらないため採らない
- built-in plugin も external plugin と同じ install / generate 流れへ完全に寄せる
  - 本体同梱 plugin まで運用時設定依存にする利点が薄いため初期案では採らない

## 参考資料

- [ADR-0038] ADR-0038: source collector plugin の発見元と利用可否制御の境界を分ける
- [ADR-0039] ADR-0039: source collector plugin の利用可否状態は API で公開し frontend に反映する
- [ADR-0041] ADR-0041: external plugin 用 install / generate CLI の責務を分ける
- [design-log-0038] ADR-0038: source collector plugin の発見元と利用可否制御の境界を分ける に対するメモ

[ADR-0038]: ./0038-runtime-plugin-discovery-and-activation.md
[ADR-0039]: ./0039-plugin-availability-status-api-and-frontend.md
[ADR-0041]: ./0041-plugin-install-and-generate-cli.md
[design-log-0038]: ../design-log/0038-runtime-plugin-discovery-configuration-shape.md
