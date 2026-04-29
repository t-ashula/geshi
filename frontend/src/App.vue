<script setup lang="ts">
import { onMounted, ref } from "vue";

import type {
  ContentListItem,
  CreateSourceRequest,
  JobListItem,
  SourceListItem,
} from "./source-api.js";
import {
  createSource,
  getJob,
  inspectSource,
  listContents,
  listSources,
  observeSource,
} from "./source-api.js";
import { validateCreateSourceRequest } from "./source-form.js";

const contents = ref<ContentListItem[]>([]);
const sources = ref<SourceListItem[]>([]);
const isCreateFormVisible = ref(false);
const isInspecting = ref(false);
const isSubmitting = ref(false);
const isObserveSubmitting = ref<string | null>(null);
const isLoading = ref(true);
const isContentsLoading = ref(true);
const errorMessage = ref<string | null>(null);
const inspectErrorMessage = ref<string | null>(null);
const observeErrorMessage = ref<string | null>(null);
const latestJob = ref<JobListItem | null>(null);
const validationMessage = ref<string | null>(null);
const lastInspectedUrl = ref<string | null>(null);
const form = ref<CreateSourceRequest>({
  description: "",
  sourceSlug: "",
  title: "",
  url: "",
});

onMounted(async () => {
  await refreshSources();
  await refreshContents();
});

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
    const result = await inspectSource({
      url: trimmedUrl,
    });

    if (!result.ok) {
      inspectErrorMessage.value = result.error.message;
      return;
    }

    form.value = {
      description: result.value.description ?? "",
      sourceSlug: result.value.sourceSlug,
      title: result.value.title ?? "",
      url: result.value.url,
    };
    lastInspectedUrl.value = result.value.url;
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
    await createSource(form.value);
    await refreshSources();
    form.value = {
      description: "",
      sourceSlug: "",
      title: "",
      url: "",
    };
    closeCreateForm();
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
    const job = await observeSource(sourceId);
    latestJob.value = job;
    await refreshJob(job.id);
    await refreshContents();
  } catch (error) {
    observeErrorMessage.value =
      error instanceof Error ? error.message : "Observe job enqueue failed.";
  } finally {
    isObserveSubmitting.value = null;
  }
}

async function refreshJob(jobId: string): Promise<void> {
  latestJob.value = await getJob(jobId);
}

async function refreshSources(): Promise<void> {
  isLoading.value = true;

  try {
    sources.value = await listSources();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to load sources.";
  } finally {
    isLoading.value = false;
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
</script>

<template>
  <main class="page">
    <section class="panel">
      <header class="panel-header">
        <div>
          <p class="eyebrow">Source Registry</p>
          <h1>Podcast RSS Sources</h1>
        </div>
        <button class="create-button" type="button" @click="openCreateForm">
          +
        </button>
      </header>

      <p v-if="errorMessage" class="feedback error">{{ errorMessage }}</p>
      <p v-if="observeErrorMessage" class="feedback error">
        {{ observeErrorMessage }}
      </p>

      <div v-if="isCreateFormVisible" class="create-form">
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

        <label>
          <span>Description</span>
          <textarea
            v-model="form.description"
            :disabled="isInspecting || isSubmitting"
            rows="4"
            placeholder="Optional"
          ></textarea>
        </label>

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
      </div>

      <div v-if="isLoading" class="empty-state">Loading sources...</div>

      <ul v-else-if="sources.length > 0" class="source-list">
        <li v-for="source in sources" :key="source.id" class="source-card">
          <div class="source-card-header">
            <h2>{{ source.title ?? source.slug }}</h2>
            <span class="kind">{{ source.kind }}</span>
          </div>
          <p v-if="source.description" class="description">
            {{ source.description }}
          </p>
          <a :href="source.url" target="_blank" rel="noreferrer">{{
            source.url
          }}</a>
          <div class="source-actions">
            <button
              type="button"
              class="primary-button"
              :disabled="isObserveSubmitting === source.id"
              @click="runObserve(source.id)"
            >
              {{
                isObserveSubmitting === source.id ? "Running..." : "Run Observe"
              }}
            </button>
          </div>
        </li>
      </ul>

      <div v-else class="empty-state">
        No sources registered yet. Use the + button to add one.
      </div>

      <section class="subpanel">
        <div class="subpanel-header">
          <h2>Latest Job</h2>
        </div>

        <div v-if="latestJob" class="job-card">
          <p><strong>Status:</strong> {{ latestJob.status }}</p>
          <p><strong>Kind:</strong> {{ latestJob.kind }}</p>
          <p><strong>Attempts:</strong> {{ latestJob.attemptCount }}</p>
          <p v-if="latestJob.failureMessage" class="failure-message">
            {{ latestJob.failureMessage }}
          </p>
        </div>

        <div v-else class="empty-state">No observe job has run yet.</div>
      </section>

      <section class="subpanel">
        <div class="subpanel-header">
          <h2>Contents</h2>
          <button
            type="button"
            class="secondary-button"
            @click="refreshContents"
          >
            Refresh
          </button>
        </div>

        <div v-if="isContentsLoading" class="empty-state">
          Loading contents...
        </div>

        <ul v-else-if="contents.length > 0" class="content-list">
          <li
            v-for="content in contents"
            :key="content.id"
            class="content-card"
          >
            <div class="content-card-header">
              <h3>{{ content.title ?? content.id }}</h3>
              <span class="kind">{{ content.status }}</span>
            </div>
            <p v-if="content.summary" class="description">
              {{ content.summary }}
            </p>
            <p class="meta">
              source={{ content.sourceId }} / published={{
                content.publishedAt ?? "unknown"
              }}
            </p>
          </li>
        </ul>

        <div v-else class="empty-state">
          No contents collected yet. Run observe on a source.
        </div>
      </section>
    </section>
  </main>
</template>
