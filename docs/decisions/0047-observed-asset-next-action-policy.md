# ADR-0047: `observe` 結果は asset ごとの next-action policy を含める

## ステータス

提案

## 範囲

`plugin`, `sdk`, `crawler`, `job`

## コンテキスト

- 現行の `observe-source` worker は，`observe` の返り値を保存したあと，`acquire-content` job を直接 enqueue している
- この構成では，`observe-source` の後続処理は実質的に `acquire-content` へ固定されている
- podcast や通常 feed のような bounded download にはこれで足りるが，録画系 source では「今すぐ取得する asset」と「予約実行する asset」とを分ける必要がある
- これらの情報を plugin 外で再解釈すると，source 固有の知識が `observe-source` worker 側へ漏れる
- 録画の具体的な実行方法を各 plugin に委ねる前提でも，`observe-source` 側には「次に何の job を起こすべきか」を判断する最小契約が必要になる

## 決定

- `observe` の返り値のうち，後続処理方針は `content` 単位ではなく asset 単位で表現する
- `observe` は，各 asset について「次に何をすべきか」を表す next-action policy を返せるものとする
- next-action policy の一般 shape は [ADR-0050] に従う
- `observe-source` worker は，asset ごとの next-action policy を見て後続 job を分岐する
- `observe` の責務は asset とそれぞれの next-action policy 返すところまでとし，download や録画の実行そのものは後続 worker が担う
- next-action policy は plugin SDK の公開契約として扱い，built-in / external plugin の両方が同じ考え方で返せるようにする
- つまり plugin は source 固有知識に基づいて「次アクションの方針」を返し，core 側 worker はその方針に従って job orchestration を行う

## 影響

- plugin SDK の `observe` 結果，とくに asset 側の契約が拡張される
- `observe-source` worker は，`assetIdsRequiringAcquire` を一律で `acquire-content` へ送るのではなく，asset ごとの next-action policy を見て分岐する実装へ変わる
- `observe` は source 固有の知識を使って，asset ごとの次アクション方針を返す責務を持つ
- plugin に録画実装を委ねつつも，後続 job の起点だけは core 側で共通化できる
- 一方で，plugin SDK の version 管理と，既存 plugin の移行が必要になる

## 代替案

- next-action policy を `content` 単位で持つ
  - 同一 `content` 内で asset ごとの取得方式が分かれたときに表現しにくいため採らない
- next-action policy を持たせず，`asset.kind` や URL から `observe-source` worker が推測する
  - source 固有知識が worker 側へ漏れ，plugin 境界が崩れるため採らない
- 録画系だけ別 plugin API を作り，`observe` の返り値は変えない
  - 後続 job 分岐の入口が統一されず，plugin ごとの差異が大きくなりすぎるため採らない

## 参考資料

- [ADR-0012] ADR-0012: source collector plugin の observe と acquire の責務境界
- [ADR-0025] ADR-0025: crawl job は worker 実行に必要な情報を enqueue 時点で持つ
- [ADR-0033] ADR-0033: source collector plugin 契約を外部 package から参照できる公開境界として定義する
- [ADR-0043] ADR-0043: 外部 plugin 開発のために plugin author 向け SDK 境界を分離する
- [acceptance-0011] Recording Job Foundation

[ADR-0012]: ./0012-podcast-rss-observe-and-acquire-boundary.md
[ADR-0025]: ./0025-crawl-worker-input-interface.md
[ADR-0033]: ./0033-source-collector-plugin-api-package-boundary.md
[ADR-0043]: ./0043-plugin-sdk-boundary-for-external-plugin-development.md
[ADR-0050]: ./0050-plugin-and-job-shared-interface.md
[acceptance-0011]: ../acceptance/0011-recording-job-foundation.md
