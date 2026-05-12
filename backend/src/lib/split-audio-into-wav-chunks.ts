import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const TRANSCRIPT_CHUNK_DURATION_SECONDS = 180;

export type SplitChunkResult = {
  body: Uint8Array;
  chunkIndex: number;
  sourceEndMs: number;
  sourceStartMs: number;
};

export async function splitAudioIntoWavChunks(
  sourceBody: Uint8Array,
): Promise<SplitChunkResult[]> {
  const tempDir = await mkdtemp(join(tmpdir(), "geshi-split-chunk-"));
  const inputPath = join(tempDir, "input");
  const outputPattern = join(tempDir, "chunk-%03d.wav");

  try {
    await writeFile(inputPath, sourceBody);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-acodec",
      "pcm_s16le",
      "-ar",
      "16000",
      "-ac",
      "1",
      "-f",
      "segment",
      "-segment_time",
      String(TRANSCRIPT_CHUNK_DURATION_SECONDS),
      outputPattern,
    ]);

    const chunkFiles = (await readdir(tempDir))
      .filter(
        (fileName) =>
          fileName.startsWith("chunk-") && fileName.endsWith(".wav"),
      )
      .sort();

    let currentStartMs = 0;
    const chunks: SplitChunkResult[] = [];

    for (const [chunkIndex, fileName] of chunkFiles.entries()) {
      const filePath = join(tempDir, fileName);
      const body = new Uint8Array(await readFile(filePath));
      const durationMs = await probeDurationMs(filePath);

      chunks.push({
        body,
        chunkIndex,
        sourceEndMs: currentStartMs + durationMs,
        sourceStartMs: currentStartMs,
      });
      currentStartMs += durationMs;
    }

    return chunks;
  } finally {
    await rm(tempDir, {
      force: true,
      recursive: true,
    });
  }
}

async function probeDurationMs(path: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    path,
  ]);
  const durationSeconds = Number.parseFloat(stdout.trim());

  if (Number.isNaN(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Failed to probe audio duration: ${path}`);
  }

  return Math.round(durationSeconds * 1000);
}
