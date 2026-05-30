import type { AppSettingService } from "./service/app-setting-service.js";
import type { AssetService } from "./service/asset-service.js";
import type { ContentService } from "./service/content-service.js";
import type { DetailBodyService } from "./service/detail-body-service.js";
import type { JobService } from "./service/job-service.js";
import type { PluginGlobalSettingsService } from "./service/plugin-global-settings-service.js";
import type { SourceDiscoveryService } from "./service/source-discovery-service.js";
import type { SourceInspectService } from "./service/source-inspect-service.js";
import type { SourceService } from "./service/source-service.js";
import type { TranscriptService } from "./service/transcript-service.js";
import type { Storage } from "./storage/types.js";

export interface AppDependencies {
  appSettingService: AppSettingService;
  assetService: AssetService;
  contentService: ContentService;
  detailBodyService: DetailBodyService;
  jobService: JobService;
  pluginGlobalSettingsService: PluginGlobalSettingsService;
  sourceDiscoveryService: SourceDiscoveryService;
  sourceInspectService: SourceInspectService;
  sourceService: SourceService;
  storage: Storage;
  transcriptService: TranscriptService;
}
