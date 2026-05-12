# ADR-0058: `content detail` では `detail_body` を優先し無ければ `summary` を使う

## ステータス

決定

## 範囲

`api backend`, `web ui frontend`

## コンテキスト

- [ADR-0028] により，保存済み asset は `content detail` から参照可能であることが前提になっている
- `podcast-rss` では episode page が `html` asset として保存対象になりうる
- 一方で，`content` にはすでに `summary` が主要属性として存在しており，detail で何を本文表示の主対象にするかを決めないと UI の優先度がぶれる
- `html asset` から本文向けの `detail_body` を作るなら，それを優先して使うのか，無いときに `summary` を使うのかを先に決める必要がある
- なお，派生生成物をどうモデル化するか自体は別論点であり，[ADR-0059] で扱う

## 決定

- `content detail` では，`detail_body` が存在する場合，それを本文表示の優先対象として扱う
- `detail_body` が存在しない場合は，`summary` を本文表示のフォールバックとして扱う
- `detail_body` の生成は，第一弾では `content detail` request の処理中に必要なら行う
- `detail_body` の抽出規則は，source collector plugin の `extractor(asset)` が担う
- 元の `html asset` は，本文表示の主対象ではなく，必要に応じて辿れる参照元として扱う
- `summary` は `detail_body` の有無に応じたフォールバック情報であり，`detail_body` がある場合の主表示とは分けて扱う

### 第一弾で採らないこと

- `html asset` の raw 本文をそのまま detail の主表示にすること
- `summary` を常に主表示に固定し，`detail_body` を表示に使わないこと
- `detail_body` が無いときに detail の本文表示自体を諦めること

## 影響

- `detail_body` がある content では，`summary` より本文に近い表示を優先できる
- `detail_body` が無い content でも，既存の `summary` を使って detail 表示を成立させやすい
- UI は `content detail` request を非同期 fetch として扱い，応答待ちの間も画面全体をブロックしない
- plugin の `extractor(asset)` に抽出規則を寄せることで，source ごとの差分を backend core に漏らしにくくなる
- `summary` 上書きではなく表示優先順位として扱うため，source 由来 metadata の意味を保てる
- 一方で，request 中の loading 表示と，生成失敗時の detail 挙動を別途設計する必要がある

## 代替案

- `summary` を常に主表示にし，`detail_body` があっても表示に使わない
  - `html asset` から本文を作る意味が薄くなり，表示改善にもつながりにくいため採らない
- `html asset` raw 本文をそのまま detail の主表示にする
  - 読みやすさと安全性の制御が弱く，`detail_body` を作る意義とも噛み合わないため採らない
- `detail_body` が無い場合は本文表示を空にする
  - 既存 `summary` を活かせず，detail の最低限の情報量も落ちるため採らない

## 参考資料

- [ADR-0028] ADR-0028 保存済み asset の参照と再生に backend API を追加する
- [ADR-0045] ADR-0045 transcript は content に直接ひもづく主体として保持する
- [ADR-0059] ADR-0059 `content` は `asset` と複数の派生主体を並列に持てるようにする
- [acceptance-0012] HTML Asset Detail And Acquire Foundation
- [design-log-0058] Design Log 0058

[ADR-0028]: ./0028-stored-asset-playback-api.md
[ADR-0045]: ./0045-transcript-owned-by-content.md
[ADR-0059]: ./0059-content-derivative-models.md
[acceptance-0012]: ../acceptance/0012-html-asset-detail-and-acquire-foundation.md
[design-log-0058]: ../design-log/0058-html-asset-detail-presentation-options.md
