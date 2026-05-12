# ADR-0016: source collector plugin は content と asset の fingerprint を返す

## ステータス

決定

## 範囲

`crawler`

## コンテキスト

- [acceptance-0003] では，podcast RSS を対象として，source collector plugin の `observe` / `acquire` 契約，`content` / `asset` モデル，および実ファイル保存先の仕様を揃えることを受け入れ条件にしている
- [ADR-0012] では，`observe` が内容を表す情報と保存対象を表す情報を対応づけて返し，`acquire` が asset 単位で実行されることを決めている
- [ADR-0014] では，`content` と `asset` を拡張し，snapshot 的に扱うための `version` を持たせることを決めている
- しかし，どの観測結果を同一 `content` とみなし，どの保存対象を同一 `asset` とみなすかはまだ決まっていない
- この同一性判定がないままでは，ある観測結果が新しい主体なのか，既存主体の別 version なのかを区別できない
- `content` / `asset` の同一性判定は，source collector plugin が source 種別ごとの文脈をもとに決めないと意味を持たない
- ただし，backend が既存 `content` / `asset` をすべて plugin へ渡して都度照合させるのは現実的ではない
- そのため，plugin が同一性判定に使う fingerprint を返せること自体を，plugin 側の契約として定める必要がある

## 決定

- source collector plugin は，`content` と `asset` の同一性判定に使う fingerprint を返すものとする
- `content` については，`observe` が source 内で何を同一 content とみなすかに基づいて content fingerprint 群を返す
- `asset` については，2 種類の fingerprint を返す
  - `observe` は，観測時点で得られる情報に基づく observed asset fingerprint 群を返す
  - `acquire` は，取得した実体に基づく acquired asset fingerprint 群を返す
- plugin は，content fingerprint，observed asset fingerprint，acquired asset fingerprint のそれぞれについて，これまで扱ったすべての version の fingerprint を返す
- observed asset fingerprint と acquired asset fingerprint の version は，それぞれ独立して管理する
- fingerprint には，導出アルゴリズムの version を prefix として含める
- fingerprint version prefix は，最新 version を単純比較できるように `yyyy-mm-dd` 形式の文字列とする
  - fingerprint version prefix は日付そのものではなく version を表す
  - 同じ日にアルゴリズムを変更する場合でも，fingerprint version prefix は新しい version へ更新する
  - fingerprint の最新判定は，version 番号の大小で行う
- fingerprint の本体は，可変長の生文字列ではなく，導出元情報を hash した固定長の値とする
- observed asset fingerprint は，観測時点での `asset` 解決に使えるように返す
- acquired asset fingerprint は，取得後に実体差分を判定できるように返す
- plugin interface は，backend が content fingerprint 群，observed asset fingerprint 群，acquired asset fingerprint 群を保存および照合できるように，その受け渡しを含む形で定義する

## 影響

- `content` と `asset` の新規作成と version 追加とを区別できるようになる
- source 種別ごとの文脈を，plugin 内で fingerprint 生成へ反映できる
- fingerprint 導出アルゴリズムを将来変更しても，prefix によって旧値と新値を区別できる
- plugin が複数 version の fingerprint を返すことで，導出アルゴリズム変更後も既存データとの照合を続けやすくなる
- `asset` について，観測段階で分かる同一性と，取得後に分かる実体同一性とを分けて扱える
- content の同一性と asset の同一性とを別スコープで扱える
- 一方で，source 種別ごとにどの情報が同一性判定に使えるかを追加で整理する必要がある

## 代替案

- 同一性判定を定義せず，すべての観測結果を常に新規 `content` / `asset` として扱う
  - 実装は単純だが，`version` や snapshot を意味ある形で扱えないため採らない
- backend 側で source 種別に応じた同一性判定を行い，plugin は raw な観測結果だけを返す
  - source ごとの文脈を backend 側へ漏らすことになり，plugin 境界の意味が薄れるため採らない

## 参考資料

- [ADR-0012] ADR-0012 source collector plugin の observe と acquire の責務境界
- [ADR-0014] ADR-0014 acquire を扱うために content と asset モデルを拡張する
- [ADR-0017] ADR-0017 api backend は fingerprint に基づいて content と asset の登録規則を適用する
- [acceptance-0003] Podcast RSS Content Asset And Storage Foundation

[ADR-0012]: ./0012-podcast-rss-observe-and-acquire-boundary.md
[ADR-0014]: ./0014-content-and-asset-model-for-acquire.md
[ADR-0017]: ./0017-source-collector-upsert-based-on-identity.md
[acceptance-0003]: ../acceptance/0003-podcast-rss-content-asset-and-storage-foundation.md
