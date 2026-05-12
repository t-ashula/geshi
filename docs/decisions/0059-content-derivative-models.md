# ADR-0059: `content` は `asset` と複数の派生主体を並列に持てるようにする

## ステータス

決定

## 範囲

`data-model`, `api backend`, `web ui frontend`

## コンテキスト

- `html asset` から detail 表示向けの本文を作る場合，表示上は `summary` より優先したい
- そのためには，派生主体に少なくとも次の情報が必要になる
  - どの元 `asset snapshot` から生成したか
  - 何の目的の生成物か
  - いつ生成されたか
  - 再生成や失敗をどう追うか
- これを既存 `asset` に `kind=generated` のように押し込める案もあるが，purpose と provenance を表現し始めると，通常 asset と派生主体とで責務がずれやすい
- 一方で，`transcript` はすでに [ADR-0045] で，生成元 `asset snapshot` を参照しうるが，`asset` の下ではなく `content` に直接ひもづく専用主体として扱う方針を取っている
- `html` 由来本文だけを別概念にし，`transcript` を特例にすると，`content` 配下の生成物モデルが二重化しやすい

## 決定

- `content` は，`asset` と，それとは別の複数の派生主体を並列に持てるようにする
- `transcript` は，その派生主体の 1 種として扱う
- `html asset` 由来の detail 表示向け本文は，`detail_body` という名前で，`transcript` と同じく `content` に直接ひもづく別主体として扱う
- 各派生主体は，必要に応じて生成元 `asset snapshot` を参照できるようにする
- 各派生主体は，種類ごとに必要な状態，生成単位，失敗追跡，表示用属性を独自に持てるようにする
- `detail_body` の第一弾の生成タイミングは，`content detail` request 内で必要時に行うことを基本とする
- `detail_body` の抽出規則は，source collector plugin の `extractor(asset)` が担う
- `detail_body` の最小属性は，少なくとも `content`，生成元 `asset snapshot`，`body`，`mime` を扱える形にする

### この方針で揃えること

- `content` 配下には，閲覧対象である元 `asset` と，そこから作られる派生主体群とが並ぶ
- 派生主体は「元 asset から作られる」という provenance を共通に持つ
- ただし保存形式，状態遷移，再生成単位，API 表現は派生主体の種類ごとに分ける
- `transcript` は chunk，retry，generation を持つ専用主体として維持する
- `detail_body` は，detail 表示向けの軽量な派生主体として，`transcript` とは別の専用主体を持つ

## 影響

- `asset` に無理に `generated` 概念を押し込めずに済む
- `transcript` と `detail_body` とを，ともに `content` 配下の兄弟主体として整理できる
- `detail_body` も，purpose や provenance を明示したまま扱いやすくなる
- `detail_body` の抽出規則を plugin 側へ閉じ込められるため，source ごとの差分を `content detail` 実装本体へ漏らしにくい
- 一方で，派生主体の種類ごとに主体や API 表現が増えるため，共通の見せ方は別途整理が必要になる
- request 中に生成が走りうるため，loading と生成失敗を detail 導線でどう扱うかの設計が必要になる

## 代替案

- `asset(kind=generated)` として派生物を asset 側へ寄せる
  - purpose と provenance を持たせるほど通常 asset との責務差が大きくなり，`transcript` と同じ階層整理もしづらいため採らない
- `generated_assets` のような単一主体へ全派生主体を集約する
  - `transcript` のような重い主体と，軽量本文派生主体とで必要属性が離れすぎるため採らない
- `transcript` を今のまま特例として残し，`html` 由来本文だけ別モデルにする
  - `content` 配下の兄弟主体という整理が崩れ，説明しづらくなるため採らない

## 参考資料

- [ADR-0045] ADR-0045 transcript は content に直接ひもづく主体として保持する
- [ADR-0058] ADR-0058 `content detail` では `html asset` 由来の派生生成物を優先し無ければ `summary` を使う
- [acceptance-0012] HTML Asset Detail And Acquire Foundation
- [design-log-0058] Design Log 0058

[ADR-0045]: ./0045-transcript-owned-by-content.md
[ADR-0058]: ./0058-html-asset-detail-presentation.md
[acceptance-0012]: ../acceptance/0012-html-asset-detail-and-acquire-foundation.md
[design-log-0058]: ../design-log/0058-html-asset-detail-presentation-options.md
