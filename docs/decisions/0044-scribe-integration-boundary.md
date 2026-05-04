# ADR-0044: scribe 連携は adapter 境界に閉じ込める

## ステータス

決定

## 範囲

`api backend`, `operations`, `integration`

## コンテキスト

- `geshi` から `scribe` と接続する要求が出ているが，現時点では repository 内に `scribe` 専用の契約や設定運用は存在しない
- 現行 `scribe` は `github.com/t-ashula/scribe` にある Python / FastAPI service で，`POST /transcribe` に `audio/x-wav` を upload して非同期 job を起票し，`GET /transcribe/{request_id}` を polling して結果を得る API 形を持つ
- `scribe` は Redis / RQ ベースの job 実行と 24 時間 TTL の結果保持を前提にしているため，呼び出し側も request / polling / completion の 3 段階を意識する必要がある
- `geshi` は source collector plugin，backend service，worker，CLI など複数の実行主体を持つため，`scribe` 呼び出し位置を曖昧にしたまま進めると責務が分散しやすい
- 外部連携先固有の request / response shape や認証方式を domain model や plugin 契約へ直接持ち込むと，`scribe` 非依存であるべき内部境界が汚染されやすい
- credential，timeout，retry，可観測性の方針を実装前に揃えておかないと，運用時設定と source ごとの設定が混ざりやすい

## 決定

- `scribe` 連携は，`geshi` の内部各所から直接 SDK / HTTP client を呼ばず，明示的な adapter 境界を通して扱う
- `scribe` 固有の request / response shape は adapter 境界で吸収し，`geshi` 内部には use case に必要な最小 interface と変換済み data だけを渡す
- `scribe` 接続に必要な endpoint，credential，timeout などの設定は，source ごとの設定ではなく，まずアプリケーション全体の運用時設定として扱う
- 開発時の `scribe` 起動は `git submodule` を前提にせず，`~/src/github.com/t-ashula/scribe` のような sibling checkout を `compose` / `Makefile` から起動する入口を `geshi` 側へ持つ
- `scribe` 呼び出しを必要とする具体的な use case は個別実装で選んでよいが，その呼び出し元は raw な `scribe` client ではなく adapter interface に依存する
- `scribe` adapter は，少なくとも「transcription request の起票」と「job 状態の取得」を明示的に分けて表現する
- `scribe` adapter は，`pending` / `working` / `done` / `error` を区別できる status 取得 API を持ち，call site が無理に同期完了へ潰さなくても扱えるようにする
- retry，timeout，error 分類，構造化 logging などの外部連携に関する横断関心は，呼び出し元ごとに重複実装せず adapter 境界またはその直上で一貫して扱う
- `scribe` 未設定や認証不備のような運用不整合は，domain model の破損としてではなく，設定または外部連携 failure として表現する

## 影響

- `scribe` への依存が adapter 境界に集約され，backend / worker / plugin の責務分散を抑えやすくなる
- 将来 `scribe` の SDK や API version が変わっても，影響範囲を adapter 周辺へ寄せやすくなる
- source collector plugin や内部 service が，外部 SaaS 固有の型や認証方式へ直接依存しなくて済む
- client 残骸を使う場合でも，「どこまでを参考にし，どこからを書き直すか」の境界を明確にしやすくなる
- 開発者は `scribe` を別 repository のまま保ちつつ，`geshi` リポジトリの共通入口から起動できる
- 一方で，最初に adapter interface と設定境界を定義する文書コストが増える
- transcript の保持モデルや job orchestration の詳細は，別 ADR で決める必要がある

## 代替案

- `backend` や plugin から `scribe` SDK / HTTP API を直接呼ぶ
  - 連携仕様と内部契約が混ざりやすく，呼び出しごとの差異も増えるため採らない
- `source` または `collector setting` ごとに `scribe` credential を持たせる
  - 運用時 secret と人が編集する収集設定が混ざりやすいため採らない
- `scribe` との接続を最初から plugin 境界の責務として固定する
  - 連携の性質によっては backend / worker / CLI 側の方が自然な場合があり，現段階では決め打ちしない
- `scribe` を `git submodule` として repository に取り込む
  - revision 固定の利点はあるが，今回ほしいのは日常開発時の起動入口であり，別 repository 運用のまま sibling checkout を compose から扱う方が軽いため採らない
- `tmp/v0.3.0/packages/scribe-client` をそのまま production 境界として復活させる
  - 現行 API との差分と `geshi` 側の責務境界の整理が未了のため採らない

## 参考資料

- [ADR-0018] ADR-0018: backend と worker に構造化ログを導入する
- [ADR-0030] ADR-0030: geshi 全体にかかる設定は source ごとの設定から分けて管理する
- [ADR-0033] ADR-0033: source collector plugin 契約を backend から分離した外部 package として定義する
- [ADR-0040] ADR-0040: 運用時設定として plugin 設定の形式を定義する
- [ADR-0045] ADR-0045: transcript は content に直接ひもづく主体として保持する
- [ADR-0046] ADR-0046: transcript 要求と scribe polling は backend job で扱う
- [design-log-xxxx] Design Log xxxx: scribe connection

[ADR-0018]: ./0018-structured-logging.md
[ADR-0030]: ./0030-configuration-management.md
[ADR-0033]: ./0033-source-collector-plugin-api-package-boundary.md
[ADR-0040]: ./0040-plugin-site-configuration-format.md
[ADR-0045]: ./0045-transcript-owned-by-content.md
[ADR-0046]: ./0046-transcript-job-orchestration.md
[design-log-xxxx]: ../design-log/xxxx-scribe-connection.md
