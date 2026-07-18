create or replace function public.refresh_ppt_generation_job_status(p_job_id uuid)
returns table (
  status text,
  completed_items integer,
  progress integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_items integer;
  v_succeeded_items integer;
  v_processing_items integer;
  v_pending_items integer;
  v_failed_items integer;
  v_status text;
  v_progress integer;
  v_error_message text;
begin
  -- Lock the parent job before counting items so concurrent slide requests serialize status updates.
  select total_items
    into v_total_items
  from public.generation_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'Generation job % was not found.', p_job_id;
  end if;

  select
    count(*) filter (where item.status = 'succeeded'),
    count(*) filter (where item.status = 'processing'),
    count(*) filter (where item.status = 'pending'),
    count(*) filter (where item.status = 'failed')
  into v_succeeded_items, v_processing_items, v_pending_items, v_failed_items
  from public.generation_items item
  where item.job_id = p_job_id;

  v_progress := case
    when v_total_items > 0 then round((v_succeeded_items::numeric / v_total_items) * 100)::integer
    else 0
  end;

  v_status := case
    when v_total_items > 0 and v_succeeded_items >= v_total_items then 'succeeded'
    when v_processing_items > 0 then 'processing'
    when v_pending_items > 0 then 'pending'
    when v_failed_items > 0 then 'failed'
    else 'pending'
  end;

  if v_status = 'failed' then
    select item.error_message
      into v_error_message
    from public.generation_items item
    where item.job_id = p_job_id
      and item.status = 'failed'
      and item.error_message is not null
    order by item.updated_at desc
    limit 1;
  end if;

  update public.generation_jobs
  set
    status = v_status,
    completed_items = v_succeeded_items,
    progress = v_progress,
    error_message = v_error_message,
    updated_at = now()
  where id = p_job_id;

  return query select v_status, v_succeeded_items, v_progress;
end;
$$;

grant execute on function public.refresh_ppt_generation_job_status(uuid) to service_role;
