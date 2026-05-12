# ADR-0012: source collector plugin の observe と acquire の責務境界

## ステータス

決定

## 範囲

`crawler`, `api backend`

## コンテキスト

- [acceptance-0003] では，podcast RSS を対象として，source collector plugin の `observe` / `acquire` 契約，`content` / `asset` モデル，および実ファイル保存先の仕様を揃えることを受け入れ条件にしている
- [ADR-0011] では，source collector plugin が `observe` と `acquire` を持つことは決めているが，`observe` が何を返し，`acquire` がどこまでを責務に含むかは十分に定まっていない
- source collector plugin が直接得るのは，`content` そのものではなく，継続対象から抽出した内容を表す情報と，それに付随する保存対象の情報である
- これらを分けずに扱うと `content` と `asset` の責務が曖昧になる
- 実ファイルの保存だけでなく，各内容に対してどの保存対象があるかを呼び出し側が把握できることが，後続の保存処理や失敗追跡の前提になる

## 決定

- source collector plugin の `observe` は，収集対象の内容を表す情報だけでなく，各内容に付随する保存対象を表す情報も，対応づいた形で返すものとする
- `observe` の結果は，内容単位のまとまりとして扱い，呼び出し側が内容とその保存対象の対応を失わないようにする
- source collector plugin の `acquire` は，`observe` で把握できた保存対象を対象として扱うものとする
- `acquire` は保存対象の asset 単位で実行する
- `acquire` の入力は，対象 asset とその親 `content` を含むものとする
- plugin 自体は backend の domain model を直接更新しないという [ADR-0011] の前提は維持する

## 影響

- `observe` の結果として，内容とその保存対象の対応を保ったまま後続処理へ渡せる
- source collector plugin 全般で，内容本体と付随ファイルを混同せずに扱いやすくなる
- `acquire` の失敗や再試行を，保存対象ごとの粒度で扱いやすくなる
- `acquire` を asset 単位で実行しつつ，常に親 `content` 文脈を伴って扱える
- 取得した実ファイルを `storage` に保存した結果を，`asset` としてどのように永続化するかは，引き続き後続で判断が必要になる

## 代替案

- `observe` は内容情報だけを返し，保存対象の情報は `acquire` 側で都度再解釈する
  - どの保存対象がどの内容に属するかを後段で再構成する必要があり，責務境界が曖昧になるため採らない
- `acquire` を内容単位で扱い，1 回の呼び出しで複数の保存対象をまとめて取得する
  - 内容全体の取得には向くが，失敗追跡と再試行の粒度を保存対象ごとに保ちにくいため採らない
- 実音声ファイルだけを扱い，その他の保存対象は後回しにする
  - 初期実装は単純になるが，source ごとに観測できる付随情報を最初から欠落させるため採らない

## 参考資料

- [ADR-0011] ADR-0011 source クロールを plugin 境界で拡張可能にする
- [acceptance-0003] Podcast RSS Content Asset And Storage Foundation
- [design-log-xxxx] Design Log xxxx

[ADR-0011]: ./0011-source-crawl-plugin-responsibilities.md
[acceptance-0003]: ../acceptance/0003-podcast-rss-content-asset-and-storage-foundation.md
[design-log-xxxx]: ../design-log/xxxx-podcast-rss-acquire-foundation.md
