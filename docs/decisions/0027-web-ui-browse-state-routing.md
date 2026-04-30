# ADR-0027: web ui frontend の browse state を URL に写す

## ステータス

決定

## 範囲

`web ui frontend`

## コンテキスト

- `web ui frontend` では，source 一覧，content 一覧，detail を一画面内で連携して browse できる形に寄せたい
- そのとき，source 選択や content 選択の状態を URL に持たせるかどうかを先に決めておかないと，画面実装と URL 設計が後からずれやすい
- browse state を URL に持たない場合は，リロードや共有時に選択状態を失う
- browse state を URL に持つ場合は，未選択状態，source 選択状態，content 選択状態をどの URL で表すかを決める必要がある
- 今回の UI 改善では，詳細な visual ではなく，一画面 browse の状態遷移を安定させたい

## 決定

- `web ui frontend` の browse state は URL に写す
- 少なくとも次の状態を URL で表現できるようにする
  - source 未選択
  - source 選択
  - source 選択かつ content 選択
- source / content / detail は別画面へ分割せず，一画面 browse の状態として扱う
- URL 形式は path を採用し，browse 用の namespace を 1 段入れる
- browse state の基本 URL は次とする
  - `/browse`
  - `/browse/feed/{source-slug}`
  - `/browse/entry/{content-id}`
- `source-slug` と `content-id` は同じ path 階層に直置きせず，役割ごとの segment を分ける
- `/browse/feed/` と `/browse/entry/` のように識別子を欠く path は正規 route とせず，404 として扱う
- `entry` を URL で直接開いた場合も，一画面 browse の state として扱えるようにする

## 影響

- browse state を保持したまま reload や共有がしやすくなる
- source / content / detail の選択状態を local state だけに閉じずに扱える
- 画面構造の変更時も，URL と状態遷移の対応を基準に整理しやすくなる

## 代替案

- browse state を URL に持たず，frontend の local state のみで扱う
  - reload や共有時に状態を失い，一画面 browse の状態遷移が不透明になりやすいため採らない

## 参考資料

- [ADR-0006] ADR-0006: web ui frontend の初期アーキテクチャを定める
- [acceptance-0006] Acceptance 0006 Web UI Polish

[ADR-0006]: ./0006-web-ui-frontend-initial-architecture.md
[acceptance-0006]: ../acceptance/0006-web-ui-polish.md
