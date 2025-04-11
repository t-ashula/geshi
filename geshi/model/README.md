# @geshi/model

データモデルモジュール

## 概要

このモジュールは、Prismaを使用してデータベースモデルを定義し、共通のデータアクセスレイヤーを提供します。

## 使用方法

```typescript
import { PrismaClient } from '@geshi/model';

const prisma = new PrismaClient();

// 使用例
```

## 開発

```bash
# 依存関係のインストール
npm install

# Prismaスキーマの生成
npx prisma generate

# データベースマイグレーション
npx prisma migrate dev

# テストの実行
npm test

# ビルド
npm run build
