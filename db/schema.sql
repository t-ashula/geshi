create table sources (
    id uuid primary key,
    slug varchar(128) not null unique,
    kind text not null constraint sources_kind_check check (
        kind = any(array ['podcast'::text, 'feed'::text])
    ),
    url text not null,
    url_hash text not null unique,
    created_at timestamptz not null default current_timestamp
);

create table source_snapshots (
    id uuid primary key,
    source_id uuid not null references sources (id),
    version integer not null,
    title text,
    description text,
    recorded_at timestamptz not null default current_timestamp,
    constraint source_snapshots_source_id_version_key unique (source_id, version)
);

create table collector_settings (
    id uuid primary key,
    source_id uuid not null references sources (id),
    plugin_slug varchar(128) not null,
    created_at timestamptz not null default current_timestamp
);

create table collector_setting_snapshots (
    id uuid primary key,
    collector_setting_id uuid not null references collector_settings(id),
    version integer not null,
    enabled boolean not null,
    periodical boolean not null default true,
    periodical_interval_minutes integer not null default 60,
    config jsonb not null default '{}'::jsonb,
    recorded_at timestamptz not null default current_timestamp,
    constraint collector_setting_snapshots_setting_id_version_key unique (collector_setting_id, version)
);

create table collector_plugin_states (
    id uuid primary key,
    collector_setting_id uuid not null references collector_settings(id),
    plugin_slug varchar(128) not null,
    created_at timestamptz not null default current_timestamp,
    constraint collector_plugin_states_collector_setting_id_key unique (collector_setting_id)
);

create table collector_plugin_state_snapshots (
    id uuid primary key,
    collector_plugin_state_id uuid not null references collector_plugin_states(id),
    version integer not null,
    state jsonb not null default '{}'::jsonb,
    recorded_at timestamptz not null default current_timestamp,
    constraint collector_plugin_state_snapshots_state_id_version_key unique (collector_plugin_state_id, version)
);

create table app_settings (
    id uuid primary key,
    profile_slug varchar(128) not null unique,
    created_at timestamptz not null default current_timestamp
);

create table app_setting_snapshots (
    id uuid primary key,
    app_setting_id uuid not null references app_settings (id),
    version integer not null,
    enabled boolean,
    interval_minutes integer,
    recorded_at timestamptz not null default current_timestamp,
    constraint app_setting_snapshots_app_setting_id_version_key unique (app_setting_id, version)
);

create table contents (
    id uuid primary key,
    source_id uuid not null references sources (id),
    external_id text not null,
    content_fingerprint text not null,
    kind varchar(128) not null,
    published_at timestamptz,
    collected_at timestamptz not null default current_timestamp,
    status text not null constraint contents_status_check check (
        status = any(
            array ['discovered'::text, 'stored'::text, 'failed'::text]
        )
    ),
    created_at timestamptz not null default current_timestamp
);

create table content_snapshots (
    id uuid primary key,
    content_id uuid not null references contents (id),
    version integer not null,
    title text,
    summary text,
    recorded_at timestamptz not null default current_timestamp,
    constraint content_snapshots_content_id_version_key unique (content_id, version)
);

create table assets (
    id uuid primary key,
    content_id uuid not null references contents (id),
    kind varchar(128) not null,
    is_primary boolean not null default false,
    observed_fingerprint text not null,
    acquired_fingerprint text,
    created_at timestamptz not null default current_timestamp,
    acquired_at timestamptz
);

create table asset_snapshots (
    id uuid primary key,
    asset_id uuid not null references assets (id),
    version integer not null,
    source_url text,
    storage_key text,
    mime_type text,
    byte_size integer,
    checksum text,
    recorded_at timestamptz not null default current_timestamp,
    constraint asset_snapshots_asset_id_version_key unique (asset_id, version)
);

create table jobs (
    id uuid primary key,
    kind varchar(128) not null,
    source_id uuid references sources (id),
    queue_job_id text unique,
    metadata jsonb not null default '{}'::jsonb,
    status text not null constraint jobs_status_check check (
        status = any(
            array ['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text]
        )
    ),
    attempt_count integer not null default 0,
    retryable boolean not null default false,
    failure_message text,
    created_at timestamptz not null default current_timestamp,
    started_at timestamptz,
    finished_at timestamptz
);

create table transcripts (
    id uuid primary key,
    content_id uuid not null references contents (id),
    source_asset_snapshot_id uuid not null references asset_snapshots (id),
    generation integer not null,
    kind text not null constraint transcripts_kind_check check (
        kind = any(array ['transcript'::text, 'ocr'::text, 'extracted-text'::text])
    ),
    status text not null constraint transcripts_status_check check (
        status = any(
            array ['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text]
        )
    ),
    body text,
    created_at timestamptz not null default current_timestamp,
    started_at timestamptz,
    finished_at timestamptz,
    constraint transcripts_source_asset_snapshot_id_generation_key unique (
        source_asset_snapshot_id,
        generation
    )
);

create table transcript_chunks (
    id uuid primary key,
    transcript_id uuid not null references transcripts (id),
    chunk_index integer not null,
    status text not null constraint transcript_chunks_status_check check (
        status = any(
            array ['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text, 'timed_out'::text]
        )
    ),
    body text,
    source_start_ms integer not null,
    source_end_ms integer not null,
    failure_message text,
    storage_key text,
    created_at timestamptz not null default current_timestamp,
    started_at timestamptz,
    finished_at timestamptz,
    constraint transcript_chunks_transcript_id_chunk_index_key unique (
        transcript_id,
        chunk_index
    )
);

create index if not exists sources_created_at_idx on sources (created_at);

create index if not exists source_snapshots_version_idx on source_snapshots (version);

create index if not exists collector_settings_source_id_idx on collector_settings (source_id);

create index if not exists collector_setting_snapshots_setting_id_version_idx on collector_setting_snapshots (
    collector_setting_id,
    version desc
);

create index if not exists collector_plugin_states_collector_setting_id_idx on collector_plugin_states (
    collector_setting_id
);

create index if not exists collector_plugin_state_snapshots_state_id_version_idx on collector_plugin_state_snapshots (
    collector_plugin_state_id,
    version desc
);

create index if not exists app_setting_snapshots_app_setting_id_version_idx on app_setting_snapshots (app_setting_id, version desc);

create index if not exists contents_source_id_published_at_idx on contents (
    source_id,
    published_at desc nulls last
);

create index if not exists content_snapshots_content_id_version_idx on content_snapshots (content_id, version desc);

create index if not exists assets_content_id_idx on assets (content_id);

create index if not exists contents_source_id_content_fingerprint_idx on contents (
    source_id,
    content_fingerprint
);

create index if not exists assets_content_id_observed_fingerprint_idx on assets (
    content_id,
    observed_fingerprint
);

create index if not exists asset_snapshots_asset_id_version_idx on asset_snapshots (asset_id, version desc);

create index if not exists jobs_source_id_created_at_idx on jobs (source_id, created_at desc);

create index if not exists transcripts_content_id_created_at_idx on transcripts (
    content_id,
    created_at desc
);

create index if not exists transcripts_source_asset_snapshot_id_idx on transcripts (
    source_asset_snapshot_id,
    created_at desc
);

create index if not exists transcript_chunks_transcript_id_chunk_index_idx on transcript_chunks (
    transcript_id,
    chunk_index asc
);
