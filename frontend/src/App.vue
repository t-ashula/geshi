<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

type HealthState = "idle" | "loading" | "healthy" | "unhealthy";

const state = ref<HealthState>("idle");
const detail = ref("Waiting for backend health check.");

const headline = computed(() => {
  if (state.value === "healthy") {
    return "backend server is healthy";
  }

  if (state.value === "unhealthy") {
    return "backend server is unavailable";
  }

  if (state.value === "loading") {
    return "checking backend server";
  }

  return "frontend bootstrap";
});

async function checkHealth(): Promise<void> {
  state.value = "loading";
  detail.value = "Requesting GET /health from backend.";

  try {
    const response = await fetch("/api/health");

    if (!response.ok) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    const payload = (await response.json()) as { ok?: boolean };

    if (!payload.ok) {
      throw new Error("Backend responded without ok=true.");
    }

    state.value = "healthy";
    detail.value = "Frontend can reach the backend health endpoint.";
  } catch (error) {
    state.value = "unhealthy";
    detail.value =
      error instanceof Error ? error.message : "Unknown error occurred.";
  }
}

onMounted(() => {
  void checkHealth();
});
</script>

<template>
  <main class="app">
    <section class="panel">
      <p class="eyebrow">
        Geshi Frontend
      </p>
      <h1>{{ headline }}</h1>
      <p class="detail">
        {{ detail }}
      </p>
      <button
        class="button"
        type="button"
        @click="checkHealth"
      >
        Retry
      </button>
    </section>
  </main>
</template>
