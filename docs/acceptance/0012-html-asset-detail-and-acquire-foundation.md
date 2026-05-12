# HTML Asset Detail And Acquire Foundation

この開発項目では，`content detail` における `html asset` の扱いを第一弾として成立させるために，`html asset` を取得して保存し，detail から参照でき，`summary` と競合せずに共存できる状態を受け入れ条件とする．

## 受け入れ条件

- `html asset` を acquire 対象として扱う content で，対応する HTML 本文を取得して保存できる
- `html asset` の取得方式として，少なくとも通常の HTTP 取得に加えて，必要に応じて Playwright を使う実装を取りうる
- `html asset` の取得で必要な option や policy が定まり，実装がその前提に従っている
- source collector plugin が，collector settings として何を設定できるかを，`plugin.settingSchema()` を通じてキー名と型つきで host とやり取りできる
- collector settings schema は，最低限 `key` と `type` を持ち，frontend へは `key` / `type` / `value` を持つ object の配列として返せる
- frontend が source collector settings の参照・変更 UI を backend から受け取った schema に基づいて組み立てられる
- plugin が browser automation を使う場合に，個別 plugin が勝手に `puppeteer` や同等依存を抱えずに済むよう，SDK 側で `webClient` と標準 `Request` / `Response` を扱う fetch 風 wrapper が提供され，必要なら browser 本体も取り出せる仕組みが定まっている
- `html asset` から作られた `detail_body` が存在する場合，`content detail` はそれを本文表示の優先対象として扱える
- `detail_body` が存在しない場合，`content detail` は `summary` を本文表示のフォールバックとして扱える
- `content detail` から，本文表示に使った `detail_body` または元の `html asset` 参照導線に到達できる
- `html asset` が未取得，取得失敗，または参照不能な場合に，detail の表示や導線が破綻しない
- `detail_body` をどう作るか，どう記録するかが定まり，実装がその前提に従っている
- UI は `content detail` 取得 request を通常の fetch として非同期に発行し，応答で返った `detail_body` を受けて表示を書き換えられる
- `html asset` の取得，保存，detail での参照，`summary` との共存について，主要な正常系と異常系が自動テストまたは再現可能な確認手順で検証されている

## 確認方法

- `html asset` を持つ content を観測して acquire し，対応する HTML 本文が storage に保存されることを確認する
- `plugin.settingSchema()` が宣言した collector settings のキー名と型に従って，host 側で設定値を受け渡せることを確認する
- backend が返す settings schema に基づいて，frontend が source collector settings の参照・変更 UI を組み立てられることを確認する
- plugin が Playwright 系機能を使う場合に，SDK 側の factory と共通 interface を通じて実行でき，必要なら browser 本体へ到達でき，plugin 個別依存の持ち込みを前提にしないことを確認する
- collector settings schema が `key` / `type` を持ち，backend から `key` / `type` / `value` 配列として返せることを確認する
- plugin が Web 取得系機能を使う場合に，SDK から得た `webClient` と標準 `Request` / `Response` を扱う wrapper を通じて実行できることを確認する
- `detail_body` が存在する content で，`content detail` がそれを本文表示の優先対象として扱うことを確認する
- `detail_body` が存在しない content で，`content detail` が `summary` をフォールバック表示として扱うことを確認する
- `content detail` を開き，本文表示に使った `detail_body` と，必要なら元の `html asset` 参照導線に到達できることを確認する
- `detail_body` 未生成の状態で `content detail` を取得し，UI をブロックせずに応答を待ち，返ってきた `detail_body` が表示へ反映されることを確認する
- `html asset` の未取得または取得失敗を発生させ，detail が空表示や壊れた導線にならず，状態が識別できることを確認する
- 関連する frontend / backend / worker のテスト，または同等の再現可能な手順で，主要な正常系と異常系が確認できることを確認する
