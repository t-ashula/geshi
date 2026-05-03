# ADR-0040: 運用時設定として plugin 設定の形式を定義する

## ステータス

提案

## 範囲

`configuration`, `plugin`, `operations`

## コンテキスト

- [ADR-0038] の提案では，plugin package discovery の責務を DB ではなく運用時設定へ寄せる
- plugin 用依存は，本体 repository の `package.json` とは分けて持ちたい
- private package, git URL, `file:` plugin を扱いたい一方で，独自 plugin registry や `latest` 固定運用は避けたい
- install CLI に渡す入力として，plugin 用依存宣言の独立した置き場が必要である

## 決定

- 運用時設定として plugin 設定の形式を，`geshi` 本体の `package.json` とは独立した設定ファイルとして定義する
- この設定は plugin CLI の install 入力として扱う
- この設定が扱うのは external plugin package の導入元とする
- 設定の中心は plugin package 群の宣言とし，package manager が扱える依存指定の表現力を流用する
- plugin 用 `package.json`, `node_modules`, generated module, metadata の配置先は，運用時設定で単一の出力先 directory として指定できるようにする
- app policy はこの設定へ入れず，`pluginSlug` ベースの有効化設定は全体設定で扱う

## 影響

- external plugin install source の表現力を既存 package manager の流儀に寄せられる
- private / local plugin を扱いやすくなる
- plugin CLI の install 入力を本体 repository 依存から分離できる
- plugin 用 artifact の配置先を 1 つの directory 配下へまとめやすくなる
- built-in plugin の導入管理と external plugin の導入管理を分けやすくなる
- 一方で，config parse / validation の責務が新たに必要になる

## 代替案

- 本体 `package.json` に plugin 用依存を直接足す
  - site 固有 plugin 依存が本体開発依存へ混ざるため採らない
- plugin 設定を JS module に寄せて動的設定も許す
  - install 入力としては自由度が高すぎ，validation も複雑になるため主案にはしない
- 独自 schema で package 名と version を別 field に切り出す
  - npm の既存表現力を捨てる割に利点が少ないため採らない
- built-in plugin も同じ設定へ含める
  - 本体同梱 plugin と external plugin package の責務が混ざるため採らない

## 参考資料

- [ADR-0038] ADR-0038: source collector plugin の発見元と利用可否制御の境界を分ける
- [ADR-0041] ADR-0041: external plugin 用 install / generate CLI の責務を分ける
- [design-log-0038] ADR-0038: source collector plugin の発見元と利用可否制御の境界を分ける に対するメモ

[ADR-0038]: ./0038-runtime-plugin-discovery-and-activation.md
[ADR-0041]: ./0041-plugin-install-and-generate-cli.md
[design-log-0038]: ../design-log/0038-runtime-plugin-discovery-configuration-shape.md
