<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  useTemplateRef,
  watch,
} from "vue";

import PlaybackDock from "./components/PlaybackDock.vue";
import type {
  ContentDetailAsset,
  ContentDetailItem,
  ContentTranscriptItem,
  ContentListItem,
  CreateSourceRequest,
  PeriodicCrawlSettings,
  PluginGlobalSettingsDetail,
  SourceCollectorPluginListItem,
  SourceCollectorSettingItem,
  SourceCollectorSettingsDetail,
  SourceListItem,
} from "./source-api.js";
import {
  createSource,
  getContentDetail,
  getPeriodicCrawlSettings,
  getPluginGlobalSettings,
  getSourceCollectorSettings,
  inspectSource,
  listSourceCollectorPlugins,
  listContents,
  listSources,
  observeSource,
  requestTranscripts,
  retryTranscript,
  updatePeriodicCrawlSettings,
  updatePluginGlobalSettings,
  updateSourceCollectorSettings,
} from "./source-api.js";
import {
  sanitizeContentSummary,
  summarizeContentSummary,
} from "./content-summary.js";
import {
  detailOriginalPageUrl,
  selectDetailDisplayContent,
} from "./content-detail.js";
import type { PlaybackState } from "./playback.js";
import { validateCreateSourceRequest } from "./source-form.js";

type RouteState =
  | { kind: "browse-index" }
  | { feedSlug: string; kind: "browse-feed" }
  | { entryId: string; kind: "browse-entry" }
  | { kind: "settings" }
  | { kind: "not-found" };

const contents = ref<ContentListItem[]>([]);
const contentDetail = ref<ContentDetailItem | null>(null);
const sourceCollectorPlugins = ref<SourceCollectorPluginListItem[]>([]);
const sources = ref<SourceListItem[]>([]);
const isCreateFormVisible = ref(false);
const isInspecting = ref(false);
const isSubmitting = ref(false);
const isObserveSubmitting = ref<string | null>(null);
const isSourceCrawlSubmitting = ref<string | null>(null);
const isSettingsSubmitting = ref(false);
const isSourcesLoading = ref(true);
const isContentsLoading = ref(true);
const isContentActionsExpanded = ref(false);
const isDetailLoading = ref(false);
const expandedAssetMenuId = ref<string | null>(null);
const isTranscriptSubmitting = ref<string | null>(null);
const isSettingsLoading = ref(true);
const isPluginGlobalSettingsLoading = ref(false);
const isPluginGlobalSettingsSubmitting = ref<string | null>(null);
const isSourceSettingsExpanded = ref(false);
const isSourceCollectorSettingsLoading = ref(false);
const errorMessage = ref<string | null>(null);
const detailErrorMessage = ref<string | null>(null);
const inspectErrorMessage = ref<string | null>(null);
const observeErrorMessage = ref<string | null>(null);
const settingsErrorMessage = ref<string | null>(null);
const pluginGlobalSettingsErrorMessage = ref<string | null>(null);
const sourceCrawlErrorMessage = ref<string | null>(null);
const transcriptActionErrorMessage = ref<string | null>(null);
const validationMessage = ref<string | null>(null);
const lastInspectedUrl = ref<string | null>(null);
const lastInspectedPluginSlug = ref<string | null>(null);
const routeState = ref<RouteState>(normalizeRoute(window.location.pathname));
const form = ref<CreateSourceRequest>({
  description: "",
  pluginSlug: "",
  sourceSlug: "",
  title: "",
  url: "",
});
const periodicCrawlSettings = ref<PeriodicCrawlSettings>({
  enabled: true,
  intervalMinutes: 60,
});
const sourceCrawlForm = ref<PeriodicCrawlSettings>({
  enabled: false,
  intervalMinutes: 60,
});
const sourceCollectorSettings = ref<SourceCollectorSettingsDetail | null>(null);
const sourceCollectorItemsForm = ref<Record<string, unknown>>({});
const pluginGlobalSettings = ref<
  Array<{
    plugin: SourceCollectorPluginListItem;
    settings: PluginGlobalSettingsDetail;
  }>
>([]);
const pluginGlobalItemsForm = ref<Record<string, Record<string, unknown>>>({});
const theme = ref<"light" | "dark">("light");
const audioPlayer = useTemplateRef<HTMLAudioElement>("audioPlayer");
const playback = ref<PlaybackState | null>(null);
const playbackCurrentTime = ref(0);
const playbackDuration = ref(0);
const isPlaybackActive = ref(false);
const isSeekingPlayback = ref(false);
const pendingSeekTime = ref(0);
const playbackVolume = ref(1);
const isPlaybackMuted = ref(false);
const expandedTranscriptIds = ref<Set<string>>(new Set());

const selectedSourceSlug = computed(() => {
  const route = routeState.value;

  switch (route.kind) {
    case "browse-feed":
      return route.feedSlug;
    case "browse-entry": {
      const content = contents.value.find(
        (entry) => entry.id === route.entryId,
      );
      return content?.sourceSlug ?? contentDetail.value?.source.slug ?? null;
    }
    default:
      return null;
  }
});

const selectedSource = computed(
  () =>
    sources.value.find((source) => source.slug === selectedSourceSlug.value) ??
    null,
);

const selectedContentId = computed(() =>
  routeState.value.kind === "browse-entry" ? routeState.value.entryId : null,
);

const visibleContents = computed(() => {
  const filteredContents =
    selectedSource.value === null
      ? contents.value
      : contents.value.filter(
          (content) => content.sourceId === selectedSource.value?.id,
        );

  return [...filteredContents].sort(compareContentListItems);
});

const routeHeadline = computed(() => {
  if (routeState.value.kind === "not-found") {
    return "Page not found";
  }

  if (selectedSource.value !== null) {
    return selectedSource.value.title ?? selectedSource.value.slug;
  }

  return "All entries";
});

const playbackSeekValue = computed(() =>
  isSeekingPlayback.value ? pendingSeekTime.value : playbackCurrentTime.value,
);

const playbackProgressMax = computed(() =>
  playbackDuration.value > 0 ? playbackDuration.value : 0,
);

const playbackSourceLabel = computed(() => {
  if (playback.value === null) {
    return "";
  }

  return playback.value.sourceTitle ?? playback.value.sourceSlug;
});

const playbackVolumeValue = computed(() =>
  isPlaybackMuted.value ? 0 : playbackVolume.value,
);

const detailHeaderAudioAsset = computed(() => {
  if (contentDetail.value === null) {
    return null;
  }

  return firstPlayableAudioAsset(contentDetail.value);
});

watch(
  selectedSource,
  (source) => {
    isSourceSettingsExpanded.value = false;
    isContentActionsExpanded.value = false;

    if (source === null) {
      sourceCollectorSettings.value = null;
      sourceCollectorItemsForm.value = {};
      return;
    }

    sourceCrawlForm.value = {
      enabled: source.periodicCrawlEnabled,
      intervalMinutes: source.periodicCrawlIntervalMinutes,
    };
    sourceCollectorSettings.value = null;
    sourceCollectorItemsForm.value = {};
    sourceCrawlErrorMessage.value = null;
    void refreshSelectedSourceCollectorSettings(source.id);
  },
  { immediate: true },
);

