# ADR-0022: BullMQ による job 実行基盤の初期実装を開始する

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- ADR-0021 により，backend の job 実行基盤として BullMQ を採用した
- 次に進むには，Redis を含む BullMQ の最小構成と，queue / worker / producer の骨格を用意したい

## 決定

- `backend/` に BullMQ を導入し，job 実行基盤の初期実装を開始する
- 初期段階では，次を最小スコープとする
  - BullMQ と Redis の最小接続
  - Docker Compose による Redis の用意
  - 動作確認用 dashboard として `bull-board` を backend に組み込む
  - queue の最小定義
  - worker の最小起動構成
  - producer 相当の最小 enqueue 経路
  - 開発用 npm script と手順文書
- BullMQ の導入と最小動作確認を目的とし，Geshi 側 `job` モデルとの橋渡しや統合はこの段階では扱わない

## 影響

- BullMQ 前提の backend 実装を進められる
- Redis を含む開発環境の具体化が進む
- 後続の Geshi 側 `job` モデル統合や job API 実装の前提確認になる

## 代替案

- BullMQ 導入をさらに後ろへ送る
  - ADR-0021 の決定を実装へつなげにくい
- Geshi 側 `job` モデルとの橋渡しまで同時に実装する
  - 初期スコープが広がりすぎる

## 備考

- 本 ADR は BullMQ bootstrap を対象とする
- queue / worker / producer の最小構成を先に作り，Geshi 側 `job` との統合は後続で進める
- 動作確認用 dashboard には `bull-board` を使い，Hono adapter 経由で backend に載せる

## 参考資料

- [adr-0012] ADR-0012 backend のジョブ実行方針を定める
- [adr-0019] ADR-0019 Hono による backend 初期実装を開始する
- [adr-0021] ADR-0021 backend のジョブ実行基盤を選定する

[adr-0012]: ./0012-backend-job-execution-policy.md
[adr-0019]: ./0019-backend-hono-bootstrap.md
[adr-0021]: ./0021-backend-job-runtime-selection.md
