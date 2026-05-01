# ADR-0034: 非 RSS HTML page を source 化する sample 外部 package plugin を追加する

## ステータス

提案

## 範囲

`plugin`, `crawler`, `api backend`

## コンテキスト

- [ADR-0033] により，source collector plugin 契約を外部 package から参照できる公開境界として扱う方針を取る
- ただし，公開拡張点の設計が妥当かどうかは，既存内蔵 plugin とは別に外部 package plugin の実例を 1 つ定めないと判断しづらい
- `geshi` は RSS 以外の source も扱う前提であり，HTML page を直接読んで更新単位を抽出する plugin は代表的な検証対象である
- sample として `go-jp-rss` 相当の package を用意すると，RSS feed が提供されていない page を source として扱う最小経路を確認できる
- 一方で，HTML page 由来の source は RSS と違って item list や asset URL の構造が標準化されていないため，content identity と source metadata の決め方を先に定義しておく必要がある

## 決定

- 外部 package から追加する sample plugin として，非 RSS HTML page を source 化する source collector plugin package を追加する方針にする
- この sample plugin は，`go-jp-rss` 相当の用途を持つものとして，HTML page を取得し，そこから source metadata と content 候補を解釈する
- sample plugin の役割は，一般 HTML 取得基盤を作ることではなく，「内蔵 plugin と共存する外部 package plugin 境界が成立すること」を示すことに置く

### sample plugin の責務

- `inspect`
  - 対象 HTML page を取得する
  - page title や description 相当の metadata を返す
  - source 登録時に使う正規化 URL を返す
- `observe`
  - page 内の更新単位を列挙する
  - 各更新単位について，`content` 候補と対応する asset 候補を返す
  - content identity は page 構造に依存する stable な URL または plugin 固有 fingerprint で表す
- `acquire`
  - `observe` が返した対象 asset を取得する
  - HTML 本体または関連ファイルを保存対象として返せるようにする

### sample plugin のスコープ制限

- 初期段階では，対象サイトを広く一般化しない
- `go-jp-rss` 相当の plugin は，特定の HTML 構造を前提とした collector として実装してよい
- JavaScript 実行や headless browser を前提にしない
- login や認証付き source は対象外とする
- page 構造変更への追従戦略は，将来の plugin 個別課題として扱う

### identity と asset の方針

- content identity は，RSS の `guid` のような外部識別子が無い場合でも，plugin が安定して再計算できる値として返す
- HTML page 上の個別 entry URL がある場合は，それを優先して content identity に使う
- entry URL が無い場合は，plugin が HTML 断片から導出する fingerprint を使ってよい
- asset は，少なくとも再取得可能な source URL を持つものだけを acquire 対象にする
- HTML page 全体を primary asset とするか，entry ごとの linked resource を primary にするかは，plugin ごとの解釈規則として明示する

## 影響

- RSS 以外の source を対象に，外部 package plugin API の妥当性を早い段階で検証できる
- source metadata 解釈，content identity，asset 取得という plugin 責務を，HTML page でも同じ境界で扱えるかを確認できる
- `podcast-rss` だけでは見えにくい plugin API の不足を洗い出しやすくなる
- 一方で，sample plugin は対象 HTML 構造への依存が強く，汎用 collector と誤解されないよう文書化が必要になる

## 代替案

- sample plugin を作らず，内蔵 plugin だけで設計を確定する
  - 公開拡張点として本当に足りるかを検証しづらいため採らない
- sample として別の RSS 系 plugin を追加する
  - feed 由来の構造差分しか検証できず，HTML page 直読みによる設計圧を得にくいため採らない
- HTML source は plugin ではなく backend 側の専用実装として扱う
  - source 種別ごとの差分が plugin 境界の外へ漏れるため採らない

## 参考資料

- [ADR-0011] ADR-0011: source クロールを plugin 境界で拡張可能にする
- [ADR-0016] ADR-0016: source collector plugin は content と asset の fingerprint を返す
- [ADR-0023] ADR-0023: source collector plugin に source 登録前 inspect API を追加する
- [ADR-0033] ADR-0033: source collector plugin 契約を外部 package から参照できる公開境界として定義する
- [plugin-doc] Plugin

[ADR-0011]: ./0011-source-crawl-plugin-responsibilities.md
[ADR-0016]: ./0016-source-collector-content-and-asset-identity.md
[ADR-0023]: ./0023-source-registration-inspect-plugin-api.md
[ADR-0033]: ./0033-source-collector-plugin-api-package-boundary.md
[plugin-doc]: ../plugin.md
