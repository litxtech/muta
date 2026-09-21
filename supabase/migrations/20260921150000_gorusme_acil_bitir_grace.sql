-- Ghost arama: app_closed yeni aramayi 3sn grace ile ezmesin
create or replace function public.gorusme_benim_aktifleri_bitir(p_reason text default 'app_closed')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n int;
  v_grace interval := interval '0 seconds';
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if coalesce(p_reason, '') = 'app_closed' then
    v_grace := interval '3 seconds';
  end if;

  update public.direct_calls set
    status = case
      when status = 'ringing' and caller_id = v_uid then 'cancelled'
      when status = 'ringing' then 'missed'
      else 'ended'
    end,
    ended_at = now(),
    ended_by = v_uid,
    end_reason = coalesce(nullif(trim(p_reason), ''), 'app_closed')
  where status in ('ringing', 'active')
    and (caller_id = v_uid or callee_id = v_uid)
    and started_at < now() - v_grace;

  get diagnostics v_n = row_count;
  return coalesce(v_n, 0);
end;
$$;

grant execute on function public.gorusme_benim_aktifleri_bitir(text) to authenticated;
