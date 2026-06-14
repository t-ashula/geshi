import { createHash } from "node:crypto";

import type { PluginGlobalRuntimeStateRepository } from "../db/plugin-global-runtime-state-repository.js";
import type {
  CreateSourceDetectionTargetInput,
  DetectedSourceCandidate,
  DetectedSourceCandidateStatus,
  SourceDetectionRepository,
  SourceDetectionTarget,
  UpdateSourceDetectionTargetInput,
} from "../db/source-detection-repository.js";
import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import type { Logger } from "../logger/index.js";
import { createLogger } from "../logger/index.js";
import type { SourceCollectorRegistry } from "../plugins/index.js";
import { defaultSourceCollectorRegistry } from "../plugins/index.js";
import { createPluginGlobalRuntimeStateHost } from "../plugins/plugin-global-runtime-state-host.js";
import type { JsonObject } from "../plugins/types.js";
import type { CreateSourceRequest, SourceService } from "./source-service.js";
import { normalizeSourceUrl } from "./source-service.js";

export type DetectSourceTargetResult = {
  detectedCount: number;
  duplicateCount: number;
  processedCount: number;
};

export type CreateSourceDetectionTargetRequest = {
  config?: JsonObject;
  enabled?: boolean;
  intervalMinutes?: number;
  pluginSlug: string;
  sourceKind: "feed" | "podcast" | "streaming";
  url: string;
};

export type UpdateSourceDetectionTargetRequest = {
  config?: JsonObject;
  enabled?: boolean;
  id: string;
  intervalMinutes?: number;
};

export interface SourceDetectionService {
  createSourceDetectionTarget(
    request: CreateSourceDetectionTargetRequest,
  ): Promise<Result<SourceDetectionTarget, Error>>;
  dismissDetectedSourceCandidate(
    candidateId: string,
  ): Promise<Result<DetectedSourceCandidate, Error>>;
  detectSourceTarget(
    target: SourceDetectionTarget,
  ): Promise<Result<DetectSourceTargetResult, Error>>;
  listDetectedSourceCandidates(): Promise<
    Result<DetectedSourceCandidate[], Error>
  >;
  listTargets(): Promise<Result<SourceDetectionTarget[], Error>>;
  registerDetectedSourceCandidate(
    candidateId: string,
  ): Promise<Result<DetectedSourceCandidate, Error>>;
  listEnabledTargets(): Promise<Result<SourceDetectionTarget[], Error>>;
  updateSourceDetectionTarget(
    request: UpdateSourceDetectionTargetRequest,
  ): Promise<Result<SourceDetectionTarget, Error>>;
}

export type CreateSourceDetectionServiceDependencies = {
  logger?: Logger;
  pluginGlobalRuntimeStateRepository?: PluginGlobalRuntimeStateRepository;
  sourceCollectorRegistry?: SourceCollectorRegistry;
  sourceService?: SourceService;
};

