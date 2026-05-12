<script setup lang="ts">
import type { PlaybackState } from "../playback.js";

const props = defineProps<{
  duration: number;
  isPlaybackActive: boolean;
  isPlaybackMuted: boolean;
  playback: PlaybackState;
  progressMax: number;
  seekValue: number;
  sourceLabel: string;
  volumeValue: number;
}>();

const emit = defineEmits<{
  seekCommit: [value: number];
  seekPreview: [value: number];
  seekRelative: [deltaSeconds: number];
  seekStart: [];
  stopPlayback: [];
  togglePlayback: [];
  togglePlaybackMuted: [];
  updatePlaybackVolume: [value: number];
}>();

function formatPlaybackTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function numberFromEvent(event: Event): number {
  return Number((event.target as HTMLInputElement).value);
}
</script>

<template>
  <section class="playback-dock">
    <div class="playback-dock-meta">
      <strong class="playback-dock-title">{{ props.playback.contentTitle }}</strong>
      <div class="playback-dock-caption">
        <span class="playback-chip">{{ props.sourceLabel }}</span>
        <span class="playback-chip playback-chip-muted">
          {{ props.playback.assetKind }}
        </span>
      </div>
    </div>

    <div class="playback-dock-progress">
      <input
        class="playback-seek"
        type="range"
        min="0"
        :max="props.progressMax"
        :value="props.seekValue"
        step="0.1"
        @change="emit('seekCommit', numberFromEvent($event))"
        @input="emit('seekPreview', numberFromEvent($event))"
        @pointerdown="emit('seekStart')"
        @pointerup="emit('seekCommit', numberFromEvent($event))"
      />
      <div class="playback-time-pill">
        {{ formatPlaybackTime(props.seekValue) }} /
        {{ formatPlaybackTime(props.duration) }}
      </div>
    </div>

    <div class="playback-dock-controls">
      <div class="playback-volume-shell">
        <div class="playback-volume-panel">
          <input
            class="playback-volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="props.volumeValue"
            @input="emit('updatePlaybackVolume', numberFromEvent($event))"
          />
        </div>
        <button
          type="button"
          class="playback-icon-button"
          :aria-label="
            props.isPlaybackMuted ? 'Unmute playback' : 'Mute playback'
          "
          @click="emit('togglePlaybackMuted')"
        >
          <svg
            v-if="props.isPlaybackMuted"
            aria-hidden="true"
            class="playback-button-icon"
            viewBox="0 0 24 24"
          >
            <path
              d="M5 10h4l5-4v12l-5-4H5zm11-2 3 8M19 8l-3 8"
              fill="none"
              stroke="currentColor"
              stroke-linecap="square"
              stroke-width="1.8"
            />
          </svg>
          <svg
            v-else
            aria-hidden="true"
            class="playback-button-icon"
            viewBox="0 0 24 24"
          >
            <path
              d="M5 10h4l5-4v12l-5-4H5m11-3a3 3 0 0 1 0 6m1.5-9a7 7 0 0 1 0 12"
              fill="none"
              stroke="currentColor"
              stroke-linecap="square"
              stroke-width="1.8"
            />
          </svg>
        </button>
      </div>

      <button
        type="button"
        class="playback-icon-button"
        aria-label="Seek backward 10 seconds"
        @click="emit('seekRelative', -10)"
      >
        <span class="playback-skip-label">10</span>
      </button>
      <button
        type="button"
        class="playback-icon-button playback-icon-button-primary"
        :aria-label="
          props.isPlaybackActive ? 'Pause playback' : 'Start playback'
        "
        @click="emit('togglePlayback')"
      >
        <svg
          v-if="props.isPlaybackActive"
          aria-hidden="true"
          class="playback-button-icon"
          viewBox="0 0 24 24"
        >
          <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
        </svg>
        <svg
          v-else
          aria-hidden="true"
          class="playback-button-icon"
          viewBox="0 0 24 24"
        >
          <path d="M8 6v12l10-6z" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        class="playback-icon-button"
        aria-label="Seek forward 10 seconds"
        @click="emit('seekRelative', 10)"
      >
        <span class="playback-skip-label">10</span>
      </button>
      <button
        type="button"
        class="playback-icon-button"
        aria-label="Stop playback"
        @click="emit('stopPlayback')"
      >
        <svg aria-hidden="true" class="playback-button-icon" viewBox="0 0 24 24">
          <path d="M7 7h10v10H7z" fill="currentColor" />
        </svg>
      </button>
    </div>
  </section>
</template>
