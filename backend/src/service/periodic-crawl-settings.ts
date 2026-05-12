export type PeriodicCrawlAppSettings = {
  enabled: boolean;
  intervalMinutes: number;
};

export type SourcePeriodicCrawlSettings = {
  enabled: boolean;
  intervalMinutes: number;
};

export function defaultPeriodicCrawlAppSettings(): PeriodicCrawlAppSettings {
  return {
    enabled: true,
    intervalMinutes: 60,
  };
}

export function defaultSourcePeriodicCrawlSettings(): SourcePeriodicCrawlSettings {
  return {
    enabled: true,
    intervalMinutes: 60,
  };
}

export function normalizePeriodicCrawlAppSettings(settings: {
  enabled: boolean | null | undefined;
  intervalMinutes: number | null | undefined;
}): PeriodicCrawlAppSettings {
  return {
    enabled:
      typeof settings.enabled === "boolean"
        ? settings.enabled
        : defaultPeriodicCrawlAppSettings().enabled,
    intervalMinutes: normalizePositiveInteger(
      settings.intervalMinutes,
      defaultPeriodicCrawlAppSettings().intervalMinutes,
    ),
  };
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}