export function createSourceDetectionService(
  sourceDetectionRepository: SourceDetectionRepository,
  sourceServiceOrDependencies:
    | SourceService
    | (CreateSourceDetectionServiceDependencies & {
        sourceService?: SourceService;
      }) = {},
  maybeDependencies: CreateSourceDetectionServiceDependencies = {},
): SourceDetectionService {
  const dependencies = isSourceService(sourceServiceOrDependencies)
    ? {
        ...maybeDependencies,
        sourceService: sourceServiceOrDependencies,
      }
    : sourceServiceOrDependencies;
  const logger =
    dependencies.logger ??
    createLogger({
      service: "source-detection",
    });
  const sourceCollectorRegistry =
    dependencies.sourceCollectorRegistry ?? defaultSourceCollectorRegistry;
  const pluginGlobalRuntimeStateRepository =
    dependencies.pluginGlobalRuntimeStateRepository;
  const sourceService = dependencies.sourceService;

  return {
    async createSourceDetectionTarget(
      request: CreateSourceDetectionTargetRequest,
    ): Promise<Result<SourceDetectionTarget, Error>> {
      const normalizedUrlResult = normalizeSourceUrl(request.url);

      if (!normalizedUrlResult.ok) {
        return err(new Error(normalizedUrlResult.error.message));
      }

      return sourceDetectionRepository.createSourceDetectionTarget({
        config: request.config,
        enabled: request.enabled,
        id: crypto.randomUUID(),
        intervalMinutes: request.intervalMinutes,
        pluginSlug: request.pluginSlug,
        sourceKind: request.sourceKind,
        url: normalizedUrlResult.value,
        userSlug: "default",
      } satisfies CreateSourceDetectionTargetInput);
    },

    listDetectedSourceCandidates() {
      return sourceDetectionRepository.listDetectedSourceCandidates();
    },

    listTargets() {
      return sourceDetectionRepository.listTargets();
    },

    listEnabledTargets() {
      return sourceDetectionRepository.listEnabledTargets();
    },

    async updateSourceDetectionTarget(
      request: UpdateSourceDetectionTargetRequest,
    ): Promise<Result<SourceDetectionTarget, Error>> {
      const result =
        await sourceDetectionRepository.updateSourceDetectionTarget({
          config: request.config,
          enabled: request.enabled,
          id: request.id,
          intervalMinutes: request.intervalMinutes,
        } satisfies UpdateSourceDetectionTargetInput);

      if (!result.ok) {
        return result;
      }

      if (result.value === null) {
        return err(new Error("Source detection target not found."));
      }

      return ok(result.value);
    },

    async dismissDetectedSourceCandidate(
      candidateId: string,
    ): Promise<Result<DetectedSourceCandidate, Error>> {
      return updateCandidateStatus(
        sourceDetectionRepository,
        candidateId,
        "dismissed",
      );
    },

    async registerDetectedSourceCandidate(
      candidateId: string,
    ): Promise<Result<DetectedSourceCandidate, Error>> {
      if (sourceService === undefined) {
        return err(
          new Error("Source service is required to register candidates."),
        );
      }

      const candidateResult =
        await sourceDetectionRepository.findDetectedSourceCandidateById(
          candidateId,
        );

      if (!candidateResult.ok) {
        return candidateResult;
      }

      if (candidateResult.value === null) {
        return err(new Error("Detected source candidate not found."));
      }

      if (candidateResult.value.resolvedSourceId !== null) {
        const updateResult =
          await sourceDetectionRepository.updateDetectedSourceCandidateStatus(
            candidateId,
            "registered",
            candidateResult.value.resolvedSourceId,
          );

        if (!updateResult.ok) {
          return updateResult;
        }

        if (updateResult.value === null) {
          return err(new Error("Detected source candidate not found."));
        }

        return ok(updateResult.value);
      }

      const createSourceResult = await sourceService.createSource(
        toCreateSourceRequest(candidateResult.value),
      );

      if (!createSourceResult.ok) {
        return err(
          createSourceResult.error instanceof Error
            ? createSourceResult.error
            : new Error(createSourceResult.error.message),
        );
      }

      const updateResult =
        await sourceDetectionRepository.updateDetectedSourceCandidateStatus(
          candidateId,
          "registered",
          createSourceResult.value.id,
        );

      if (!updateResult.ok) {
        return updateResult;
      }

      if (updateResult.value === null) {
        return err(new Error("Detected source candidate not found."));
      }

      return ok(updateResult.value);
    },

    async detectSourceTarget(
      target: SourceDetectionTarget,
    ): Promise<Result<DetectSourceTargetResult, Error>> {
      const detectionLogger = logger.child({
        operation: "detect-sources",
        pluginSlug: target.pluginSlug,
        sourceDetectionTargetId: target.id,
        targetUrl: target.url,
      });
      const plugin = sourceCollectorRegistry.get(target.pluginSlug);

      if (plugin.detectSources === undefined) {
        detectionLogger.warn(
          "source detection skipped for plugin without API.",
        );
        return ok({
          detectedCount: 0,
          duplicateCount: 0,
          processedCount: 0,
        });
      }

      try {
        const result = await plugin.detectSources(
          {
            abortSignal: AbortSignal.timeout(30_000),
            config: target.config,
            detectorState: target.state,
            inputUrl: target.url,
          },
          {
            getHost() {
              return {
                logger: detectionLogger,
                pluginGlobalRuntimeState:
                  pluginGlobalRuntimeStateRepository === undefined
                    ? undefined
                    : createPluginGlobalRuntimeStateHost(
                        pluginGlobalRuntimeStateRepository,
                        target.pluginSlug,
                      ),
              };
            },
          },
        );

        const dedupedCandidates = dedupeCandidates(
          result.candidates.map((candidate) => ({
            description: candidate.description,
            normalizedUrl: normalizeCandidateUrl(candidate.url),
            sourceSlug: candidate.sourceSlug,
            title: candidate.title,
          })),
        );
        let detectedCount = 0;
        let duplicateCount = 0;

        for (const candidate of dedupedCandidates) {
          const existingSourceIdResult =
            await sourceDetectionRepository.findExistingSourceIdByUrl(
              candidate.normalizedUrl,
            );

          if (!existingSourceIdResult.ok) {
            return existingSourceIdResult;
          }

          const nextStatus: DetectedSourceCandidateStatus =
            existingSourceIdResult.value === null ? "detected" : "duplicate";
          const saveCandidateResult =
            await sourceDetectionRepository.saveDetectedSourceCandidate({
              description: candidate.description,
              fingerprint: createCandidateFingerprint(
                target.pluginSlug,
                target.sourceKind,
                candidate.normalizedUrl,
                candidate.sourceSlug,
              ),
              normalizedUrl: candidate.normalizedUrl,
              pluginSlug: target.pluginSlug,
              resolvedSourceId: existingSourceIdResult.value,
              sourceDetectionTargetId: target.id,
              sourceKind: target.sourceKind,
              sourceSlug: candidate.sourceSlug,
              status: nextStatus,
              title: candidate.title,
              userId: target.userId,
            });

          if (!saveCandidateResult.ok) {
            return saveCandidateResult;
          }

          if (nextStatus === "duplicate") {
            duplicateCount += 1;
          } else {
            detectedCount += 1;
          }
        }

        if (result.detectorState !== undefined) {
          const saveStateResult = await sourceDetectionRepository.saveState(
            target.id,
            target.pluginSlug,
            result.detectorState,
          );

          if (!saveStateResult.ok) {
            return saveStateResult;
          }
        }

        const markCheckedResult = await sourceDetectionRepository.markChecked(
          target.id,
          new Date(),
        );

        if (!markCheckedResult.ok) {
          return markCheckedResult;
        }

        detectionLogger.info("source detection completed.", {
          dedupedCandidateCount: dedupedCandidates.length,
          detectedCount,
          duplicateCount,
        });

        return ok({
          detectedCount,
          duplicateCount,
          processedCount: dedupedCandidates.length,
        });
      } catch (error) {
        detectionLogger.error("source detection failed.", { error });
        return err(
          error instanceof Error
            ? error
            : new Error("Source detection failed."),
        );
      }
    },
  };
}

