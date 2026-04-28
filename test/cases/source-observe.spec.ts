import { expect, test } from "@playwright/test";

const sourceFeedUrl =
  process.env.E2E_SOURCE_FEED_URL ?? "http://127.0.0.1:3401/feeds/podcast.xml";

test("registers a source and observes contents", async ({ page, request }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "+" }).click();
  await page.getByRole("textbox", { name: "RSS URL" }).fill(sourceFeedUrl);
  await page.getByRole("textbox", { name: "Title" }).fill("E2E Feed");
  await page.getByRole("textbox", { name: "Description" }).fill(
    "E2E source fixture.",
  );
  await page.getByRole("button", { name: "Register" }).click();

  await expect(page.getByText(sourceFeedUrl)).toBeVisible();

  await page.getByRole("button", { name: "Run Observe" }).click();

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
