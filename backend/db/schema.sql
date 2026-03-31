-- dbmate schema dump

create table jobs (
  id uuid primary key,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  run_after timestamptz null
);

create index idx_jobs_kind on jobs (kind);
create index idx_jobs_run_after on jobs (run_after);

create table job_events (
  id uuid primary key,
  job_id uuid not null references jobs (id) on delete cascade,
  runtime_job_id text null,
  occurred_at timestamptz not null default now(),
  status text not null,
  failure_stage text null,
  note text null
);

create index idx_job_events_job_id on job_events (job_id);
create index idx_job_events_runtime_job_id on job_events (runtime_job_id);
create index idx_job_events_job_id_occurred_at_id
  on job_events (job_id, occurred_at desc, id desc);
