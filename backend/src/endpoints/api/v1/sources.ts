import type { JobListItem } from "../../../db/job-repository.js";
import type {
  SourceCollectionListItem,
  SourceListItem,
} from "../../../db/source-repository.js";
import {
  CollectorSettingsVersionConflictError,
  DuplicateSourceUrlHashError,
} from "../../../db/source-repository.js";
import type { AppDependencies } from "../../../deps.js";
import type { Result } from "../../../lib/result.js";
import { err, ok } from "../../../lib/result.js";
import type {
  DiscoverSourcesResult,
  PreviewSourceError,
  PreviewSourceResult,
} from "../../../service/source-discovery-service.js";
import type { InspectSourceError } from "../../../service/source-inspect-service.js";
import type { InspectSourceResult } from "../../../service/source-inspect-service.js";
import type {
  SourceCollectorPluginListItem,
  SourceCollectorSettingsDetail,
  SourceCollectorSettingValue,
} from "../../../service/source-service.js";

export type ListSourceCollectionsEndpointError = {
  code: "source_collection_list_failed";
  message: string;
};

export type CreateSourceCollectionEndpointError = {
  code: "source_collection_create_failed";
  message: string;
};

export type UpdateSourceCollectionEndpointError =
  | {
      code: "collection_not_found";
      message: string;
    }
  | {
      code: "source_collection_update_failed";
      message: string;
    };

export type AssignSourceToCollectionEndpointError =
  | {
      code: "collection_not_found";
      message: string;
    }
  | {
      code: "source_collection_assign_failed";
      message: string;
    };

export type ListSourcesEndpointError = {
  code: "source_list_failed";
  message: string;
};

export type UnsubscribeEndpointError =
  | {
      code: "subscription_not_found";
      message: string;
    }
  | {
      code: "subscription_unsubscribe_failed";
      message: string;
    };

export type ListSourceCollectorPluginsEndpointError = {
  code: "source_collector_plugin_list_failed";
  message: string;
};

export type GetSourceCollectorSettingsEndpointError =
  | {
      code: "collector_settings_get_failed";
      message: string;
    }
  | {
      code: "source_not_found";
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

export type DiscoverSourcesEndpointInput = {
  url?: string;
};

export type PreviewSourceEndpointInput = {
  pluginSlug?: string;
  url?: string;
};

export type PatchSourceCollectorSettingsEndpointInput = {
  baseVersion: number;
  enabled: boolean;
  intervalMinutes: number;
  items: Array<{ key: string; value: SourceCollectorSettingValue }>;
};

export type CreateSourceCollectionEndpointInput = {
  parentCollectionId?: string | null;
  position: number;
  title?: string;
};

export type AssignSourceToCollectionEndpointInput = {
  collectionId?: string | null;
  position: number;
};

export type UpdateSourceCollectionEndpointInput = {
  parentCollectionId?: string | null;
  position: number;
  title?: string;
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

export function createUnsubscribeEndpoint(dependencies: AppDependencies) {
  return async (
    subscriptionId: string,
  ): Promise<Result<void, UnsubscribeEndpointError>> => {
    const result = await dependencies.sourceService.unsubscribe(subscriptionId);

    if (!result.ok) {
      if (result.error instanceof Error) {
        return err({
          code: "subscription_unsubscribe_failed",
          message: result.error.message,
        });
      }

      return err(result.error);
    }

    return ok(undefined);
  };
}

export function createListSourceCollectionsEndpoint(
  dependencies: AppDependencies,
) {
  return async (): Promise<
    Result<SourceCollectionListItem[], ListSourceCollectionsEndpointError>
  > => {
    const collections =
      await dependencies.sourceService.listSourceCollections();

    if (!collections.ok) {
      return err({
        code: "source_collection_list_failed",
        message: collections.error.message,
      });
    }

    return collections;
  };
}

export function createListSourceCollectorPluginsEndpoint(
  dependencies: AppDependencies,
) {
  return (): Result<
    SourceCollectorPluginListItem[],
    ListSourceCollectorPluginsEndpointError
  > => {
    const result = dependencies.sourceService.listSourceCollectorPlugins();

    if (!result.ok) {
      return err({
        code: "source_collector_plugin_list_failed",
        message: result.error.message,
      });
    }

    return result;
  };
}

export function createGetSourceCollectorSettingsEndpoint(
  dependencies: AppDependencies,
) {
  return async (
    sourceId: string,
  ): Promise<
    Result<
      SourceCollectorSettingsDetail,
      GetSourceCollectorSettingsEndpointError
    >
  > => {
    const result =
      await dependencies.sourceService.getSourceCollectorSettings(sourceId);

    if (!result.ok) {
      if (result.error instanceof Error) {
        return err({
          code: "collector_settings_get_failed",
          message: result.error.message,
        });
      }

      return err(result.error);
    }

    return result;
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

export function createCreateSourceCollectionEndpoint(
  dependencies: AppDependencies,
) {
  return async (
    input: CreateSourceCollectionEndpointInput,
  ): Promise<
    Result<SourceCollectionListItem, CreateSourceCollectionEndpointError>
  > => {
    const result = await dependencies.sourceService.createCollection(
      input.title ?? "",
      input.position,
      input.parentCollectionId,
    );

    if (!result.ok) {
      return err({
        code: "source_collection_create_failed",
        message: result.error.message,
      });
    }

    return result;
  };
}

export function createAssignSourceToCollectionEndpoint(
  dependencies: AppDependencies,
) {
  return async (
    sourceId: string,
    input: AssignSourceToCollectionEndpointInput,
  ): Promise<Result<SourceListItem, AssignSourceToCollectionEndpointError>> => {
    const result = await dependencies.sourceService.assignSourceToCollection(
      sourceId,
      input.collectionId ?? null,
      input.position,
    );

    if (!result.ok) {
      if (result.error instanceof Error) {
        return err({
          code: "source_collection_assign_failed",
          message: result.error.message,
        });
      }

      return err(result.error);
    }

    return result;
  };
}

export function createUpdateSourceCollectionEndpoint(
  dependencies: AppDependencies,
) {
  return async (
    collectionId: string,
    input: UpdateSourceCollectionEndpointInput,
  ): Promise<
    Result<SourceCollectionListItem, UpdateSourceCollectionEndpointError>
  > => {
    const result = await dependencies.sourceService.updateCollection(
      collectionId,
      input.title ?? "",
      input.position,
      input.parentCollectionId,
    );

    if (!result.ok) {
      if (result.error instanceof Error) {
        return err({
          code: "source_collection_update_failed",
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

export function createDiscoverSourcesEndpoint(dependencies: AppDependencies) {
  return async (
    input: DiscoverSourcesEndpointInput,
  ): Promise<
    Result<DiscoverSourcesResult, { code: string; message: string }>
  > =>
    dependencies.sourceDiscoveryService.discoverSources({
      url: input.url ?? "",
    });
}

export function createPreviewSourceEndpoint(dependencies: AppDependencies) {
  return async (
    input: PreviewSourceEndpointInput,
  ): Promise<Result<PreviewSourceResult, PreviewSourceError>> =>
    dependencies.sourceDiscoveryService.previewSource({
      pluginSlug: input.pluginSlug ?? "",
      url: input.url ?? "",
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
        input.items,
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
