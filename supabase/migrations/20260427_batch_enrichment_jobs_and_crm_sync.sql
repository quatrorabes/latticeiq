-- ============================================================================
-- File: supabase/migrations/20260427_batch_enrichment_jobs_and_crm_sync.sql
-- Purpose:
--   1) Add operational tables for batch enrichment jobs
--   2) Track per-contact enrichment results and approvals
--   3) Log outbound CRM sync events
--   4) Keep aggregate job counts/status in sync automatically
-- Notes:
--   - This repo is primarily user_id-centric, so these tables use user_id.
--   - We intentionally do NOT add RLS in this first pass.
-- ============================================================================

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.enrichment_jobs (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,

  mode text not null
    check (mode in ('quick', 'deep')),

  provider text not null default 'perplexity',

  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'partial', 'failed', 'cancelled')),

  selection_type text not null default 'manual'
    check (selection_type in ('manual', 'filter', 'all')),

  requested_contact_ids jsonb not null default '[]'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,

  contact_count integer not null default 0 check (contact_count >= 0),
  success_count integer not null default 0 check (success_count >= 0),
  failure_count integer not null default 0 check (failure_count >= 0),

  error_summary text,

  started_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_enrichment_jobs_user_created_at
  on public.enrichment_jobs (user_id, created_at desc);

create index if not exists idx_enrichment_jobs_user_status
  on public.enrichment_jobs (user_id, status);

create index if not exists idx_enrichment_jobs_mode
  on public.enrichment_jobs (mode);

drop trigger if exists trg_enrichment_jobs_updated_at on public.enrichment_jobs;
create trigger trg_enrichment_jobs_updated_at
before update on public.enrichment_jobs
for each row
execute function public.set_updated_at();

create table if not exists public.enrichment_job_items (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.enrichment_jobs(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,

  mode text not null
    check (mode in ('quick', 'deep')),

  provider text not null default 'perplexity',

  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'skipped')),

  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected', 'not_required')),

  attempt_count integer not null default 0 check (attempt_count >= 0),

  provider_response jsonb,
  normalized_data jsonb,
  field_patch jsonb not null default '{}'::jsonb,
  approved_fields jsonb not null default '[]'::jsonb,

  error_message text,

  started_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_enrichment_job_items_job_contact unique (job_id, contact_id)
);

create index if not exists idx_enrichment_job_items_job_id
  on public.enrichment_job_items (job_id);

create index if not exists idx_enrichment_job_items_user_status
  on public.enrichment_job_items (user_id, status);

create index if not exists idx_enrichment_job_items_contact_id
  on public.enrichment_job_items (contact_id);

create index if not exists idx_enrichment_job_items_job_status
  on public.enrichment_job_items (job_id, status);

create index if not exists idx_enrichment_job_items_approval_status
  on public.enrichment_job_items (approval_status);

create index if not exists idx_enrichment_job_items_normalized_data_gin
  on public.enrichment_job_items using gin (normalized_data);

create index if not exists idx_enrichment_job_items_field_patch_gin
  on public.enrichment_job_items using gin (field_patch);

drop trigger if exists trg_enrichment_job_items_updated_at on public.enrichment_job_items;
create trigger trg_enrichment_job_items_updated_at
before update on public.enrichment_job_items
for each row
execute function public.set_updated_at();

create table if not exists public.crm_sync_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,

  job_id uuid references public.enrichment_jobs(id) on delete set null,
  job_item_id uuid references public.enrichment_job_items(id) on delete set null,

  crm_system text not null
    check (crm_system in ('hubspot', 'salesforce', 'pipedrive')),

  direction text not null default 'outbound'
    check (direction in ('outbound', 'inbound')),

  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed', 'skipped')),

  crm_record_id text,
  payload_sent jsonb not null default '{}'::jsonb,
  response_body jsonb,
  error_message text,

  synced_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_sync_events_user_created_at
  on public.crm_sync_events (user_id, created_at desc);

create index if not exists idx_crm_sync_events_user_status
  on public.crm_sync_events (user_id, status);

create index if not exists idx_crm_sync_events_contact_id
  on public.crm_sync_events (contact_id);

create index if not exists idx_crm_sync_events_crm_system
  on public.crm_sync_events (crm_system);

create index if not exists idx_crm_sync_events_job_id
  on public.crm_sync_events (job_id);

create index if not exists idx_crm_sync_events_job_item_id
  on public.crm_sync_events (job_item_id);

drop trigger if exists trg_crm_sync_events_updated_at on public.crm_sync_events;
create trigger trg_crm_sync_events_updated_at
before update on public.crm_sync_events
for each row
execute function public.set_updated_at();

create or replace function public.refresh_enrichment_job_stats(p_job_id uuid)
returns void
language plpgsql
as $$
declare
  v_total integer := 0;
  v_completed integer := 0;
  v_failed integer := 0;
  v_processing integer := 0;
  v_queued integer := 0;
  v_skipped integer := 0;
  v_status text := 'queued';
begin
  select
    count(*)::integer,
    count(*) filter (where status = 'completed')::integer,
    count(*) filter (where status = 'failed')::integer,
    count(*) filter (where status = 'processing')::integer,
    count(*) filter (where status = 'queued')::integer,
    count(*) filter (where status = 'skipped')::integer
  into
    v_total,
    v_completed,
    v_failed,
    v_processing,
    v_queued,
    v_skipped
  from public.enrichment_job_items
  where job_id = p_job_id;

  if v_total = 0 then
    v_status := 'queued';
  elsif v_processing > 0 then
    v_status := 'processing';
  elsif v_completed = v_total then
    v_status := 'completed';
  elsif v_failed = v_total then
    v_status := 'failed';
  elsif (v_completed + v_failed + v_skipped) = v_total and v_failed > 0 then
    v_status := 'partial';
  elsif v_queued = v_total then
    v_status := 'queued';
  else
    v_status := 'processing';
  end if;

  update public.enrichment_jobs
  set
    contact_count = v_total,
    success_count = v_completed,
    failure_count = v_failed,
    status = v_status,
    started_at = case
      when started_at is null and (v_processing > 0 or v_completed > 0 or v_failed > 0) then now()
      else started_at
    end,
    completed_at = case
      when (v_completed + v_failed + v_skipped) = v_total and v_total > 0 then now()
      else null
    end,
    updated_at = now()
  where id = p_job_id;
end;
$$;

create or replace function public.trg_refresh_enrichment_job_stats()
returns trigger
language plpgsql
as $$
declare
  v_job_id uuid;
begin
  v_job_id := coalesce(new.job_id, old.job_id);
  perform public.refresh_enrichment_job_stats(v_job_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_enrichment_job_items_refresh_job_stats on public.enrichment_job_items;

create trigger trg_enrichment_job_items_refresh_job_stats
after insert or update or delete on public.enrichment_job_items
for each row
execute function public.trg_refresh_enrichment_job_stats();

commit;