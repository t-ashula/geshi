# ADR-0062: plugin 実行時の logger 追加コンテキストは呼び出された側が付与する

## ステータス

決定

## 範囲

`geshi-sdk`, `api backend`, `crawler`, external plugins

## コンテキスト

- [ADR-0018] は，logger に child bindings を持たせ，共通文脈を束ねられるようにする方針を定めている
- plugin 実行では，host 側が job, source, plugin slug などの実行文脈を持っており，plugin 側はその上に plugin 内部の処理段階や対象 URL などの文脈を重ねて出力したい
- ただし，どちらの側が logger へ追加コンテキストを付与するかが曖昧なままだと，host 側が plugin 内部事情まで先回りして bindings を増やしたり，plugin 側が文脈追加をできずに message や metadata へ値を重複して埋めたりしやすい
- plugin API を `fn(input, context)` の形に寄せるなら，host は base logger を渡し，plugin はその logger をもとに自身の内部文脈を追加する責務分担の方が自然である
- 特に plugin ごとの sub-operation は host 側からは見えないため，呼び出し側が追加コンテキストを決める形では粒度が粗くなりやすい

## 決定

- plugin 実行時に host が渡す logger は base logger とする
- plugin 内部で必要な追加コンテキストは，呼び出された側が child logger または log metadata により付与する
- host 側は，job / source / plugin slug など host が知っている共通実行文脈までを base logger に束ねる
- plugin 側は，plugin 内部の処理段階，対象 URL，selector 分岐，解析対象 ID など，plugin 自身が知る局所文脈を logger に追加する
- host 側は，plugin 内部用の文脈を先回りして logger に埋め込まない

## 影響

- host と plugin の logger 責務分担が明確になる
- plugin 内部文脈を，plugin 自身が一貫した粒度で追加しやすくなる
- host 側が plugin ごとの内部事情を推測して bindings を増やす必要がなくなる
- 一方で，plugin author が logger の child / metadata 運用を理解して使う必要がある

## 代替案

- host 側が plugin 内部文脈までまとめて logger に付与する
  - plugin 内部の粒度を host が把握できず，不自然な共通化になりやすいため採らない
- plugin 側では child logger を使わず，すべて message や metadata の都度指定で済ませる
  - 繰り返しが増え，一貫した文脈付与もしにくいため採らない
- plugin と host の双方が同じ種類の文脈を重複して付与する
  - ログの重複や責務の曖昧さを招きやすいため採らない

## 参考資料

- [ADR-0018] ADR-0018 backend と worker に構造化ログを導入する

[ADR-0018]: ./0018-structured-logging.md
