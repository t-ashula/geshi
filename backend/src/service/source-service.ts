import type {
  CollectorSettingsVersionConflictError,
  CreateCollectionInput,
  DuplicateSourceUrlHashError,
  ObserveSourceTarget,
  PeriodicCrawlSourceTarget,
  SourceCollectionListItem,
  SourceCollectorSettingsRecord,
  SourceListItem,
  SourceRepository,
  SourceRepositoryError,
} from "../db/source-repository.js";
import type { Result } from "../lib/result.js";
import { err, ok } from "../lib/result.js";
import { createSourceSlug, normalizeOptionalSlug } from "../lib/source-slug.js";
import { createUrlHash } from "../lib/url-hash.js";
import type { Logger } from "../logger/index.js";
import { createLogger } from "../logger/index.js";
import type { SourceCollectorRegistry } from "../plugins/index.js";
import { defaultSourceCollectorRegistry } from "../plugins/index.js";
import type {
  JsonValue,
  SourceCollectorSettingSchemaField,
  SourceCollectorSettingValue as PluginSourceCollectorSettingValue,
} from "../plugins/types.js";
import type { SourcePeriodicCrawlSettings } from "./periodic-crawl-settings.js";

export type CreateSourceRequest = {
  description?: string;
  pluginSlug?: string;
  sourceSlug?: string;
  title?: string;
  url: string;
};

export type SourceUrlError = {
  code: "source_url_required" | "source_url_invalid";
  message: string;
};
export type CreateSourceError =
  | SourceUrlError
  | DuplicateSourceUrlHashError
  | SourceRepositoryError;

export type UpdateSourceCollectorSettingsError = {
  code: "source_not_found";
  message: string;
};

export type FindObserveSourceTargetError = {
  code: "source_not_found";
  message: string;
};

export type GetSourceCollectorSettingsError = {
  code: "source_not_found";
  message: string;
};

export type SourceCollectionError = {
  code: "collection_not_found";
  message: string;
};

export type SubscriptionError = {
  code: "subscription_not_found";
  message: string;
};

export type SourceCollectorPluginListItem = {
  message: string | null;
  description: string | null;
  displayName: string;
  pluginSlug: string;
  sourceKind: "feed" | "podcast" | "streaming";
  status: "available" | "unavailable";
};

export type SourceCollectorSettingItem = {
  key: string;
  type: SourceCollectorSettingSchemaField["type"];
  value: PluginSourceCollectorSettingValue;
};

export type SourceCollectorSettingValue = PluginSourceCollectorSettingValue;

export type SourceCollectorSettingsDetail = {
  baseVersion: number;
  items: SourceCollectorSettingItem[];
  periodicCrawl: SourcePeriodicCrawlSettings;
};

export interface SourceService {
  assignSourceToCollection(
    sourceId: string,
    collectionId: string | null,
    position: number,
  ): Promise<
    Result<SourceListItem, SourceCollectionError | SourceRepositoryError>
  >;
  createCollection(
    title: string,
    position: number,
    parentCollectionId?: string | null,
  ): Promise<Result<SourceCollectionListItem, SourceRepositoryError>>;
  updateCollection(
    collectionId: string,
    title: string,
    position: number,
    parentCollectionId?: string | null,
  ): Promise<
    Result<
      SourceCollectionListItem,
      SourceCollectionError | SourceRepositoryError
    >
  >;
  createSource(
    request: CreateSourceRequest,
  ): Promise<Result<SourceListItem, CreateSourceError>>;
  findObserveSourceTarget(
    sourceId: string,
  ): Promise<
    Result<
      ObserveSourceTarget,
      FindObserveSourceTargetError | SourceRepositoryError
    >
  >;
  getSourceCollectorSettings(
    sourceId: string,
  ): Promise<
    Result<
      SourceCollectorSettingsDetail,
      GetSourceCollectorSettingsError | SourceRepositoryError
    >
  >;
  listSourceCollectorPlugins(): Result<SourceCollectorPluginListItem[], Error>;
  listSourceCollections(): Promise<
    Result<SourceCollectionListItem[], SourceRepositoryError>
  >;
  listPeriodicCrawlTargets(): Promise<
    Result<PeriodicCrawlSourceTarget[], SourceRepositoryError>
  >;
  listSources(): Promise<Result<SourceListItem[], SourceRepositoryError>>;
  unsubscribe(
    subscriptionId: string,
  ): Promise<Result<void, SubscriptionError | SourceRepositoryError>>;
  updateSourceCollectorSettings(
    sourceId: string,
    settings: SourcePeriodicCrawlSettings,
    baseVersion: number,
    items?: Array<{ key: string; value: PluginSourceCollectorSettingValue }>,
  ): Promise<
    Result<
      SourceListItem,
      | UpdateSourceCollectorSettingsError
      | CollectorSettingsVersionConflictError
      | SourceRepositoryError
    >
  >;
}

