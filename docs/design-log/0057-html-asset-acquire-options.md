# Design Log 0057

`html asset` acquire の方式と plugin 責務に関する比較メモ．

## この開発項目で先に決めたいこと

- `html asset` の acquire に何を使うか
- HTTP 取得と Playwright 取得をどう使い分けるか
- plugin が collector settings として何を設定できるかを host とどう共有するか
- frontend が settings UI をどう組み立てるか
- browser automation を plugin 個別依存にせず SDK 側でどう提供するか

## acquire の候補

### 1. plugin の `acquire` で通常の HTTP fetch を行う

- 既存の `observe -> acquire -> storage` 境界と自然につながる
- `audio` と同様に `html` も asset 単位で扱える
- plugin ごとに必要な request header や URL 正規化を閉じ込めやすい
- 一方で，サイト側の癖に応じた retry や MIME 判定の補強は別途必要になりうる

### 2. plugin の `acquire` で Playwright を使う

- JS 実行後の DOM や browser 文脈を必要とする page に対応できる
- page 遷移後の待機条件や DOM 安定化を収集条件に含められる
- 一方で，browser 実行環境，timeout，待機条件の設計が必要になる

### 3. backend 共通層に HTML 専用 downloader を持つ

- 共通の retry / redirect / content-type 判定を寄せやすい
- 一方で，plugin が source 固有に持つべき取得知識まで backend 側へ漏れやすい
- Playwright を含むと downloader 自体が重くなりやすい

## acquire option の候補

### HTTP 側の最小構成

- timeout
- redirect follow
- `Accept: text/html,application/xhtml+xml`
- 取得結果の content-type を保存する

### Playwright 側の最小構成

- navigation timeout
- load 完了後の待機条件
- 必要なら追加 wait
- 取得結果の content-type または取得方式 metadata

### 追加候補

- retry 回数
- user-agent 上書き
- content-type 不一致時のフォールバック判定
- charset 補正
- viewport
- script 実行待ちの selector / event 条件

### この段階の考え

- 静的 page には HTTP，動的 page には Playwright を選びたい
- ただし，この切替を settings に出しても，最終的な挙動は plugin 実装が握る
- したがって，取得方式の選択や具体 option は plugin の責務として扱う方が筋がよい
- retry や MIME 補正はなお必要だが，まずは HTTP / Playwright の二系統を扱えることを優先したい

## collector settings 宣言の候補

### `plugin.settingSchema()` で settings 定義を返す

- plugin author は TypeScript で書きやすい
- host 側は plugin から設定可能項目を runtime で取得できる
- UI や validation に流し込みやすい
- 一方で，schema 表現をどこまで豊かにするかの設計が必要になる

### この段階の考え

- plugin が設定できるキー名と型は，host 側でも理解できる必要がある
- 単なる自由 object では UI や validation が弱い
- したがって，`plugin.settingSchema()` のように plugin から host へ collector settings schema を渡せる仕組みが必要
- 第一弾では最低限 `key` と `type` があればよく，追加 metadata は後から足す
- frontend に返す形も `key` / `type` / `value` を持つ object の array で十分
- `type` は将来 `select` / `radio` / `checkbox` などへ拡張できるよう，文字列ではなく `type: { type: "text" }` のような入れ子にしておく

## frontend settings UI の候補

### backend が schema を返し frontend が動的に組み立てる

- plugin 固有 settings UI を frontend にハードコードせずに済む
- schema と validation と表示を揃えやすい
- 一方で，schema 表現に UI 構築に十分な情報をどこまで含めるかを決める必要がある

### frontend が plugin ごとに個別実装する

- 個別最適化はしやすい
- 一方で，plugin 拡張性が弱く，schema 変更時の追従コストも高い

### この段階の考え

- `plugin.settingSchema()` を導入するなら，frontend は backend が返す schema を使って UI を組み立てる方が自然
- plugin ごとの UI 直書きは避けたい

## SDK 提供 browser capability の候補

### 1. SDK が factory と共通 interface を提供する

- plugin author は一定の共通 API で書き始めやすい
- host 側で browser 実行環境を一元管理しやすい
- 一方で，共通 interface だけでは出来ることの差を吸収しきれない可能性がある

### 2. 共通 interface に加えて browser 本体への escape hatch を持つ

- 抽象化しすぎずに高度な利用も許せる
- fetch / Playwright / puppeteer の差を plugin 側で必要な範囲だけ扱える
- 一方で，host がどこまで互換を保証するかを明確にする必要がある

### この段階の考え

- plugin が個別に `puppeteer` や Playwright を依存へ追加する形は避けたい
- browser automation は host / SDK 側で用意し，plugin から capability として使える形がよい
- まずは `webClient` と標準 `Request` / `Response` を扱う fetch 風 wrapper を用意する
- ただし，共通 interface だけでは差分を吸収しきれないので，browser 本体へ到達できる escape hatch も必要

## 現時点の推奨

- acquire は plugin の `acquire` 境界に残す
- 取得方式は plugin 実装の責務とし，少なくとも HTTP と Playwright の両方を取りうるようにする
- collector settings は，`plugin.settingSchema()` により plugin が host へキー名と型を宣言できる形を持たせる
- frontend は backend が返す schema をもとに source collector settings UI を組み立てる
- browser automation は plugin 個別依存ではなく SDK 提供 capability として扱う
- SDK は `webClient` factory と標準 `Request` / `Response` を扱う fetch 風 wrapper を提供しつつ，必要なら browser 本体にも到達できるようにする

## まだ残る論点

- content-type が不正または欠落している page をどこまで救済するか
- Playwright 実行環境を worker にどう配るか
- HTTP / Playwright の取得結果を fingerprint や metadata にどう反映するか
- `plugin.settingSchema()` に `key` / `type` 以外の metadata をどこまで持たせるか
- schema に UI 構築用 metadata をどこまで含めるか
- `webClient` wrapper と browser 本体露出の境界をどこで切るか
