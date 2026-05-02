# ADR-0041: external plugin 用 install / generate CLI の責務を分ける

## ステータス

提案

## 範囲

`cli`, `plugin`, `operations`, `build`

## コンテキスト

- external plugin を扱うには，依存を解決して利用可能にする処理と，実行時に読む生成物を作る処理が必要になる
- install は network, registry, 認証, private repository など外部失敗要因が多い
- generate は install 済みの依存集合を入力にしたローカル処理として扱いやすい
- install と generate を同じ責務として扱うと，起動時自動実行や失敗モードの整理が難しくなる

## 決定

- external plugin 用 CLI は install と generate を別責務として持つ
- CLI の入口は `geshi` に統一する
- install は明示コマンドとして扱う
- generate は明示コマンドでも実行でき，必要なら app 起動時の自動実行にも対応できるようにする
- install は本体依存と切り離された plugin 依存集合を対象に行う
- generate は install 済み plugin を検査し，実行時に読む生成物を作る責務を持つ
- install における依存解決と package 配置は，独自実装ではなく npm の仕組みを前提に扱う
- 運用時設定ファイル，plugin 用 install 先，generate 出力先は固定パスとして扱う

## 影響

- install 失敗と generate 失敗を分けて扱える
- 起動時自動処理は generate に限定しやすくなる
- plugin 依存集合を本体依存集合から分離しやすくなる
- CLI 利用者が入口を `geshi` に一本化して扱える
- 依存解決の責務を npm に委ねることで，独自 package manager 的実装を避けられる
- 一方で，CLI 境界と運用手順の定義が必要になる

## 代替案

- install と generate を 1 コマンドに統合する
  - 外部失敗要因とローカル生成失敗を分けにくいため採らない
- install も generate も常に起動時自動実行する
  - network や認証失敗が app 起動へ直結しすぎるため採らない
- 本体 repository の `node_modules` をそのまま plugin install 先にする
  - 本体依存と plugin 依存の責務が混ざりやすいため採らない
- install の依存解決を `geshi` 側で独自実装する
  - npm が既に持つ解決と配置の仕組みを再実装する負担が大きいため採らない

## 参考資料

- [ADR-0038] ADR-0038: source collector plugin の発見元と利用可否制御の境界を分ける
- [ADR-0040] ADR-0040: 運用時設定として plugin 設定の形式を定義する
- [ADR-0042] ADR-0042: backend と worker は生成済み plugin registry module を import する
- [design-log-0038] ADR-0038: source collector plugin の発見元と利用可否制御の境界を分ける に対するメモ

[ADR-0038]: ./0038-runtime-plugin-discovery-and-activation.md
[ADR-0040]: ./0040-plugin-site-configuration-format.md
[ADR-0042]: ./0042-generated-plugin-registry-import-boundary.md
[design-log-0038]: ../design-log/0038-runtime-plugin-discovery-configuration-shape.md
