import { describe, expect, it, vi } from "vitest";

import { ok } from "../../src/lib/result.js";
import { createNoopLogger } from "../../src/logger/index.js";
import { createSourceDetectionService } from "../../src/service/source-detection-service.js";
import { assertOk } from "../support/result.js";

describe("source detection service", () => {
  it("detects, deduplicates, and stores source candidates", async () => {
    const detectSources = vi.fn(() =>
      Promise.resolve({
        candidates: [
          {
            description: "Description 1",
            sourceSlug: "show-1",
            title: "Show 1",
            url: "https://example.com/program/show-1",
          },
          {
            description: "Description 1 duplicate",
            sourceSlug: "show-1",
            title: "Show 1",
            url: "https://example.com/program/show-1",
          },
          {
            description: "Description 2",
            sourceSlug: "show-2",
            title: "Show 2",
            url: "https://example.com/program/show-2",
          },
        ],
        detectorState: {
          cursor: "next-page",
        },
      }),
    );
    const findExistingSourceIdByUrl = vi
      .fn()
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce(ok("source-2"));
    const saveDetectedSourceCandidate = vi.fn(() =>
      Promise.resolve(
        ok({
          id: "candidate-1",
          status: "detected",
        }),
      ),
    );
    const saveState = vi.fn(() => Promise.resolve(ok(undefined)));
    const markChecked = vi.fn(() => Promise.resolve(ok(undefined)));
    const service = createSourceDetectionService(
      {
        findExistingSourceIdByUrl,
        listEnabledTargets: vi.fn(),
        markChecked,
        saveDetectedSourceCandidate,
        saveState,
      } as never,
      {
        logger: createNoopLogger(),
        sourceCollectorRegistry: {
          get: vi.fn(
            () =>
              ({
                acquire: vi.fn(),
                detectSources,
                extract: vi.fn(),
                inspect: vi.fn(),
                observe: vi.fn(),
                settingSchema: vi.fn(() => []),
                supports: vi.fn(),
              }) as never,
          ),
          getSourceKind: vi.fn(),
          list: vi.fn(),
        },
      },
    );

    const result = await service.detectSourceTarget({
      config: {},
      enabled: true,
      id: "target-1",
      intervalMinutes: 60,
      lastCheckedAt: null,
      pluginSlug: "radio-onsen",
      sourceKind: "podcast",
      state: {
        cursor: "current-page",
      },
      url: "https://www.onsen.ag",
      userId: "user-1",
    });

    assertOk(result);
    expect(result.value).toEqual({
      detectedCount: 1,
      duplicateCount: 1,
      processedCount: 2,
    });
    expect(detectSources).toHaveBeenCalledWith(
      {
        abortSignal: expect.any(AbortSignal),
        config: {},
        detectorState: {
          cursor: "current-page",
        },
        inputUrl: "https://www.onsen.ag",
      },
      expect.any(Object),
    );
    expect(saveDetectedSourceCandidate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        normalizedUrl: "https://example.com/program/show-1",
        sourceSlug: "show-1",
        status: "detected",
      }),
    );
    expect(saveDetectedSourceCandidate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        normalizedUrl: "https://example.com/program/show-2",
        resolvedSourceId: "source-2",
        sourceSlug: "show-2",
        status: "duplicate",
      }),
    );
    expect(saveState).toHaveBeenCalledWith("target-1", "radio-onsen", {
      cursor: "next-page",
    });
    expect(markChecked).toHaveBeenCalledWith("target-1", expect.any(Date));
  });

  it("registers a detected source candidate by creating a source", async () => {
    const service = createSourceDetectionService(
      {
        findDetectedSourceCandidateById: vi.fn(() =>
          Promise.resolve(
            ok({
              description: "Example desc",
              firstDetectedAt: new Date("2026-06-10T00:00:00.000Z"),
              id: "candidate-1",
              lastDetectedAt: new Date("2026-06-10T00:00:00.000Z"),
              normalizedUrl: "https://www.onsen.ag/program/example",
              pluginSlug: "radio-onsen",
              resolvedSourceId: null,
              sourceDetectionTargetId: "target-1",
              sourceKind: "podcast",
              sourceSlug: "example",
              status: "detected",
              title: "Example",
              userId: "user-1",
            }),
          ),
        ),
        updateDetectedSourceCandidateStatus: vi.fn(() =>
          Promise.resolve(
            ok({
              description: "Example desc",
              firstDetectedAt: new Date("2026-06-10T00:00:00.000Z"),
              id: "candidate-1",
              lastDetectedAt: new Date("2026-06-10T00:01:00.000Z"),
              normalizedUrl: "https://www.onsen.ag/program/example",
              pluginSlug: "radio-onsen",
              resolvedSourceId: "source-1",
              sourceDetectionTargetId: "target-1",
              sourceKind: "podcast",
              sourceSlug: "example",
              status: "registered",
              title: "Example",
              userId: "user-1",
            }),
          ),
        ),
      } as never,
      {
        createSource: vi.fn(() =>
          Promise.resolve(
            ok({
              collectionId: null,
              collectorSettingsVersion: 1,
              createdAt: new Date("2026-06-10T00:00:00.000Z"),
              description: "Example desc",
              id: "source-1",
              kind: "podcast",
              periodicCrawlEnabled: true,
              periodicCrawlIntervalMinutes: 60,
              recordedAt: null,
              slug: "example",
              subscriptionId: "subscription-1",
              subscriptionPosition: 0,
              title: "Example",
              url: "https://www.onsen.ag/program/example",
              urlHash: "hash-1",
              version: 1,
            }),
          ),
        ),
        listSources: vi.fn(),
      } as never,
      {
        logger: createNoopLogger(),
      },
    );

    const result = await service.registerDetectedSourceCandidate("candidate-1");

    assertOk(result);
    expect(result.value.status).toBe("registered");
    expect(result.value.resolvedSourceId).toBe("source-1");
  });
});
