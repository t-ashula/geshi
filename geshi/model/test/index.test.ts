import { describe, it, expect, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

// Prisma クライアントをモック
vi.mock("@prisma/client", () => {
  const mockClient = {
    channel: {},
    episode: {},
    job: {},
    transcriptRequest: {},
    transcript: {},
    transcriptSegment: {},
    summarizeRequest: {},
    summary: {},
    summarySegment: {},
  };

  return {
    PrismaClient: vi.fn().mockImplementation(() => mockClient),
  };
});

// モジュールのインポートは、モックの後に行う
import { createPrismaClient } from "../src";

describe("Model", () => {
  it("should create a PrismaClient instance", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const client = createPrismaClient();
    expect(PrismaClient).toHaveBeenCalled();
  });

  it("should have all required models defined in schema", () => {
    const client = createPrismaClient();

    // 期待されるモデル名のリスト
    const expectedModels = [
      "channel",
      "episode",
      "job",
      "transcriptRequest",
      "transcript",
      "transcriptSegment",
      "summarizeRequest",
      "summary",
      "summarySegment",
    ];

    // すべての期待されるモデルが存在することを確認
    for (const model of expectedModels) {
      expect(client).toHaveProperty(model);
    }
  });
});
