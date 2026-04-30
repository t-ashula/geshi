<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

import type {
  ContentDetailAsset,
  ContentDetailItem,
  ContentListItem,
  CreateSourceRequest,
  PeriodicCrawlSettings,
  SourceListItem,
} from "./source-api.js";
import {
  createSource,
  getContentDetail,
  getPeriodicCrawlSettings,
  inspectSource,
  listContents,
  listSources,
  observeSource,
  updatePeriodicCrawlSettings,
  updateSourceCollectorSettings,
} from "./source-api.js";
import {
  sanitizeContentSummary,
  summarizeContentSummary,
} from "./content-summary.js";
import { validateCreateSourceRequest } from "./source-form.js";

type RouteState =
  | { kind: "browse-index" }
  | { feedSlug: string; kind: "browse-feed" }
  | { entryId: string; kind: "browse-entry" }
  | { kind: "settings" }
  | { kind: "not-found" };

const contents = ref<ContentListItem[]>([]);
const contentDetail = ref<ContentDetailItem | null>(null);
const sources = ref<SourceListItem[]>([]);
const isCreateFormVisible = ref(false);
const isInspecting = ref(false);
const isSubmitting = ref(false);
const isObserveSubmitting = ref<string | null>(null);
const isSourceCrawlSubmitting = ref<string | null>(null);
const isSettingsSubmitting = ref(false);
const isSourcesLoading = ref(true);
const isContentsLoading = ref(true);
const isDetailLoading = ref(false);
const isSettingsLoading = ref(true);
const errorMessage = ref<string | null>(null);
const detailErrorMessage = ref<string | null>(null);
const inspectErrorMessage = ref<string | null>(null);
const observeErrorMessage = ref<string | null>(null);
const settingsErrorMessage = ref<string | null>(null);
const sourceCrawlErrorMessage = ref<string | null>(null);
const validationMessage = ref<string | null>(null);
const lastInspectedUrl = ref<string | null>(null);
const routeState = ref<RouteState>(normalizeRoute(window.location.pathname));
const form = ref<CreateSourceRequest>({
  description: "",
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

const selectedSourceSlug = computed(() => {
  switch (routeState.value.kind) {
    case "browse-feed":
      return routeState.value.feedSlug;
    case "browse-entry":
      return contentDetail.value?.source.slug ?? null;
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
  if (selectedSource.value === null) {
    return contents.value;
  }

  return contents.value.filter(
    (content) => content.sourceId === selectedSource.value?.id,
  );
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

watch(
  selectedSource,
  (source) => {
    if (source === null) {
      return;
    }

    sourceCrawlForm.value = {
      enabled: source.periodicCrawlEnabled,
      intervalMinutes: source.periodicCrawlIntervalMinutes,
    };
    sourceCrawlErrorMessage.value = null;
  },
  { immediate: true },
);

onMounted(async () => {
  if (window.location.pathname === "/") {
    replaceLocation("/browse");
    routeState.value = normalizeRoute("/browse");
  }

  window.addEventListener("popstate", syncRouteFromLocation);

  await Promise.all([refreshSources(), refreshContents(), refreshSettings()]);
  await syncDetailWithRoute();
});

onUnmounted(() => {
  window.removeEventListener("popstate", syncRouteFromLocation);
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
  validationMessage.value = null;
}

function closeCreateForm(): void {
  isCreateFormVisible.value = false;
  inspectErrorMessage.value = null;
  lastInspectedUrl.value = null;
  validationMessage.value = null;
}

async function inspectCurrentSource(): Promise<void> {
  const trimmedUrl = form.value.url.trim();

  if (trimmedUrl === "" || lastInspectedUrl.value === trimmedUrl) {
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
      url: trimmedUrl,
    });
    form.value = {
      description: draft.description ?? "",
      sourceSlug: draft.sourceSlug,
      title: draft.title ?? "",
      url: draft.url,
    };
    lastInspectedUrl.value = draft.url;
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

    await refreshSources();
    form.value = {
      description: "",
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

  if (selectedSource.value.collectorSettingsVersion === null) {
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
        baseVersion: selectedSource.value.collectorSettingsVersion,
        enabled: sourceCrawlForm.value.enabled,
        intervalMinutes: Number(sourceCrawlForm.value.intervalMinutes),
      },
    );

    sources.value = sources.value.map((source) =>
      source.id === updatedSource.id ? updatedSource : source,
    );
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

async function refreshContents(): Promise<void> {
  isContentsLoading.value = true;

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
}

async function syncDetailWithRoute(): Promise<void> {
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

function formatDate(value: string | null): string {
  if (value === null) {
    return "Unknown date";
  }

  return new Date(value).toLocaleString();
}

function detailPlayableAssets(detail: ContentDetailItem): ContentDetailAsset[] {
  return detail.assets.filter((asset) => asset.url !== null);
}

function renderContentSummary(summary: string | null): string {
  if (summary === null) {
    return "";
  }

  return sanitizeContentSummary(summary);
}

function renderContentSummaryPreview(summary: string | null): string {
  if (summary === null) {
    return "";
  }

  return summarizeContentSummary(summary);
}
</script>

<template>
  <main class="workspace">
    <header class="workspace-header">
      <div>
        <p class="eyebrow">Geshi</p>
        <h1>
          {{
            routeState.kind === "settings"
              ? "Application Settings"
              : "Browse Archive"
          }}
        </h1>
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
        <button
          v-if="routeState.kind !== 'settings'"
          class="primary-button"
          type="button"
          @click="openCreateForm"
        >
          Add source
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
    </section>

    <template v-else>
      <section v-if="isCreateFormVisible" class="create-shell">
        <div class="create-shell-header">
          <div>
            <p class="eyebrow">Register source</p>
            <h2>Add podcast feed</h2>
          </div>
          <button class="ghost-button" type="button" @click="closeCreateForm">
            Close
          </button>
        </div>

        <div class="create-grid">
          <label>
            <span>RSS URL</span>
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
            <div>
              <p class="eyebrow">Feeds</p>
              <h2>Sources</h2>
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
                <span class="source-row-title">
                  {{ source.title ?? source.slug }}
                </span>
                <span class="source-row-url">{{ source.url }}</span>
                <span class="source-row-meta">
                  {{ source.kind }} ·
                  {{
                    source.periodicCrawlEnabled
                      ? `Auto ${source.periodicCrawlIntervalMinutes}m`
                      : "Auto off"
                  }}
                </span>
              </button>
            </li>
          </ul>

          <div v-else class="empty-state">
            No sources registered yet. Add a feed to get started.
          </div>

          <section v-if="selectedSource" class="source-settings-card">
            <div class="detail-section-header">
              <div>
                <p class="eyebrow">Per source</p>
                <h3>Autonomous Crawl</h3>
              </div>
            </div>

            <p v-if="sourceCrawlErrorMessage" class="feedback error">
              {{ sourceCrawlErrorMessage }}
            </p>

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

            <div class="actions">
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
          </section>
        </aside>

        <section class="pane pane-contents">
          <div class="pane-header">
            <div>
              <p class="eyebrow">Entries</p>
              <h2>{{ routeHeadline }}</h2>
            </div>
            <div class="pane-actions">
              <button
                type="button"
                class="ghost-button"
                @click="refreshContents"
              >
                Refresh
              </button>
              <button
                v-if="selectedSource"
                type="button"
                class="secondary-button"
                :disabled="isObserveSubmitting === selectedSource.id"
                @click="runObserve(selectedSource.id)"
              >
                {{
                  isObserveSubmitting === selectedSource.id
                    ? "Running..."
                    : "Observe"
                }}
              </button>
            </div>
          </div>

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
                <span class="content-row-title">
                  {{ content.title ?? "Untitled entry" }}
                </span>
                <span class="content-row-meta">
                  {{ formatDate(content.publishedAt) }} · {{ content.status }}
                </span>
                <span v-if="content.summary" class="content-row-summary">
                  {{ renderContentSummaryPreview(content.summary) }}
                </span>
              </button>
            </li>
          </ul>

          <div v-else class="empty-state">No contents yet.</div>
        </section>

        <section class="pane pane-detail">
          <div class="pane-header">
            <div>
              <p class="eyebrow">Detail</p>
              <h2>
                {{
                  contentDetail?.title ??
                  (routeState.kind === "browse-entry"
                    ? "Entry detail"
                    : "Select an entry")
                }}
              </h2>
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
            </div>

            <div
              v-if="contentDetail.summary"
              class="detail-summary"
              v-html="renderContentSummary(contentDetail.summary)"
            ></div>

            <section class="detail-section">
              <div class="detail-section-header">
                <h3>Playable assets</h3>
                <span class="detail-count">
                  {{ detailPlayableAssets(contentDetail).length }}
                </span>
              </div>

              <div
                v-if="detailPlayableAssets(contentDetail).length === 0"
                class="empty-inline"
              >
                No playable assets stored yet.
              </div>

              <ul v-else class="asset-list">
                <li
                  v-for="asset in detailPlayableAssets(contentDetail)"
                  :key="asset.id"
                  class="asset-card"
                >
                  <div class="asset-card-header">
                    <strong>{{ asset.kind }}</strong>
                    <span class="asset-meta">
                      {{ asset.primary ? "Primary" : "Supplemental" }}
                    </span>
                  </div>

                  <audio v-if="asset.mimeType?.startsWith('audio/')" controls>
                    <source
                      :src="asset.url ?? undefined"
                      :type="asset.mimeType"
                    />
                  </audio>

                  <a
                    v-else-if="asset.url"
                    class="asset-link"
                    :href="asset.url"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open asset
                  </a>

                  <p class="asset-meta">
                    {{ asset.mimeType ?? "Unknown mime" }}
                    <template v-if="asset.byteSize !== null">
                      · {{ asset.byteSize }} bytes
                    </template>
                  </p>
                </li>
              </ul>
            </section>
          </article>
        </section>
      </section>
    </template>
  </main>
</template>
