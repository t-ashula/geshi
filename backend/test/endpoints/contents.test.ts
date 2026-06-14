import { describe, expect, it, vi } from "vitest";

import {
  createGetContentDetailEndpoint,
  createListContentsEndpoint,
  createRequestTranscriptsEndpoint,
  createRetryTranscriptEndpoint,
} from "../../src/endpoints/api/v1/contents.js";
import { InvalidContentListCursorError } from "../../src/db/content-repository.js";
import { err, ok } from "../../src/lib/result.js";
import type { AssetService } from "../../src/service/asset-service.js";
import type { ContentService } from "../../src/service/content-service.js";
import type { DetailBodyService } from "../../src/service/detail-body-service.js";
import type { TranscriptService } from "../../src/service/transcript-service.js";
import { createTestAppDependencies } from "../support/app-dependencies.js";

describe("content endpoints", () => {
  it("returns current content list shape", async () => {
    const endpoint = createListContentsEndpoint(
      createTestAppDependencies({
        assetService: {} as unknown as AssetService,
        contentService: {
          listContents: vi.fn(() =>
            Promise.resolve({
              items: [{ id: "content-1", title: "Episode 1" }],
              nextCursor: "cursor-1",
            }),
          ),
        } as unknown as ContentService,
      }),
    );

    await expect(endpoint({ limit: 10 })).resolves.toEqual(
      ok({
        items: [{ id: "content-1", title: "Episode 1" }],
        nextCursor: "cursor-1",
      }),
    );
  });

  it("returns invalid cursor errors without converting them to 500s", async () => {
    const endpoint = createListContentsEndpoint(
      createTestAppDependencies({
        assetService: {} as unknown as AssetService,
        contentService: {
          listContents: vi.fn(() =>
            Promise.reject(new InvalidContentListCursorError()),
          ),
        } as unknown as ContentService,
      }),
    );

    await expect(endpoint({ cursor: "bad", limit: 10 })).resolves.toEqual(
      err({
        code: "invalid_cursor",
        message: "Content list cursor is invalid.",
      }),
    );
  });

  it("returns content detail with media asset urls", async () => {
    const endpoint = createGetContentDetailEndpoint(
      createTestAppDependencies({
        assetService: {
          listAssetsByContentId: vi.fn(() =>
            Promise.resolve([
              {
                byteSize: 128,
                id: "asset-1",
                kind: "audio",
                mimeType: "audio/mpeg",
                primary: true,
                sourceUrl: "https://cdn.example.com/audio.mp3",
                storageKey: "stored/asset-1",
              },
            ]),
          ),
        } as unknown as AssetService,
        contentService: {
          findContentDetail: vi.fn(() =>
            ok({
              collectedAt: new Date("2026-05-01T00:00:00.000Z"),
              detailBody: null,
              id: "content-1",
              kind: "podcast-episode",
              publishedAt: new Date("2026-04-30T00:00:00.000Z"),
              source: {
                id: "source-1",
                slug: "example-feed",
                title: "Example Feed",
              },
              status: "stored",
              summary: "Episode summary",
              title: "Episode 1",
            }),
          ),
          listContents: vi.fn(),
        } as unknown as ContentService,
        detailBodyService: {
          findOrCreateDetailBodyByContentId: vi.fn(() =>
            Promise.resolve(
              ok({
                body: "Detailed body",
                contentId: "content-1",
                createdAt: new Date("2026-05-01T00:00:00.000Z"),
                format: "plain",
                id: "detail-body-1",
                sourceAssetSnapshotId: "asset-snapshot-1",
              }),
            ),
          ),
        } as unknown as DetailBodyService,
      }),
    );

    await expect(endpoint("content-1")).resolves.toMatchObject(
      ok({
        assets: [
          {
            id: "asset-1",
            url: "/media/assets/asset-1.mp3",
          },
        ],
        detailBody: {
          body: "Detailed body",
          format: "plain",
        },
        id: "content-1",
        title: "Episode 1",
        transcripts: [],
      }),
    );
  });

  it("returns transcript request results", async () => {
    const endpoint = createRequestTranscriptsEndpoint(
      createTestAppDependencies({
        transcriptService: {
          enqueueTranscriptsForContent: vi.fn(() =>
            Promise.resolve(
              ok({
                createdTranscriptCount: 1,
                skippedTranscriptCount: 0,
                transcripts: [
                  {
                    body: null,
                    contentId: "content-1",
                    finishedAt: null,
                    generation: 1,
                    id: "transcript-1",
                    kind: "transcript",
                    language: "ja",
                    sourceAssetSnapshotId: "asset-snapshot-1",
                    startedAt: null,
                    status: "queued",
                  },
                ],
              }),
            ),
          ),
        } as unknown as TranscriptService,
      }),
    );

    await expect(endpoint("content-1")).resolves.toEqual(
      ok({
        createdTranscriptCount: 1,
        skippedTranscriptCount: 0,
        transcripts: [
          expect.objectContaining({
            id: "transcript-1",
          }),
        ],
      }),
    );
  });

  it("returns transcript retry results", async () => {
    const endpoint = createRetryTranscriptEndpoint(
      createTestAppDependencies({
        transcriptService: {
          retryTranscript: vi.fn(() =>
            Promise.resolve(
              ok({
                jobId: "job-1",
                transcriptId: "transcript-1",
              }),
            ),
          ),
        } as unknown as TranscriptService,
      }),
    );

    await expect(endpoint("content-1", "transcript-1")).resolves.toEqual(
      ok({
        jobId: "job-1",
        transcriptId: "transcript-1",
      }),
    );
  });

  it("preserves not-found responses", async () => {
    const endpoint = createGetContentDetailEndpoint(
      createTestAppDependencies({
        assetService: {
          listAssetsByContentId: vi.fn(),
        } as unknown as AssetService,
        contentService: {
          findContentDetail: vi.fn(() =>
            err({
              code: "content_not_found",
              message: "Content was not found.",
            }),
          ),
          listContents: vi.fn(),
        } as unknown as ContentService,
        detailBodyService: {
          findOrCreateDetailBodyByContentId: vi.fn(),
        } as unknown as DetailBodyService,
      }),
    );

    await expect(endpoint("missing")).resolves.toEqual(
      err({
        code: "content_not_found",
        message: "Content was not found.",
      }),
    );
  });

  it("falls back to summary when detail body generation fails", async () => {
    const endpoint = createGetContentDetailEndpoint(
      createTestAppDependencies({
        assetService: {
          listAssetsByContentId: vi.fn(() => Promise.resolve([])),
        } as unknown as AssetService,
        contentService: {
          findContentDetail: vi.fn(() =>
            ok({
              collectedAt: new Date("2026-05-01T00:00:00.000Z"),
              detailBody: null,
              id: "content-1",
              kind: "podcast-episode",
              publishedAt: new Date("2026-04-30T00:00:00.000Z"),
              source: {
                id: "source-1",
                slug: "example-feed",
                title: "Example Feed",
              },
              status: "stored",
              summary: "Episode summary",
              title: "Episode 1",
            }),
          ),
          listContents: vi.fn(),
        } as unknown as ContentService,
        detailBodyService: {
          findOrCreateDetailBodyByContentId: vi.fn(() =>
            Promise.resolve(err(new Error("detail body failed"))),
          ),
        } as unknown as DetailBodyService,
        transcriptService: {
          listTranscriptsByContentId: vi.fn(() => Promise.resolve(ok([]))),
        } as unknown as TranscriptService,
      }),
    );

    await expect(endpoint("content-1")).resolves.toEqual(
      ok({
        assets: [],
        collectedAt: new Date("2026-05-01T00:00:00.000Z"),
        detailBody: null,
        id: "content-1",
        kind: "podcast-episode",
        publishedAt: new Date("2026-04-30T00:00:00.000Z"),
        source: {
          id: "source-1",
          slug: "example-feed",
          title: "Example Feed",
        },
        status: "stored",
        summary: "Episode summary",
        title: "Episode 1",
        transcripts: [],
      }),
    );
  });

  it("returns summary-only detail when assets and transcripts fail", async () => {
    const endpoint = createGetContentDetailEndpoint(
      createTestAppDependencies({
        assetService: {
          listAssetsByContentId: vi.fn(() =>
            Promise.reject(new Error("assets failed")),
          ),
        } as unknown as AssetService,
        contentService: {
          findContentDetail: vi.fn(() =>
            ok({
              collectedAt: new Date("2026-05-01T00:00:00.000Z"),
              detailBody: null,
              id: "content-1",
              kind: "podcast-episode",
              publishedAt: new Date("2026-04-30T00:00:00.000Z"),
              source: {
                id: "source-1",
                slug: "example-feed",
                title: "Example Feed",
              },
              status: "stored",
              summary: "Episode summary",
              title: "Episode 1",
            }),
          ),
          listContents: vi.fn(),
        } as unknown as ContentService,
        detailBodyService: {
          findOrCreateDetailBodyByContentId: vi.fn(() =>
            Promise.resolve(err(new Error("detail body failed"))),
          ),
        } as unknown as DetailBodyService,
        transcriptService: {
          listTranscriptsByContentId: vi.fn(() =>
            Promise.resolve(err(new Error("transcripts failed"))),
          ),
        } as unknown as TranscriptService,
      }),
    );

    await expect(endpoint("content-1")).resolves.toEqual(
      ok({
        assets: [],
        collectedAt: new Date("2026-05-01T00:00:00.000Z"),
        detailBody: null,
        id: "content-1",
        kind: "podcast-episode",
        publishedAt: new Date("2026-04-30T00:00:00.000Z"),
        source: {
          id: "source-1",
          slug: "example-feed",
          title: "Example Feed",
        },
        status: "stored",
        summary: "Episode summary",
        title: "Episode 1",
        transcripts: [],
      }),
    );
  });
});
