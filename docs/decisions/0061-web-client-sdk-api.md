# ADR-0061: web client は plugin context ではなく SDK 提供 API として扱う

## ステータス

決定

## 範囲

`geshi-sdk`, `api backend`, `crawler`, external plugins

## コンテキスト

- [ADR-0043] により，external plugin author は SDK 境界を通じて plugin を実装する
- 現在の plugin 実行では，`context.getWebClient({ kind: "fetch" | "browser" })` のように plugin context から web client を取得する形を取っている
- この形だと，plugin 呼び出しのたびに host 側が `PluginWebClient` interface を満たす object を組み立てる必要があり，実行箇所ごとの重複が生じる
- plugin 側でも，web access を使うたびに context から capability を取り出す段階が増え，plugin 機能の引数と無関係な取得手順を毎回書くことになる
- 一方で，`webClient` を使いたい理由自体は残っている
  - 通常の HTTP fetch でも
  - browser access だが UI 操作は不要な page fetch でも
  - 同じ `fetch(request) -> Response` interface で扱いたい
- ここで問題なのは `webClient` の存在ではなく，それを plugin context から受け取る構造である
- host 側が毎回 `PluginWebClient` を渡す構造を前提にすると，plugin 実行 API と capability 提供 API とが不必要に結びつく
- したがって，`webClient` は plugin context の一部ではなく，SDK が直接提供する API として扱った方が自然である

## 決定

- `webClient` は plugin context から取得する capability ではなく，SDK が plugin author へ直接提供する API として扱う
- plugin は `context.getWebClient(...)` を使わず，SDK import を通じて `WebClient` を利用する
- plugin context は `webClient` を持たない
- `webClient` は，通常の HTTP fetch と，UI 操作を必要としない browser access とを，同じ `fetch(request) -> Response` interface で扱うための API として残す
- `webClient.getBrowser()` のような browser 本体 access は，`webClient` 上の例外的操作として残す

### この方針の意図

- plugin 機能の引数と，web access capability の取得経路とを切り離す
- host 側が plugin 実行ごとに `PluginWebClient` object を組み立てる無駄をなくす
- plugin author が web access を使うときの呼び出し手順を減らす
- `webClient` 自体は残しつつ，plugin context を痩せさせる

## 影響

- plugin 呼び出し時の context から `getWebClient` を外せる
- host 側の per-call adapter を減らせる
- plugin author は web access を SDK API として直接使える
- `webClient` の利用意図である「UI 操作なし access の共通 interface」は維持できる
- 一方で，現在の plugin / backend 実装は `context.getWebClient(...)` 前提から移行が必要になる

## 代替案

- `context.getWebClient(...)` を維持する
  - host 側の重複 adapter と，plugin 側の不要な取得段階が残るため採らない
- `webClient` 自体を廃止して `fetch` を別 API に置き換える
  - browser-backed fetch と plain fetch を同じ interface で扱いたい意図が失われるため採らない
- browser access を完全に `webClient` から切り離す
  - UI 操作を必要としない browser access まで別 API に分断され，利用側の統一性が弱くなるため採らない

## 参考資料

- [ADR-0043] ADR-0043 外部 plugin 開発のために plugin author 向け SDK 境界を分離する
- [ADR-0057] ADR-0057 `html asset` の acquire 方式は source collector plugin が責務を持つ
- [ADR-0060] ADR-0060 plugin 実行 capability は collector 固有 context ではなく host object として公開する

[ADR-0043]: ./0043-plugin-sdk-boundary-for-external-plugin-development.md
[ADR-0057]: ./0057-html-asset-acquire-strategy.md
[ADR-0060]: ./0060-plugin-host-object.md
