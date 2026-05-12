# ADR-0013: podcast rss plugin で episode と付随 asset を対応づけて扱う

## ステータス

決定

## 範囲

`crawler`, `api backend`

## コンテキスト

- [acceptance-0003] では，podcast episode に対応する実ファイルを取得し，`storage` へ保存できる状態を受け入れ条件にしている
- [ADR-0012] では，source collector plugin の `observe` が，内容を表す情報と保存対象を表す情報を対応づけて返すことを決める
- podcast RSS では，1 つの episode に対して，実音声ファイルだけでなく，個別ページなど複数の保存対象が存在しうる
- podcast RSS の取得経路では，episode と付随 asset の対応を失うと，何を保存するのか，どこで失敗したのかを追跡しづらくなる

## 決定

- `podcast-rss` plugin では，1 つの episode に対して複数の付随 asset を持ちうる前提で扱う
- `podcast-rss` plugin では，少なくとも episode の個別ページと実音声ファイルを asset として扱う
- `podcast-rss` plugin では，episode の個別ページを `primary: true` の asset として扱い，実音声ファイルは `primary: false` の asset として扱う
- `podcast-rss` plugin の `observe` 結果では，episode を表す情報と，その episode に付随する保存対象の情報とを対応づけて扱う
- `podcast-rss` plugin は，新しい source collector plugin 契約に沿って，episode と付随 asset を表す情報を取得できるようにする

## 影響

- podcast RSS で，episode 本体と付随 asset を分けて扱える
- episode の個別ページと実音声ファイルを，別々の asset として保存対象に含められる
- episode の代表的な参照先として，個別ページを主たる asset として扱える
- 実音声ファイル以外の付随情報も，将来の保存対象として拡張しやすくなる
- 一方で，podcast RSS plugin の入出力契約は，内容だけを返す単純な形より広がる

## 代替案

- podcast RSS では実音声ファイルだけを扱い，その他の付随 asset は最初から無視する
  - 実装初速は上がるが，episode に付随して観測できる情報を早い段階で落としてしまうため採らない
- episode と付随 asset の対応を保持せず，後段で都度推定する
  - 保存処理や失敗追跡で文脈を失いやすくなるため採らない

## 参考資料

- [ADR-0012] ADR-0012 source collector plugin の observe と acquire の責務境界
- [acceptance-0003] Podcast RSS Content Asset And Storage Foundation
- [design-log-xxxx] Design Log xxxx

[ADR-0012]: ./0012-podcast-rss-observe-and-acquire-boundary.md
[acceptance-0003]: ../acceptance/0003-podcast-rss-content-asset-and-storage-foundation.md
[design-log-xxxx]: ../design-log/xxxx-podcast-rss-acquire-foundation.md
