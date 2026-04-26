create table sources (
  id uuid primary key,
  slug varchar(128) not null unique,
  kind text not null constraint sources_kind_check check (kind = any (array['podcast'::text])),
  url text not null,
  url_hash text not null unique,
  created_at timestamptz not null default current_timestamp
);

create table source_snapshots (
  id uuid primary key,
  source_id uuid not null references sources(id),
  version integer not null,
  title text,
  description text,
  recorded_at timestamptz not null default current_timestamp,
  constraint source_snapshots_source_id_version_key unique (source_id, version)
);

create table collector_settings (
  id uuid primary key,
  source_id uuid not null references sources(id),
  plugin_slug varchar(128) not null,
  created_at timestamptz not null default current_timestamp
);

create table collector_setting_snapshots (
  id uuid primary key,
  collector_setting_id uuid not null references collector_settings(id),
  version integer not null,
  enabled boolean not null,
  config jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default current_timestamp,
  constraint collector_setting_snapshots_setting_id_version_key unique (collector_setting_id, version)
);

create table contents (
  id uuid primary key,
  source_id uuid not null references sources(id),
  external_id text not null,
  kind varchar(128) not null,
  published_at timestamptz,
  collected_at timestamptz not null default current_timestamp,
  status text not null constraint contents_status_check check (status = any (array['discovered'::text, 'stored'::text, 'failed'::text])),
  created_at timestamptz not null default current_timestamp,
  constraint contents_source_id_external_id_key unique (source_id, external_id)
);

create table content_snapshots (
  id uuid primary key,
  content_id uuid not null references contents(id),
  version integer not null,
  title text,
  summary text,
  recorded_at timestamptz not null default current_timestamp,
  constraint content_snapshots_content_id_version_key unique (content_id, version)
);

create table jobs (
  id uuid primary key,
  kind varchar(128) not null,
  source_id uuid references sources(id),
  queue_job_id text unique,
  status text not null constraint jobs_status_check check (status = any (array['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text])),
  attempt_count integer not null default 0,
  retryable boolean not null default false,
  failure_message text,
  created_at timestamptz not null default current_timestamp,
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists sources_created_at_idx on sources (created_at);
create index if not exists source_snapshots_version_idx on source_snapshots (version);
create index if not exists collector_settings_source_id_idx on collector_settings (source_id);
create index if not exists collector_setting_snapshots_setting_id_version_idx on collector_setting_snapshots (collector_setting_id, version desc);
create index if not exists contents_source_id_published_at_idx on contents (source_id, published_at desc nulls last);
create index if not exists content_snapshots_content_id_version_idx on content_snapshots (content_id, version desc);
create index if not exists jobs_source_id_created_at_idx on jobs (source_id, created_at desc);
