# ADR-0015: backend の API 表現詳細を定める

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- ADR-0010 により，backend の HTTP API は Geshi における操作の共通入口として扱うことが決まっている
- `docs/models.md` では，`source / channel / feed / program / episode / asset / derivative` という概念モデルを整理している
- ただし，概念モデルをそのまま HTTP API に露出するとは限らず，利用側にとって扱いやすい表現へ整える必要がある
- `frontend` と将来の `cli` は backend API を利用する前提のため，API がどの粒度で何を返すかを整理しておきたい

## 決定

- backend の API 表現詳細を定める
- この ADR では，少なくとも次を対象にする
  - `channel / feed / episode / asset / derivative` を API でどう見せるか
  - 読み取り系 API と書き込み系 API の粒度
  - job 状態と domain データの API 上の分け方
  - `frontend` と `cli` から見た扱いやすい単位
- 認証方式，URL 設計，OpenAPI の具体形，validation ライブラリの採用は本 ADR では決めない

### 基本方針

- backend の API は，基本的には resource ベースで表現する
- ただし，処理起動や再試行のように resource の CRUD だけでは表しづらい操作については，action を併用する
- つまり，Geshi の API は純粋な REST に寄せ切るのではなく，resource と action を混ぜた形を基本とする
- action は，原則として `resource/:id/action` の形で，対象 resource 配下に置く
- ただし `search` のような横断的 query は，この原則の例外として専用 endpoint を許す
- `derivative` のような派生物は，通常は job の結果として生成されるものとして扱い，独立した create 操作を中心には据えない
- `asset` は内部モデルとしては共通に扱うが，API では一様に独立 resource として露出しない
- 音声ファイルや録画ファイルのような file 系 `asset` は，必要に応じて独立 resource として参照できるようにする
- 本文テキストや説明文のような text 系 `asset` は，親 resource の表現に吸収することを基本とする
- `job` は，状態確認や実行履歴参照のための resource として露出してよい
- ただし現時点では，`job` 自体を action の対象にはしない
- action は，当面 `channel`，`episode`，`asset` などの domain 側 resource に対して行うことを基本とする

### イメージ

- 参照系
  - `channel`，`episode`，`asset`，`job` などを resource として参照する
- 操作系
  - `crawl`
  - `record`
  - `transcribe`
  - `retry`
  などを action として扱う

## 影響

- `frontend` と `cli` が利用する API の境界を具体化しやすくなる
- 概念モデルと API 表現のずれを意識して設計しやすくなる
- 後続の Hono 実装や API ルーティング設計へ進みやすくなる

## 代替案

- API 表現を実装時に都度決める
  - route ごとに粒度がばらけやすい
- 認証や URL 設計まで一度に決める
  - 判断対象が広がりすぎる

## 備考

- 本 ADR は，backend の API がどのような単位でデータと操作を表現するかを整理するための項目である
- 実際の route 一覧や request / response 形状の詳細は，この ADR の更新または後続文書で詰める

## 参考資料

- [adr-0010] ADR-0010 backend の API 方針を定める
- [adr-0012] ADR-0012 backend のジョブ実行方針を定める
- [models] データモデル

[adr-0010]: ./0010-backend-api-policy.md
[adr-0012]: ./0012-backend-job-execution-policy.md
[models]: ../models.md
