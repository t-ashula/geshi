#!/bin/sh

set -eu

mode="${1:-basic}"
root_dir="$(CDPATH='' cd -- "$(dirname "$0")/../.." && pwd)"
. "$root_dir/test/scripts/e2e-common.sh"

wait_for_http() {
  sh test/scripts/wait-for-http.sh "$1" "${2:-30}"
}

poll_for_content_id() {
  attempts=0

  while [ "$attempts" -lt 60 ]; do
    content_id="$(curl -fsS "http://127.0.0.1:$backend_port/api/v1/contents" \
      | jq -r --arg source_id "$source_id" '.data[] | select(.sourceId == $source_id) | .id' \
      | head -n 1)"

    if [ -n "$content_id" ] && [ "$content_id" != "null" ]; then
      printf '%s' "$content_id"
      return 0
    fi

    attempts=$((attempts + 1))
    sleep 1
  done

  echo "content was not created in time" >&2
  return 1
}

poll_for_stored_asset_url() {
  attempts=0

  while [ "$attempts" -lt 60 ]; do
    detail="$(curl -fsS "http://127.0.0.1:$backend_port/api/v1/contents/$content_id")"
    asset_url="$(printf '%s' "$detail" | jq -r '.data.assets[] | select(.url != null) | .url' | head -n 1)"
    status="$(printf '%s' "$detail" | jq -r '.data.status')"

    if [ -n "$asset_url" ] && [ "$asset_url" != "null" ] && [ "$status" = "stored" ]; then
      printf '%s' "$asset_url"
      return 0
    fi

    attempts=$((attempts + 1))
    sleep 1
  done

  echo "recorded asset was not stored in time" >&2
  return 1
}

run_basic() {
  log_dir="$root_dir/tmp/e2e"
  backend_log="$log_dir/backend.log"
  frontend_log="$log_dir/frontend.log"
  source_server_log="$log_dir/source-server.log"
  observe_worker_log="$log_dir/observe-worker.log"
  acquire_worker_log="$log_dir/acquire-worker.log"

  frontend_port="${E2E_FRONTEND_PORT:-4273}"
  backend_port="${E2E_BACKEND_PORT:-3300}"
  source_server_port="${E2E_SOURCE_SERVER_PORT:-3501}"
  storage_root_dir="$root_dir/.data/e2e-storage"

  mkdir -p "$log_dir" "$storage_root_dir"

  e2e_prepare_db
  e2e_start_source_server "$source_server_port" "$source_server_log" >/dev/null
  e2e_start_backend "$backend_port" "$storage_root_dir" "$storage_root_dir" "$backend_log" >/dev/null
  e2e_start_worker "worker:observe-source" "$storage_root_dir" "$storage_root_dir" "$observe_worker_log" >/dev/null
  e2e_start_worker "worker:acquire-content" "$storage_root_dir" "$storage_root_dir" "$acquire_worker_log" >/dev/null
  e2e_start_frontend "$backend_port" "$frontend_port" "$frontend_log" >/dev/null

  wait_for_http "http://127.0.0.1:$source_server_port/feeds/podcast.xml" 30
  wait_for_http "http://127.0.0.1:$backend_port/api/v1/sources" 30
  wait_for_http "http://127.0.0.1:$frontend_port" 30

  E2E_FRONTEND_URL="http://127.0.0.1:$frontend_port" \
  E2E_SOURCE_FEED_URL="http://127.0.0.1:$source_server_port/feeds/podcast.xml" \
  E2E_NON_RSS_SOURCE_URL="http://127.0.0.1:$source_server_port/feeds/not-rss.xml" \
    npx playwright test --config test/playwright.config.ts
}

