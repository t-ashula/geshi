# ADR-0044: Entry model を共通 model として再整理する

## ステータス

提案

## 範囲

全体

## コンテキスト

- `Entry` は Geshi 側の共通 model であり，特定の媒体や collector 実装に引きずられない必要がある
- しかし，実装を進める中で `Entry` の意味が曖昧なままになり，`sourceUrl` を含む各フィールドの責務も揺れ始めた
- その結果，次の問題が発生した
  - `Entry` の意味を実装都合で読み替えやすくなる
  - `sourceUrl` の意味が媒体ごとにぶれやすい
  - `Entry` 単体で何を表す model なのかが不明瞭になる
- したがって，`Entry` の共通責務と，各フィールドの意味を先に固定する必要がある

## 提案

- `Entry` は Geshi 側の共通 model として再整理する
- `Entry` の既存フィールドの意味を，実装都合で上書きしない
- 特に `sourceUrl` の意味は `docs/models.md` で明示的に定義する
- `Entry` が何を表す model なのかを，`docs/models.md` で先に固定する
- `Entry` の再整理が終わるまで，`Entry` の意味に依存する新しい collector 実装や frontend 実装を前進させない

## 影響

## 代替案

- `Entry` の意味を実装側に委ねたまま進める
  - 実装は早いが，共通 model の意味が崩れ，後続の collector や frontend 実装で不整合が増える

## 参考資料

- [models] データモデル仕様
- [design-log-0044] 0044 entry model reconsideration

[models]: ../models.md
[design-log-0044]: ../design-log/0044-entry-model-reconsideration.md
