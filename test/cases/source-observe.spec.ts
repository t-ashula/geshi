import { expect, test } from "@playwright/test";

const sourceFeedUrl =
  process.env.E2E_SOURCE_FEED_URL ?? "http://127.0.0.1:3401/feeds/podcast.xml";
const nonRssSourceUrl =
  process.env.E2E_NON_RSS_SOURCE_URL ??
  "http://127.0.0.1:3401/feeds/not-rss.xml";

test("autofills source fields via inspect", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "+" }).click();

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

  await page.getByRole("button", { name: "+" }).click();

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

  await page.getByRole("button", { name: "+" }).click();
  const urlInput = page.getByRole("textbox", { name: "RSS URL" });
  await urlInput.fill(sourceFeedUrl);
  await urlInput.blur();
  await page.getByRole("button", { name: "Register" }).click();

  await expect(page.getByText(sourceFeedUrl)).toBeVisible();

  await page
    .locator(".source-card")
    .filter({ hasText: sourceFeedUrl })
    .getByRole("button", { name: "Run Observe" })
    .click();

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

  await expect(
    page.getByRole("heading", { level: 3, name: "Episode 1" }),
  ).toBeVisible();
  await expect(page.getByText("Hello from E2E fixture.")).toBeVisible();
});
