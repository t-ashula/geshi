import {
  CollectorSettingsVersionConflictError,
  DuplicateSourceUrlHashError,
} from "../../../db/source-repository.js";
import type { AppDependencies } from "../../../deps.js";
import type { InspectSourceError } from "../../../service/source-inspect-service.js";
import type { JsonEndpointResult } from "../../types.js";

export function createListSourcesEndpoint(dependencies: AppDependencies) {
  return async (): Promise<JsonEndpointResult> => {
    const sources = await dependencies.sourceService.listSources();

    if (!sources.ok) {
      return {
        body: {
          error: {
            code: "source_list_failed",
            message: sources.error.message,
          },
        },
        status: 500,
      };
    }

    return {
      body: {
        data: sources.value,
      },
      status: 200,
    };
  };
}

export function createCreateSourceEndpoint(dependencies: AppDependencies) {
  return async (body: unknown): Promise<JsonEndpointResult> => {
    if (body === null || typeof body !== "object") {
      return invalidJsonResult();
    }

    const record = body as Record<string, unknown>;
    const result = await dependencies.sourceService.createSource({
      description: toOptionalString(record.description),
      sourceSlug: toOptionalString(record.sourceSlug),
      title: toOptionalString(record.title),
      url: toOptionalString(record.url) ?? "",
    });

    if (!result.ok) {
      if (result.error instanceof DuplicateSourceUrlHashError) {
        return {
          body: {
            error: {
              code: "duplicate_source",
              message: "A source for this RSS URL already exists.",
            },
          },
          status: 409,
        };
      }

      if (result.error instanceof Error) {
        return {
          body: {
            error: {
              code: "source_create_failed",
              message: result.error.message,
            },
          },
          status: 500,
        };
      }

      return {
        body: {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        status: 422,
      };
    }

    return {
      body: {
        data: result.value,
      },
      status: 201,
    };
  };
}

export function createInspectSourceEndpoint(dependencies: AppDependencies) {
  return async (body: unknown): Promise<JsonEndpointResult> => {
    if (body === null || typeof body !== "object") {
      return invalidJsonResult();
    }

    const record = body as Record<string, unknown>;
    const result = await dependencies.sourceInspectService.inspectSource({
      url: toOptionalString(record.url) ?? "",
    });

    if (!result.ok) {
      return {
        body: {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        status: inspectSourceStatus(result.error),
      };
    }

    return {
      body: {
        data: result.value,
      },
      status: 200,
    };
  };
}

export function createEnqueueObserveSourceEndpoint(
  dependencies: AppDependencies,
) {
  return async (sourceId: string): Promise<JsonEndpointResult> => {
    const result =
      await dependencies.jobService.enqueueObserveSourceJob(sourceId);

    if (!result.ok) {
      if (result.error instanceof Error) {
        return {
          body: {
            error: {
              code: "observe_enqueue_failed",
              message: result.error.message,
            },
          },
          status: 500,
        };
      }

      return {
        body: {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        status: 404,
      };
    }

    return {
      body: { data: result.value },
      status: 202,
    };
  };
}

export function createPatchSourceCollectorSettingsEndpoint(
  dependencies: AppDependencies,
) {
  return async (
    sourceId: string,
    body: unknown,
  ): Promise<JsonEndpointResult> => {
    if (body === null || typeof body !== "object") {
      return invalidJsonResult();
    }

    const record = body as Record<string, unknown>;

    if (
      typeof record.enabled !== "boolean" ||
      !isPositiveInteger(record.intervalMinutes) ||
      !isPositiveInteger(record.baseVersion)
    ) {
      return {
        body: {
          error: {
            code: "invalid_collector_settings",
            message:
              "Collector settings require boolean enabled and positive intervalMinutes and baseVersion.",
          },
        },
        status: 422,
      };
    }

    const result =
      await dependencies.sourceService.updateSourceCollectorSettings(
        sourceId,
        {
          enabled: record.enabled,
          intervalMinutes: record.intervalMinutes,
        },
        record.baseVersion,
      );

    if (!result.ok) {
      if (result.error instanceof CollectorSettingsVersionConflictError) {
        return {
          body: {
            error: {
              code: "collector_settings_conflict",
              message: "Collector settings were updated by another request.",
            },
          },
          status: 409,
        };
      }

      if (result.error instanceof Error) {
        return {
          body: {
            error: {
              code: "collector_settings_update_failed",
              message: result.error.message,
            },
          },
          status: 500,
        };
      }

      return {
        body: {
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        },
        status: 404,
      };
    }

    return {
      body: {
        data: result.value,
      },
      status: 200,
    };
  };
}

function inspectSourceStatus(error: InspectSourceError): 422 | 502 {
  return error.code === "source_inspect_fetch_failed" ? 502 : 422;
}

function invalidJsonResult(): JsonEndpointResult {
  return {
    body: {
      error: {
        code: "invalid_json",
        message: "Request body must be a JSON object.",
      },
    },
    status: 400,
  };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
