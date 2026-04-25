import type { Hono } from "hono";

import { createCatalogStore } from "../catalog/index.js";

export function registerChannelRoutes(app: Hono): void {
  const catalogStore = createCatalogStore({ kind: "pg" });

  app.get("/channels", async (context) => {
    const channels = await catalogStore.listChannels();

    return context.json({ channels });
  });

  app.post("/channels", async (context) => {
    const request = (await context.req.json()) as {
      collector?: {
        feedUrl?: string;
        observeInterval?: string | null;
        observeScheduleKind?: "interval" | "manual";
        pluginId?: string;
        slug?: string;
      };
      kind?: "podcast" | "rss" | "streaming";
      name?: string;
      note?: string | null;
      slug?: string;
    };

    if (typeof request.name !== "string" || request.name.length === 0) {
      return context.json({ error: "name is required." }, 400);
    }

    if (typeof request.slug !== "string" || request.slug.length === 0) {
      return context.json({ error: "slug is required." }, 400);
    }

    if (
      request.kind !== "podcast" &&
      request.kind !== "rss" &&
      request.kind !== "streaming"
    ) {
      return context.json({ error: "kind is invalid." }, 400);
    }

    if (typeof request.collector !== "object" || request.collector === null) {
      return context.json({ error: "collector is required." }, 400);
    }

    if (
      typeof request.collector.pluginId !== "string" ||
      request.collector.pluginId.length === 0
    ) {
      return context.json({ error: "collector.pluginId is required." }, 400);
    }

    if (
      request.collector.observeScheduleKind !== "interval" &&
      request.collector.observeScheduleKind !== "manual"
    ) {
      return context.json(
        { error: "collector.observeScheduleKind is invalid." },
        400,
      );
    }

    if (
      typeof request.collector.slug !== "string" ||
      request.collector.slug.length === 0
    ) {
      return context.json({ error: "collector.slug is required." }, 400);
    }

    if (
      typeof request.collector.feedUrl !== "string" ||
      request.collector.feedUrl.length === 0
    ) {
      return context.json({ error: "collector.feedUrl is required." }, 400);
    }

    const channel = await catalogStore.createChannel({
      kind: request.kind,
      name: request.name,
      note: request.note ?? null,
      slug: request.slug,
    });
    const collector = await catalogStore.createCollector({
      channelId: channel.id,
      config: {
        feedUrl: request.collector.feedUrl,
      },
      observeInterval: request.collector.observeInterval ?? null,
      observeScheduleKind: request.collector.observeScheduleKind,
      pluginId: request.collector.pluginId,
      slug: request.collector.slug,
    });

    return context.json({ channel, collector }, 201);
  });
}
