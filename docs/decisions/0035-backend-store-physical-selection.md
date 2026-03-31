# ADR-0035: BackendStore の物理実体として PostgreSQL を採用する

## ステータス

決定

## 範囲

`backend/`

## コンテキスト

- `0030` から `0034` までで，model，collector，job，asset store の責務境界はおおむね整理できた
- 一方で，`BackendStore` の物理実体が未決のままでは，backend の保存実装に着手しにくい
- `BackendStore` の物理実体は，実装開始のために先に決める必要がある

## 決定

- `BackendStore` の物理実体として PostgreSQL を採用する

## 影響

- backend の保存実装を PostgreSQL 前提で進められる
- migration，schema 定義，SQL の置き方は後続で整理する必要がある
- ORM を採用するかどうか，採用しない場合にどのように SQL を管理するかは後続で整理する必要がある

## 備考

- 開発用の PostgreSQL は，`docker compose` で用意する前提にする

## 参考資料

- [adr-0030] ADR-0030 model 層の扱い
- [adr-0033] ADR-0033 job model の見直し
- [adr-0034] ADR-0034 asset store の抽象と分離

[adr-0030]: ./0030-models.md
[adr-0033]: ./0033-job-model-review.md
[adr-0034]: ./0034-asset-store-abstraction.md
