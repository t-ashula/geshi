import { describe, expect, it, vi } from "vitest";

import {
  createCreateSourceDetectionTargetEndpoint,
  createDismissDetectedSourceCandidateEndpoint,
  createGetPeriodicCrawlSettingsEndpoint,
  createGetPluginGlobalSettingsEndpoint,
  createListDetectedSourceCandidatesEndpoint,
  createListSourceDetectionTargetsEndpoint,
  createPatchPeriodicCrawlSettingsEndpoint,
  createPatchPluginGlobalSettingsEndpoint,
  createPatchSourceDetectionTargetEndpoint,
  createRegisterDetectedSourceCandidateEndpoint,
} from "../../src/endpoints/api/v1/settings.js";
import { ok } from "../../src/lib/result.js";
import type { AppSettingService } from "../../src/service/app-setting-service.js";
import type { PluginGlobalSettingsService } from "../../src/service/plugin-global-settings-service.js";
import { createTestAppDependencies } from "../support/app-dependencies.js";

describe("settings endpoints", () => {
  it("returns current periodic-crawl settings shape", async () => {
    const endpoint = createGetPeriodicCrawlSettingsEndpoint(
      createTestAppDependencies({
        appSettingService: {
          getPeriodicCrawlSettings: vi.fn(() =>
            Promise.resolve(
              ok({
                enabled: true,
                intervalMinutes: 30,
              }),
            ),
          ),
          updatePeriodicCrawlSettings: vi.fn(),
        } as unknown as AppSettingService,
      }),
    );

    await expect(endpoint()).resolves.toEqual(
      ok({
        enabled: true,
        intervalMinutes: 30,
      }),
    );
  });

  it("returns updated settings", async () => {
    const endpoint = createPatchPeriodicCrawlSettingsEndpoint(
      createTestAppDependencies({
        appSettingService: {
          getPeriodicCrawlSettings: vi.fn(),
          updatePeriodicCrawlSettings: vi.fn(() =>
            Promise.resolve(
              ok({
                enabled: true,
                intervalMinutes: 15,
              }),
            ),
          ),
        } as unknown as AppSettingService,
      }),
    );

    await expect(
      endpoint({
        enabled: true,
        intervalMinutes: 15,
      }),
    ).resolves.toEqual(
      ok({
        enabled: true,
        intervalMinutes: 15,
      }),
    );
  });

  it("returns plugin global settings shape", async () => {
    const endpoint = createGetPluginGlobalSettingsEndpoint(
      createTestAppDependencies({
        pluginGlobalSettingsService: {
          getPluginGlobalSettings: vi.fn(() =>
            Promise.resolve(
              ok({
                baseVersion: 4,
                items: [
                  {
                    key: "profileName",
                    type: { type: "text" as const },
                    value: "main-profile",
                  },
                ],
                pluginSlug: "go-jp-rss",
              }),
            ),
          ),
          updatePluginGlobalSettings: vi.fn(),
        } as unknown as PluginGlobalSettingsService,
      }),
    );

    await expect(endpoint("go-jp-rss")).resolves.toEqual(
      ok({
        baseVersion: 4,
        items: [
          {
            key: "profileName",
            type: { type: "text" },
            value: "main-profile",
          },
        ],
        pluginSlug: "go-jp-rss",
      }),
    );
  });

  it("returns updated plugin global settings", async () => {
    const endpoint = createPatchPluginGlobalSettingsEndpoint(
      createTestAppDependencies({
        pluginGlobalSettingsService: {
          getPluginGlobalSettings: vi.fn(),
          updatePluginGlobalSettings: vi.fn(() =>
            Promise.resolve(
              ok({
                baseVersion: 5,
                items: [
                  {
                    key: "profileName",
                    type: { type: "text" as const },
                    value: "new-profile",
                  },
                ],
                pluginSlug: "go-jp-rss",
              }),
            ),
          ),
        } as unknown as PluginGlobalSettingsService,
      }),
    );

    await expect(
      endpoint("go-jp-rss", {
        baseVersion: 4,
        items: [
          {
            key: "profileName",
            value: "new-profile",
          },
        ],
      }),
    ).resolves.toEqual(
      ok({
        baseVersion: 5,
        items: [
          {
            key: "profileName",
            type: { type: "text" },
            value: "new-profile",
          },
        ],
        pluginSlug: "go-jp-rss",
      }),
    );
  });

  it("returns source detection targets", async () => {
    const endpoint = createListSourceDetectionTargetsEndpoint(
      createTestAppDependencies(),
    );

    await expect(endpoint()).resolves.toEqual(
      ok([
        {
          config: {},
          enabled: true,
          id: "target-1",
          intervalMinutes: 60,
          lastCheckedAt: null,
          pluginSlug: "radio-onsen",
          sourceKind: "podcast",
          state: undefined,
          url: "https://www.onsen.ag",
          userId: "user-1",
        },
      ]),
    );
  });

  it("creates a source detection target", async () => {
    const endpoint = createCreateSourceDetectionTargetEndpoint(
      createTestAppDependencies(),
    );

    await expect(
      endpoint({
        pluginSlug: "radio-onsen",
        sourceKind: "podcast",
        url: "https://www.onsen.ag",
      }),
    ).resolves.toEqual(
      ok({
        config: {},
        enabled: true,
        id: "target-1",
        intervalMinutes: 60,
        lastCheckedAt: null,
        pluginSlug: "radio-onsen",
        sourceKind: "podcast",
        state: undefined,
        url: "https://www.onsen.ag",
        userId: "user-1",
      }),
    );
  });

  it("returns detected source candidates", async () => {
    const endpoint = createListDetectedSourceCandidatesEndpoint(
      createTestAppDependencies(),
    );

    await expect(endpoint()).resolves.toEqual(
      ok([
        {
          description: null,
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
        },
      ]),
    );
  });

  it("updates a source detection target", async () => {
    const endpoint = createPatchSourceDetectionTargetEndpoint(
      createTestAppDependencies(),
    );

    await expect(
      endpoint({
        enabled: false,
        id: "target-1",
        intervalMinutes: 120,
        pluginSlug: "radio-onsen",
        sourceKind: "podcast",
        url: "https://www.onsen.ag",
      }),
    ).resolves.toEqual(
      ok({
        config: {},
        enabled: false,
        id: "target-1",
        intervalMinutes: 120,
        lastCheckedAt: null,
        pluginSlug: "radio-onsen",
        sourceKind: "podcast",
        state: undefined,
        url: "https://www.onsen.ag",
        userId: "user-1",
      }),
    );
  });

  it("dismisses a detected source candidate", async () => {
    const endpoint = createDismissDetectedSourceCandidateEndpoint(
      createTestAppDependencies(),
    );

    await expect(endpoint("candidate-1")).resolves.toEqual(
      ok({
        description: null,
        firstDetectedAt: new Date("2026-06-10T00:00:00.000Z"),
        id: "candidate-1",
        lastDetectedAt: new Date("2026-06-10T00:05:00.000Z"),
        normalizedUrl: "https://www.onsen.ag/program/example",
        pluginSlug: "radio-onsen",
        resolvedSourceId: null,
        sourceDetectionTargetId: "target-1",
        sourceKind: "podcast",
        sourceSlug: "example",
        status: "dismissed",
        title: "Example",
        userId: "user-1",
      }),
    );
  });

  it("registers a detected source candidate", async () => {
    const endpoint = createRegisterDetectedSourceCandidateEndpoint(
      createTestAppDependencies(),
    );

    await expect(endpoint("candidate-1")).resolves.toEqual(
      ok({
        description: null,
        firstDetectedAt: new Date("2026-06-10T00:00:00.000Z"),
        id: "candidate-1",
        lastDetectedAt: new Date("2026-06-10T00:10:00.000Z"),
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
    );
  });
});
