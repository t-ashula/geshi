# Migration

この文書は，`geshi` の schema migration と data migration の手順を記す．

## 対象

- schema migration
  - `db/schema.sql` の差分適用
- data migration
  - schema 変更に伴って既存データを補完，変換，移送する作業

## schema migration

schema 定義の正本は `db/schema.sql` とする．
schema 差分の適用には `psqldef` を使う．

### 手順

1. `docker compose up -d postgres`
2. `make db-schema-dry-run`
3. dry-run の差分を確認する
4. 問題がなければ `make db-schema-apply`

### 確認項目

- 想定外の `drop` や `alter` が含まれていないこと
- `pgboss` schema に干渉しないこと
- 既存 table / column / index に対する変更内容が意図どおりであること

## data migration

既存データに対する補完や変換が必要な変更では，schema migration だけで完了扱いにしない．

### 要件

- 既存データに何を追加，更新，変換するかを実装前に決める
- data migration の手順は，schema migration と分けて明示する
- data migration が必要な変更では，dry-run の確認だけで完了扱いにしない
- data migration を実行した後の整合条件を確認する

### 手順

1. `make db-schema-dry-run`
2. schema 差分を確認する
3. 既存データへの影響を確認する
4. 必要な data migration 手順を決める
   - SQL あるいは コードでデータ移行処理を実装する
5. `make db-schema-apply`
6. 4 で決めた手順で data migration を実行する
7. 移行後データを確認する

### 確認項目

- 新しい非 null 制約や一意制約を既存データが満たせること
- 新しく必要になる関連レコードが補完されること
- 既存データが新しい読み取り経路で参照可能であること
- 移行後に backend / worker が期待どおり動くこと

## 禁止事項

- `make db-schema-dry-run` を通さずに schema 適用可否を判断しない
- `make db-schema-apply` と異なる手順で schema を流し込んだ結果を migration 確認として扱わない
- data migration が必要な変更を，既存データ影響未確認のまま適用しない
