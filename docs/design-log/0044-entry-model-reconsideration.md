# 0044 entry model reconsideration

## 位置づけ

この文書は，`ADR-0044` の検討メモである．

## 問題の所在

`Entry` は Geshi 側の共通 model であり，特定の媒体専用 model として再定義したくない．

一方で，実装を進める中で `Entry` が何を表すのか，`sourceUrl` が何を指すのかが曖昧なままになった．

## 今回見えたズレ

- `Entry` が何の単位を表す model なのかが揺れた
- `Entry.sourceUrl` の意味が実装ごとにぶれた
- `Entry` と他 model の責務境界が曖昧なまま実装が進みやすくなった

この流れは，実装上は成立しても，Geshi 側の共通 model としての `Entry` を弱くする．

## 今回決めるべきこと

`0044` では具体的な物理 model や table schema までは決めない．

先に固定したいのは次の原則である．

- `Entry` は共通 model として扱う
- `Entry` の意味を実装側へ委ねない

## 後続で詰める論点

後続では，少なくとも次を `docs/models.md` で整理する必要がある．

- `Entry` の共通責務
- `Entry.sourceUrl` の意味
- `Entry` が表す単位
- `Entry` と他 model の責務境界

ただし，この design log ではまだ model 名や保存場所を決めない．

## 参考資料

- [adr-0044] ADR-0044: Entry model を共通 model として再整理する
- [models] データモデル仕様

[adr-0044]: ../decisions/0044-entry-model-and-plugin-acquire-boundary.md
[models]: ../models.md
