import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const sourceFeedUrl =
  process.env.E2E_SOURCE_FEED_URL ?? "http://127.0.0.1:3401/feeds/podcast.xml";
const discoveryPageUrl =
  process.env.E2E_DISCOVERY_PAGE_URL ??
  "http://127.0.0.1:3401/discovery/index.html";
const sourceOrigin = new URL(sourceFeedUrl).origin;

test("detects multiple source candidates from a discovery page and registers them", async ({
  page,
  request,
}) => {
  await page.goto("/");

  await openSourceRegistration(page);
  await detectSources(page, discoveryPageUrl);

  const rdfCandidate = candidateRow(page, "Geshi E2E RDF Feed", "rss / feed");
  const podcastCandidate = candidateRow(
    page,
    "Geshi E2E Discovery Podcast",
    "podcast-rss / podcast",
  );
  const duplicatePodcastCandidate = candidateRow(
    page,
    "Geshi E2E Discovery Podcast",
    "rss / feed",
  );

  await expect(rdfCandidate).toBeVisible();
  await expect(podcastCandidate).toBeVisible();
  await expect(rdfCandidate.getByText("Discovery Entry 1")).toBeVisible();
  await expect(podcastCandidate.getByText("Discovery Episode 1")).toBeVisible();
  await duplicatePodcastCandidate.getByRole("checkbox").uncheck();

  await page.getByRole("button", { name: "Register selected sources" }).click();

  await expect(
    page.getByRole("heading", { level: 2, name: "Add source" }),
  ).toHaveCount(0);

  await expect
    .poll(
      async () => {
        const response = await request.get("/api/v1/sources");
        const payload = (await response.json()) as {
          data: Array<{ title: string | null }>;
        };

        const titles = payload.data.map((source) => source.title);

        return (
          titles.includes("Geshi E2E RDF Feed") &&
          titles.includes("Geshi E2E Discovery Podcast")
        );
      },
      {
        timeout: 30_000,
      },
    )
    .toBe(true);
});

test("registers a source from direct feed discovery and observes contents", async ({
  page,
  request,
}) => {
  await page.goto("/");

  await openSourceRegistration(page);
  await detectSources(page, sourceFeedUrl);
  const selectedCandidate = candidateRow(
    page,
    "Geshi E2E Feed",
    "podcast-rss / podcast",
  );
  const duplicateCandidate = candidateRow(page, "Geshi E2E Feed", "rss / feed");

  await expect(selectedCandidate).toBeVisible();
  await expect(selectedCandidate.getByText("Episode 1")).toBeVisible();
  await duplicateCandidate.getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: "Register selected sources" }).click();

  await expect(
    page.getByRole("heading", { level: 2, name: "Geshi E2E Feed" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Entry actions" }).click();
  await page.getByRole("menuitem", { name: "Crawl" }).click();

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

  await page.getByRole("button", { name: "Reload entries" }).click();
  await expect(page.getByText("Episode 1")).toBeVisible();
  await expect(page.getByText("Hello from E2E fixture.")).toBeVisible();
});

test("opens entry detail and exposes playable audio", async ({
  page,
  request,
}) => {
  const playbackSourceFeedUrl = `${sourceFeedUrl}?playback=1`;

  await page.goto("/");

  await openSourceRegistration(page);
  await detectSources(page, playbackSourceFeedUrl);
  await candidateRow(page, "Geshi E2E Feed", "rss / feed")
    .getByRole("checkbox")
    .uncheck();
  await page.getByRole("button", { name: "Register selected sources" }).click();

  await expect(
    page.getByRole("heading", { level: 2, name: "Geshi E2E Feed" }),
  ).toBeVisible();
  const sourcesResponse = await request.get("/api/v1/sources");
  const sourcesPayload = (await sourcesResponse.json()) as {
    data: Array<{ slug: string; url: string }>;
  };
  const playbackSource = sourcesPayload.data.find(
    (source) => source.url === playbackSourceFeedUrl,
  );

  expect(playbackSource).toBeDefined();
  const playbackSourceSlug = playbackSource?.slug ?? "";

  await page.getByRole("button", { name: "Entry actions" }).click();
  await page.getByRole("menuitem", { name: "Crawl" }).click();

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
  await expect(
    page.getByRole("link", { name: "Original page" }),
  ).toHaveAttribute("href", `${sourceOrigin}/episodes/1.html`);
  await expect(
    page.getByRole("heading", { level: 3, name: "Playable assets" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Play" }).first().click();
  await expect(page.getByText("Episode 1").last()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Stop playback" }),
  ).toBeVisible();

  const audio = page.locator("audio");
  await expect(audio).toHaveAttribute(
    "src",
    /\/media\/assets\/[0-9a-f-]+\.mp3$/u,
  );

  const audioSourceUrl = await audio.getAttribute("src");

  expect(audioSourceUrl).toMatch(/^\/media\/assets\/[0-9a-f-]+\.mp3$/u);

  const mediaResponse = await request.get(audioSourceUrl ?? "");

  expect(mediaResponse.status()).toBe(200);
  expect(mediaResponse.headers()["content-type"]).toBe("audio/mpeg");

  await page.getByRole("button", { name: "Asset actions" }).first().click();
  await expect(
    page.getByRole("menuitem", { name: "Request transcripts" }),
  ).toBeVisible();
});

async function openSourceRegistration(page: Page) {
  await page.getByRole("button", { name: "Add source" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Add source" }),
  ).toBeVisible();
}

async function detectSources(page: Page, url: string) {
  await page.getByRole("textbox", { name: "Discovery URL" }).fill(url);
  await page.getByRole("button", { name: "Detect sources" }).click();
  await expect(
    page.getByRole("heading", { level: 3, name: "Select sources to register" }),
  ).toBeVisible();
}

function candidateRow(page: Page, title: string, meta: string) {
  return page.locator(".candidate-option").filter({
    has: page.locator(".candidate-option-title", { hasText: title }),
    hasText: meta,
  });
}
