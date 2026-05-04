import { expect, test } from "@playwright/test";

const transcriptSourceFeedUrl =
  process.env.E2E_TRANSCRIPT_SOURCE_FEED_URL ??
  "http://127.0.0.1:3401/feeds/botchan.xml";
const transcriptTestTimeoutMs = 5 * 60 * 1_000;

test.setTimeout(transcriptTestTimeoutMs);

test("requests transcript and waits for chunked transcription to complete", async ({
  page,
  request,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Add source" }).click();
  await page
    .getByRole("combobox", { name: "Collector Plugin" })
    .selectOption("podcast-rss");
  const urlInput = page.getByRole("textbox", { name: "Source URL" });
  await urlInput.fill(transcriptSourceFeedUrl);
  await urlInput.blur();
  await page.getByRole("button", { name: "Register" }).click();

  await expect(page.getByText(transcriptSourceFeedUrl)).toBeVisible();
  await page.getByRole("button", { name: "Observe" }).click();

  let entryId: string | null = null;

  await expect
    .poll(
      async () => {
        const response = await request.get("/api/v1/contents");
        const payload = (await response.json()) as {
          data: Array<{ id: string; title: string | null }>;
        };
        const entry = payload.data.find(
          (content) => content.title === "Botchan Episode 1",
        );

        entryId = entry?.id ?? null;

        return entryId !== null;
      },
      {
        timeout: transcriptTestTimeoutMs,
      },
    )
    .toBe(true);

  if (entryId === null) {
    throw new Error("Botchan Episode 1 was not observed.");
  }

  const observedEntryId: string = entryId;

  await expect
    .poll(
      async () => {
        const response = await request.get(
          `/api/v1/contents/${observedEntryId}`,
        );
        const payload = (await response.json()) as {
          data?: {
            assets: Array<{
              kind: string;
              url: string | null;
            }>;
            status: "discovered" | "stored" | "failed";
          };
        };

        const hasPlayableAudioAsset =
          payload.data?.assets.some(
            (asset) => asset.kind === "audio" && asset.url !== null,
          ) ?? false;

        if (!hasPlayableAudioAsset) {
          return "waiting";
        }

        return payload.data?.status ?? "waiting";
      },
      {
        timeout: transcriptTestTimeoutMs,
      },
    )
    .toBe("stored");

  await page.goto(`/browse/entry/${observedEntryId}`);
  await expect(
    page.getByRole("heading", { name: "Botchan Episode 1" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Request transcripts" }).click();

  await expect
    .poll(
      async () => {
        const response = await request.get(
          `/api/v1/contents/${observedEntryId}`,
        );
        const payload = (await response.json()) as {
          data?: {
            transcripts: Array<{
              body: string | null;
              status: "queued" | "running" | "succeeded" | "failed";
              totalChunkCount: number;
            }>;
          };
        };
        const transcript = payload.data?.transcripts[0];

        if (transcript === undefined) {
          return "missing";
        }

        if (transcript.status === "failed") {
          return "failed";
        }

        if (transcript.status !== "succeeded") {
          return transcript.status;
        }

        if (transcript.totalChunkCount < 2) {
          return "single-chunk";
        }

        if ((transcript.body ?? "").trim() === "") {
          return "empty-body";
        }

        return "succeeded";
      },
      {
        timeout: transcriptTestTimeoutMs,
      },
    )
    .toBe("succeeded");

  await page.reload();
  await expect(page.getByText("Transcript #1")).toBeVisible();
  await expect(page.getByText("succeeded")).toBeVisible();
});