run_transcript() {
  log_dir="$root_dir/tmp/e2e-transcript"
  backend_log="$log_dir/backend.log"
  frontend_log="$log_dir/frontend.log"
  source_server_log="$log_dir/source-server.log"
  fake_scribe_log="$log_dir/fake-scribe.log"
  observe_worker_log="$log_dir/observe-worker.log"
  acquire_worker_log="$log_dir/acquire-worker.log"
  transcript_split_worker_log="$log_dir/transcript-split-worker.log"
  transcript_chunk_worker_log="$log_dir/transcript-chunk-worker.log"
  fixture_audio_path="$log_dir/botchan-8min.mp3"

  frontend_port="${E2E_FRONTEND_PORT:-4274}"
  backend_port="${E2E_BACKEND_PORT:-3301}"
  source_server_port="${E2E_SOURCE_SERVER_PORT:-3502}"
  use_real_scribe="${E2E_USE_REAL_SCRIBE:-0}"
  scribe_port="${E2E_SCRIBE_PORT:-58001}"
  scribe_base_url="${E2E_SCRIBE_BASE_URL:-http://127.0.0.1:$scribe_port}"
  storage_root_dir="$root_dir/.data/e2e-transcript-storage"
  work_storage_root_dir="$root_dir/.data/e2e-transcript-work-storage"
  source_mp3_path="${E2E_BOTCHAN_SOURCE_MP3:-$root_dir/tmp/botchan/botchan_01_natsume_64kb.mp3}"

  mkdir -p "$log_dir" "$storage_root_dir" "$work_storage_root_dir"

  if [ ! -f "$source_mp3_path" ]; then
    echo "botchan source mp3 not found: $source_mp3_path" >&2
    exit 1
  fi

  ffmpeg -y -i "$source_mp3_path" -t 480 -c copy "$fixture_audio_path" >/dev/null 2>&1

  e2e_prepare_db

  E2E_SOURCE_SERVER_PORT="$source_server_port" E2E_BOTCHAN_AUDIO_PATH="$fixture_audio_path" \
    node --import tsx test/server/main.ts >"$source_server_log" 2>&1 &
  source_server_pid=$!
  e2e_register_pid "$source_server_pid"

  if [ "$use_real_scribe" = "1" ]; then
    wait_for_http "$scribe_base_url/docs" 30
  else
    E2E_SCRIBE_PORT="$scribe_port" \
      node --import tsx test/server/fake-scribe.ts >"$fake_scribe_log" 2>&1 &
    fake_scribe_pid=$!
    e2e_register_pid "$fake_scribe_pid"
    wait_for_http "$scribe_base_url/docs" 30
  fi

  PGDATABASE=geshi_test \
  PGPORT=55433 \
  PORT="$backend_port" \
  GESHI_STORAGE_ROOT_DIR="$storage_root_dir" \
  GESHI_WORK_STORAGE_ROOT_DIR="$work_storage_root_dir" \
  GESHI_SCRIBE_BASE_URL="$scribe_base_url" \
    npm run -s backend:start >"$backend_log" 2>&1 &
  backend_pid=$!
  e2e_register_pid "$backend_pid"

  e2e_start_worker_with_scribe "worker:observe-source" "$storage_root_dir" "$work_storage_root_dir" "$scribe_base_url" "$observe_worker_log" >/dev/null
  e2e_start_worker_with_scribe "worker:acquire-content" "$storage_root_dir" "$work_storage_root_dir" "$scribe_base_url" "$acquire_worker_log" >/dev/null
  e2e_start_worker_with_scribe "worker:transcript-split" "$storage_root_dir" "$work_storage_root_dir" "$scribe_base_url" "$transcript_split_worker_log" >/dev/null
  e2e_start_worker_with_scribe "worker:transcript-chunk" "$storage_root_dir" "$work_storage_root_dir" "$scribe_base_url" "$transcript_chunk_worker_log" >/dev/null
  e2e_start_frontend "$backend_port" "$frontend_port" "$frontend_log" >/dev/null

  wait_for_http "http://127.0.0.1:$source_server_port/feeds/botchan.xml" 30
  wait_for_http "http://127.0.0.1:$backend_port/api/v1/sources" 30
  wait_for_http "http://127.0.0.1:$frontend_port" 30

  E2E_FRONTEND_URL="http://127.0.0.1:$frontend_port" \
  E2E_TRANSCRIPT_SOURCE_FEED_URL="http://127.0.0.1:$source_server_port/feeds/botchan.xml" \
    npx playwright test --config test/playwright.config.ts test/cases/transcript.spec.ts
}