watch(theme, (currentTheme) => {
  document.documentElement.dataset.theme = currentTheme;
  window.localStorage.setItem("geshi-theme", currentTheme);
});

watch(playbackVolume, (nextVolume) => {
  const element = audioPlayer.value;

  if (element !== null) {
    element.volume = nextVolume;
  }
});

watch(isPlaybackMuted, (muted) => {
  const element = audioPlayer.value;

  if (element !== null) {
    element.muted = muted;
  }
});

watch(contentDetail, (detail) => {
  if (detail === null) {
    expandedTranscriptIds.value = new Set();
    return;
  }

  expandedTranscriptIds.value = new Set(
    detail.transcripts
      .filter((transcript) => transcript.body !== null)
      .map((transcript) => transcript.id),
  );
});

onMounted(async () => {
  if (window.location.pathname === "/") {
    replaceLocation("/browse");
    routeState.value = normalizeRoute("/browse");
  }

  theme.value = readInitialTheme();

  window.addEventListener("popstate", syncRouteFromLocation);

  await refreshSourceCollectorPlugins();
  await Promise.all([refreshSources(), refreshContents(), refreshSettings()]);
  await syncDetailWithRoute();
});

onUnmounted(() => {
  window.removeEventListener("popstate", syncRouteFromLocation);
});

watch(audioPlayer, (element, previousElement) => {
  previousElement?.pause();

  if (element === null || playback.value === null) {
    return;
  }

  element.src = playback.value.url;
  element.currentTime = playbackCurrentTime.value;
  element.volume = playbackVolume.value;
  element.muted = isPlaybackMuted.value;
  void element.play().catch(() => {
    isPlaybackActive.value = false;
  });
});

function syncRouteFromLocation(): void {
  routeState.value = normalizeRoute(window.location.pathname);
  void syncDetailWithRoute();
}

function openCreateForm(): void {
  isCreateFormVisible.value = true;
  errorMessage.value = null;
  inspectErrorMessage.value = null;
  lastInspectedUrl.value = null;
  lastInspectedPluginSlug.value = null;
  validationMessage.value = null;
}

function handlePluginSlugChange(pluginSlug: string): void {
  form.value.pluginSlug = pluginSlug;
  form.value.description = "";
  form.value.sourceSlug = "";
  form.value.title = "";
  lastInspectedUrl.value = null;
  lastInspectedPluginSlug.value = null;
  inspectErrorMessage.value = null;
  validationMessage.value = null;

  if (form.value.url.trim() !== "") {
    void inspectCurrentSource();
  }
}

function handlePluginSelection(event: Event): void {
  handlePluginSlugChange((event.target as HTMLSelectElement).value);
}

function closeCreateForm(): void {
  isCreateFormVisible.value = false;
  inspectErrorMessage.value = null;
  lastInspectedUrl.value = null;
  lastInspectedPluginSlug.value = null;
  validationMessage.value = null;
}

function toggleTheme(): void {
  theme.value = theme.value === "dark" ? "light" : "dark";
}

function toggleSourceSettings(): void {
  isSourceSettingsExpanded.value = !isSourceSettingsExpanded.value;
  closeContentActions();
}

function toggleContentActions(): void {
  isContentActionsExpanded.value = !isContentActionsExpanded.value;
}

function closeContentActions(): void {
  isContentActionsExpanded.value = false;
}

function toggleAssetMenu(assetId: string): void {
  expandedAssetMenuId.value =
    expandedAssetMenuId.value === assetId ? null : assetId;
}

function isCurrentPlaybackAsset(assetId: string): boolean {
  return playback.value?.assetId === assetId;
}

function startPlayback(
  detail: ContentDetailItem,
  asset: ContentDetailAsset,
): void {
  if (asset.url === null || asset.mimeType === null) {
    return;
  }

  const isSameAsset =
    playback.value?.assetId === asset.id && playback.value.url === asset.url;

  playback.value = {
    assetId: asset.id,
    assetKind: asset.kind,
    contentId: detail.id,
    contentTitle: detail.title ?? "Untitled entry",
    mimeType: asset.mimeType,
    sourceSlug: detail.source.slug,
    sourceTitle: detail.source.title,
    url: asset.url,
  };
  closeAssetMenu();

  if (!isSameAsset) {
    playbackCurrentTime.value = 0;
    playbackDuration.value = 0;
    pendingSeekTime.value = 0;
  }

  const element = audioPlayer.value;

  if (element === null) {
    return;
  }

  if (!isSameAsset) {
    element.src = asset.url;
    element.load();
  }

  void element.play().catch(() => {
    isPlaybackActive.value = false;
  });
}

function togglePlayback(): void {
  const element = audioPlayer.value;

  if (element === null || playback.value === null) {
    return;
  }

  if (element.paused) {
    void element.play().catch(() => {
      isPlaybackActive.value = false;
    });
    return;
  }

  element.pause();
}

function stopPlayback(): void {
  const element = audioPlayer.value;

  if (element !== null) {
    element.pause();
    element.removeAttribute("src");
    element.load();
    element.currentTime = 0;
  }

  playback.value = null;
  playbackCurrentTime.value = 0;
  playbackDuration.value = 0;
  pendingSeekTime.value = 0;
  isPlaybackActive.value = false;
  isSeekingPlayback.value = false;
}

function syncPlaybackCurrentTime(): void {
  const element = audioPlayer.value;

  if (element === null || isSeekingPlayback.value) {
    return;
  }

  playbackCurrentTime.value = element.currentTime;
}

function syncPlaybackDuration(): void {
  const element = audioPlayer.value;

  if (element === null) {
    return;
  }

  playbackDuration.value = Number.isFinite(element.duration)
    ? element.duration
    : 0;
}

function handlePlaybackStarted(): void {
  isPlaybackActive.value = true;
}

function handlePlaybackPaused(): void {
  isPlaybackActive.value = false;
}

function handlePlaybackEnded(): void {
  isPlaybackActive.value = false;
  playbackCurrentTime.value = playbackDuration.value;
}

function beginSeek(): void {
  isSeekingPlayback.value = true;
  pendingSeekTime.value = playbackCurrentTime.value;
}

function handleSeekPreview(value: number): void {
  pendingSeekTime.value = Number.isFinite(value) ? value : 0;
}

function commitSeek(value: number): void {
  const element = audioPlayer.value;
  const nextTime = Number.isFinite(value) ? value : 0;

  playbackCurrentTime.value = nextTime;
  pendingSeekTime.value = nextTime;
  isSeekingPlayback.value = false;

  if (element !== null) {
    element.currentTime = nextTime;
  }
}

function togglePlaybackMuted(): void {
  isPlaybackMuted.value = !isPlaybackMuted.value;
}

function seekPlaybackBy(deltaSeconds: number): void {
  const element = audioPlayer.value;

  if (element === null) {
    return;
  }

  const duration = Number.isFinite(element.duration) ? element.duration : 0;
  const nextTime = Math.max(
    0,
    Math.min(
      element.currentTime + deltaSeconds,
      duration || element.currentTime + deltaSeconds,
    ),
  );

  element.currentTime = nextTime;
  playbackCurrentTime.value = nextTime;
  pendingSeekTime.value = nextTime;
}

function updatePlaybackVolume(nextVolume: number): void {
  if (!Number.isFinite(nextVolume)) {
    return;
  }

  playbackVolume.value = Math.max(0, Math.min(1, nextVolume));
  isPlaybackMuted.value = playbackVolume.value === 0;
}