function isSourceService(value: unknown): value is SourceService {
  return (
    typeof value === "object" &&
    value !== null &&
    "createSource" in value &&
    "listSources" in value
  );
}

async function updateCandidateStatus(
  repository: SourceDetectionRepository,
  candidateId: string,
  status: DetectedSourceCandidateStatus,
): Promise<Result<DetectedSourceCandidate, Error>> {
  const result = await repository.updateDetectedSourceCandidateStatus(
    candidateId,
    status,
  );

  if (!result.ok) {
    return result;
  }

  if (result.value === null) {
    return err(new Error("Detected source candidate not found."));
  }

  return ok(result.value);
}

function toCreateSourceRequest(
  candidate: DetectedSourceCandidate,
): CreateSourceRequest {
  return {
    description: candidate.description ?? undefined,
    pluginSlug: candidate.pluginSlug,
    sourceSlug: candidate.sourceSlug,
    title: candidate.title ?? undefined,
    url: candidate.normalizedUrl,
  };
}

function normalizeCandidateUrl(url: string): string {
  const normalizedUrlResult = normalizeSourceUrl(url);

  if (!normalizedUrlResult.ok) {
    throw new Error(normalizedUrlResult.error.message);
  }

  return normalizedUrlResult.value;
}

function createCandidateFingerprint(
  pluginSlug: string,
  sourceKind: string,
  normalizedUrl: string,
  sourceSlug: string,
): string {
  return createHash("sha256")
    .update(`${pluginSlug}:${sourceKind}:${normalizedUrl}:${sourceSlug}`)
    .digest("hex");
}

function dedupeCandidates(
  candidates: Array<{
    description: string | null;
    normalizedUrl: string;
    sourceSlug: string;
    title: string | null;
  }>,
): Array<{
  description: string | null;
  normalizedUrl: string;
  sourceSlug: string;
  title: string | null;
}> {
  const dedupedCandidates = new Map<
    string,
    {
      description: string | null;
      normalizedUrl: string;
      sourceSlug: string;
      title: string | null;
    }
  >();

  for (const candidate of candidates) {
    const key = `${candidate.normalizedUrl}::${candidate.sourceSlug}`;

    if (!dedupedCandidates.has(key)) {
      dedupedCandidates.set(key, candidate);
    }
  }

  return [...dedupedCandidates.values()];
}
