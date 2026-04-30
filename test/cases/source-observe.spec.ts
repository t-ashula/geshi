import { expect, test } from "@playwright/test";

const sourceFeedUrl =
  process.env.E2E_SOURCE_FEED_URL ?? "http://127.0.0.1:3401/feeds/podcast.xml";
const nonRssSourceUrl =
  process.env.E2E_NON_RSS_SOURCE_URL ??
  "http://127.0.0.1:3401/feeds/not-rss.xml";

test("autofills source fields via inspect", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Add source" }).click();

  const urlInput = page.getByRole("textbox", { name: "RSS URL" });
  await urlInput.fill(sourceFeedUrl);
  await urlInput.blur();

  await expect(page.getByRole("textbox", { name: "Source Slug" })).toHaveValue(
    /geshi-e2e-feed-/,
  );
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue(
    "Geshi E2E Feed",
  );
  await expect(page.getByRole("textbox", { name: "Description" })).toHaveValue(
    "Fixture feed for E2E tests.",
  );
});

test("allows manual registration after inspect failure", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Add source" }).click();

  const urlInput = page.getByRole("textbox", { name: "RSS URL" });
  await urlInput.fill(nonRssSourceUrl);
  await urlInput.blur();

  await expect(
    page.getByText("The given URL is not a supported RSS feed."),
  ).toBeVisible();

  await page.getByRole("textbox", { name: "Title" }).fill("Manual Source");
  await page
    .getByRole("textbox", { name: "Description" })
    .fill("Registered after inspect failure.");
  await page.getByRole("button", { name: "Register" }).click();

  await expect(page.getByText(nonRssSourceUrl)).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Manual Source" }),
  ).toBeVisible();
});

test("registers a source and observes contents", async ({ page, request }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Add source" }).click();
  const urlInput = page.getByRole("textbox", { name: "RSS URL" });
  await urlInput.fill(sourceFeedUrl);
  await urlInput.blur();
  await page.getByRole("button", { name: "Register" }).click();

  await expect(page.getByText(sourceFeedUrl)).toBeVisible();

  await page.getByRole("button", { name: "Observe" }).click();

  await expect
    .poll(
      async () => {
        const response = await request.get("/api/v1/contents");
        const payload = (await response.json()) as {
          data: Array<{ title: string | null }>;
        };

        return payload.data.some((content) => content.title === "Episode 1");
      },
      {
        timeout: 30_000,
      },
    )
    .toBe(true);

  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByText("Episode 1")).toBeVisible();
  await expect(page.getByText("Hello from E2E fixture.")).toBeVisible();
});

test("opens entry detail and exposes playable audio", async ({
  page,
  request,
}) => {
  const playbackSourceFeedUrl = `${sourceFeedUrl}?playback=1`;

  await page.goto("/");

  await page.getByRole("button", { name: "Add source" }).click();
  const urlInput = page.getByRole("textbox", { name: "RSS URL" });
  await urlInput.fill(playbackSourceFeedUrl);
  await urlInput.blur();
  await page.getByRole("button", { name: "Register" }).click();

  await expect(page.getByText(playbackSourceFeedUrl)).toBeVisible();
  const sourcesResponse = await request.get("/api/v1/sources");
  const sourcesPayload = (await sourcesResponse.json()) as {
    data: Array<{ slug: string; url: string }>;
  };
  const playbackSource = sourcesPayload.data.find(
    (source) => source.url === playbackSourceFeedUrl,
  );

  expect(playbackSource).toBeDefined();
  const playbackSourceSlug = playbackSource?.slug ?? "";

  await page.getByRole("button", { name: "Observe" }).click();

  await expect
    .poll(
      async () => {
        const response = await request.get("/api/v1/contents");
        const payload = (await response.json()) as {
          data: Array<{ sourceSlug: string; title: string | null }>;
        };

        return payload.data.some(
          (content) =>
            content.title === "Episode 1" &&
            content.sourceSlug === playbackSourceSlug,
        );
      },
      {
        timeout: 30_000,
      },
    )
    .toBe(true);

  const contentsResponse = await request.get("/api/v1/contents");
  const contentsPayload = (await contentsResponse.json()) as {
    data: Array<{ id: string; title: string | null; sourceSlug: string }>;
  };
  const entry = contentsPayload.data.find(
    (content) =>
      content.title === "Episode 1" &&
      content.sourceSlug === playbackSourceSlug,
  );

  expect(entry).toBeDefined();

  await expect
    .poll(
      async () => {
        const detailResponse = await request.get(
          `/api/v1/contents/${entry?.id}`,
        );
        const detailPayload = (await detailResponse.json()) as {
          data?: {
            assets: Array<{ kind: string; url: string | null }>;
          };
        };

        return (
          detailPayload.data?.assets.some(
            (asset) => asset.kind === "audio" && asset.url !== null,
          ) ?? false
        );
      },
      {
        timeout: 30_000,
      },
    )
    .toBe(true);

  await page.goto(`/browse/entry/${entry?.id}`);

  await expect(page).toHaveURL(/\/browse\/entry\//);

  const audio = page.locator("audio");
  await expect(audio).toBeVisible();

  const audioSourceUrl = await audio.evaluate((element) =>
    element.getAttribute("src"),
  );

  expect(audioSourceUrl).toMatch(/^\/media\/assets\/[0-9a-f-]+\.mp3$/u);

  const mediaResponse = await request.get(audioSourceUrl ?? "");

  expect(mediaResponse.status()).toBe(200);
  expect(mediaResponse.headers()["content-type"]).toBe("audio/mpeg");
});