run_recording() {
  log_dir="$root_dir/tmp/e2e-recording"
  backend_log="$log_dir/backend.log"
  source_server_log="$log_dir/source-server.log"
  observe_worker_log="$log_dir/observe-worker.log"
  recording_scheduler_log="$log_dir/recording-scheduler.log"
  fixture_audio_path="$log_dir/botchan-streaming.mp3"
  fixture_playlist_dir="$log_dir/playlist"

  backend_port="${E2E_BACKEND_PORT:-3302}"
  source_server_port="${E2E_SOURCE_SERVER_PORT:-3503}"
  storage_root_dir="$root_dir/.data/e2e-recording-storage"
  work_storage_root_dir="$root_dir/.data/e2e-recording-work-storage"
  stream_source_url="http://localhost:$source_server_port/sources/streams/live-1"
  source_mp3_path="${E2E_BOTCHAN_SOURCE_MP3:-$root_dir/tmp/botchan/botchan_01_natsume_64kb.mp3}"

  mkdir -p "$log_dir" "$storage_root_dir" "$work_storage_root_dir" "$fixture_playlist_dir"

  if [ ! -f "$source_mp3_path" ]; then
    echo "botchan source mp3 not found: $source_mp3_path" >&2
    exit 1
  fi

  ffmpeg -y -i "$source_mp3_path" -t 30 -c copy "$fixture_audio_path" >/dev/null 2>&1
  ffmpeg -y -i "$fixture_audio_path" -c copy -f hls -hls_time 10 -hls_list_size 0 -hls_playlist_type vod \
    -hls_segment_filename "$fixture_playlist_dir/live-1-%03d.ts" \
    "$fixture_playlist_dir/live-1.m3u8" >/dev/null 2>&1

  e2e_prepare_db

  E2E_SOURCE_SERVER_PORT="$source_server_port" E2E_BOTCHAN_AUDIO_PATH="$fixture_audio_path" E2E_BOTCHAN_PLAYLIST_DIR="$fixture_playlist_dir" \
    node --import tsx test/server/main.ts >"$source_server_log" 2>&1 &
  source_server_pid=$!
  e2e_register_pid "$source_server_pid"

  e2e_start_backend "$backend_port" "$storage_root_dir" "$work_storage_root_dir" "$backend_log" >/dev/null
  e2e_start_worker "worker:observe-source" "$storage_root_dir" "$work_storage_root_dir" "$observe_worker_log" >/dev/null
  e2e_start_worker "worker:recording-scheduler" "$storage_root_dir" "$work_storage_root_dir" "$recording_scheduler_log" >/dev/null

  wait_for_http "$stream_source_url" 30
  wait_for_http "http://127.0.0.1:$backend_port/api/v1/sources" 30

  inspect_payload="$(curl -fsS \
    -H 'content-type: application/json' \
    -d "{\"pluginSlug\":\"streaming-plugin-example\",\"url\":\"$stream_source_url\"}" \
    "http://127.0.0.1:$backend_port/api/v1/sources/inspect")"

  source_slug="$(printf '%s' "$inspect_payload" | jq -r '.data.sourceSlug')"
  title="$(printf '%s' "$inspect_payload" | jq -r '.data.title')"
  description="$(printf '%s' "$inspect_payload" | jq -r '.data.description')"

  create_payload="$(curl -fsS \
    -H 'content-type: application/json' \
    -d "$(jq -cn \
      --arg pluginSlug "streaming-plugin-example" \
      --arg url "$stream_source_url" \
      --arg sourceSlug "$source_slug" \
      --arg title "$title" \
      --arg description "$description" \
      '{pluginSlug:$pluginSlug,url:$url,sourceSlug:$sourceSlug,title:$title,description:$description}')" \
    "http://127.0.0.1:$backend_port/api/v1/sources")"

  source_id="$(printf '%s' "$create_payload" | jq -r '.data.id')"

  curl -fsS -X POST \
    "http://127.0.0.1:$backend_port/api/v1/sources/$source_id/observe" >/dev/null

  content_id="$(poll_for_content_id)"
  asset_url="$(poll_for_stored_asset_url)"
  content_detail="$(curl -fsS "http://127.0.0.1:$backend_port/api/v1/contents/$content_id")"
  asset_mime_type="$(printf '%s' "$content_detail" | jq -r '.data.assets[] | select(.url != null) | .mimeType' | head -n 1)"

  test "$asset_mime_type" = "audio/mpeg"
  curl -fsS "http://127.0.0.1:$backend_port$asset_url" >/dev/null

  echo "recording e2e passed"
  echo "source_id=$source_id"
  echo "content_id=$content_id"
  echo "asset_url=$asset_url"
}

e2e_init_cleanup
trap e2e_cleanup EXIT INT TERM

cd "$root_dir"

case "$mode" in
  basic)
    run_basic
    ;;
  transcript)
    run_transcript
    ;;
  recording)
    run_recording
    ;;
  *)
    echo "usage: sh test/scripts/run-e2e.sh [basic|transcript|recording]" >&2
    exit 2
    ;;
esac
