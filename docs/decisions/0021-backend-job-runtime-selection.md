# ADR-0021: backend のジョブ実行基盤を選定する

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- ADR-0012 により，長時間処理は job として扱い，実行制御は backend に閉じる方針が決まっている
- ADR-0019 により，backend の最小 Hono bootstrap は整った
- Geshi では，複数種別の非同期処理を扱う前提がある
- 次に進むには，queue，scheduler，worker を含む job 実行基盤の方向を決めたい

## 決定

- backend の job 実行基盤として `BullMQ` を採用する
- 採用理由は次の通りである
  - Node.js 向け job 実行基盤として十分に利用実績がある
  - 専用 worker プロセスを追加起動しやすい
  - progress と event を扱いやすい
  - 親子 job や fan-out / fan-in を flow として扱える
  - 子 job 単位の retry を job 実行基盤側で持てる
- Geshi 側の `job` は API と履歴参照の基準となる正本として扱う
- BullMQ 側 job は job 実行基盤上の実行単位として扱い，Geshi 側 `job` とは別物とする
- Geshi 側 `job` から BullMQ への投入は，別段階の投入処理を経由させて行う
  - Geshi 側 `job` を保存した直後に直接 `queue.add()` する前提は採らない
  - job の投入タイミングや同時実行数の調整を，保存と分離して扱えるようにする
- job 種別ごとの差は，投入条件の違いとして後続で扱う
- 具体的な domain job の実装は後続の開発項目で扱う

## 影響

- 各種 job の実装方針を進めやすくなる
- backend API と job 実行の境界を具体化しやすくなる
- 永続化や運用方式の判断材料が増える
- 録画系 job を固定 worker 数前提で詰まらせない方向を選びやすくなる
- 全 job の投入モデルを一貫させやすくなる
- Redis を job 実行基盤用の追加インフラとして前提にする
- Geshi 側 `job` と BullMQ 側 job の二重管理が発生する
- BullMQ 固有の state，id，event を Geshi 側へどう反映するかを後続で詰める必要がある
- 進捗や親子関係の扱いをどこまで Geshi 側 model に反映するかを後続で詰める必要がある

## 代替案

- `pg-boss` を採用する
  - PostgreSQL に寄せられるのは魅力だが，親子関係や進捗集約を Geshi 側で自前実装する比重が高くなりやすい
- Geshi 側 `job` と job 実行基盤側 job を同一視する
  - job 実行基盤依存が強くなり，後の migration が重くなりやすい
- 実装を始めながら都度決める
  - queue や worker の責務が混ざりやすい
- crawler や transcription ごとに別方式を採る
  - job 実行モデルがばらけやすい

## 備考

- 本 ADR は job 実行基盤の選定を対象とする
- 具体的な package 導入やコード変更は，この ADR を前提に後続コミットで行う
- Geshi 側 `job` と BullMQ 側 job の対応づけ詳細，status 語彙，progress 反映方法は，この ADR の後続で詰める
- BullMQ 採用は，job 実行基盤としての利点を優先した判断であり，Geshi 側 `job` モデルとのずれや Redis 追加は受け入れる

## 参考資料

- [adr-0012] ADR-0012 backend のジョブ実行方針を定める
- [adr-0014] ADR-0014 backend の HTTP API フレームワークを選定する
- [adr-0019] ADR-0019 Hono による backend 初期実装を開始する

[adr-0012]: ./0012-backend-job-execution-policy.md
[adr-0014]: ./0014-backend-http-api-framework-selection.md
[adr-0019]: ./0019-backend-hono-bootstrap.md
