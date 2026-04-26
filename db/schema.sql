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

create index sources_created_at_idx on sources (created_at);
create index source_snapshots_version_idx on source_snapshots (version);
