import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import type { JobRepository } from "../../db/job-repository.js";
import type { ObserveSourceJobPayload } from "../../job-queue/types.js";
import { getSourceCollectorPlugin } from "../../plugins/index.js";
import type { ContentService } from "../../service/content-service.js";

type HandleObserveSourceJobDependencies = {
  contentService: ContentService;
  jobRepository: JobRepository;
  tmpRootDir?: string;
};

export async function handleObserveSourceJob(
  payload: ObserveSourceJobPayload,
  dependencies: HandleObserveSourceJobDependencies,
): Promise<void> {
  const tmpRootDir = dependencies.tmpRootDir ?? "/tmp/geshi";
  const workDir = join(tmpRootDir, payload.jobId);

  await mkdir(workDir, {
    recursive: true,
  });
  await dependencies.jobRepository.markRunning(payload.jobId);

  try {
    const plugin = getSourceCollectorPlugin(payload.pluginSlug);
    const abortController = new AbortController();
    const observedContents = await plugin.observe({
      abortSignal: abortController.signal,
      config: payload.config,
      logger: console,
      sourceUrl: payload.url,
      workDir,
    });

    await dependencies.contentService.importObservedContents(
      observedContents.map((content) => ({
        ...content,
        sourceId: payload.sourceId,
      })),
    );
    await dependencies.jobRepository.markSucceeded(payload.jobId);
  } catch (error) {
    const failureMessage =
      error instanceof Error ? error.message : "Observe source job failed.";

    await dependencies.jobRepository.markFailed(
      payload.jobId,
      failureMessage,
      true,
    );
    throw error;
  } finally {
    await rm(workDir, {
      force: true,
      recursive: true,
    });
  }
}