function closeAssetMenu(): void {
  expandedAssetMenuId.value = null;
}

function toggleTranscriptExpanded(transcriptId: string): void {
  const nextExpandedIds = new Set(expandedTranscriptIds.value);

  if (nextExpandedIds.has(transcriptId)) {
    nextExpandedIds.delete(transcriptId);
  } else {
    nextExpandedIds.add(transcriptId);
  }

  expandedTranscriptIds.value = nextExpandedIds;
}

async function inspectCurrentSource(): Promise<void> {
  const trimmedUrl = form.value.url.trim();
  const trimmedPluginSlug = (form.value.pluginSlug ?? "").trim();

  if (
    trimmedUrl === "" ||
    (lastInspectedUrl.value === trimmedUrl &&
      lastInspectedPluginSlug.value === trimmedPluginSlug)
  ) {
    return;
  }

  validationMessage.value = validateCreateSourceRequest(form.value);

  if (validationMessage.value !== null) {
    inspectErrorMessage.value = validationMessage.value;
    return;
  }

  isInspecting.value = true;
  inspectErrorMessage.value = null;

  try {
    const draft = await inspectSource({
      pluginSlug: form.value.pluginSlug,
      url: trimmedUrl,
    });
    form.value = {
      description: draft.description ?? "",
      pluginSlug: form.value.pluginSlug,
      sourceSlug: draft.sourceSlug,
      title: draft.title ?? "",
      url: draft.url,
    };
    lastInspectedUrl.value = draft.url;
    lastInspectedPluginSlug.value = trimmedPluginSlug;
  } catch (error) {
    inspectErrorMessage.value =
      error instanceof Error ? error.message : "Source inspect failed.";
  } finally {
    isInspecting.value = false;
  }
}

