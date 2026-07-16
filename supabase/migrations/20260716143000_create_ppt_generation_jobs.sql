create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  type text not null,
  status text not null default 'pending',
  progress integer not null default 0,
  total_items integer not null default 0,
  completed_items integer not null default 0,
  request jsonb not null,
  result_path text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generation_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  item_index integer not null,
  item_type text not null,
  status text not null default 'pending',
  input jsonb,
  output_path text,
  attempts integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, item_index, item_type)
);

create index if not exists generation_jobs_status_idx on public.generation_jobs (status, created_at);
create index if not exists generation_items_job_status_idx on public.generation_items (job_id, status, item_index);

alter table public.generation_jobs enable row level security;
alter table public.generation_items enable row level security;

create policy "generation_jobs_service_role_all"
  on public.generation_jobs
  for all
  to service_role
  using (true)
  with check (true);

create policy "generation_items_service_role_all"
  on public.generation_items
  for all
  to service_role
  using (true)
  with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ppt-generations', 'ppt-generations', true, 10485760, array['image/png'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
