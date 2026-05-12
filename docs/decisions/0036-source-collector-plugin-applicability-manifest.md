# ADR-0036: source collector plugin の適用可能性は plugin API で判定する

## ステータス

決定

## 範囲

`plugin`, `api backend`, `web ui frontend`

## コンテキスト

- [ADR-0033] により，source collector plugin は外部 package から参照できる公開契約で追加できるようにする
- ただし，適用可能性を判定する前に，plugin が source collector plugin であること自体を backend が識別できる必要がある
- この識別は外部 package だけでなく，`podcast-rss` のような built-in plugin に対しても共通である必要がある
- [ADR-0034] では，その sample として `go-jp-rss` 相当の非 RSS HTML page collector を追加する方針を取っている
- しかし，`go-jp-rss` のような plugin は任意の source URL に対して意味があるわけではなく，特定 host や特定 page 構造にしか適用できない
- 現在の plugin 契約では，`pluginSlug` を知っていれば呼べるだけで，「どの source に対して適用可能か」を静的に表現する手段がない
- 一方で，URL pattern や host だけでは最終判定できず，実際の page 内容を見て初めて「対応可能 / 非対応 / 解釈不能」が決まる plugin もある
- そのため，plugin の適用可能性は，plugin 自身が持つ API で判定できる必要がある

## 決定

- plugin が source collector plugin であることの識別は，manifest の capability 宣言で行う
- この capability 宣言は，built-in plugin と外部 package plugin の両方に必須とする
- source collector plugin は，source URL に対する適用可能性を判定する API を公開契約に含める
- この API は，plugin がその source に対して意味を持ちうるかを，plugin 自身の知識で判定する
- `inspect` は，適用可能と判断された source に対して，登録用初期データを返す責務に寄せる
- `backend` と `frontend` は，候補の絞り込みや事前案内にこの API の結果を使ってよい

### manifest に含める情報

- plugin manifest は，少なくとも次を持つ
  - `pluginSlug`
  - `sourceKind`
  - `displayName`
  - `description`
- さらに，source collector plugin であることを示す capability 情報を持つ
- manifest は plugin の識別と説明のための metadata に留め，適用条件そのものは持たせない

### supports の役割

- plugin は，`supports` のような API で source URL に対する適用可能性を返す
- `supports` は，少なくとも `supported` / `unsupported` を区別できればよい
- 必要に応じて，なぜ unsupported なのかを表す reason を返してよい
- `supports` は，`inspect` より軽い判定であることを優先する

### inspect の役割

- `inspect` は，適用可能な source に対して，実際の取得と初期 metadata 抽出を行う
- plugin が `supports` では supported と判断した URL でも，実取得の結果として解釈不能なら `source_inspect_unrecognized` を返してよい
- plugin が対象であり，必要な metadata を抽出できた場合は登録用初期データを返す

### backend / frontend での使い方

- `backend` は manifest と `supports` の両方を registry 経由で扱えるようにしてよい
- `backend` は manifest の capability を見て source collector registry へ登録し，その後に `supports` を呼ぶ
- `frontend` は manifest を plugin 選択 UI の説明に使ってよい
- source 登録時に URL が与えられたとき，候補 plugin に対して `supports` を呼び，supported な plugin の `inspect` を試してよい
- plugin を明示選択する UI を先に置く場合でも，URL と選択 plugin の組み合わせに対する事前 validation として `supports` を使ってよい

## 影響

- `go-jp-rss` のような特定 source 向け plugin の適用範囲を，公開契約の中で明示できる
- `frontend` や `backend` が，無関係な plugin を無差別に試す必要を減らせる
- plugin 適用可能性の知識を plugin 自身に閉じ込められる
- 一方で，`supports` と `inspect` の責務境界は，今後の plugin 追加に応じて見直しが必要になる

## 代替案

- 適用可能性 API を持たせず，すべて `inspect` の結果だけで判定する
  - 最終判定はできるが，候補絞り込みや UI 補助の情報が弱くなるため採らない
- host / URL pattern のような静的条件だけを manifest に持たせる
  - 実際の page 構造や plugin 固有ロジックまで表現しづらく，適用可能性の知識が公開契約の静的 metadata に寄りすぎるため採らない
- source 側に plugin ごとの適用条件をハードコードする
  - plugin の公開契約に含めるべき知識が backend / frontend 側へ漏れるため採らない

## 参考資料

- [ADR-0023] ADR-0023: source collector plugin に source 登録前 inspect API を追加する
- [ADR-0033] ADR-0033: source collector plugin 契約を外部 package から参照できる公開境界として定義する
- [ADR-0034] ADR-0034: 外部 package plugin のサンプルとして非 RSS ページを source にする実装を追加する
- [plugin-doc] Plugin

[ADR-0023]: ./0023-source-registration-inspect-plugin-api.md
[ADR-0033]: ./0033-source-collector-plugin-api-package-boundary.md
[ADR-0034]: ./0034-html-source-collector-sample-plugin.md
[plugin-doc]: ../plugin.md