async function submitSource(): Promise<void> {
  validationMessage.value = validateCreateSourceRequest(form.value);

  if (validationMessage.value !== null) {
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = null;

  try {
    const source = await createSource(form.value);
    sources.value = [
      ...sources.value.filter(
        (existingSource) => existingSource.id !== source.id,
      ),
      source,
    ];
    void refreshSources();
    form.value = {
      description: "",
      pluginSlug: form.value.pluginSlug,
      sourceSlug: "",
      title: "",
      url: "",
    };
    closeCreateForm();
    navigateTo(`/browse/feed/${encodeURIComponent(source.slug)}`);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Source registration failed.";
  } finally {
    isSubmitting.value = false;
  }
}

async function runObserve(sourceId: string): Promise<void> {
  isObserveSubmitting.value = sourceId;
  observeErrorMessage.value = null;
  closeContentActions();

  try {
    await observeSource(sourceId);
    await refreshContents();
    await syncDetailWithRoute();
  } catch (error) {
    observeErrorMessage.value =
      error instanceof Error ? error.message : "Observe job enqueue failed.";
  } finally {
    isObserveSubmitting.value = null;
  }
}

async function savePeriodicCrawlSettings(): Promise<void> {
  isSettingsSubmitting.value = true;
  settingsErrorMessage.value = null;

  try {
    periodicCrawlSettings.value = await updatePeriodicCrawlSettings({
      enabled: periodicCrawlSettings.value.enabled,
      intervalMinutes: Number(periodicCrawlSettings.value.intervalMinutes),
    });
  } catch (error) {
    settingsErrorMessage.value =
      error instanceof Error ? error.message : "Settings update failed.";
  } finally {
    isSettingsSubmitting.value = false;
  }
}

async function saveSelectedSourceCrawlSettings(): Promise<void> {
  if (selectedSource.value === null) {
    return;
  }

  if (sourceCollectorSettings.value === null) {
    sourceCrawlErrorMessage.value = "Source collector settings unavailable.";
    return;
  }

  if (sourceCollectorSettings.value.baseVersion === null) {
    sourceCrawlErrorMessage.value =
      "Source collector settings version missing.";
    return;
  }

  isSourceCrawlSubmitting.value = selectedSource.value.id;
  sourceCrawlErrorMessage.value = null;

  try {
    const updatedSource = await updateSourceCollectorSettings(
      selectedSource.value.id,
      {
        baseVersion: sourceCollectorSettings.value.baseVersion,
        enabled: sourceCrawlForm.value.enabled,
        intervalMinutes: Number(sourceCrawlForm.value.intervalMinutes),
        items: sourceCollectorSettings.value.items.map((item) => ({
          key: item.key,
          value: normalizeCollectorSettingFormValue(
            item,
            sourceCollectorItemsForm.value[item.key],
          ),
        })),
      },
    );

    sources.value = sources.value.map((source) =>
      source.id === updatedSource.id ? updatedSource : source,
    );
    await refreshSelectedSourceCollectorSettings(updatedSource.id);
  } catch (error) {
    sourceCrawlErrorMessage.value =
      error instanceof Error
        ? error.message
        : "Source crawl settings update failed.";
  } finally {
    isSourceCrawlSubmitting.value = null;
  }
}

async function refreshSources(): Promise<void> {
  isSourcesLoading.value = true;

  try {
    sources.value = await listSources();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to load sources.";
  } finally {
    isSourcesLoading.value = false;
  }
}

async function refreshSourceCollectorPlugins(): Promise<void> {
  try {
    sourceCollectorPlugins.value = await listSourceCollectorPlugins();
    const firstAvailablePlugin = sourceCollectorPlugins.value.find(
      (plugin) => plugin.status === "available",
    );

    if (
      (form.value.pluginSlug ?? "") === "" &&
      firstAvailablePlugin !== undefined
    ) {
      form.value.pluginSlug = firstAvailablePlugin.pluginSlug;
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Failed to load source collector plugins.";
  }
}

async function refreshSelectedSourceCollectorSettings(
  sourceId: string,
): Promise<void> {
  isSourceCollectorSettingsLoading.value = true;

  try {
    const settings = await getSourceCollectorSettings(sourceId);

    if (selectedSource.value?.id !== sourceId) {
      return;
    }

    sourceCollectorSettings.value = settings;
    sourceCrawlForm.value = {
      enabled: settings.periodicCrawl.enabled,
      intervalMinutes: settings.periodicCrawl.intervalMinutes,
    };
    sourceCollectorItemsForm.value = Object.fromEntries(
      settings.items.map((item) => [item.key, item.value]),
    );
  } catch (error) {
    if (selectedSource.value?.id === sourceId) {
      sourceCrawlErrorMessage.value =
        error instanceof Error
          ? error.message
          : "Failed to load source collector settings.";
    }
  } finally {
    if (selectedSource.value?.id === sourceId) {
      isSourceCollectorSettingsLoading.value = false;
    }
  }
}

async function refreshContents(): Promise<void> {
  isContentsLoading.value = true;
  closeContentActions();

  try {
    contents.value = await listContents();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to load contents.";
  } finally {
    isContentsLoading.value = false;
  }
}

async function refreshSettings(): Promise<void> {
  isSettingsLoading.value = true;
  isPluginGlobalSettingsLoading.value = true;
  pluginGlobalSettingsErrorMessage.value = null;

  try {
    periodicCrawlSettings.value = await getPeriodicCrawlSettings();
  } catch (error) {
    settingsErrorMessage.value =
      error instanceof Error
        ? error.message
        : "Failed to load autonomous crawl settings.";
  } finally {
    isSettingsLoading.value = false;
  }

  try {
    const pluginSettings = await loadPluginGlobalSettings();
    pluginGlobalSettings.value = pluginSettings;
    pluginGlobalItemsForm.value = Object.fromEntries(
      pluginSettings.map(({ plugin, settings }) => [
        plugin.pluginSlug,
        Object.fromEntries(
          settings.items.map((item) => [item.key, item.value]),
        ),
      ]),
    );
  } catch (error) {
    pluginGlobalSettingsErrorMessage.value =
      error instanceof Error
        ? error.message
        : "Failed to load plugin global settings.";
  } finally {
    isPluginGlobalSettingsLoading.value = false;
  }
}

async function loadPluginGlobalSettings(): Promise<
  Array<{
    plugin: SourceCollectorPluginListItem;
    settings: PluginGlobalSettingsDetail;
  }>
> {
  const availablePlugins = sourceCollectorPlugins.value.filter(
    (plugin) => plugin.status === "available",
  );
  const results = await Promise.all(
    availablePlugins.map(async (plugin) => ({
      plugin,
      settings: await getPluginGlobalSettings(plugin.pluginSlug),
    })),
  );

  return results.filter(({ settings }) => settings.items.length > 0);
}

async function savePluginSettings(pluginSlug: string): Promise<void> {
  const pluginSettings = pluginGlobalSettings.value.find(
    ({ plugin }) => plugin.pluginSlug === pluginSlug,
  );

  if (pluginSettings === undefined) {
    pluginGlobalSettingsErrorMessage.value = "Plugin settings unavailable.";
    return;
  }

  isPluginGlobalSettingsSubmitting.value = pluginSlug;
  pluginGlobalSettingsErrorMessage.value = null;

  try {
    const updatedSettings = await updatePluginGlobalSettings(pluginSlug, {
      baseVersion: pluginSettings.settings.baseVersion,
      items: pluginSettings.settings.items.map((item) => ({
        key: item.key,
        value: normalizeCollectorSettingFormValue(
          item,
          pluginGlobalItemsForm.value[pluginSlug]?.[item.key],
        ),
      })),
    });

    pluginGlobalSettings.value = pluginGlobalSettings.value.map((entry) =>
      entry.plugin.pluginSlug === pluginSlug
        ? {
            ...entry,
            settings: updatedSettings,
          }
        : entry,
    );
    pluginGlobalItemsForm.value[pluginSlug] = Object.fromEntries(
      updatedSettings.items.map((item) => [item.key, item.value]),
    );
  } catch (error) {
    pluginGlobalSettingsErrorMessage.value =
      error instanceof Error
        ? error.message
        : "Failed to update plugin global settings.";
  } finally {
    isPluginGlobalSettingsSubmitting.value = null;
  }
}

async function syncDetailWithRoute(): Promise<void> {
  closeAssetMenu();

  if (routeState.value.kind !== "browse-entry") {
    contentDetail.value = null;
    detailErrorMessage.value = null;
    isDetailLoading.value = false;
    return;
  }

  isDetailLoading.value = true;
  detailErrorMessage.value = null;

  try {
    contentDetail.value = await getContentDetail(routeState.value.entryId);
  } catch (error) {
    contentDetail.value = null;
    detailErrorMessage.value =
      error instanceof Error ? error.message : "Failed to load content detail.";
  } finally {
    isDetailLoading.value = false;
  }
}

async function requestContentTranscripts(contentId: string): Promise<void> {
  isTranscriptSubmitting.value = contentId;
  transcriptActionErrorMessage.value = null;
  closeAssetMenu();

  try {
    await requestTranscripts(contentId);
    await syncDetailWithRoute();
  } catch (error) {
    transcriptActionErrorMessage.value =
      error instanceof Error ? error.message : "Failed to request transcripts.";
  } finally {
    isTranscriptSubmitting.value = null;
  }
}

async function retryFailedTranscript(
  contentId: string,
  transcriptId: string,
): Promise<void> {
  isTranscriptSubmitting.value = transcriptId;
  transcriptActionErrorMessage.value = null;
  closeAssetMenu();

  try {
    await retryTranscript(contentId, transcriptId);
    await syncDetailWithRoute();
  } catch (error) {
    transcriptActionErrorMessage.value =
      error instanceof Error ? error.message : "Failed to retry transcript.";
  } finally {
    isTranscriptSubmitting.value = null;
  }
}

function navigateTo(pathname: string): void {
  if (window.location.pathname === pathname) {
    return;
  }

  window.history.pushState({}, "", pathname);
  routeState.value = normalizeRoute(pathname);
  void syncDetailWithRoute();
}

function replaceLocation(pathname: string): void {
  window.history.replaceState({}, "", pathname);
}

function openFeed(source: SourceListItem): void {
  navigateTo(`/browse/feed/${encodeURIComponent(source.slug)}`);
}

function openEntry(content: ContentListItem): void {
  navigateTo(`/browse/entry/${content.id}`);
}

function normalizeRoute(pathname: string): RouteState {
  if (pathname === "/browse") {
    return { kind: "browse-index" };
  }

  if (pathname === "/settings") {
    return { kind: "settings" };
  }

  const feedMatch = pathname.match(/^\/browse\/feed\/([^/]+)$/u);

  if (feedMatch?.[1]) {
    return {
      feedSlug: decodeURIComponent(feedMatch[1]),
      kind: "browse-feed",
    };
  }

  const entryMatch = pathname.match(/^\/browse\/entry\/([^/.][^/]*)$/u);

  if (entryMatch?.[1]) {
    return {
      entryId: decodeURIComponent(entryMatch[1]),
      kind: "browse-entry",
    };
  }

  return { kind: "not-found" };
}

function isSourceSelected(source: SourceListItem): boolean {
  return selectedSource.value?.id === source.id;
}

function isContentSelected(content: ContentListItem): boolean {
  return selectedContentId.value === content.id;
}

function compareContentListItems(
  left: ContentListItem,
  right: ContentListItem,
): number {
  const statusDifference =
    contentStatusRank(left.status) - contentStatusRank(right.status);

  if (statusDifference !== 0) {
    return statusDifference;
  }

  const publishedAtDifference =
    new Date(right.publishedAt ?? 0).getTime() -
    new Date(left.publishedAt ?? 0).getTime();

  if (publishedAtDifference !== 0) {
    return publishedAtDifference;
  }

  return left.id.localeCompare(right.id);
}

function contentStatusRank(status: ContentListItem["status"]): number {
  switch (status) {
    case "stored": {
      return 0;
    }
    case "failed": {
      return 1;
    }
    case "discovered": {
      return 2;
    }
  }
}

function readInitialTheme(): "light" | "dark" {
  const storedTheme = window.localStorage.getItem("geshi-theme");

  if (storedTheme === "light" || storedTheme === "dark") {
    document.documentElement.dataset.theme = storedTheme;
    return storedTheme;
  }

  const initialTheme = "dark";
  document.documentElement.dataset.theme = initialTheme;
  return initialTheme;
}

function sourceDomainLabel(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./u, "");
  } catch {
    return sourceUrl;
  }
}

