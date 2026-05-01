# ADR-0031: route handler のテスト容易性を interface 境界と Hono 依存の隔離で高める

## ステータス

決定

## 範囲

`backend`

## コンテキスト

- 現在の `backend` は `src/routes` / `src/service` / `src/db` に責務を分けているが，route 実装ごとの依存の持ち方はまだ統一されていない
- route から直接 concrete class や生成関数に寄った依存をたどると，handler 単体での差し替えがしにくくなり，テストが実 DB や広い起動経路に寄りやすい
- route の分割粒度そのものよりも，handler が依存をどう受け取り，`Hono.Context` にどこまで縛られるかが testability を強く左右している
- [ADR-0007] は backend に HTTP 入出力と機能別ロジック，永続化アクセスの責務分割を置くことを決めているが，test を容易にするための依存方向までは明示していない
- [ADR-0019] により Web UI 起点の E2E は既に導入しているが，E2E だけでは route ごとの正常系・異常系・入力境界の確認を細かく保ちにくい
- [ADR-0022] により service 境界では `result` 型による失敗表現を採用しており，route handler 側は HTTP 変換責務に集中させやすい条件が揃っている
- 今後 API が増える前に，route 実装の依存方向，Hono 依存の置き場，test の基本方針を先に固定したい

## 決定

- `backend` の API 実装は，test を容易にするため，interface への依存を基本とする
- route handler は concrete class の直接生成や global な実装参照を避け，必要な依存を interface 越しに受け取る
- route handler の業務分岐は `Hono.Context` から切り離し，Hono 依存は HTTP adapter として隔離する
- route の構成では，上位の app が下位の routing を登録し，下位の routes に app instance を引き回さない
- route handler の test を，API の主要な自動テスト単位として扱う

### interface 依存の原則

- route handler から参照する機能は，原則として interface または interface 相当の抽象型で受け取る
- interface は route handler が必要とする振る舞いだけに絞る
- interface の背後にある具体実装は，service，repository，plugin，storage などの concrete class でよいが，handler からはそれを前提にしない
- 実装生成や配線は，route handler 本体ではなく，アプリケーション組み立て側に寄せる

### Hono 依存と route 構成の原則

- `Hono.Context` への依存は，request の解釈と response の構築に閉じ込める
- route module は少なくとも，次の責務を混在させない
  - HTTP request の解釈
  - service 呼び出し
  - `result` や例外の HTTP response への写像
- route の分割粒度は固定しないが，上位の app が下位の routing を登録する向きは崩さない
- 下位の routes に app instance を渡して設定を書き足させる形は採らない
- route ごとの責務が大きくなった場合は，登録処理と handler 本体を同一ファイル内の別関数，または近接ファイルへ分離してよい

### route handler test の原則

- route handler test では，Hono の request / response を通して HTTP 入出力を検証する
- test では concrete class ではなく test double を注入し，handler の分岐と HTTP 変換を確認する
- route handler test は，現行 API の response を回帰基準として保持する役割も持つ
- 少なくとも次を route handler test の対象に含める
  - 入力の正常系
  - 入力検証エラー
  - `result` 型で返る期待される失敗の HTTP status / body 変換
  - 想定外障害の 500 変換
- 既存 API を移行する際は，現在の response body と status を正として，回帰がないことを同時に確認する
- repository や DB の正しさは別の test 単位で扱い，route handler test に持ち込まない

### 移行方針

- `backend` の既存 route 実装は，段階移行ではなく，一度に揃えて移行する
- 対象は `sources`，`contents`，`jobs`，`settings` を含む既存の API 一式とする
- 新旧の route 構成や依存方式を長期間混在させない
- 移行時は，route 構成，dependency injection，Hono 依存の隔離，route handler test の追加を一体で行う
- あわせて，現行 API の response を固定する test を整備し，構造変更による回帰がないことを確認する

## 影響

- route handler を DB や worker 起動経路から切り離して test しやすくなる
- API の仕様変更時に，HTTP level の回帰を route 単位で早く検出しやすくなる
- Hono 依存の置き場が明確になり，HTTP 都合と業務都合の混線を抑えやすくなる
- app 組み立て側に依存配線が寄るため，生成責務と利用責務の境界が明確になる
- interface 設計が増えるため，抽象化が粗すぎたり細かすぎたりしないレビューが必要になる
- 一括移行になるため，変更量とレビュー対象は一時的に大きくなる
- 一括移行の中で現行 response の固定化も進めるため，既存 API の期待値を先に明文化する必要がある

## 代替案

- route test ではなく E2E のみを API の主検証手段とする
  - 利用者経路の確認には有効だが，入力境界や失敗変換の網羅が重くなるため採らない
- concrete class 依存のまま，module mock で route test を成立させる
  - test は書けるが，依存方向が実装詳細に縛られ，保守性が下がるため採らない
- backend の route 構成だけを先に変え，dependency injection や Hono 依存の整理は後回しにする
  - 見た目だけ分かれて本質的な testability 改善が起きないため採らない

## 備考

- この ADR は route handler test を API テストの基本単位とするものであり，E2E を置き換えるものではない
- service，repository，plugin，worker の test 方針は，必要に応じて別 ADR で補足してよい
- interface は TypeScript の `interface` に限定せず，最小の振る舞いを表す `type` や引数契約でもよい
- route の段階分離は手段であり，目的は dependency injection と Hono 依存の隔離である

## 参考資料

- [ADR-0007] ADR-0007: api backend の初期構成
- [ADR-0019] ADR-0019: Web UI 起点の最小 E2E を Playwright で検証する
- [ADR-0022] ADR-0022: 期待される失敗は result 型で表現する

[ADR-0007]: ./0007-api-backend-initial-architecture.md
[ADR-0019]: ./0019-e2e-test-foundation.md
[ADR-0022]: ./0022-result-type-for-expected-failures.md
