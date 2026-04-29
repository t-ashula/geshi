# ADR-0021: E2E 用 DB を実運用 DB から分離する

## ステータス

決定

## 範囲

`backend`

## コンテキスト

- [ADR-0019] では，frontend，api backend，worker，PostgreSQL を含む実行環境で最小 E2E を検証する方針を定めている
- 現在のローカル開発環境では，`compose.yaml` の PostgreSQL は `geshi` DB を前提にしており，backend / worker も同じ接続先を既定で使う
- E2E が実運用相当の開発用 DB をそのまま使うと，既存データ汚染，テストの相互干渉，再実行時の不安定さが起きやすい
- E2E では source 登録，job 実行，content 保存まで実データを書き込むため，DB 状態の初期化と分離方針を先に定める必要がある
- 一方で，テストのたびに永続 DB を共有して手で掃除する運用は，再現性と自動化の両方を損なう

## 決定

- E2E テストは，日常の開発や手動確認に使う DB とは分離した，専用の DB を使う
- E2E 用 DB は，`docker compose` で起動する
- E2E 用 DB と通常の開発用 DB とは，`docker compose` の `profile` を分けて明示的に切り替える
- E2E 用 DB は，追加 service を増やさず，同じ PostgreSQL instance 上の別 database 名 `geshi_test` を使う
- E2E 用 DB は，実運用向け schema と同じ `db/schema.sql` を適用した状態で起動する
- E2E 実行時の backend / worker は，通常の開発用 DB ではなく，E2E 専用接続先へ向ける
- E2E テストは，開始時に期待する空状態または fixture 状態を自動で作れるようにする
- E2E の成否は，既存のローカル開発データの有無に依存しないものとする
- E2E 用 DB の初期化と破棄は，リポジトリルートから辿れる実行入口に含める
- E2E 用 DB の起動・初期化・掃除の補助には，`Makefile` と `test/scripts/` 配下の shell script を併用してよい

## 影響

- E2E の再実行性と独立性が上がる
- 開発中のローカルデータを誤って汚染しにくくなる
- schema 差分や migration の適用漏れを，E2E 環境でも検出しやすくなる
- `docker compose` を共通入口として保ったまま，E2E 用実行環境を明示的に扱える
- PostgreSQL service を増やさずに済み，E2E 導入の運用コストを抑えやすい
- E2E 用 DB の起動，初期化，掃除の手順を整備する必要がある

## 代替案

- 開発用 DB をそのまま E2E に使う
  - データ汚染とテスト干渉のリスクが高いため採らない
- 毎回 SQL で必要テーブルだけ truncate して共有 DB を使う
  - 掃除漏れや schema 追加時の追従漏れが起きやすいため採らない
- E2E では DB を使わずモックに寄せる
  - full stack の結合確認という E2E の目的を満たさないため採らない

## 備考

- `pgboss` schema を含む queue 周辺状態も，E2E 用 DB 側で独立して初期化される前提で扱う

## 参考資料

- [ADR-0008] ADR-0008 source 登録に向けた永続化と migration 方針
- [ADR-0010] ADR-0010 source クロールの実行基盤として job queue を導入する
- [ADR-0019] ADR-0019 Web UI 起点の最小 E2E を Playwright で検証する
- [migration-doc] Migration
- [acceptance-0004] E2E Foundation

[ADR-0008]: ./0008-source-storage-and-migration-strategy.md
[ADR-0010]: ./0010-source-crawl-job-queue.md
[ADR-0019]: ./0019-e2e-test-foundation.md
[migration-doc]: ../migration.md
[acceptance-0004]: ../acceptance/0004-e2e-foundation.md
