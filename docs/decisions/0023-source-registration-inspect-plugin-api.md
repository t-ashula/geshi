# ADR-0023: source collector plugin に source 登録前 inspect API を追加する

## ステータス

決定

## 範囲

plugin, api backend

## コンテキスト

- 現在の source collector plugin は `observe` と `acquire` を持つが，source 登録前に URL から初期データを引くための入口は持っていない
- 今回の段階では，podcast RSS URL が与えられた時点で feed の `title` や `description` を抽出し，登録画面の補完用データとして frontend へ返したい
- preview の解釈を backend service に直接持たせると，plugin 境界の外に source 種別ごとの解釈ロジックが漏れる
- [ADR-0011] と [plugin-doc] では，外部 source へのアクセスと source 種別ごとの差分は plugin 境界で扱う前提を採っている
- [ADR-0022] により，新規に追加する backend service では，期待される失敗を `result` 型で扱う方針を採る

## 決定

- `source collector plugin` に，source 登録前 `inspect` API を追加する
- 現段階では `inspect` 呼び出し先 plugin は `podcast-rss` に固定し，URL から plugin を選択する仕組みは導入しない
- `inspect` API は RSS URL を受け取り，次を返す
  - 正規化済み URL
  - sourceSlug
  - feed から抽出した `title`
  - feed から抽出した `description`
- `podcast-rss` plugin はこの `inspect` API を実装し，RSS の取得と feed 解釈を担う
- `api backend` は plugin の `inspect` API を呼び出し，HTTP request / response へ変換する境界として振る舞う
- `inspect` API の期待される失敗は `result` 型で扱い，少なくとも次を区別する
  - URL 必須
  - URL 不正
  - plugin 非対応
  - feed 取得失敗
  - RSS ではない，または plugin が解釈できない
- `inspect` API の解釈規則は，可能な限り `observe` と揃える
- 現時点で source 登録対象は `podcast-rss` しかないため，URL からどの plugin を選ぶかは，この段階では設計対象に含めない
- `inspect` の失敗は source 登録不能を意味せず，補完失敗として呼び出し側が扱えるようにする

## 影響

- source 種別ごとの `inspect` 解釈ロジックを plugin 境界へ閉じ込められる
- backend 側は plugin の結果を API 表現へ変換する責務に集中できる
- いまは plugin 選択を考えずに `podcast-rss` の `inspect` 追加へ集中できる
- `podcast-rss` 以外の source 種別でも，将来は同じ拡張点を流用できる
- inspect 失敗と登録失敗を分離して扱える

## 代替案

- backend service が plugin を介さず直接 RSS を取得して初期データを作る
  - source 種別ごとの解釈ロジックが plugin 境界の外へ漏れるため採らない
- 既存の `observe` を流用して `inspect` も兼ねる
  - source 登録前の確認と継続クロールでは入力も出力も責務も異なるため採らない

## 参考資料

- [ADR-0011] ADR-0011: source クロールを plugin 境界で拡張可能にする
- [ADR-0022] ADR-0022: 期待される失敗は result 型で表現する
- [ADR-0024] ADR-0024: web ui frontend の source 登録フローを 2 段階化する
- [acceptance-0005] Acceptance 0005 Source Registration Preview
- [plugin-doc] Plugin

[ADR-0011]: ./0011-source-crawl-plugin-responsibilities.md
[ADR-0022]: ./0022-result-type-for-expected-failures.md
[ADR-0024]: ./0024-source-registration-preview-ui-flow.md
[acceptance-0005]: ../acceptance/0005-source-registration-preview.md
[plugin-doc]: ../plugin.md
