# ADR-0014: backend の HTTP API フレームワークを選定する

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- ADR-0004 により，`backend/` の責務範囲は定まっている
- ADR-0010 により，backend の HTTP API は Geshi における操作の共通入口として扱うことが決まった
- ADR-0011 と ADR-0012 により，永続化方針とジョブ実行方針の基本線も定まってきた
- ここまでで backend が何を担うかはある程度明確になったため，次は実装フレームワークを選定してよい段階に入っている
- HTTP API，CLI からの起動，ジョブ実行基盤との接続を考えると，過度に重すぎず，Node.js / TypeScript と相性のよい構成を選びたい

## 決定

- backend の HTTP API フレームワークとして Hono を採用する
- queue，scheduler，ORM，検索基盤のライブラリ選定は本 ADR では扱わない
- 採用理由は次の通りである
  - TypeScript との相性がよい
  - HTTP API 層を薄く保ちやすい
  - backend を API サーバとして素直に構成しやすい
  - 将来的に frontend / backend の配信を完全に分離しても扱いやすい

## 影響

- backend 実装の具体化を進めやすくなる
- 後続の API 実装やジョブ起動経路の詳細設計に着手しやすくなる
- 他の技術選定と分けて，HTTP API フレームワークの判断だけを先に固定できる
- backend を static 配信込みの一体サーバとしてではなく，API サーバとして捉えやすくなる

## 代替案

- フレームワーク選定をさらに後ろへ送る
  - 実装方針の具体化が進みにくい
- HTTP API フレームワーク以外も一度に選定する
  - 判断対象が広がりすぎる

## 備考

- 本 ADR は，backend の HTTP API フレームワークとして Hono を採用する判断を記録する
- `npm install` や初期実装は後続の開発項目で扱う

## 参考資料

- [adr-0004] ADR-0004 backend の初期アーキテクチャ方針
- [adr-0010] ADR-0010 backend の API 方針を定める
- [adr-0011] ADR-0011 backend の永続化方針を定める
- [adr-0012] ADR-0012 backend のジョブ実行方針を定める

[adr-0004]: ./0004-backend-initial-architecture.md
[adr-0010]: ./0010-backend-api-policy.md
[adr-0011]: ./0011-backend-persistence-policy.md
[adr-0012]: ./0012-backend-job-execution-policy.md
