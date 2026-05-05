import { describe, expect, it, vi } from "vitest";

import { PgBossJobQueue } from "../../src/job-queue/pg-boss.js";
import {
  ACQUIRE_CONTENT_JOB_NAME,
  RECORD_CONTENT_JOB_NAME,
} from "../../src/job-queue/types.js";

describe("PgBossJobQueue", () => {
  it("disables queue-level retry for record-content jobs", async () => {
    const send = vi.fn(() => Promise.resolve("queue-job-1"));
    const jobQueue = new PgBossJobQueue({
      send,
    } as never);

    await jobQueue.enqueue(RECORD_CONTENT_JOB_NAME, {
      asset: {
        id: "asset-1",
        kind: "audio",
        observedFingerprint: "stream-observed:1",
        primary: true,
        sourceUrl: "http://localhost:3401/streams/live-1",
      },
      collector: {
        config: {},
        pluginSlug: "streaming-plugin-example",
        settingId: "collector-setting-1",
        settingSnapshotId: "collector-setting-snapshot-1",
      },
      content: {
        externalId: "live-1",
        id: "content-1",
        kind: "stream-recording",
        publishedAt: null,
        status: "discovered",
        summary: null,
        title: "Live 1",
      },
      jobId: "record-job-1",
      source: {
        id: "source-1",
        slug: "stream-1",
      },
    });

    expect(send).toHaveBeenCalledWith(
      RECORD_CONTENT_JOB_NAME,
      expect.any(Object),
      {
        retryLimit: 0,
      },
    );
  });

  it("keeps retry settings for non-record-content jobs", async () => {
    const send = vi.fn(() => Promise.resolve("queue-job-1"));
    const jobQueue = new PgBossJobQueue({
      send,
    } as never);

    await jobQueue.enqueue(ACQUIRE_CONTENT_JOB_NAME, {
      asset: {
        id: "asset-1",
        kind: "audio",
        observedFingerprint: "asset-observed:1",
        primary: true,
        sourceUrl: "http://localhost:3401/files/audio.mp3",
      },
      collector: {
        config: {},
        pluginSlug: "go-jp-rss",
        settingId: "collector-setting-1",
        settingSnapshotId: "collector-setting-snapshot-1",
      },
      content: {
        externalId: "content-1",
        id: "content-1",
        kind: "episode",
        publishedAt: null,
        status: "discovered",
        summary: null,
        title: "Episode 1",
      },
      jobId: "acquire-job-1",
      source: {
        id: "source-1",
        slug: "source-1",
      },
    });

    expect(send).toHaveBeenCalledWith(
      ACQUIRE_CONTENT_JOB_NAME,
      expect.any(Object),
      {
        retryBackoff: true,
        retryDelay: 5,
        retryLimit: 2,
      },
    );
  });
});
