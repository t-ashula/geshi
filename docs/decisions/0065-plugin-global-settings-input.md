# ADR-0065: pluginSlug 単位の共有永続化領域に対する設定は schema を介して画面と CLI から行う

## ステータス

決定

## 範囲

`geshi-sdk`, `api backend`, `frontend`, `cli`, external plugins

## コンテキスト

- [ADR-0064] により，backend(host) は source をまたいで同じ `pluginSlug` の実行間で共有される永続化領域を持つ
- この共有永続化領域は plugin が host 経由で読み書きできるが，それだけでは人が初期値や運用上必要な値を与える経路がない
- 現在の `settingSchema` は source collector plugin ごとの source 単位設定を画面から編集し，`collector_setting.config` に保存するために使っている
- この仕組みにより，plugin ごとの source 設定項目を core 側へハードコードせず，backend と frontend が共通の schema をもとに設定 UI を組み立てられる
- `pluginSlug` 単位の共有永続化領域についても，同様に plugin 側が設定項目を公開し，core 側がその schema をもとに入力経路を組み立てる形の方が自然である
- 一方で，source 設定用の `settingSchema` は source 単位設定のためのものであり，そのまま `pluginSlug` 単位の共有設定入力に流用すると scope が曖昧になる

## 決定

- `pluginSlug` 単位の共有永続化領域に対して，人が与える設定値の入力経路を持つ
- この入力経路は，少なくとも画面から利用できるようにする
- plugin は，source 設定用 `settingSchema` とは別に，`pluginSlug` 単位の共有設定入力 schema を公開してよい
- backend と frontend と CLI は，その schema をもとに入力項目の表示，更新対象 key の決定，値の送受信を行う
- core 側は，plugin ごとの共有設定項目を固定実装しない
- 同じ `pluginSlug` に対する共有設定入力は source をまたいで共有される
- 異なる `pluginSlug` の共有設定入力へはアクセスできない
- plugin が schema として公開していない property は，画面や CLI から変更しない
- plugin は，必要に応じて初期値候補を自動補完してよい
- ただし，core は自動補完だけで設定が完結することを前提にしない

### schema の役割

- plugin が，人に設定してほしい key を公開するために使う
- backend と frontend と CLI が，共有設定入力項目を動的に組み立てるために使う
- `pluginSlug` 単位の共有永続化領域のうち，どの key を人が編集対象として扱うかを示すために使う
- schema に含まれない property は，plugin 自身が内部利用する値として残してよい

### 入力経路

- 画面は，schema を取得して共有設定入力 UI を組み立てる
- CLI は，schema を取得して入力値の指定や validation に使う
- backend API は，schema に基づいて共有設定入力の取得と更新を扱う
- source ごとの設定画面や API とは別に，`pluginSlug` 単位の共有設定入力を扱う経路を持つ

## 影響

- `pluginSlug` 単位の共有永続化領域に対して，人が値を与える正規の経路を持てる
- plugin ごとの共有設定入力を schema 駆動で画面と CLI に出せる
- core 側へ plugin 個別設定項目をハードコードせずに済む
- source 単位設定と `pluginSlug` 単位設定入力との scope を分けて扱える
- 一方で，backend API，frontend UI，CLI，SDK に共有設定入力用の境界を追加する必要がある

## 代替案

- plugin 実行だけで必要な値を自動初期化する
  - 人が与える必要のある値に対応できないため採らない
- source 設定の `settingSchema` をそのまま流用する
  - source 単位設定と `pluginSlug` 単位設定入力の scope が曖昧になるため採らない
- plugin ごとの共有設定項目を core 側へ固定実装する
  - plugin 追加のたびに core 側変更が必要になり，schema 駆動の利点も失うため採らない

## 参考資料

- [ADR-0064] ADR-0064: source をまたいで同じ pluginSlug で共有される実行時状態は source 状態と分けて host が保持する
- [plugin-doc] Plugin

[ADR-0064]: ./0064-plugin-global-runtime-state.md
[plugin-doc]: ../plugin.md
