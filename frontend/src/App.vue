<script setup lang="ts">
import { onMounted, ref } from "vue";

import type { CreateSourceRequest, SourceListItem } from "./source-api.js";
import { createSource, listSources } from "./source-api.js";
import { validateCreateSourceRequest } from "./source-form.js";

const sources = ref<SourceListItem[]>([]);
const isCreateFormVisible = ref(false);
const isSubmitting = ref(false);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);
const validationMessage = ref<string | null>(null);
const form = ref<CreateSourceRequest>({
  description: "",
  title: "",
  url: "",
});

onMounted(async () => {
  await refreshSources();
});

function openCreateForm(): void {
  isCreateFormVisible.value = true;
  errorMessage.value = null;
  validationMessage.value = null;
}

function closeCreateForm(): void {
  isCreateFormVisible.value = false;
  validationMessage.value = null;
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

      <div v-if="isCreateFormVisible" class="create-form">
        <label>
          <span>RSS URL</span>
          <input
            v-model="form.url"
            type="url"
            placeholder="https://example.com/feed.xml"
          />
        </label>

        <label>
          <span>Title</span>
          <input v-model="form.title" type="text" placeholder="Optional" />
        </label>

        <label>
          <span>Description</span>
          <textarea
            v-model="form.description"
            rows="4"
            placeholder="Optional"
          ></textarea>
        </label>

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
            :disabled="isSubmitting"
            @click="submitSource"
          >
            {{ isSubmitting ? "Registering..." : "Register" }}
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
        </li>
      </ul>

      <div v-else class="empty-state">
        No sources registered yet. Use the + button to add one.
      </div>
    </section>
  </main>
</template>
