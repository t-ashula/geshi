import { expect } from "vitest";
import { createPrismaClient } from "../src";

async function main() {
  // Prisma クライアントを作成
  const prisma = createPrismaClient();

  try {
    // チャンネルとエピソードを取得
    const channels = await prisma.channel.findMany({
      include: {
        episodes: true,
      },
    });

    //
    expect(channels).toBeTruthy();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("エラーが発生しました:", error);
  } finally {
    // Prisma クライアントを切断
    await prisma.$disconnect();
  }
}

// スクリプトを実行
main();
