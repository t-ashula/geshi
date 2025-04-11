/**
 * @geshi/model
 * データモデルモジュール
 */

import { PrismaClient } from '@prisma/client';

export { PrismaClient } from '@prisma/client';

/**
 * Prismaクライアントのインスタンスを作成
 * @returns PrismaClientのインスタンス
 */
export function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

export default {
  createPrismaClient,
};