function formatDate(value: string | null): string {
  if (value === null) {
    return "Unknown date";
  }

  return new Date(value).toLocaleString();
}

function detailPlayableAssets(detail: ContentDetailItem): ContentDetailAsset[] {
  return detail.assets.filter(isPlayableAsset);
}

function firstPlayableAudioAsset(
  detail: ContentDetailItem,
): ContentDetailAsset | null {
  return (
    detail.assets.find(
      (asset) => asset.url !== null && asset.mimeType?.startsWith("audio/"),
    ) ?? null
  );
}

function detailReferenceAssets(
  detail: ContentDetailItem,
): ContentDetailAsset[] {
  return detail.assets.filter((asset) => !isPlayableAsset(asset));
}

function isPlayableAsset(asset: ContentDetailAsset): boolean {
  if (asset.url === null || asset.mimeType === null) {
    return false;
  }

  return (
    asset.mimeType.startsWith("audio/") || asset.mimeType.startsWith("video/")
  );
}

function transcriptSourceLabel(transcript: ContentTranscriptItem): string {
  const source = transcript.sourceAsset;

  return [
    source.kind,
    source.primary ? "Primary" : "Supplemental",
    source.mimeType ?? "Unknown mime",
  ].join(" · ");
}

function renderContentSummary(summary: string | null): string {
  if (summary === null) {
    return "";
  }

  return sanitizeContentSummary(summary);
}

function detailDisplayBody(detail: ContentDetailItem): string | null {
  const display = selectDetailDisplayContent(detail);

  return display?.kind === "detail-body" ? display.body : null;
}

function detailDisplayFormat(
  detail: ContentDetailItem,
): "html" | "markdown" | "plain" | null {
  const display = selectDetailDisplayContent(detail);

  return display?.kind === "detail-body" ? display.format : null;
}

function detailDisplaySummary(detail: ContentDetailItem): string | null {
  const display = selectDetailDisplayContent(detail);

  return display?.kind === "summary" ? display.summary : null;
}

function renderContentSummaryPreview(summary: string | null): string {
  if (summary === null) {
    return "";
  }

  return summarizeContentSummary(summary);
}

function isCheckboxCollectorSetting(item: SourceCollectorSettingItem): boolean {
  return item.type.type === "checkbox";
}

function isNumberCollectorSetting(item: SourceCollectorSettingItem): boolean {
  return item.type.type === "number";
}

