# ADR-0057: `html asset` の acquire 方式は source collector plugin が責務を持つ

## ステータス

決定

## 範囲

`crawler`, `api backend`

## コンテキスト

- [ADR-0012] では，source collector plugin の `observe` が内容と保存対象を対応づけて返し，`acquire` は asset 単位で実行することを決めている
- [ADR-0013] では，`podcast-rss` plugin が episode page を `html` asset として扱うことを決めている
- [ADR-0015] により，acquire した asset は storage に保存される前提になっている
- 一方で，`html asset` を acquire するときに，通常の HTTP 取得で十分な source と，JS 実行や画面描画後の DOM 取得が必要な source とがありうる
- ただし，取得方式や待機条件を settings に出しても，最終的な実装責務は plugin 側にあり，source ごとの差分も plugin 側で吸収することになる
- さらに，plugin が設定可能な collector settings の形を host とどう共有するかが未整理だと，取得に必要な option を安全に受け渡しにくい
- また，Playwright のような browser automation を plugin が使う場合に，各 plugin が個別に重い依存を抱えると，配布や実行環境管理が不安定になりやすい
- `html asset` の取得方式を先に決めないと，request option，Playwright 利用条件，失敗時挙動，source 固有知識の置き場所がぶれる

## 決定

- `html asset` の acquire は，source collector plugin の `acquire` 境界で行う
- 通常の HTTP 取得は，静的な episode page や単純な server-side rendered page の既定方式として扱う
- Playwright 取得は，JS 実行後の DOM や browser 文脈が必要な page を扱うための選択肢として扱う
- `html asset` を取得する request や browser 実行の具体的な条件は，plugin 実装が責務を持つ
- source 固有の取得知識は plugin 側へ寄せる
- plugin が利用可能な collector settings は，`plugin.settingSchema()` により，host と plugin の間でキー名と型を共有できる形で宣言可能にする
- backend は，`plugin.settingSchema()` から得た schema を frontend へ返し，frontend が source collector settings UI を組み立てられるようにする
- plugin が browser automation を必要とする場合は，plugin 個別依存として勝手に抱えるのではなく，SDK 側が提供する factory と実行機構を通じて利用する方針にする

### acquire の初期方針

- 通常の HTTP 取得では，redirect follow，timeout，HTML を期待する request header を基本にする
- Playwright 取得では，少なくとも page 遷移 timeout や待機条件を設定できる前提で扱う
- 取得結果の content-type や取得方式は，保存対象 metadata として扱えるようにする
- collector settings の宣言は，`plugin.settingSchema()` が「何を設定できるか」を host に伝えられる形で持つ
- browser automation は，plugin SDK から参照できる host 提供 capability として扱う
- SDK は，Playwright / puppeteer / fetch などの差をまたぐための factory と一定の共通 interface を持つ
- ただし，共通 interface だけでは足りない機能のために，必要なら browser 本体へ到達できる escape hatch も持たせる

### この段階で決めきらないこと

- retry 回数や backoff policy の標準化
- user-agent の全体方針
- content-type 欠落や不正時の救済規則
- Playwright browser context の共通管理方式
- `plugin.settingSchema()` の schema 表現をどこまで豊かにするか
- SDK の共通 interface でどこまで吸収し，どこから browser 本体の escape hatch に委ねるか

## 影響

- 既存の `observe -> acquire -> storage` 境界の延長で `html asset` を扱える
- source ごとに静的取得と browser 取得との違いを plugin 側へ閉じ込められる
- plugin 設定のキー名や型を host と共有しやすくなる
- frontend が plugin 固有 settings UI をハードコードせずに済む
- browser automation 依存を plugin ごとに重複して抱えずに済む
- 共通 interface と browser 本体露出の両方を持つため，抽象化しすぎずに高度な利用も許しやすい
- 一方で，Playwright 実行環境や timeout，待機条件の設計が新たに必要になる

## 代替案

- source collector settings に取得方式や option を露出し，運用設定で切り替える
  - 最終的な取得責務は plugin 実装に残るため，契約が中途半端になりやすく採らない
- plugin が必要な settings を自由な `config` object の慣習だけで受け取る
  - host 側でキー名や型を理解できず，検証や UI 連携が弱くなるため採らない
- plugin ごとに `puppeteer` や Playwright を個別依存として抱えさせる
  - 実行環境管理と配布が不安定になり，SDK 境界の利点も薄れるため採らない
- SDK が browser 本体を隠し，共通 interface だけを露出する
  - fetch と Playwright と puppeteer で出来ることの差を吸収しきれず，plugin 側で必要な高度機能を扱いにくいため採らない
- frontend が plugin ごとの settings UI を個別実装する
  - schema 変更のたびに frontend 実装も追従が必要になり，plugin 拡張性が弱くなるため採らない
- 全 source で Playwright 取得を既定にする
  - 静的 page にも browser 起動コストを強制し，単純 source の運用を重くするため採らない
- 通常の HTTP 取得だけに固定し，Playwright を導入しない
  - JS 実行や browser 文脈が必要な page を収集対象から外すことになるため採らない
- backend 共通の HTML 専用 downloader だけで完結させる
  - source 固有の取得知識と settings 解釈の置き場が曖昧になるため採らない

## 参考資料

- [ADR-0012] ADR-0012 source collector plugin の observe と acquire の責務境界
- [ADR-0013] ADR-0013 podcast rss plugin で episode と付随 asset を対応づけて扱う
- [ADR-0015] ADR-0015 acquire した実ファイルを保存する storage の責務を定義する
- [ADR-0043] ADR-0043 外部 plugin 開発のために plugin author 向け SDK 境界を分離する
- [acceptance-0012] HTML Asset Detail And Acquire Foundation
- [design-log-0057] Design Log 0057

[ADR-0012]: ./0012-podcast-rss-observe-and-acquire-boundary.md
[ADR-0013]: ./0013-podcast-rss-episode-and-asset-handling.md
[ADR-0015]: ./0015-storage-for-acquired-assets.md
[ADR-0043]: ./0043-plugin-sdk-boundary-for-external-plugin-development.md
[acceptance-0012]: ../acceptance/0012-html-asset-detail-and-acquire-foundation.md
[design-log-0057]: ../design-log/0057-html-asset-acquire-options.md
