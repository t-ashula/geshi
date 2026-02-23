/**
 * @geshi/model
 * データモデルモジュール
 */

import { PrismaClient } from "@prisma/client";

// Prisma クライアントとモデルの型情報をエクスポート
export { PrismaClient } from "@prisma/client";
export {
  Channel,
  Episode,
  Job,
  TranscriptRequest,
  Transcript,
  TranscriptSegment,
  SummarizeRequest,
  Summary,
  SummarySegment,
} from "@prisma/client";

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
