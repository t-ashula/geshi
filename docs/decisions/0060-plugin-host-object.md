# ADR-0060: plugin 実行 capability は collector 固有 context ではなく host object として公開する

## ステータス

決定

## 範囲

`geshi-sdk`, `api backend`, `crawler`, external plugins

## コンテキスト

- [ADR-0043] により，external plugin author は backend 実装詳細から独立した SDK 境界で plugin を実装する
- [ADR-0050] では，plugin と job の一般インタフェースとして共通の実行 context を導入した
- [ADR-0057] では，`html asset` の acquire に browser automation を用いる可能性を認め，SDK 側が browser capability を提供する方針を置いた
- 一方で，現在の `SourceCollectorExecutionContext` は `logger`, `getWebClient`, `putWorkObject`, `replacePluginMetadata` のように collector 固有 capability を個別に生やす形になっている
- この形では，新しい capability を追加するたびに context が肥大化し，plugin 種別をまたいだ共通概念として整理しにくい
- host 側でも，plugin 実行のたびに `getWebClient(input) { return getWebClient(input, pluginLogger); }` のような wrapper を都度組み立てており，interface を満たすためだけの重複が発生している
- browser capability を追加すると，`context` にさらに collector 固有 method を足すか，既存 method に escape hatch を混ぜるかの二択になりやすく，SDK surface が不自然になる
- plugin author の視点では，「geshi host が何を提供するか」という capability のまとまりとして見えた方が理解しやすい
- ただし，それは plugin の `inspect` / `observe` / `acquire` など各機能の引数そのものとは分けて扱われるべきであり，plugin 機能の入力値と host capability とが同じ object 上で混ざるのは望ましくない
- plugin は，`observe(input, context)` のように，「機能引数」と「host への入口」を別引数で受けるこの形に統一した方が意図が明確である

## 決定

- plugin 実行時に利用可能な capability は，collector 固有 context の field 群として増やすのではなく，`context.getHost()` を通じて取得できる host object としてまとめて公開する
- source collector plugin の API は，`observe(input, context)` のように，plugin 機能の引数と host への入口とを別引数で受ける形へ寄せる
- `SourceCollectorExecutionContext` は，plugin 機能の引数 object とは分離された `context` として扱い，そこから `getHost()` を提供する薄い境界へ縮小する
- plugin author は，plugin 機能の引数とは別に渡される `context` から `getHost()` を呼び，host capability を取得して利用する
- host 側は，plugin 実行ごとに collector 固有 interface を満たすための adapter を組み立てるのではなく，`GeshiHost` を生成して渡す責務に寄せる

### host object に寄せる初期 capability

- `logger`
- work storage への一時保存 capability
- plugin metadata 更新 capability

## 影響

- plugin 実行 capability の概念が collector 固有 context や plugin 機能の引数から分離され，SDK 境界の見通しが良くなる
- host 側の per-call wrapper を減らしやすくなる
- external plugin author が「geshi host から何が提供されるか」をまとまりとして理解しやすくなる
- `logger` は呼び出し側からの実行コンテキストを引き継いだ状態で plugin へ渡せる
- `work object` のような host 管理資源を，plugin から明示的に利用できる
- 一方で，既存の `SourceCollectorExecutionContext` を参照する plugin / backend 実装の移行計画が必要になる

## 代替案

- `SourceCollectorExecutionContext` に field を追加し続ける
  - capability の追加ごとに collector 固有 context が肥大化し，plugin 種別をまたいだ一般化もしにくいため採らない
- browser や storage などを `getWebClient` のような factory 群にぶら下げる
  - host capability の境界が分かりにくくなり，wrapper も減らないため採らない
- plugin 機能の引数 object の中に `host` や `getHost()` を同居させる
  - plugin 固有入力と host capability との境界が曖昧になるため採らない
- plugin ごとに必要な capability adapter を host 側で都度手組みする
  - 実行箇所ごとの重複が残り，SDK 契約も不安定になるため採らない

## 参考資料

- [ADR-0043] ADR-0043 外部 plugin 開発のために plugin author 向け SDK 境界を分離する
- [ADR-0050] ADR-0050 plugin と job の一般インタフェースとして next-action arguments と共通実行 context を定義する
- [ADR-0057] ADR-0057 `html asset` の acquire 方式は source collector plugin が責務を持つ
- [ADR-0061] ADR-0061 web client は plugin context ではなく SDK 提供 API として扱う

[ADR-0043]: ./0043-plugin-sdk-boundary-for-external-plugin-development.md
[ADR-0050]: ./0050-plugin-and-job-shared-interface.md
[ADR-0057]: ./0057-html-asset-acquire-strategy.md
[ADR-0061]: ./0061-web-client-sdk-api.md
