# ADR-0050: plugin と job の一般インタフェースとして next-action arguments と共通実行 context を定義する

## ステータス

提案

## 範囲

`plugin`, `sdk`, `job`, `worker`

## コンテキスト

- 録画系では，`observe` が返した source 固有条件を，後続の `record-content` job へ渡す必要がある
- 一方で，`observe` の返り値に source 固有条件を平坦に並べると，core 側が理解しない情報まで公開契約に露出しやすい
- また，録画中の途中経過を `jobs.metadata` へ反映したい場合，plugin 実行中に core 側へ metadata 更新を依頼できる共通の窓口が必要になる
- これらは録画系だけの特例として閉じるより，plugin と job の一般インタフェースとして定義した方が，他の後続 job や plugin API にも適用しやすい

## 決定

- `observe` が返す asset ごとの next-action policy は，少なくとも次を含む
  - `actionKind`
  - `scheduledStartAt`
  - `arguments`
- `arguments` は，後続 job にそのまま引き継ぐ plugin 固有 object とする
- `jobs.metadata` は，少なくとも `core` と `plugin` の namespace に分ける
- core 側が保存・更新する情報は `jobs.metadata.core` 配下に置く
- plugin 側が読む/書く情報は `jobs.metadata.plugin` 配下に置く
- `observe-source` worker は，next-action policy の `arguments` を `jobs.metadata.plugin.arguments` へ保存する
- 後続 job は，`jobs.metadata.plugin.arguments` を plugin 実行入力の一部として利用してよい
- plugin API は，共通の実行 context を受け取る
- 上記 context は，`record` だけの特例ではなく，`observe` / `acquire` / `record` を含む plugin API 全体で共有する
- `record` のような後続 job 実行 API には，`jobs.metadata.plugin.arguments` から読み出した `arguments` を通常の input として渡す
- 上記 context には，少なくとも metadata 更新 API を含めてよい
- metadata 更新 API は，plugin が `jobs.metadata.plugin` 配下だけを更新できるものとする
- plugin が実行中の途中経過を残す場合は，`jobs.metadata.plugin.progress` 配下へ保存する
- metadata の正本保存は core 側が担い，plugin は必要な進行情報を生成して上記 API へ渡す

## 影響

- plugin SDK の公開契約に，next-action policy の `arguments` と，共通実行 context の考え方が追加で必要になる
- `observe-source` worker は，後続 job 分岐だけでなく，後続 job へ渡す plugin 固有引数の永続化も担う
- `record-content` のような後続 job は，plugin 固有条件を `jobs.metadata.plugin.arguments` から受け取る前提で実装できる
- plugin 実行 input と実行中 metadata 更新経路とが分かれるため，「初期入力」と「途中経過」の責務を分けやすい
- source 固有条件を core 側の固定 schema に押し込めずに，plugin ごとの差分を保ったまま job orchestration へ橋渡しできる
- 録画系で必要になった metadata 更新 API を，他の plugin API にも共通の仕組みとして広げられる
- `jobs.metadata` の key ownership が明確になるため，core 側更新と plugin 側更新が衝突しにくくなる

## 代替案

- plugin に `jobs.metadata` 全体を書き換えさせる
  - core 側の管理項目と plugin 側の進行情報が衝突しやすく，key ownership が不明瞭になるため採らない
- source 固有条件を next-action policy の top-level field として都度追加する
  - core 側が解釈しない field が増え続け，公開契約の責務が曖昧になるため採らない
- `observe` の返り値には `arguments` を持たせず，後続 job 側が source や asset から再計算する
  - plugin が既に判定した source 固有条件の受け渡し経路が失われ，job 側へ知識が漏れるため採らない
- metadata 更新 API を `record` だけの特例にする
  - 一般化可能な実行 context 設計を録画系だけに閉じ込めることになり，不自然な API 境界になるため採らない

## 参考資料

- [ADR-0047] ADR-0047: `observe` 結果は asset ごとの next-action policy を含める
- [ADR-0048] ADR-0048: 録画系 acquire は専用 job orchestration と複数 worker 前提で扱う
- [acceptance-0011] Recording Job Foundation

[ADR-0047]: ./0047-observed-asset-next-action-policy.md
[ADR-0048]: ./0048-recording-job-orchestration.md
[acceptance-0011]: ../acceptance/0011-recording-job-foundation.md