function normalizeCollectorSettingFormValue(
  item: SourceCollectorSettingItem,
  value: unknown,
): SourceCollectorSettingItem["value"] {
  if (item.type.type === "checkbox") {
    return value === true;
  }

  if (item.type.type === "number") {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  return typeof value === "string"
    ? value
    : value === null
      ? null
      : String(value ?? "");
}
</script>

<template>
  <main class="workspace">
    <header class="workspace-header">
      <div class="workspace-title">
        <p class="eyebrow">Geshi Media Archive</p>
        <h1>
          {{
            routeState.kind === "settings"
              ? "Application Settings"
              : "Browse Archive"
          }}
        </h1>
        <p class="workspace-summary">
          {{ sources.length }} sources · {{ contents.length }} entries
          <template v-if="selectedSource !== null">
            · focused on {{ selectedSource.title ?? selectedSource.slug }}
          </template>
        </p>
      </div>
      <div class="workspace-actions">
        <nav class="view-nav" aria-label="Primary">
          <button
            type="button"
            class="ghost-button"
            :class="{ active: routeState.kind !== 'settings' }"
            @click="navigateTo('/browse')"
          >
            Browse
          </button>
          <button
            type="button"
            class="ghost-button"
            :class="{ active: routeState.kind === 'settings' }"
            @click="navigateTo('/settings')"
          >
            Settings
          </button>
        </nav>
        <button class="ghost-button" type="button" @click="toggleTheme">
          {{ theme === "dark" ? "Light" : "Dark" }}
        </button>
      </div>
    </header>

    <p v-if="errorMessage" class="feedback error">{{ errorMessage }}</p>
    <p v-if="observeErrorMessage" class="feedback error">
      {{ observeErrorMessage }}
    </p>

    <section v-if="routeState.kind === 'settings'" class="settings-shell">
      <div class="settings-shell-header">
        <div>
          <p class="eyebrow">Operations</p>
          <h2>Autonomous Crawl</h2>
        </div>
      </div>

      <p v-if="settingsErrorMessage" class="feedback error">
        {{ settingsErrorMessage }}
      </p>
      <p v-if="pluginGlobalSettingsErrorMessage" class="feedback error">
        {{ pluginGlobalSettingsErrorMessage }}
      </p>

      <div v-if="isSettingsLoading" class="empty-state">
        Loading settings...
      </div>

      <form
        v-else
        class="settings-grid"
        @submit.prevent="savePeriodicCrawlSettings"
      >
        <label class="toggle-field">
          <span>Scheduler Enabled</span>
          <input v-model="periodicCrawlSettings.enabled" type="checkbox" />
        </label>

        <label>
          <span>Scheduler Interval Minutes</span>
          <input
            v-model.number="periodicCrawlSettings.intervalMinutes"
            min="1"
            step="1"
            type="number"
          />
        </label>

        <div class="actions">
          <button
            type="submit"
            class="primary-button"
            :disabled="isSettingsSubmitting"
          >
            {{ isSettingsSubmitting ? "Saving..." : "Save settings" }}
          </button>
        </div>
      </form>

      <div class="settings-shell-header">
        <div>
          <p class="eyebrow">Plugins</p>
          <h2>Shared Plugin Settings</h2>
        </div>
      </div>

      <div v-if="isPluginGlobalSettingsLoading" class="empty-state">
        Loading plugin settings...
      </div>

      <div v-else-if="pluginGlobalSettings.length === 0" class="empty-state">
        No plugin shared settings.
      </div>

      <form
        v-for="{ plugin, settings } in pluginGlobalSettings"
        :key="plugin.pluginSlug"
        class="settings-grid"
        @submit.prevent="savePluginSettings(plugin.pluginSlug)"
      >
        <div class="settings-shell-header">
          <div>
            <p class="eyebrow">{{ plugin.sourceKind }}</p>
            <h3>{{ plugin.displayName }}</h3>
          </div>
        </div>

        <label
          v-for="item in settings.items"
          :key="item.key"
          :class="{ 'toggle-field': isCheckboxCollectorSetting(item) }"
        >
          <span>{{ item.key }}</span>
          <input
            v-if="isCheckboxCollectorSetting(item)"
            v-model="pluginGlobalItemsForm[plugin.pluginSlug][item.key]"
            type="checkbox"
          />
          <input
            v-else-if="isNumberCollectorSetting(item)"
            v-model.number="pluginGlobalItemsForm[plugin.pluginSlug][item.key]"
            type="number"
          />
          <input
            v-else
            v-model="pluginGlobalItemsForm[plugin.pluginSlug][item.key]"
            type="text"
          />
        </label>

        <div class="actions">
          <button
            type="submit"
            class="primary-button"
            :disabled="isPluginGlobalSettingsSubmitting === plugin.pluginSlug"
          >
            {{
              isPluginGlobalSettingsSubmitting === plugin.pluginSlug
                ? "Saving..."
                : "Save plugin settings"
            }}
          </button>
        </div>
      </form>
    </section>

    <template v-else>
      <section v-if="isCreateFormVisible" class="create-shell">
        <div class="create-shell-header">
          <div>
            <p class="eyebrow">Register source</p>
            <h2>Add source</h2>
          </div>
          <button class="ghost-button" type="button" @click="closeCreateForm">
            Close
          </button>
        </div>

        <div class="create-grid">
          <label>
            <span>Collector Plugin</span>
            <select
              :value="form.pluginSlug"
              :disabled="isInspecting || isSubmitting"
              @change="handlePluginSelection"
            >
              <option value="" disabled>Select a plugin</option>
              <option
                v-for="plugin in sourceCollectorPlugins"
                :key="plugin.pluginSlug"
                :value="plugin.pluginSlug"
                :disabled="plugin.status !== 'available'"
              >
                {{ plugin.displayName }} ({{ plugin.sourceKind }}){{
                  plugin.status === "available" ? "" : " unavailable"
                }}
              </option>
            </select>
          </label>

          <p
            v-if="
              sourceCollectorPlugins.find(
                (plugin) => plugin.pluginSlug === form.pluginSlug,
              )?.message
            "
            class="feedback error"
          >
            {{
              sourceCollectorPlugins.find(
                (plugin) => plugin.pluginSlug === form.pluginSlug,
              )?.message
            }}
          </p>

          <label>
            <span>Source URL</span>
            <input
              v-model="form.url"
              :disabled="isInspecting || isSubmitting"
              type="url"
              placeholder="https://example.com/feed.xml"
              @change="inspectCurrentSource"
            />
          </label>

          <label>
            <span>Source Slug</span>
            <input
              :value="form.sourceSlug"
              readonly
              type="text"
              placeholder="Filled by inspect when available"
            />
          </label>

          <label>
            <span>Title</span>
            <input
              v-model="form.title"
              :disabled="isInspecting || isSubmitting"
              type="text"
              placeholder="Optional"
            />
          </label>

          <label class="create-grid-wide">
            <span>Description</span>
            <textarea
              v-model="form.description"
              :disabled="isInspecting || isSubmitting"
              rows="4"
              placeholder="Optional"
            ></textarea>
          </label>
        </div>

        <p v-if="inspectErrorMessage" class="feedback error">
          {{ inspectErrorMessage }}
        </p>
        <p v-if="validationMessage" class="feedback error">
          {{ validationMessage }}
        </p>

        <div class="actions">
          <button
            type="button"
            class="secondary-button"
            @click="closeCreateForm"
          >
            Cancel
          </button>
          <button
            type="button"
            class="primary-button"
            :disabled="isInspecting || isSubmitting"
            @click="submitSource"
          >
            {{
              isSubmitting
                ? "Registering..."
                : isInspecting
                  ? "Inspecting..."
                  : "Register"
            }}
          </button>
        </div>
      </section>

      <section class="browser-shell">
        <aside class="pane pane-sources">
          <div class="pane-header">
            <div class="pane-heading">
              <p class="eyebrow">Feeds</p>
              <h2>Sources</h2>
              <p class="pane-caption">Registered feeds and collectors</p>
            </div>
            <span class="pane-count">{{ sources.length }}</span>
            <div class="pane-actions">
              <button
                type="button"
                class="ghost-button menu-toggle-button pane-add-button"
                aria-label="Add source"
                title="Add source"
                @click="openCreateForm"
              >
                <svg aria-hidden="true" class="button-icon" viewBox="0 0 24 24">
                  <path
                    d="M12 5v14M5 12h14"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="square"
                    stroke-width="1.8"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div v-if="isSourcesLoading" class="empty-state">
            Loading sources...
          </div>

          <ul v-else-if="sources.length > 0" class="source-list">
            <li v-for="source in sources" :key="source.id">
              <button
                type="button"
                class="source-row"
                :class="{ selected: isSourceSelected(source) }"
                @click="openFeed(source)"
              >
                <span class="source-row-head">
                  <span class="source-row-title">
                    {{ source.title ?? source.slug }}
                  </span>
                  <span
                    class="source-row-status"
                    :class="{
                      active: source.periodicCrawlEnabled,
                      idle: !source.periodicCrawlEnabled,
                    }"
                  >
                    {{
                      source.periodicCrawlEnabled
                        ? `Auto ${source.periodicCrawlIntervalMinutes}m`
                        : "Manual"
                    }}
                  </span>
                </span>
                <span class="source-row-meta-line">
                  <span class="source-row-domain">
                    {{ sourceDomainLabel(source.url) }}
                  </span>
                  <span class="source-row-meta"
                    >{{ source.kind }} · {{ source.slug }}</span
                  >
                </span>
                <span v-if="source.description" class="source-row-description">
                  {{ source.description }}
                </span>
              </button>
            </li>
          </ul>

          <div v-else class="empty-state">
            No sources registered yet. Add a feed to get started.
          </div>
        </aside>

        <section class="pane pane-contents">
          <div class="pane-header">
            <div class="pane-heading">
              <p class="eyebrow">Entries</p>
              <h2>{{ routeHeadline }}</h2>
              <p class="pane-caption">
                {{
                  selectedSource === null
                    ? "Across every registered source"
                    : sourceDomainLabel(selectedSource.url)
                }}
              </p>
            </div>
            <span class="pane-count">{{ visibleContents.length }}</span>
            <div class="pane-actions">
              <button
                type="button"
                class="ghost-button menu-toggle-button pane-reload-button"
                aria-label="Reload entries"
                title="Reload"
                :disabled="isContentsLoading"
                @click="refreshContents"
              >
                <svg aria-hidden="true" class="button-icon" viewBox="0 0 24 24">
                  <path
                    d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6"
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="square"
                    stroke-linejoin="miter"
                    stroke-width="1.8"
                  />
                </svg>
              </button>
              <div class="menu-shell">
                <button
                  type="button"
                  class="ghost-button menu-toggle-button"
                  :aria-expanded="isContentActionsExpanded"
                  aria-label="Entry actions"
                  @click="toggleContentActions"
                >
                  <svg
                    aria-hidden="true"
                    class="button-icon"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M4 7h16M4 12h16M4 17h16"
                      fill="none"
                      stroke="currentColor"
                      stroke-linecap="square"
                      stroke-width="1.8"
                    />
                  </svg>
                </button>

                <div
                  v-if="isContentActionsExpanded"
                  class="menu-panel"
                  role="menu"
                >
                  <button
                    v-if="selectedSource"
                    type="button"
                    class="menu-item"
                    role="menuitem"
                    @click="toggleSourceSettings"
                  >
                    {{
                      isSourceSettingsExpanded
                        ? "Hide source settings"
                        : "Source settings"
                    }}
                  </button>
                  <button
                    v-if="selectedSource"
                    type="button"
                    class="menu-item"
                    role="menuitem"
                    :disabled="isObserveSubmitting === selectedSource.id"
                    @click="runObserve(selectedSource.id)"
                  >
                    {{
                      isObserveSubmitting === selectedSource.id
                        ? "Crawling..."
                        : "Crawl"
                    }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <section
            v-if="selectedSource && isSourceSettingsExpanded"
            class="source-settings-panel"
          >
            <div class="source-settings-panel-header">
              <div>
                <p class="eyebrow">Source settings</p>
                <h3>{{ selectedSource.title ?? selectedSource.slug }}</h3>
              </div>
              <p class="source-settings-summary">
                {{
                  selectedSource.periodicCrawlEnabled
                    ? `Auto crawl every ${selectedSource.periodicCrawlIntervalMinutes} minutes`
                    : "Auto crawl disabled"
                }}
              </p>
            </div>

            <p v-if="sourceCrawlErrorMessage" class="feedback error">
              {{ sourceCrawlErrorMessage }}
            </p>

            <div class="source-settings-grid">
              <label class="toggle-field">
                <span>Enabled</span>
                <input v-model="sourceCrawlForm.enabled" type="checkbox" />
              </label>

              <label>
                <span>Interval Minutes</span>
                <input
                  v-model.number="sourceCrawlForm.intervalMinutes"
                  min="1"
                  step="1"
                  type="number"
                />
              </label>

              <div class="actions source-settings-actions">
                <button
                  type="button"
                  class="secondary-button"
                  :disabled="isSourceCrawlSubmitting === selectedSource.id"
                  @click="saveSelectedSourceCrawlSettings"
                >
                  {{
                    isSourceCrawlSubmitting === selectedSource.id
                      ? "Saving..."
                      : "Save source settings"
                  }}
                </button>
              </div>
            </div>

            <div class="source-settings-grid plugin-settings-grid">
              <p v-if="isSourceCollectorSettingsLoading" class="feedback">
                Loading plugin settings...
              </p>

              <template
                v-else-if="
                  sourceCollectorSettings !== null &&
                  sourceCollectorSettings.items.length > 0
                "
              >
                <label
                  v-for="item in sourceCollectorSettings.items"
                  :key="item.key"
                  :class="{ 'toggle-field': isCheckboxCollectorSetting(item) }"
                >
                  <span>{{ item.key }}</span>
                  <input
                    v-if="isCheckboxCollectorSetting(item)"
                    v-model="sourceCollectorItemsForm[item.key]"
                    type="checkbox"
                  />
                  <input
                    v-else-if="isNumberCollectorSetting(item)"
                    v-model.number="sourceCollectorItemsForm[item.key]"
                    type="number"
                  />
                  <input
                    v-else
                    v-model="sourceCollectorItemsForm[item.key]"
                    type="text"
                  />
                </label>
              </template>

              <p v-else class="feedback">No plugin settings.</p>
            </div>
          </section>

          <div
            v-if="
              routeState.kind === 'browse-feed' &&
              selectedSource === null &&
              !isSourcesLoading
            "
            class="empty-state"
          >
            Feed not found.
          </div>

          <div v-else-if="routeState.kind === 'not-found'" class="empty-state">
            This browse URL does not exist.
          </div>

          <div v-else-if="isContentsLoading" class="empty-state">
            Loading contents...
          </div>

          <ul v-else-if="visibleContents.length > 0" class="content-list">
            <li v-for="content in visibleContents" :key="content.id">
              <button
                type="button"
                class="content-row"
                :class="{ selected: isContentSelected(content) }"
                @click="openEntry(content)"
              >
                <span class="content-row-thumb" aria-hidden="true"></span>
                <span class="content-row-body">
                  <span class="content-row-head">
                    <span class="content-row-title">
                      {{ content.title ?? "Untitled entry" }}
                    </span>
                    <span class="content-row-status" :class="content.status">
                      {{ content.status }}
                    </span>
                  </span>
                  <span class="content-row-meta">
                    <span>{{ formatDate(content.publishedAt) }}</span>
                    <span>{{
                      selectedSource === null
                        ? content.sourceSlug
                        : content.kind
                    }}</span>
                  </span>
                  <span v-if="content.summary" class="content-row-summary">
                    {{ renderContentSummaryPreview(content.summary) }}
                  </span>
                </span>
              </button>
            </li>
          </ul>

          <div v-else class="empty-state">No contents yet.</div>
        </section>

        <section class="pane pane-detail">
          <div class="pane-header">
            <div class="pane-heading">
              <p class="eyebrow">Detail</p>
              <div class="pane-title-row">
                <h2>
                  {{
                    contentDetail?.title ??
                    (routeState.kind === "browse-entry"
                      ? "Entry detail"
                      : "Select an entry")
                  }}
                </h2>
                <button
                  v-if="contentDetail !== null && detailHeaderAudioAsset"
                  type="button"
                  class="secondary-button pane-title-action"
                  :class="{
                    active: isCurrentPlaybackAsset(detailHeaderAudioAsset.id),
                  }"
                  @click="startPlayback(contentDetail, detailHeaderAudioAsset)"
                >
                  {{
                    isCurrentPlaybackAsset(detailHeaderAudioAsset.id)
                      ? isPlaybackActive
                        ? "Playing"
                        : "Resume"
                      : "Play"
                  }}
                </button>
              </div>
              <p class="pane-caption">
                {{
                  contentDetail?.source.title ??
                  contentDetail?.source.slug ??
                  "Summary, transcript, and stored assets"
                }}
              </p>
            </div>
          </div>

          <div v-if="isDetailLoading" class="empty-state">
            Loading detail...
          </div>

          <div v-else-if="detailErrorMessage" class="empty-state">
            {{ detailErrorMessage }}
          </div>

          <div v-else-if="contentDetail === null" class="empty-state">
            Pick an entry to inspect its stored assets.
          </div>

          <article v-else class="detail-card">
            <div class="detail-meta">
              <span>{{ contentDetail.kind }}</span>
              <span>{{ contentDetail.status }}</span>
              <span>{{ formatDate(contentDetail.publishedAt) }}</span>
              <a
                v-if="detailOriginalPageUrl(contentDetail)"
                class="detail-meta-link"
                :href="detailOriginalPageUrl(contentDetail) ?? undefined"
                target="_blank"
                rel="noreferrer"
              >
                Original page
              </a>
            </div>

            <div v-if="detailDisplayBody(contentDetail)" class="detail-summary">
              <pre
                v-if="detailDisplayFormat(contentDetail) === 'plain'"
                class="detail-body-text"
                >{{ detailDisplayBody(contentDetail) }}</pre
              >
              <div v-else v-html="detailDisplayBody(contentDetail) ?? ''"></div>
            </div>

            <div
              v-else-if="detailDisplaySummary(contentDetail)"
              class="detail-summary"
              v-html="renderContentSummary(detailDisplaySummary(contentDetail))"
            ></div>

            <section
              v-if="contentDetail.transcripts.length > 0"
              class="detail-section"
            >
              <div class="detail-section-header">
                <div>
                  <h3>Transcripts</h3>
                  <span class="detail-count">
                    {{ contentDetail.transcripts.length }}
                  </span>
                </div>
              </div>

              <p v-if="transcriptActionErrorMessage" class="feedback error">
                {{ transcriptActionErrorMessage }}
              </p>

              <ul class="asset-list">
                <li
                  v-for="transcript in contentDetail.transcripts"
                  :key="transcript.id"
                  class="asset-card"
                >
                  <div class="asset-card-header">
                    <div class="transcript-card-heading">
                      <strong> Transcript #{{ transcript.generation }} </strong>
                      <span class="asset-meta">
                        {{ transcriptSourceLabel(transcript) }}
                      </span>
                    </div>
                    <div class="transcript-card-actions">
                      <span class="asset-meta">
                        {{ transcript.status }}
                        <template v-if="transcript.totalChunkCount > 0">
                          · {{ transcript.totalChunkCount }} chunks
                        </template>
                      </span>
                      <button
                        v-if="transcript.retryAvailable"
                        type="button"
                        class="ghost-button"
                        :disabled="isTranscriptSubmitting === transcript.id"
                        @click="
                          retryFailedTranscript(contentDetail.id, transcript.id)
                        "
                      >
                        {{
                          isTranscriptSubmitting === transcript.id
                            ? "Retrying..."
                            : "Retry failed chunks"
                        }}
                      </button>
                    </div>
                  </div>

                  <details
                    v-if="transcript.body"
                    class="transcript-disclosure"
                    :open="expandedTranscriptIds.has(transcript.id)"
                  >
                    <summary
                      class="transcript-summary"
                      @click.prevent="toggleTranscriptExpanded(transcript.id)"
                    >
                      {{
                        expandedTranscriptIds.has(transcript.id)
                          ? "Hide transcript"
                          : "Show transcript"
                      }}
                    </summary>
                    <p class="transcript-body">
                      {{ transcript.body }}
                    </p>
                  </details>
                  <p v-else class="asset-meta">
                    {{
                      transcript.status === "failed"
                        ? `Failed chunks: ${transcript.failedChunkCount}`
                        : "Transcript is not completed yet."
                    }}
                  </p>
                </li>
              </ul>
            </section>

            <section
              v-if="detailPlayableAssets(contentDetail).length > 0"
              class="detail-section"
            >
              <div class="detail-section-header">
                <h3>Playable assets</h3>
                <span class="detail-count">
                  {{ detailPlayableAssets(contentDetail).length }}
                </span>
              </div>

              <p v-if="transcriptActionErrorMessage" class="feedback error">
                {{ transcriptActionErrorMessage }}
              </p>

              <ul class="asset-list">
                <li
                  v-for="asset in detailPlayableAssets(contentDetail)"
                  :key="asset.id"
                  class="asset-card"
                >
                  <div class="asset-card-header">
                    <div class="asset-card-heading">
                      <strong>{{ asset.kind }}</strong>
                      <span class="asset-meta">
                        {{ asset.primary ? "Primary" : "Supplemental" }}
                      </span>
                    </div>
                    <div class="asset-card-actions">
                      <div class="menu-shell">
                        <button
                          type="button"
                          class="ghost-button menu-toggle-button"
                          :aria-expanded="expandedAssetMenuId === asset.id"
                          aria-label="Asset actions"
                          @click="toggleAssetMenu(asset.id)"
                        >
                          <svg
                            aria-hidden="true"
                            class="button-icon"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M6 12h.01M12 12h.01M18 12h.01"
                              fill="none"
                              stroke="currentColor"
                              stroke-linecap="round"
                              stroke-width="2.2"
                            />
                          </svg>
                        </button>

                        <div
                          v-if="expandedAssetMenuId === asset.id"
                          class="menu-panel"
                          role="menu"
                        >
                          <a
                            v-if="asset.url"
                            class="menu-item"
                            role="menuitem"
                            :href="asset.url"
                            target="_blank"
                            rel="noreferrer"
                            @click="closeAssetMenu"
                          >
                            Open asset
                          </a>
                          <a
                            v-if="detailOriginalPageUrl(contentDetail)"
                            class="menu-item"
                            role="menuitem"
                            :href="
                              detailOriginalPageUrl(contentDetail) ?? undefined
                            "
                            target="_blank"
                            rel="noreferrer"
                            @click="closeAssetMenu"
                          >
                            Original page
                          </a>
                          <button
                            v-if="asset.kind === 'audio'"
                            type="button"
                            class="menu-item"
                            role="menuitem"
                            :disabled="
                              isTranscriptSubmitting === contentDetail.id
                            "
                            @click="requestContentTranscripts(contentDetail.id)"
                          >
                            {{
                              isTranscriptSubmitting === contentDetail.id
                                ? "Requesting..."
                                : "Request transcripts"
                            }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    v-if="asset.mimeType?.startsWith('audio/')"
                    class="asset-inline-actions"
                  >
                    <button
                      type="button"
                      class="secondary-button"
                      :class="{ active: isCurrentPlaybackAsset(asset.id) }"
                      @click="startPlayback(contentDetail, asset)"
                    >
                      {{
                        isCurrentPlaybackAsset(asset.id)
                          ? isPlaybackActive
                            ? "Playing"
                            : "Resume"
                          : "Play"
                      }}
                    </button>
                  </div>

                  <video
                    v-else-if="asset.mimeType?.startsWith('video/')"
                    controls
                  >
                    <source
                      :src="asset.url ?? undefined"
                      :type="asset.mimeType"
                    />
                  </video>

                  <p class="asset-meta">
                    {{ asset.mimeType ?? "Unknown mime" }}
                    <template v-if="asset.byteSize !== null">
                      · {{ asset.byteSize }} bytes
                    </template>
                  </p>
                </li>
              </ul>
            </section>

            <section
              v-if="detailReferenceAssets(contentDetail).length > 0"
              class="detail-section"
            >
              <div class="detail-section-header">
                <h3>Reference assets</h3>
                <span class="detail-count">
                  {{ detailReferenceAssets(contentDetail).length }}
                </span>
              </div>

              <ul class="asset-list">
                <li
                  v-for="asset in detailReferenceAssets(contentDetail)"
                  :key="asset.id"
                  class="asset-card"
                >
                  <div class="asset-card-header">
                    <div class="asset-card-heading">
                      <strong>{{ asset.kind }}</strong>
                      <span class="asset-meta">
                        {{ asset.mimeType ?? "unknown type" }}
                      </span>
                    </div>
                    <div class="asset-card-actions">
                      <a
                        v-if="asset.url"
                        class="ghost-button"
                        :href="asset.url"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open stored asset
                      </a>
                    </div>
                  </div>
                </li>
              </ul>
            </section>
          </article>
        </section>
      </section>
    </template>

    <PlaybackDock
      v-if="playback !== null"
      :duration="playbackDuration"
      :is-playback-active="isPlaybackActive"
      :is-playback-muted="isPlaybackMuted"
      :playback="playback"
      :progress-max="playbackProgressMax"
      :seek-value="playbackSeekValue"
      :source-label="playbackSourceLabel"
      :volume-value="playbackVolumeValue"
      @seek-commit="commitSeek"
      @seek-preview="handleSeekPreview"
      @seek-relative="seekPlaybackBy"
      @seek-start="beginSeek"
      @stop-playback="stopPlayback"
      @toggle-playback="togglePlayback"
      @toggle-playback-muted="togglePlaybackMuted"
      @update-playback-volume="updatePlaybackVolume"
    />

    <template v-if="playback !== null">
      <audio
        ref="audioPlayer"
        class="playback-audio-element"
        preload="metadata"
        :src="playback.url"
        @durationchange="syncPlaybackDuration"
        @ended="handlePlaybackEnded"
        @pause="handlePlaybackPaused"
        @play="handlePlaybackStarted"
        @timeupdate="syncPlaybackCurrentTime"
      ></audio>
    </template>
  </main>
</template>
