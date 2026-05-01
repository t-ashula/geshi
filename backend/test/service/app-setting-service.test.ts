import { describe, expect, it, vi } from "vitest";

import type {
  AppSettingRecord,
  AppSettingRepository,
} from "../../src/db/app-setting-repository.js";
import { err, ok } from "../../src/lib/result.js";
import { createAppSettingService } from "../../src/service/app-setting-service.js";
import { assertErr, assertOk } from "../support/result.js";

describe("app setting service", () => {
  it("ensures the default profile through repository", async () => {
    const ensureProfile = vi.fn(() => Promise.resolve(ok(undefined)));
    const service = createAppSettingService({
      ensureProfile,
      findLatestByProfile: vi.fn(),
      upsert: vi.fn(),
    } as unknown as AppSettingRepository);

    const result = await service.ensureDefaultProfile();

    assertOk(result);
    expect(ensureProfile).toHaveBeenCalledWith("default");
  });

  it("creates default periodic crawl settings when missing", async () => {
    const upsert = vi.fn(() =>
      Promise.resolve(
        ok({
          enabled: true,
          id: "setting-1",
          intervalMinutes: 60,
          profileSlug: "default",
          snapshotId: "snapshot-1",
          version: 1,
        } satisfies AppSettingRecord),
      ),
    );
    const service = createAppSettingService({
      ensureProfile: vi.fn(),
      findLatestByProfile: vi.fn(() => Promise.resolve(ok(null))),
      upsert,
    } as unknown as AppSettingRepository);

    const result = await service.getPeriodicCrawlSettings();

    assertOk(result);
    expect(upsert).toHaveBeenCalledWith("default", {
      enabled: true,
      intervalMinutes: 60,
    });
    expect(result.value).toEqual({
      enabled: true,
      intervalMinutes: 60,
    });
  });

  it("passes through repository errors while loading periodic crawl settings", async () => {
    const service = createAppSettingService({
      ensureProfile: vi.fn(),
      findLatestByProfile: vi.fn(() =>
        Promise.resolve(err(new Error("load failed"))),
      ),
      upsert: vi.fn(),
    } as unknown as AppSettingRepository);

    const result = await service.getPeriodicCrawlSettings();

    assertErr(result);
    expect(result.error.message).toBe("load failed");
  });

  it("passes through repository errors while creating default settings", async () => {
    const service = createAppSettingService({
      ensureProfile: vi.fn(),
      findLatestByProfile: vi.fn(() => Promise.resolve(ok(null))),
      upsert: vi.fn(() => Promise.resolve(err(new Error("upsert failed")))),
    } as unknown as AppSettingRepository);

    const result = await service.getPeriodicCrawlSettings();

    assertErr(result);
    expect(result.error.message).toBe("upsert failed");
  });

  it("normalizes loaded periodic crawl settings", async () => {
    const service = createAppSettingService({
      ensureProfile: vi.fn(),
      findLatestByProfile: vi.fn(() =>
        Promise.resolve(
          ok({
            enabled: null,
            id: "setting-1",
            intervalMinutes: 0,
            profileSlug: "default",
            snapshotId: "snapshot-1",
            version: 2,
          } satisfies AppSettingRecord),
        ),
      ),
      upsert: vi.fn(),
    } as unknown as AppSettingRepository);

    const result = await service.getPeriodicCrawlSettings();

    assertOk(result);
    expect(result.value).toEqual({
      enabled: true,
      intervalMinutes: 60,
    });
  });

  it("normalizes settings before persisting updates", async () => {
    const upsert = vi.fn(() =>
      Promise.resolve(
        ok({
          enabled: true,
          id: "setting-1",
          intervalMinutes: 60,
          profileSlug: "default",
          snapshotId: "snapshot-2",
          version: 2,
        } satisfies AppSettingRecord),
      ),
    );
    const service = createAppSettingService({
      ensureProfile: vi.fn(),
      findLatestByProfile: vi.fn(),
      upsert,
    } as unknown as AppSettingRepository);

    const result = await service.updatePeriodicCrawlSettings({
      enabled: true,
      intervalMinutes: 0,
    });

    assertOk(result);
    expect(upsert).toHaveBeenCalledWith("default", {
      enabled: true,
      intervalMinutes: 60,
    });
    expect(result.value).toEqual({
      enabled: true,
      intervalMinutes: 60,
    });
  });
});
