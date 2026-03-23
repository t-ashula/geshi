# ADR-0010: backend の API 方針を定める

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- ADR-0004 により，`backend/` は Web API の提供を責務として持つことが決まっている
- ADR-0005 により，`cli/` は backend のユースケースを呼ぶ側に留め，将来的には backend の HTTP API を呼ぶだけで成立する形へ寄せる方針になっている
- `frontend/` もまた，backend が提供する情報と操作を利用する側として位置づけられている
- `docs/models.md` により，`source / channel / feed / program / episode / asset / derivative` という概念モデルの土台ができた
- この段階で，backend の API が何の正本であり，どこまでを外部に見せるかを先に定めておきたい

## 決定

- backend は HTTP API を提供する
- backend の HTTP API は，Geshi における操作の共通入口とする
- `frontend` は backend の機能を HTTP API 経由で利用する
- `cli` も将来的には backend の HTTP API を利用することを基本方針とする
- backend 内部のユースケースと HTTP API の責務は極力そろえ，HTTP API だけが特別な業務ロジックを持たないようにする
- backend の API は，概念モデルをそのまま露出するのではなく，利用側に必要な単位で読み書きできるように設計する
- backend の API では，少なくとも次の領域を順次扱えるようにする
  - `channel` / `feed` の管理
  - `program` / `episode` の参照
  - `asset` / `derivative` の参照
  - 収集，録画，文字起こし依頼などの操作
- 認証，認可，API フレームワーク，URL 設計，レスポンス形式の詳細は本 ADR では決めない

## 影響

- `frontend` と `cli` が依存する入口として，backend API の位置づけを早めに固定できる
- 後続の ADR で，永続化やジョブ実行方式を決める際にも，外部境界を意識して整理しやすくなる
- 概念モデルと API 表現を分けて考える前提が共有される
- CLI を backend 内部実装へ過度に結びつけることを避けやすくなる

## 代替案

- `frontend` は HTTP API，`cli` は backend の内部関数を直接呼ぶ
  - 当面は実装しやすいが，境界が二重化しやすい
- backend の API を参照専用にして，書き込みは CLI 専用にする
  - 運用経路が分かれすぎる

## 備考

- 本 ADR は，HTTP API の位置づけと責務境界だけを定める
- リソース設計，認証方式，ジョブ起動 API の具体形は後続 ADR で扱う

## 参考資料

- [adr-0000] ADR-0000 ADR ドキュメントフォーマットと設計ログ
- [adr-0004] ADR-0004 backend の初期アーキテクチャ方針
- [adr-0005] ADR-0005 cli の初期アーキテクチャ方針
- [models] データモデル

[adr-0000]: ./0000-adr-format.md
[adr-0004]: ./0004-backend-initial-architecture.md
[adr-0005]: ./0005-cli-initial-architecture.md
[models]: ../models.md