export type CreateSourceServiceDependencies = {
  logger?: Logger;
  sourceCollectorRegistry?: SourceCollectorRegistry;
};

const DEFAULT_SOURCE_USER_SLUG = "default";

export function createSourceService(
  sourceRepository: SourceRepository,
  sourceCollectorRegistryOrDependencies:
    | SourceCollectorRegistry
    | CreateSourceServiceDependencies = {},
): SourceService {
  const dependencies = isSourceCollectorRegistry(
    sourceCollectorRegistryOrDependencies,
  )
    ? {
        sourceCollectorRegistry: sourceCollectorRegistryOrDependencies,
      }
    : sourceCollectorRegistryOrDependencies;
  const logger =
    dependencies.logger ??
    createLogger({
      service: "source",
    });
  const sourceCollectorRegistry =
    dependencies.sourceCollectorRegistry ?? defaultSourceCollectorRegistry;

  return {
    async assignSourceToCollection(
      sourceId: string,
      collectionId: string | null,
      position: number,
    ): Promise<
      Result<SourceListItem, SourceCollectionError | SourceRepositoryError>
    > {
      const result = await sourceRepository.assignSourceToCollection(
        DEFAULT_SOURCE_USER_SLUG,
        sourceId,
        collectionId,
        position,
      );

      if (!result.ok) {
        return result;
      }

      if (result.value === null) {
        return err({
          code: "collection_not_found",
          message: "Collection or source not found.",
        });
      }

      return ok(result.value);
    },

    async createCollection(
      title: string,
      position: number,
      parentCollectionId?: string | null,
    ): Promise<Result<SourceCollectionListItem, SourceRepositoryError>> {
      return sourceRepository.createCollection({
        id: crypto.randomUUID(),
        parentCollectionId,
        position,
        title,
        userSlug: DEFAULT_SOURCE_USER_SLUG,
      } satisfies CreateCollectionInput);
    },

    async updateCollection(
      collectionId: string,
      title: string,
      position: number,
      parentCollectionId?: string | null,
    ): Promise<
      Result<
        SourceCollectionListItem,
        SourceCollectionError | SourceRepositoryError
      >
    > {
      const result = await sourceRepository.updateCollection({
        collectionId,
        parentCollectionId,
        position,
        title,
        userSlug: DEFAULT_SOURCE_USER_SLUG,
      });

      if (!result.ok) {
        return result;
      }

      if (result.value === null) {
        return err({
          code: "collection_not_found",
          message: "Collection not found.",
        });
      }

      return ok(result.value);
    },

    async createSource(
      request: CreateSourceRequest,
    ): Promise<Result<SourceListItem, CreateSourceError>> {
      const sourceLogger = logger.child({
        operation: "source-create",
        pluginSlug: request.pluginSlug ?? "podcast-rss",
        requestUrl: request.url,
        requestSourceSlug: request.sourceSlug,
      });
      const normalizedUrlResult = normalizeSourceUrl(request.url);

      if (!normalizedUrlResult.ok) {
        sourceLogger.warn("source create rejected invalid URL.", {
          errorCode: normalizedUrlResult.error.code,
        });
        return normalizedUrlResult;
      }

      const normalizedUrl = normalizedUrlResult.value;
      const slug =
        normalizeOptionalSlug(request.sourceSlug) ??
        createSourceSlug(normalizedUrl, request.title);
      const pluginSlug = request.pluginSlug ?? "podcast-rss";
      const sourceKind = sourceCollectorRegistry.getSourceKind(pluginSlug);
      sourceLogger.info("source create started.", {
        normalizedUrl,
        sourceKind,
        slug,
      });
      const result = await sourceRepository.createSource({
        collectorSettingId: crypto.randomUUID(),
        collectorSettingSnapshotId: crypto.randomUUID(),
        description: normalizeOptionalString(request.description),
        id: crypto.randomUUID(),
        kind: sourceKind,
        pluginSlug,
        slug,
        snapshotId: crypto.randomUUID(),
        subscriptionEventId: crypto.randomUUID(),
        subscriptionId: crypto.randomUUID(),
        title: normalizeOptionalString(request.title),
        url: normalizedUrl,
        urlHash: createUrlHash(normalizedUrl),
        userSlug: DEFAULT_SOURCE_USER_SLUG,
      });

      if (!result.ok) {
        const errorCode =
          isErrorWithCode(result.error) && typeof result.error.code === "string"
            ? result.error.code
            : "source_create_failed";
        sourceLogger.warn("source create failed.", {
          errorCode,
          errorMessage: result.error.message,
        });

        return result;
      }

      sourceLogger.info("source create completed.", {
        sourceId: result.value.id,
        slug: result.value.slug,
      });

      return result;
    },

    async findObserveSourceTarget(
      sourceId: string,
    ): Promise<
      Result<
        ObserveSourceTarget,
        FindObserveSourceTargetError | SourceRepositoryError
      >
    > {
      const source = await sourceRepository.findObserveSourceTarget(sourceId);

      if (!source.ok) {
        return source;
      }

      if (source.value === null) {
        return err({
          code: "source_not_found",
          message: "Source not found.",
        });
      }

      return ok(source.value);
    },

    async getSourceCollectorSettings(
      sourceId: string,
    ): Promise<
      Result<
        SourceCollectorSettingsDetail,
        GetSourceCollectorSettingsError | SourceRepositoryError
      >
    > {
      const currentSettings =
        await sourceRepository.findSourceCollectorSettings(sourceId);

      if (!currentSettings.ok) {
        return currentSettings;
      }

      if (currentSettings.value === null) {
        return err({
          code: "source_not_found",
          message: "Source not found.",
        });
      }

      try {
        return ok(
          await toSourceCollectorSettingsDetail(
            sourceCollectorRegistry,
            currentSettings.value,
          ),
        );
      } catch (error) {
        return err(
          error instanceof Error
            ? error
            : new Error("Failed to get source collector settings."),
        );
      }
    },

    listSourceCollectorPlugins(): Result<
      SourceCollectorPluginListItem[],
      Error
    > {
      try {
        return ok(
          sourceCollectorRegistry.list().map((plugin) => ({
            description: plugin.description,
            displayName: plugin.displayName,
            message: plugin.message,
            pluginSlug: plugin.pluginSlug,
            sourceKind: plugin.sourceKind,
            status: plugin.status,
          })),
        );
      } catch (error) {
        return err(
          error instanceof Error
            ? error
            : new Error("Failed to list source collector plugins."),
        );
      }
    },

    async listPeriodicCrawlTargets(): Promise<
      Result<PeriodicCrawlSourceTarget[], SourceRepositoryError>
    > {
      return sourceRepository.listPeriodicCrawlTargets();
    },

    async listSourceCollections(): Promise<
      Result<SourceCollectionListItem[], SourceRepositoryError>
    > {
      return sourceRepository.listCollections(DEFAULT_SOURCE_USER_SLUG);
    },

    async listSources(): Promise<
      Result<SourceListItem[], SourceRepositoryError>
    > {
      return sourceRepository.listSources(DEFAULT_SOURCE_USER_SLUG);
    },

    async unsubscribe(
      subscriptionId: string,
    ): Promise<Result<void, SubscriptionError | SourceRepositoryError>> {
      const result = await sourceRepository.unsubscribe(
        DEFAULT_SOURCE_USER_SLUG,
        subscriptionId,
      );

      if (!result.ok) {
        return result;
      }

      if (!result.value) {
        return err({
          code: "subscription_not_found",
          message: "Subscription not found.",
        });
      }

      return ok(undefined);
    },

    async updateSourceCollectorSettings(
      sourceId: string,
      settings: SourcePeriodicCrawlSettings,
      baseVersion: number,
      items: Array<{
        key: string;
        value: PluginSourceCollectorSettingValue;
      }> = [],
    ): Promise<
      Result<
        SourceListItem,
        | UpdateSourceCollectorSettingsError
        | CollectorSettingsVersionConflictError
        | SourceRepositoryError
      >
    > {
      const currentSettings =
        await sourceRepository.findSourceCollectorSettings(sourceId);

      if (!currentSettings.ok) {
        return currentSettings;
      }

      if (currentSettings.value === null) {
        return err({
          code: "source_not_found",
          message: "Source not found.",
        });
      }

      const nextConfig = {
        ...currentSettings.value.config,
        ...Object.fromEntries(items.map((item) => [item.key, item.value])),
      };
      const source = await sourceRepository.updateSourceCollectorSettings(
        DEFAULT_SOURCE_USER_SLUG,
        sourceId,
        settings,
        baseVersion,
        nextConfig,
      );

      if (!source.ok) {
        return source;
      }

      if (source.value === null) {
        return err({
          code: "source_not_found",
          message: "Source not found.",
        });
      }

      return ok(source.value);
    },
  };
}

