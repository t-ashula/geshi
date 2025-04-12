# ADR-0001: DB naming policy

## ステータス

決定

## コンテキスト

スキーマ設計において命名の不一致，ORM との整合性を明確にする

## 決定

- テーブル名はすべて小文字の複数形（Rails 風）
- カラム名はすべて snake_case
- ORM/Prisma でのモデル名やプロパティ名は，Prisma のスタイルのままの camelCase として，マッピング機能でテーブル名やカラム名と対応させる

## 影響

- schema.prisma が `@map`, `@@map` だらけになる
- DB 上の識別子が小文字のみに統一され，DB や OS の影響を抑えられる
