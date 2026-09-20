-- Ghost call: stale ringing/active temizligi + gorusme_baslat oncesi expire

-- Ringing > 60sn → missed (callee) / cancelled (caller tarafi bitmedi)
-- Active > 3 saat → ended (kopma / unmount kacirma)

create or replace function public.gorusme_stale_temizle()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int := 0;
  v_ring int;
  v_act int;
begin
  update public.direct_calls set
    status = 'missed',
    ended_at = now(),
    end_reason = 'ring_timeout'
  where status = 'ringing'
    and started_at < now() - interval '60 seconds';
  get diagnostics v_ring = row_count;

  update public.direct_calls set
    status = 'ended',
    ended_at = now(),
    end_reason = 'stale_active'
  where status = 'active'
    and coalesce(answered_at, started_at) < now() - interval '3 hours';
  get diagnostics v_act = row_count;

  v_n := coalesce(v_ring, 0) + coalesce(v_act, 0);
  return v_n;
end;
$$;

grant execute on function public.gorusme_stale_temizle() to authenticated;

create or replace function public.gorusme_baslat(
  p_thread_id uuid,
  p_call_type text
)
returns public.direct_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_peer uuid;
  v_guest boolean;
  v_type text := lower(trim(p_call_type));
  v_row public.direct_calls%rowtype;
  v_channel text;
  v_stale public.direct_calls%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_type not in ('audio', 'video') then raise exception 'Gecersiz cagri turu'; end if;

  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir arama yapamaz'; end if;

  if not exists (
    select 1 from public.message_thread_members
    where thread_id = p_thread_id and user_id = v_uid
  ) then
    raise exception 'Not a thread member';
  end if;

  select user_id into v_peer
  from public.message_thread_members
  where thread_id = p_thread_id and user_id <> v_uid
  limit 1;
  if v_peer is null then raise exception 'Karsi taraf yok'; end if;

  -- Once stale cagrilari temizle (bu cift + global ringing timeout)
  perform public.gorusme_stale_temizle();

  -- Bu ciftteki eski ringing/active hâlâ varsa: gerçekten taze mi?
  select * into v_stale
  from public.direct_calls
  where status in ('ringing', 'active')
    and (
      (caller_id = v_uid and callee_id = v_peer)
      or (caller_id = v_peer and callee_id = v_uid)
    )
  order by started_at desc
  limit 1;

  if found then
    -- Ringing ve 20sn+ eskiyse zorla kapat (UI unmount kaçırdıysa)
    if v_stale.status = 'ringing' and v_stale.started_at < now() - interval '20 seconds' then
      update public.direct_calls set
        status = case when v_stale.caller_id = v_uid then 'cancelled' else 'missed' end,
        ended_at = now(),
        ended_by = v_uid,
        end_reason = 'stale_replaced'
      where id = v_stale.id;
    elsif v_stale.status = 'active'
      and coalesce(v_stale.answered_at, v_stale.started_at) < now() - interval '30 minutes'
    then
      update public.direct_calls set
        status = 'ended',
        ended_at = now(),
        ended_by = v_uid,
        end_reason = 'stale_replaced'
      where id = v_stale.id;
    else
      raise exception 'Zaten aktif bir gorusme var';
    end if;
  end if;

  v_channel := 'dm_call_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.direct_calls (
    thread_id, caller_id, callee_id, call_type, status, channel_name
  ) values (
    p_thread_id, v_uid, v_peer, v_type, 'ringing', v_channel
  ) returning * into v_row;

  insert into public.direct_messages (thread_id, sender_id, body, message_type)
  values (
    p_thread_id,
    v_uid,
    case when v_type = 'video' then '📹 Görüntülü arama' else '📞 Sesli arama' end,
    'system'
  );

  update public.message_threads set
    updated_at = now(),
    last_message_at = now(),
    last_message_preview = case when v_type = 'video' then 'Görüntülü arama' else 'Sesli arama' end
  where id = p_thread_id;

  return v_row;
end;
$$;

grant execute on function public.gorusme_baslat(uuid, text) to authenticated;
