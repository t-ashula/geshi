# Design Log 0027

`ADR-0027` の補足メモ．

## この段階の論点

- `web ui frontend` の browse state を URL に写すとして，どの粒度で path を分けるか
- source 選択状態と content 選択状態を，同じ path 形で畳むか，役割ごとに分けるか
- browse 用 namespace の名前を何にするか

## 前提

- UI は source 一覧，content 一覧，detail を一画面内で連携して browse する
- browse state を URL に持たない案は採らない
- root 直下に `/{source-slug}/{content-id}` を置く形は，将来の path の自由度を落とすため採らない

## 比較した案

### `/{source-slug}/{content-id}`

- path は短い
- ただし root 直下を早い段階で消費する
- `source-slug` と `content-id` の役割が path 上で明示されない
- 今後 `/jobs`, `/settings`, `/sources` のような別機能を足すときに整理しづらい

### `/browse/{source-slug}/{content-id}`

- browse 用 namespace を 1 段入れられる
- 一方で `source-slug` と `content-id` を同じ path 形に畳むため，segment の意味が path 自体からは読み取りにくい
- content を直接開く URL と source を選ぶ URL を同じ系統で扱うことになり，後から派生状態を増やしにくい

### `/browse/feed/{source-slug}` と `/browse/entry/{content-id}`

- path の各 segment が何を選んでいるかを明示できる
- source 選択状態と content 選択状態を URL 上でも分けられる
- content 直リンクを持ちやすい
- 今後 `/browse/all` や別の browse 状態を増やす余地を残しやすい
- `/browse/feed/` や `/browse/entry/` のような識別子欠落 path を正規 route に含めず，404 として切り分けやすい
- internal model 名の `source` / `content` を path に直接出さずに済む

## 参照した実装パターン

### `Inoreader`

ユーザー観測ベースでは，次のように状態を分けている．

- `/all_articles`
- `/feed/{source-url}`
- `/article/{content-id}`

この構成では，全体一覧，特定 source，一件の article が URL 上で別の役割として扱われる．

今回の `geshi` でも，source と content を同じ path 形へ押し込むより，役割ごとに分けるほうが自然であると判断した．

## 名前の比較

### `view`

- 単一対象の表示名に見えやすい
- 一覧から辿る browse state 全体の名前としては少し狭い

### `read`

- 記事や文書を読む文脈には合う
- 音声 asset を含む media archive 全体の browse には少し寄りすぎる

### `browse`

- source 一覧から content を辿り，detail を見る操作全体を表しやすい
- media archive 全体の閲覧状態として広すぎず狭すぎない

### `feed` / `entry`

- `source` / `content` より内部 model 名がそのまま見えにくい
- `feed` / `article` より既視感を出しすぎずに RSS 文脈を保てる
- `channel` を将来の上位概念として空けておける

## この段階の整理

- browse 用 namespace は `browse` を使う
- source 選択状態と content 選択状態は，path segment を分けて表す
- 基本 URL は次とする
  - `/browse`
  - `/browse/feed/{source-slug}`
  - `/browse/entry/{content-id}`

## 補足

- `entry` を直接開いたときに source 一覧側をどう選択状態へ寄せるかは，URL 設計ではなく画面実装側の責務として残す
- query parameter による詳細な filter state は，この段階では決めない
