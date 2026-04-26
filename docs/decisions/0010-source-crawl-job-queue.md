# ADR-0010: source クロールの実行基盤として job queue を導入する

## ステータス

決定

## 範囲

`api backend`, `crawler`

## コンテキスト

- [acceptance-0002] では，登録済み `source` を起点にクロール job を非同期実行できることを受け入れ条件にしている
- source 登録までは同期的な API と永続化で成立したが，クロールは外部通信，保存処理，再試行を伴うため，同期リクエストに閉じると扱いづらい
- 収集対象が増える前に，投入，実行，状態追跡，失敗時の再試行をどこで担うかを決める必要がある
- [system-architecture] では `crawler` をバッチ / 非同期処理の主体としているが，`api backend` との役割分担はまだ未整理である

## 決定

source クロールの実行基盤として，`pg-boss` を採用する．

- `api backend` はクロール要求を受け付け，job を投入する入口を担う
- job の実行は非同期 worker が担い，HTTP リクエスト中にクロール本体を完了させる前提を置かない
- queue 実装には PostgreSQL ベースの `pg-boss` を使う
- 初回クロールや将来の文字起こしのような手動起動可能な処理は，frontend から backend 経由で job を投入できるようにする
  - 継続的な（定期的な）クロールはの実現方法は後続の ADR であつかう
- queue 上の job には，少なくとも対象 `source` の識別子を含める
- job には少なくとも `queued`，`running`，`succeeded`，`failed` を追跡できる状態を持たせる
- 再試行可能な失敗は queue 側の再実行で扱える構成を採る
- job の状態や失敗理由は，後から `api backend` または運用手段から参照できるようにする
- queue の進捗詳細や長時間 job のイベント表現は，queue 実装固有機能に寄せず backend 側の job event で扱う

### 採用理由

- 現在の repo は PostgreSQL を前提にしており，queue 導入だけのために Redis などを追加しないで済む
- source クロールの初期要件では，投入，非同期実行，再試行，遅延実行，状態追跡が主であり，`pg-boss` で十分に満たせる
- 進捗や詳細ログは queue 実装固有 API に依存せず，backend 側の job event として扱う前提にすれば，長時間 job 向け UI / API も別途設計できる
- source ごとの継続クロールを backend 内の永続 job として表現できれば，frontend からの初回起動と内部の定期起動を同じ runtime に揃えられる
- backend API からの操作と PostgreSQL ベースの queue を近い構成で保てるため，運用要素を増やしすぎずに始めやすい

## 影響

- クロール要求の受付と，実際の取得処理を分離できる
- source 数や処理時間が増えても，HTTP タイムアウトや同期待ちに引きずられにくくなる
- job 状態，失敗理由，再試行の扱いを共通化しやすくなる
- 一方で，queue runtime，worker 起動方法，状態保存先の設計が追加で必要になる
- job の進捗やログを backend 側で扱うため，job event の model と API 設計が別途必要になる
- 継続クロールを積み続ける scheduler job と，個別クロール job の責務分離を別途詰める必要がある
- plugin 境界や asset 保存との接続方法を，後続 ADR で補う必要がある

## 代替案

- `api backend` で同期的にクロールを完了させる
  - 実装初速は出るが，長時間処理，失敗追跡，再試行の扱いが不安定になりやすいため採らない
- `BullMQ` を採用する
  - 進捗や dashboard 周りは強いが，現時点では Redis の追加運用が先に立つため，source クロール初期基盤としては採らない
- `crawler` を完全に独立した外部スケジューラ駆動にして，backend からは起動しない
  - 役割は明確になるが，source 単位の初回実行や将来の手動処理を UI / API から操作しづらいため現時点では採らない

## 参考資料

- [ADR-0003] ADR-0003 全体アーキテクチャ
- [ADR-0007] ADR-0007 api backend の初期構成
- [acceptance-0002] Source Crawl Foundation
- [system-architecture] System Architecture
- [design-log-0010] Design Log 0010
- [job-queue-doc] Job Queue

[ADR-0003]: ./0003-system-architecture.md
[ADR-0007]: ./0007-api-backend-initial-architecture.md
[acceptance-0002]: ../acceptance/0002-source-crawl-foundation.md
[system-architecture]: ../system-architecture.md
[design-log-0010]: ../design-log/0010-source-crawl-job-queue.md
[job-queue-doc]: ../job-queue.md
