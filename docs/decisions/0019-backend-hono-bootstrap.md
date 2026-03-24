# ADR-0019: Hono による backend 初期実装を開始する

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- ADR-0014 により，backend の HTTP API フレームワークとして Hono を採用した
- ADR-0010，ADR-0012，ADR-0015 により，backend は Geshi の操作の共通入口であり，job の起動や状態参照も含む HTTP API を提供する方針が固まっている
- これまでの ADR で，backend の責務，API 表現，永続化方針の大枠は整理できた
- 次に進むには，実装を始められる最小の backend 骨格を用意したい

## 決定

- `backend/` に Hono を導入し，初期実装を開始する
- 初期段階では，次を最小スコープとする
  - Hono アプリケーションを生成する最小構成
  - Node.js 上で起動する最小エントリポイント
  - ヘルスチェック相当の最小 endpoint
  - 今後 route を追加できる最小の route 登録構成
  - backend 開発用の最小 npm script
  - backend 開発開始手順を共有するための最小ドキュメント
- 初期実装の目標は，次を満たすこととする
  - `backend/` 単体で起動できる
  - `GET /health` のような最小 endpoint に応答できる
  - route 追加先が見える構成になっている
  - backend 用の起動 script が用意されている
  - 開発者が backend の起動方法を文書から追える
  - 既存の `lint` と `typecheck` を通せる
- 認証，永続化，job 実行基盤，OpenAPI などはこの段階では導入しない
- 画面用 API や domain 固有の route もこの段階では導入しない

## 影響

- backend の実装を着手できる状態になる
- API route の追加や Hono 前提の構成整理を進めやすくなる
- 後続の job 実行基盤や永続化実装の受け皿を作れる
- backend の開発開始手順を共有しやすくなる

## 代替案

- Hono 導入をさらに後ろへ送る
  - 設計だけが先行し，実装着手が遅れる
- 認証や永続化まで同時に初期化する
  - 初期スコープが広がりすぎる

## 備考

- 本 ADR は backend の最小 bootstrap を対象とする
- 具体的な package 導入やコード変更は，この ADR を前提に後続コミットで行う
- 想定する成果物は，Hono の導入，backend の起動コード，最小 route 定義，npm script，開発手順文書であり，domain 実装そのものではない

## 参考資料

- [adr-0010] ADR-0010 backend の API 方針を定める
- [adr-0014] ADR-0014 backend の HTTP API フレームワークを選定する
- [adr-0015] ADR-0015 backend の API 表現詳細を定める

[adr-0010]: ./0010-backend-api-policy.md
[adr-0014]: ./0014-backend-http-api-framework-selection.md
[adr-0015]: ./0015-backend-api-representation.md
