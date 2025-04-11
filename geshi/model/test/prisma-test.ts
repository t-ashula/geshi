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

    console.log("=== チャンネルとエピソード ===");
    channels.forEach((channel) => {
      console.log(`チャンネル: ${channel.title} (${channel.slug})`);
      console.log(`RSS URL: ${channel.rssUrl}`);
      console.log("エピソード:");
      channel.episodes.forEach((episode) => {
        console.log(`- ${episode.title} (${episode.type})`);
        console.log(`  公開日: ${episode.publishedAt}`);
        console.log(`  音声URL: ${episode.audioUrl}`);
      });
      console.log("---");
    });
  } catch (error) {
    console.error("エラーが発生しました:", error);
  } finally {
    // Prisma クライアントを切断
    await prisma.$disconnect();
  }
}

// スクリプトを実行
main();
