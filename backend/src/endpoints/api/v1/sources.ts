import type { JobListItem } from "../../../db/job-repository.js";
import type { SourceListItem } from "../../../db/source-repository.js";
import {
  CollectorSettingsVersionConflictError,
  DuplicateSourceUrlHashError,
} from "../../../db/source-repository.js";
import type { AppDependencies } from "../../../deps.js";
import type { Result } from "../../../lib/result.js";
import { err, ok } from "../../../lib/result.js";
import type { InspectSourceError } from "../../../service/source-inspect-service.js";
import type { InspectSourceResult } from "../../../service/source-inspect-service.js";

export type ListSourcesEndpointError = {
  code: "source_list_failed";
  message: string;
};

export type CreateSourceEndpointError =
  | {
      code: "duplicate_source";
      message: string;
    }
  | {
      code: "source_create_failed";
      message: string;
    }
  | {
      code: "source_url_required" | "source_url_invalid";
      message: string;
    };

export type EnqueueObserveSourceEndpointError =
  | {
      code: "observe_enqueue_failed";
      message: string;
    }
  | {
      code: "source_not_found";
      message: string;
    };

export type PatchSourceCollectorSettingsEndpointError =
  | {
      code: "collector_settings_conflict";
      message: string;
    }
  | {
      code: "collector_settings_update_failed";
      message: string;
    }
  | {
      code: "source_not_found";
      message: string;
    };

export type CreateSourceEndpointInput = {
  description?: string;
  pluginSlug?: string;
  sourceSlug?: string;
  title?: string;
  url?: string;
};

export type InspectSourceEndpointInput = {
  pluginSlug?: string;
  url?: string;
};

export type PatchSourceCollectorSettingsEndpointInput = {
  baseVersion: number;
  enabled: boolean;
  intervalMinutes: number;
};

export function createListSourcesEndpoint(dependencies: AppDependencies) {
  return async (): Promise<
    Result<SourceListItem[], ListSourcesEndpointError>
  > => {
    const sources = await dependencies.sourceService.listSources();

    if (!sources.ok) {
      return err({
        code: "source_list_failed",
        message: sources.error.message,
      });
    }

    return sources;
  };
}

export function createCreateSourceEndpoint(dependencies: AppDependencies) {
  return async (
    input: CreateSourceEndpointInput,
  ): Promise<Result<SourceListItem, CreateSourceEndpointError>> => {
    const result = await dependencies.sourceService.createSource({
      description: input.description,
      pluginSlug: input.pluginSlug,
      sourceSlug: input.sourceSlug,
      title: input.title,
      url: input.url ?? "",
    });

    if (!result.ok) {
      if (result.error instanceof DuplicateSourceUrlHashError) {
        return err({
          code: "duplicate_source",
          message: "A source for this source URL already exists.",
        });
      }

      if (result.error instanceof Error) {
        return err({
          code: "source_create_failed",
          message: result.error.message,
        });
      }

      return err(result.error);
    }

    return result;
  };
}

export function createInspectSourceEndpoint(dependencies: AppDependencies) {
  return async (
    input: InspectSourceEndpointInput,
  ): Promise<Result<InspectSourceResult, InspectSourceError>> =>
    dependencies.sourceInspectService.inspectSource({
      url: input.url ?? "",
      pluginSlug: input.pluginSlug,
    });
}

export function createEnqueueObserveSourceEndpoint(
  dependencies: AppDependencies,
) {
  return async (
    sourceId: string,
  ): Promise<Result<JobListItem, EnqueueObserveSourceEndpointError>> => {
    const result =
      await dependencies.jobService.enqueueObserveSourceJob(sourceId);

    if (!result.ok) {
      if (result.error instanceof Error) {
        return err({
          code: "observe_enqueue_failed",
          message: result.error.message,
        });
      }

      return err(result.error);
    }

    return result;
  };
}

export function createPatchSourceCollectorSettingsEndpoint(
  dependencies: AppDependencies,
) {
  return async (
    sourceId: string,
    input: PatchSourceCollectorSettingsEndpointInput,
  ): Promise<
    Result<SourceListItem, PatchSourceCollectorSettingsEndpointError>
  > => {
    const result =
      await dependencies.sourceService.updateSourceCollectorSettings(
        sourceId,
        {
          enabled: input.enabled,
          intervalMinutes: input.intervalMinutes,
        },
        input.baseVersion,
      );

    if (!result.ok) {
      if (result.error instanceof CollectorSettingsVersionConflictError) {
        return err({
          code: "collector_settings_conflict",
          message: "Collector settings were updated by another request.",
        });
      }

      if (result.error instanceof Error) {
        return err({
          code: "collector_settings_update_failed",
          message: result.error.message,
        });
      }

      return err(result.error);
    }

    return ok(result.value);
  };
}
