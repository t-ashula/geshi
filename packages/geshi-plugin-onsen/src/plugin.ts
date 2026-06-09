import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";

import type {
  AcquiredAsset,
  ExtractedDetailBody,
  SourceCollectorAcquireInput,
  SourceCollectorDetectSourcesInput,
  SourceCollectorDetectSourcesResult,
  SourceCollectorExecutionContext,
  SourceCollectorExtractInput,
  SourceCollectorInspectErrorCode,
  SourceCollectorInspectInput,
  SourceCollectorNextAction,
  SourceCollectorObserveInput,
  SourceCollectorObserveResult,
  SourceCollectorPlugin,
  SourceCollectorPluginDefinition,
  SourceCollectorSupportsInput,
  SourceMetadata,
} from "@geshi/sdk";
import { WebClient } from "@geshi/sdk";

import { manifest } from "./manifest.js";

const DEFAULT_CONTENT_TYPE = "audio/mp4";
const DEFAULT_FFMPEG_PATH = "ffmpeg";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const FINGERPRINT_VERSION = "2026-06-05";
const ONSEN_HOSTS = new Set(["onsen.ag", "www.onsen.ag"]);
const ONSEN_JST_OFFSET = "+09:00";
const ONSEN_PROGRAM_PATH_PATTERN = /^\/program\/([^/?#]+)\/?$/u;
const ONSEN_REFERER = "https://www.onsen.ag/";
const ONSEN_ROOT_URL = "https://www.onsen.ag/";

class SourceCollectorInspectPluginError extends Error {
  public readonly code: SourceCollectorInspectErrorCode;

  public constructor(code: SourceCollectorInspectErrorCode, message: string) {
    super(message);
    this.name = "SourceCollectorInspectPluginError";
    this.code = code;
  }
}

type OnsenProgramInfo = {
  description?: string | null;
  directory_url?: string | null;
  title?: string | null;
};

type OnsenProgramContentGuest = {
  name?: string | null;
};

type OnsenProgramContent = {
  delivery_date?: string | null;
  free?: boolean;
  id?: number | string;
  premium?: boolean;
  streaming_url?: string | null;
  title?: string | null;
  guests?: OnsenProgramContentGuest[] | null;
};

type OnsenProgramState = {
  contents?: OnsenProgramContent[] | null;
  directory_name?: string | null;
  program_info?: OnsenProgramInfo | null;
};

type OnsenProgramListingEntry = {
  directory_name?: string | null;
  title?: string | null;
};

type OnsenNuxtState = {
  state?: {
    program?: {
      program?: OnsenProgramState | null;
    } | null;
    programs?: {
      programs?: Record<string, unknown> | null;
    } | null;
  } | null;
};

type OnsenEpisode = {
  deliveryDate: string | null;
  directoryName: string;
  externalId: string;
  free: boolean;
  guestNames: string[];
  premium: boolean;
  publishedAt: Date | null;
  streamingUrl: string | null;
  title: string;
};

type OnsenPluginConfig = {
  ffmpegPath: string;
};

export const plugin: SourceCollectorPlugin = {
  supports(
    input: SourceCollectorSupportsInput,
    _context: SourceCollectorExecutionContext,
  ): Promise<{ supported: boolean }> {
    return Promise.resolve({
      supported: normalizeProgramUrl(input.sourceUrl) !== null,
    });
  },

  settingSchema() {
    return [];
  },

  async detectSources(
    input: SourceCollectorDetectSourcesInput,
    _context: SourceCollectorExecutionContext,
  ): Promise<SourceCollectorDetectSourcesResult> {
    const normalizedUrl = assertSupportedListingUrl(input.inputUrl);
    const html = await fetchOnsenPageHtml(normalizedUrl, input.abortSignal);
    const listingPrograms = readListingPrograms(html);

    return {
      candidates: listingPrograms.map((program) => ({
        description: null,
        sourceSlug: program.directoryName,
        title: program.title,
        url: buildProgramUrl(program.directoryName),
      })),
      detectorState: input.detectorState,
    };
  },

  async inspect(
    input: SourceCollectorInspectInput,
    _context: SourceCollectorExecutionContext,
  ): Promise<SourceMetadata> {
    const normalizedUrl = assertSupportedSourceUrl(input.sourceUrl);
    const html = await fetchProgramPageHtml(normalizedUrl, input.abortSignal);
    const program = readProgramState(html);

    if (program === null) {
      throw new SourceCollectorInspectPluginError(
        "source_inspect_unrecognized",
        "Failed to recognize the Onsen program page.",
      );
    }

    const title = collapseEmpty(program.program_info?.title ?? null);
    const description = collapseEmpty(
      program.program_info?.description ?? null,
    );
    const directoryUrl = normalizeProgramUrl(
      collapseEmpty(program.program_info?.directory_url ?? null) ??
        normalizedUrl,
    );

    if (title === null && description === null) {
      throw new SourceCollectorInspectPluginError(
        "source_inspect_unrecognized",
        "Failed to recognize the Onsen program metadata.",
      );
    }

    return {
      description,
      title,
      url: directoryUrl ?? normalizedUrl,
    };
  },

  async observe(
    input: SourceCollectorObserveInput,
    _context: SourceCollectorExecutionContext,
  ): Promise<SourceCollectorObserveResult> {
    const normalizedUrl = assertSupportedSourceUrl(input.sourceUrl);
    const html = await fetchProgramPageHtml(normalizedUrl, input.abortSignal);
    const program = readProgramState(html);

    if (program === null) {
      throw new SourceCollectorInspectPluginError(
        "source_inspect_unrecognized",
        "Failed to recognize the Onsen program page.",
      );
    }

    const episodes = buildEpisodes(program);

    return {
      contents: episodes.map((episode) => ({
        assets: [
          {
            kind: "audio",
            nextAction: buildEpisodeNextAction(episode),
            observedFingerprints: createObservedAudioFingerprints(
              episode.directoryName,
              episode.externalId,
              episode.streamingUrl,
            ),
            primary: true,
            sourceUrl: episode.streamingUrl,
          },
        ],
        contentFingerprints: createContentFingerprints(
          episode.directoryName,
          episode.externalId,
        ),
        externalId: episode.externalId,
        kind: "podcast-episode",
        publishedAt: episode.publishedAt,
        status: "discovered",
        summary: buildEpisodeSummary(episode),
        title: episode.title,
      })),
    };
  },

  acquire(
    input: SourceCollectorAcquireInput,
    _context: SourceCollectorExecutionContext,
  ): Promise<AcquiredAsset> {
    if (input.asset.kind !== "audio" || input.asset.sourceUrl === null) {
      return Promise.reject(
        new Error("Onsen acquire() only supports audio assets with sourceUrl."),
      );
    }

    const config = readPluginConfig(input.config);

    return acquireStreamingAudio(
      input.asset.sourceUrl,
      config.ffmpegPath,
      input.abortSignal,
      input.asset.primary,
    );
  },

  extract(
    _input: SourceCollectorExtractInput,
    _context: SourceCollectorExecutionContext,
  ): Promise<ExtractedDetailBody | null> {
    return Promise.resolve(null);
  },
};

export const definition: SourceCollectorPluginDefinition = {
  manifest,
  plugin,
};

function assertSupportedSourceUrl(sourceUrl: string): string {
  const normalized = normalizeProgramUrl(sourceUrl);

  if (normalized === null) {
    throw new SourceCollectorInspectPluginError(
      "source_inspect_unsupported",
      "The Onsen plugin only supports https://www.onsen.ag/program/<slug> URLs.",
    );
  }

  return normalized;
}

function normalizeProgramUrl(sourceUrl: string): string | null {
  let url: URL;

  try {
    url = new URL(sourceUrl);
  } catch {
    return null;
  }

  if (!ONSEN_HOSTS.has(url.hostname)) {
    return null;
  }

  const match = ONSEN_PROGRAM_PATH_PATTERN.exec(url.pathname);

  if (match === null) {
    return null;
  }

  return `https://www.onsen.ag/program/${match[1]}`;
}

async function fetchProgramPageHtml(
  sourceUrl: string,
  abortSignal: AbortSignal,
): Promise<string> {
  return fetchOnsenPageHtml(sourceUrl, abortSignal);
}

async function fetchOnsenPageHtml(
  sourceUrl: string,
  abortSignal: AbortSignal,
): Promise<string> {
  const webClient = WebClient.create({ kind: "fetch" });
  let response: Response;

  try {
    response = await webClient.fetch(
      new Request(sourceUrl, {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
        },
        signal: abortSignal,
      }),
    );
  } catch {
    throw new SourceCollectorInspectPluginError(
      "source_inspect_fetch_failed",
      "Failed to fetch the Onsen program page.",
    );
  }

  if (!response.ok) {
    throw new SourceCollectorInspectPluginError(
      "source_inspect_fetch_failed",
      "Failed to fetch the Onsen program page.",
    );
  }

  return response.text();
}

function assertSupportedListingUrl(inputUrl: string): string {
  const normalized = normalizeListingUrl(inputUrl);

  if (normalized === null) {
    throw new SourceCollectorInspectPluginError(
      "source_inspect_unsupported",
      "The Onsen plugin only supports https://www.onsen.ag/ as a source detection listing URL.",
    );
  }

  return normalized;
}

function normalizeListingUrl(inputUrl: string): string | null {
  let url: URL;

  try {
    url = new URL(inputUrl);
  } catch {
    return null;
  }

  if (!ONSEN_HOSTS.has(url.hostname)) {
    return null;
  }

  if (url.pathname !== "/" && url.pathname !== "") {
    return null;
  }

  return ONSEN_ROOT_URL;
}

function readProgramState(html: string): OnsenProgramState | null {
  const nuxtScript = extractNuxtScript(html);

  if (nuxtScript === null) {
    return null;
  }

  const context = {
    window: {} as { __NUXT__?: OnsenNuxtState },
  };
  vm.createContext(context);

  try {
    vm.runInContext(nuxtScript, context, {
      timeout: 1000,
    });
  } catch {
    return null;
  }

  const candidate = context.window.__NUXT__?.state?.program?.program;

  if (
    candidate === undefined ||
    candidate === null ||
    typeof candidate !== "object"
  ) {
    return null;
  }

  return candidate;
}

function readListingPrograms(
  html: string,
): Array<{ directoryName: string; title: string | null }> {
  const nuxtScript = extractNuxtScript(html);

  if (nuxtScript === null) {
    return [];
  }

  const context = {
    window: {} as { __NUXT__?: OnsenNuxtState },
  };
  vm.createContext(context);

  try {
    vm.runInContext(nuxtScript, context, {
      timeout: 1000,
    });
  } catch {
    return [];
  }

  const listing = context.window.__NUXT__?.state?.programs?.programs;

  if (
    listing === undefined ||
    listing === null ||
    typeof listing !== "object"
  ) {
    return [];
  }

  const candidates: unknown[] = Array.isArray(listing.all)
    ? listing.all
    : Object.values(listing).reduce<unknown[]>((accumulator, value) => {
        if (Array.isArray(value)) {
          for (const item of value) {
            accumulator.push(item);
          }
        }

        return accumulator;
      }, []);
  const programs = new Map<
    string,
    { directoryName: string; title: string | null }
  >();

  for (const candidate of candidates) {
    if (candidate === null || typeof candidate !== "object") {
      continue;
    }

    const entry = candidate as OnsenProgramListingEntry;
    const directoryName = collapseEmpty(entry.directory_name ?? null);

    if (directoryName === null || programs.has(directoryName)) {
      continue;
    }

    programs.set(directoryName, {
      directoryName,
      title: collapseEmpty(entry.title ?? null),
    });
  }

  return [...programs.values()];
}

function extractNuxtScript(html: string): string | null {
  const marker = "<script>window.__NUXT__=";
  const startIndex = html.indexOf(marker);

  if (startIndex < 0) {
    return null;
  }

  const endIndex = html.indexOf("</script>", startIndex);

  if (endIndex < 0) {
    return null;
  }

  return html.slice(startIndex + "<script>".length, endIndex);
}

function buildEpisodes(program: OnsenProgramState): OnsenEpisode[] {
  const directoryName = collapseEmpty(program.directory_name ?? null);
  const contents = Array.isArray(program.contents) ? program.contents : [];

  if (directoryName === null) {
    return [];
  }

  const monthDayItems = contents.map((content) =>
    parseMonthDay(collapseEmpty(content.delivery_date ?? null)),
  );
  const inferredDates = inferPublishedDates(monthDayItems);
  const episodes: OnsenEpisode[] = [];

  for (const [index, content] of contents.entries()) {
    const contentId = normalizeContentId(content.id);
    const title = collapseEmpty(content.title ?? null);

    if (contentId === null || title === null) {
      continue;
    }

    const free = content.free === true;
    const premium = content.premium === true;
    const streamingUrl = normalizeStreamingUrl(content.streaming_url ?? null);

    episodes.push({
      deliveryDate: collapseEmpty(content.delivery_date ?? null),
      directoryName,
      externalId: `${directoryName}:${contentId}`,
      free,
      guestNames: readGuestNames(content.guests),
      premium,
      publishedAt: inferredDates[index] ?? null,
      streamingUrl,
      title,
    });
  }

  return episodes;
}

function normalizeContentId(value: number | string | undefined): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function buildProgramUrl(directoryName: string): string {
  return `https://www.onsen.ag/program/${directoryName}`;
}

function normalizeStreamingUrl(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();

  if (normalized === "") {
    return null;
  }

  try {
    return new URL(normalized).toString();
  } catch {
    return null;
  }
}

function readGuestNames(
  guests: OnsenProgramContentGuest[] | null | undefined,
): string[] {
  if (!Array.isArray(guests)) {
    return [];
  }

  return guests
    .map((guest) => collapseEmpty(guest.name ?? null))
    .filter((guest): guest is string => guest !== null);
}

function parseMonthDay(
  deliveryDate: string | null,
): { day: number; month: number } | null {
  if (deliveryDate === null) {
    return null;
  }

  const match = /^(\d{1,2})\/(\d{1,2})$/u.exec(deliveryDate);

  if (match === null) {
    return null;
  }

  const month = Number.parseInt(match[1], 10);
  const day = Number.parseInt(match[2], 10);

  if (
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return { day, month };
}

function inferPublishedDates(
  values: Array<{ day: number; month: number } | null>,
): Array<Date | null> {
  const currentYear = new Date().getFullYear();
  const dates: Array<Date | null> = [];
  let currentInferenceYear = currentYear;
  let previous: { day: number; month: number } | null = null;

  for (const value of values) {
    if (value === null) {
      dates.push(null);
      continue;
    }

    if (
      previous !== null &&
      (value.month > previous.month ||
        (value.month === previous.month && value.day > previous.day))
    ) {
      currentInferenceYear -= 1;
    }

    previous = value;
    const date = new Date(
      `${currentInferenceYear}-${String(value.month).padStart(2, "0")}-${String(
        value.day,
      ).padStart(2, "0")}T00:00:00${ONSEN_JST_OFFSET}`,
    );
    dates.push(Number.isNaN(date.getTime()) ? null : date);
  }

  return dates;
}

function buildEpisodeSummary(episode: OnsenEpisode): string | null {
  const lines = [
    episode.deliveryDate,
    episode.guestNames.length === 0
      ? null
      : `Guest: ${episode.guestNames.join(", ")}`,
    episode.premium && !episode.free ? "PREMIUM only" : null,
  ].filter((value): value is string => value !== null && value !== "");

  return lines.length === 0 ? null : lines.join("\n");
}

function buildEpisodeNextAction(
  episode: OnsenEpisode,
): SourceCollectorNextAction {
  if (episode.streamingUrl !== null) {
    return {
      actionKind: "acquire",
    };
  }

  return {
    actionKind: "none",
    message:
      "Audio stream is not publicly available for this episode on the current Onsen page.",
    reason: "requires-manual-action",
  };
}

function collapseEmpty(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const collapsed = value.replace(/\s+/gu, " ").trim();
  return collapsed === "" ? null : collapsed;
}

function readPluginConfig(config: Record<string, unknown>): OnsenPluginConfig {
  const ffmpegPath =
    typeof config.ffmpegPath === "string" && config.ffmpegPath.trim() !== ""
      ? config.ffmpegPath.trim()
      : DEFAULT_FFMPEG_PATH;

  return {
    ffmpegPath,
  };
}

async function acquireStreamingAudio(
  streamingUrl: string,
  ffmpegPath: string,
  abortSignal: AbortSignal,
  primary: boolean,
): Promise<AcquiredAsset> {
  const workDirectory = await mkdtemp(join(tmpdir(), "geshi-onsen-"));
  const outputPath = join(workDirectory, "episode.m4a");

  try {
    await transcodePlaylistToM4a(
      streamingUrl,
      outputPath,
      ffmpegPath,
      abortSignal,
    );
    const body = new Uint8Array(await readFile(outputPath));

    return {
      acquiredFingerprints: createAcquiredAudioFingerprints(
        streamingUrl,
        body.byteLength,
      ),
      body,
      contentType: DEFAULT_CONTENT_TYPE,
      kind: "audio",
      metadata: {},
      primary,
      sourceUrl: streamingUrl,
    };
  } finally {
    await rm(workDirectory, {
      force: true,
      recursive: true,
    }).catch(() => undefined);
  }
}

async function transcodePlaylistToM4a(
  streamingUrl: string,
  outputPath: string,
  ffmpegPath: string,
  abortSignal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      "-loglevel",
      "error",
      "-y",
      "-headers",
      `Referer: ${ONSEN_REFERER}\r\nUser-Agent: ${DEFAULT_USER_AGENT}\r\n`,
      "-i",
      streamingUrl,
      "-vn",
      "-c:a",
      "copy",
      "-bsf:a",
      "aac_adtstoasc",
      "-f",
      "ipod",
      outputPath,
    ]);
    const stderrChunks: Buffer[] = [];

    const abortHandler = () => {
      ffmpeg.kill("SIGTERM");
      reject(new Error("Onsen acquire() aborted."));
    };

    abortSignal.addEventListener("abort", abortHandler, { once: true });

    ffmpeg.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    ffmpeg.on("error", (error) => {
      abortSignal.removeEventListener("abort", abortHandler);
      reject(error);
    });

    ffmpeg.on("close", (code) => {
      abortSignal.removeEventListener("abort", abortHandler);

      if (code !== 0) {
        const detail = Buffer.concat(stderrChunks).toString("utf8").trim();
        reject(
          new Error(
            `ffmpeg failed while acquiring Onsen audio: ${detail || code}`,
          ),
        );
        return;
      }

      resolve();
    });
  });
}

function createContentFingerprints(
  directoryName: string,
  externalId: string,
): string[] {
  return [createFingerprint(`${directoryName}:${externalId}`)];
}

function createObservedAudioFingerprints(
  directoryName: string,
  externalId: string,
  streamingUrl: string | null,
): string[] {
  return [
    createFingerprint(
      `${directoryName}:${externalId}:${streamingUrl ?? "unavailable"}`,
    ),
  ];
}

function createAcquiredAudioFingerprints(
  streamingUrl: string,
  byteLength: number,
): string[] {
  return [createFingerprint(`${streamingUrl}:${byteLength}`)];
}

function createFingerprint(value: string): string {
  const hash = createHash("sha256").update(value).digest("hex");
  return `${FINGERPRINT_VERSION}:${hash}`;
}
