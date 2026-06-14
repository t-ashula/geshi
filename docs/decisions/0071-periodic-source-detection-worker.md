# ADR-0071: 新規 source 候補を定期検知する worker を導入する

## ステータス

決定

## 範囲

`api backend`, `worker`, `job queue`

## コンテキスト

- [ADR-0029] では，登録済み `source` を対象として `observe-source` job を投入する定期クロール worker を導入した
- しかしこの worker は既知 `source` の content 更新検知を目的としており，未知 `source` の発見は対象にしていない
- 音泉のように `program` ごとに source を持つ場合，既知 `program` の更新は通常クロールで追えても，新しい `program` がサイトに追加されたことは別経路で検知する必要がある
- こうした検知は，source 登録 UI で人が都度 URL を入れるだけでは追いきれず，catalog / listing を定期的に走査する worker が必要になる
- 一方で，未知 `source` の発見を既存の periodic crawl worker に混ぜると，「既知 source の content crawl」と「未登録 source の候補検知」が同じ scheduler responsibility に混在する
- 検知結果は直ちに source 自動登録されるとは限らず，既存 source との dedupe や保留，通知，承認待ちといった後続 policy を別途扱いたい

## 決定

既知 `source` の periodic crawl とは別に，新規 source 候補を定期検知する worker を導入する．

### worker の位置づけ

- 新 worker は，catalog / listing / frontier のような「source 候補を列挙する対象」を定期的に走査する
- 既知 source の `observe-source` job を投入する worker とは別責務として扱う
- worker 自体は候補検知と host への受け渡しに責務を限定し，source の自動登録 policy までは内包しない

### 管理単位

- worker の管理単位は既知 `source` ではなく，source 検知対象である listing / catalog / frontier とする
- 各検知対象は少なくとも次を持てるようにする
  - 対象 URL
  - 対応 pluginSlug
  - 有効 / 無効
  - 実行間隔
  - plugin 固有 config
- 検知対象ごとの継続状態は，既知 source の collector state と分けて保持する

### 実行方式

- worker は定期的に有効な検知対象を走査し，対象ごとに source 検知 API を実行する
- plugin が返した detector state は，対象 listing ごとの current state として保存する
- worker は plugin が返した source 候補を，既存 source との dedupe 前提で host 側へ渡す
- dedupe 後の新規候補は，検知結果として保存するか，後続 job / service へ引き継ぐ

### 既知 source との関係

- worker は候補 URL や pluginSlug, sourceKind, sourceSlug 候補などを用いて既存 source と突き合わせる
- 既に登録済みの source は新規候補として重複保存しない
- 同じ未登録候補が毎回検知されても，host 側で重複を抑制できる形にする

### 自動登録 policy との分離

- worker は候補検知のための基盤であり，自動登録を既定動作にしない
- 検知結果をどう扱うかは少なくとも次のいずれかを取りうる
  - 保留候補として一覧化する
  - 通知対象として扱う
  - 別 policy のもとで自動 source 作成する
- これらの policy は worker とは別設計として扱う

### 既存 periodic crawl worker との関係

- 既存 periodic crawl worker は，登録済み `source` を対象とする現在の責務を維持する
- 新 worker は，未登録 source 候補の検知だけを担う
- 両者を別 worker にすることで，設定，state ownership，障害時の再試行，監視指標を分けやすくする

## 影響

- backend / worker には，source 検知対象を管理する設定と detector state の永続化が必要になる
- job queue には，source 検知用 worker と必要に応じた follow-up job の入口が追加される
- 音泉のような catalog 型 source で，新しい `program` を既知 source の observe とは別経路で継続検知できる
- 一方で，検知対象の CRUD, 検知結果一覧, 承認フロー, 自動登録 policy などの周辺機能は別途設計が必要になる

## 代替案

- [ADR-0029] の periodic crawl worker に未知 source 検知も混ぜる
  - 既知 source crawl と未知 source discovery の責務，設定，state ownership が混ざるため採らない
- 外部 cron から都度 listing URL を叩いて ad hoc に候補検知する
  - `geshi` 内の設定，state，dedupe と分断しやすいため採らない
- plugin が source 候補検知と source 自動登録まで一括で行う
  - host の ownership と policy 決定が plugin 外へ逃げるため採らない

## 備考

- worker 名称は実装時に詰めてよいが，`periodic-crawl` とは別名にする
- 検知対象設定の置き場は，全体設定か専用主体かを含めて実装時に詰めてよいが，既知 source の collector setting とは分ける

## 参考資料

- [ADR-0010] ADR-0010: source クロールの実行基盤として job queue を導入する
- [ADR-0029] ADR-0029: 定期クロール job は source 設定を走査して observe-source を投入する
- [ADR-0030] ADR-0030: 定期実行クローラの設定は source ごとの設定から分けて管理する
- [ADR-0070] ADR-0070: source collector plugin に継続的な source 検知 API を追加する

[ADR-0010]: ./0010-source-crawl-job-queue.md
[ADR-0029]: ./0029-periodic-source-crawl-scheduling.md
[ADR-0030]: ./0030-configuration-management.md
[ADR-0070]: ./0070-source-collector-source-detection-api.md