async function toSourceCollectorSettingsDetail(
  sourceCollectorRegistry: SourceCollectorRegistry,
  settings: SourceCollectorSettingsRecord,
): Promise<SourceCollectorSettingsDetail> {
  const plugin = sourceCollectorRegistry.get(settings.pluginSlug);
  const schema = await plugin.settingSchema();

  return {
    baseVersion: settings.baseVersion,
    items: schema.map((field) => ({
      key: field.key,
      type: field.type,
      value: readCollectorSettingValue(settings.config, field.key),
    })),
    periodicCrawl: {
      enabled: settings.periodicCrawlEnabled,
      intervalMinutes: settings.periodicCrawlIntervalMinutes,
    },
  };
}

function readCollectorSettingValue(
  config: Record<string, JsonValue>,
  key: string,
): SourceCollectorSettingValue {
  return key in config ? (config[key] ?? null) : null;
}

function normalizeOptionalString(
  value: string | undefined,
): string | undefined {
  const trimmedValue = value?.trim();

  return trimmedValue === "" ? undefined : trimmedValue;
}

function isSourceCollectorRegistry(
  value: SourceCollectorRegistry | CreateSourceServiceDependencies,
): value is SourceCollectorRegistry {
  return (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    "getSourceKind" in value &&
    "list" in value
  );
}

function isErrorWithCode(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as Record<string, unknown>).code === "string"
  );
}

export function normalizeSourceUrl(
  value: string,
): Result<string, SourceUrlError> {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return err({
      code: "source_url_required",
      message: "Source URL is required.",
    });
  }

  let url: URL;

  try {
    url = new URL(trimmedValue);
  } catch {
    return err({
      code: "source_url_invalid",
      message: "Source URL must be an absolute http or https URL.",
    });
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return err({
      code: "source_url_invalid",
      message: "Source URL must be an absolute http or https URL.",
    });
  }

  return ok(url.toString());
}
