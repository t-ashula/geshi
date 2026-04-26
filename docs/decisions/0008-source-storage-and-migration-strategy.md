# ADR-0008: source 登録に向けた永続化と migration 方針

## ステータス

決定

## 範囲

storage

## コンテキスト

- [data-model] で source や snapshot のモデルの採用は決まっているが，実際の DB，schema 管理方法，migration の運用は未定である
- `podcast rss source` を登録するには，少なくとも `source` と `sourceSnapshot` をどう保存し，どう変更管理するかを決める必要がある
- source 登録機能は今後の content, asset, transcript 追加の土台にもなるため，永続化の初期判断を後から崩しにくい

## 決定

source 登録機能に関する永続化と migration は以下の構成とする．

- 永続化 DB には PostgreSQL を採用する
- ローカル開発環境とテスト環境には `docker compose` で PostgreSQL 18 を用意する
- アプリケーションからの DB アクセスには Kysely を採用する
- Kysely で使う DB 型定義の生成には `kysely-codegen` を採用する
- schema 定義は SQL を正として管理し，ORM 側の DSL を schema 定義の正本にしない
- schema 定義の配置先は当面 `db/schema.sql` とする
- `db/schema.sql` は物理配置としては repo 直下に置くが，責務としては backend 側に属する
- schema 差分の適用には `psqldef` を採用する
- migration の適用順はファイル名に依存させず，現行 schema と定義 SQL の差分から反映する
- `source` と `sourceSnapshot` の初回 schema は，`podcast rss source` 登録に必要な最小範囲から始める
- 初回 schema は [data-model] で議論した `source` / `sourceSnapshot` をベースにし，ID には UUID v7 を採用する
- UUID v7 の生成は当面アプリケーション側で行う

### 採用理由

- PostgreSQL は UUID や `jsonb` を含む表現力があり，今後の metadata 拡張にも向いている
- Kysely は query builder として利用しつつ，schema 定義を SQL 側に残せる
- `kysely-codegen` により，適用済み schema から Kysely 用の DB 型定義を生成できる
- schema を SQL で持つことで，DDL と命名規則をアプリケーションコードから独立して管理できる
- `psqldef` は差分適用型なので，ファイル名順に依存する migration より多ブランチ開発時の衝突を抑えやすい

詳細な補足は [design-log-0008] へ分離する．

## 影響

- source 登録 API の保存先と transaction 境界を議論できる
- データモデル文書を実装可能な schema に落とし込む入口になる
- 後から migration 戦略を差し替えるコストを減らせる
- DDL と命名規則を SQL 側で統制できる
- 多ブランチ開発時に migration ファイル順序の衝突を減らせる

## 代替案

- まずメモリ内やファイル保存で画面だけ進め，DB は後で決める
  - 画面確認はしやすいが，登録機能の本質的な判断を先送りにする
- ORM の schema DSL を正本にする
  - 実装言語側には寄るが，DDL と命名規則の制御がライブラリ都合に引っ張られやすい
- 連番 migration ファイルを順に適用する方式を採る
  - 一般的だが，多ブランチ開発では競合解消や順序調整の手間が増えやすい

## 参考資料

- [ADR-0005] ADR-0005 データモデルを主体テーブルと履歴テーブルで構成する
- [data-model] Data Model
- [kysely-docs] Kysely official documentation
- [kysely-github] Kysely official GitHub repository
- [kysely-codegen-github] kysely-codegen GitHub repository
- [sqldef-github] sqldef official GitHub repository
- [design-log-0008] Design log 0008
- [acceptance-0001] Acceptance 0001 Podcast RSS Source Registration

[ADR-0005]: ./0005-data-model.md
[data-model]: ../data-model.md
[kysely-docs]: https://www.kysely.dev/
[kysely-github]: https://github.com/kysely-org/kysely
[kysely-codegen-github]: https://github.com/RobinBlomberg/kysely-codegen
[sqldef-github]: https://github.com/sqldef/sqldef
[design-log-0008]: ../design-log/0008-source-storage-and-migration-strategy.md
[acceptance-0001]: ../acceptance/0001-source-registration-foundation.md
