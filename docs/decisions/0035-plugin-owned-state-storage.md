# ADR-0035: collector plugin 固有の継続状態は collector setting とは分けて backend が保持する

## ステータス

提案

## 範囲

`plugin`, `api backend`, `crawler`

## コンテキスト

- [ADR-0033] により，source collector plugin は内蔵実装と外部 package 実装が同じ公開契約で共存できるようにする
- 既存の source collector plugin 入力には `collectorSettingSnapshot.config` があり，これは source ごとの plugin 固有 option の置き場として使える
- ただし，非 RSS HTML page を扱う plugin では，次回実行の開始位置を示す cursor，観測済み entry の補助情報，解釈済み metadata の cache など，人が直接編集しない継続状態を持ちたくなる
- これらを `collector setting` に直接書き戻す方式にすると，人が与える設定値と plugin 実行で変化する内部状態が混ざる
- [ADR-0030] では，全体設定と source ごとの設定を混在させない方針を採っており，同様に「設定」と「実行状態」も分離した方が責務が明確になる
- plugin が `backend` の repository を直接更新するのは，[ADR-0011] の plugin 責務境界にも反する

## 決定

- plugin 固有の継続状態は，`collector setting` へ直接書き戻さない
- source collector plugin が保持したい継続状態は，`backend` が所有する `collector_plugin_state` 領域へ分けて保存する
- `collector setting` は，人や API が与える入力設定として扱い続ける
- plugin は必要な継続状態を input として受け取り，更新したい継続状態を output として返す
- state の永続化と version 管理は `backend` 側の責務とする
- `collector_plugin_state` は，少なくとも `collector setting` ごとに分離する
- `pluginSlug` だけを key にした source 横断共有 state は，初期方針として採らない

### 用語

- `collector setting`
  - source ごとの有効 / 無効，実行間隔，plugin 固有 option など，人や API が与える入力設定
- `collector plugin state`
  - cursor，前回観測位置，解釈補助 metadata など，plugin 実行によって更新される継続状態

### state model

- `collector_plugin_state` は，plugin が所有する JSON serialize 可能な任意の object とする
- その property 名，値の意味，versioning，互換性，秘匿方法は plugin の責務とする
- `backend` は，その object の意味を解釈せず，opaque state として保存・受け渡しする
- PostgreSQL 実装でどう保持するかは永続化詳細であり，この ADR の model 定義には含めない

### state のスコープ

- `collector_plugin_state` の基本スコープは，`collector_setting` と `pluginSlug` の組とする
- 同じ source collector plugin を複数 source が使っていても，state は collector setting ごとに独立して持つ
- `collector setting snapshot` の version 更新とは独立して，current state を更新できるようにしてよい
- source 横断で共有したい read-only な知識が将来必要になっても，それは別の cache や reference data として扱い，collector plugin state と混同しない
- source 横断共有 state を collector plugin API の標準機能として先に入れない
- この ADR の state は source collector plugin 専用であり，将来別種の plugin が追加されても同じ table や ownership を強制しない

### 境界の原則

- plugin は `collector_plugin_state` を直接保存しない
- plugin は `collector_plugin_state` を解釈して使ってよい
- plugin が state 更新を望む場合は，呼び出し側へ新しい state を返す
- `backend` は，job 実行単位でどの state snapshot を plugin に渡し，実行後にどの state を current state として採用するかを決める
- `collector setting` の変更 API と `plugin state` の更新経路は分ける

### API への影響

- plugin 公開契約には，必要に応じて `collectorPluginState` input と `nextCollectorPluginState` output を追加できるようにする
- state の shape は plugin ごとに異なるため，公開契約では JSON serialize 可能な object を基本にしてよい
- `backend` は少なくとも pluginSlug と collector setting にひもづく形で state を管理する
- state は，少なくとも last-write-wins で current state を更新できれば始められる
- 履歴や snapshot を持つかどうかは，実装時に別途判断してよい

## 影響

- 人が編集する設定値と，plugin 実行が更新する内部状態を分離できる
- collector setting ごとの cursor や補助 metadata が，他の設定や source に漏れない
- 外部 package plugin でも，`backend` 内部実装へ侵入せずに継続状態を扱える
- 非 RSS HTML source のように cursor を必要とする plugin を設計しやすくなる
- source collector plugin 以外の plugin 種別が将来追加されても，state ownership の齟齬を起こしにくい
- 一方で，plugin state の保存主体，更新タイミング，競合解決規則は `backend` 側で別途設計が必要になる

## 代替案

- plugin が `collector setting` を直接書き戻す
  - 設定と実行状態が混ざり，責務境界が崩れるため採らない
- plugin ごとの永続記憶領域を plugin 実装側が勝手に持つ
  - `geshi` の source / job / retry の整合管理から外れ，再現性と運用性が落ちるため採らない
- pluginSlug 単位の source 横断共有 state を標準の置き場として持つ
  - source 間の独立性を崩し，意図しない state 汚染を起こしやすいため採らない
- plugin 種別を問わない汎用 `plugin_state` を 1 つだけ設け，source collector plugin もそこへ混在させる
  - ownership と参照主体が曖昧になり，`collector_setting` との関係や将来の非 collector plugin との責務境界が崩れやすいため採らない
- plugin は一切 state を持たず，毎回完全走査だけで対応する
  - HTML source のようなケースで効率と安定性を損ないやすいため採らない

## 参考資料

- [ADR-0011] ADR-0011: source クロールを plugin 境界で拡張可能にする
- [ADR-0030] ADR-0030: geshi 全体にかかる設定は source ごとの設定から分けて管理する
- [ADR-0033] ADR-0033: source collector plugin 契約を外部 package から参照できる公開境界として定義する
- [ADR-0034] ADR-0034: 外部 package plugin のサンプルとして非 RSS ページを source にする実装を追加する
- [plugin-doc] Plugin

[ADR-0011]: ./0011-source-crawl-plugin-responsibilities.md
[ADR-0030]: ./0030-configuration-management.md
[ADR-0033]: ./0033-source-collector-plugin-api-package-boundary.md
[ADR-0034]: ./0034-html-source-collector-sample-plugin.md
[plugin-doc]: ../plugin.md
