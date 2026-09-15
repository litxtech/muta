-- Cikis: host'un tum canli odalari + yayinlari kapat (feed'den dus)
-- Admin: canli yayin listesi + zorla kapat

-- ---------------------------------------------------------------------------
-- Host cikisinda / temizlik: kendi canli iceriklerini kapat
-- ---------------------------------------------------------------------------
create or replace function public.cikis_canli_icerikleri_kapat()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room_ids uuid[];
  v_rid uuid;
  v_rooms int := 0;
  v_yayinlar int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(array_agg(r.id), '{}'::uuid[])
  into v_room_ids
  from public.rooms r
  where r.host_id = v_uid
    and r.is_live = true;

  foreach v_rid in array v_room_ids
  loop
    update public.rooms set
      is_live = false,
      ended_at = coalesce(ended_at, now()),
      listener_count = 0
    where id = v_rid;

    update public.room_seats
    set user_id = null, is_muted = false
    where room_id = v_rid;

    delete from public.room_members where room_id = v_rid;

    begin
      update public.game_sessions
      set status = 'cancelled',
          finished_at = coalesce(finished_at, now()),
          ends_at = coalesce(ends_at, now())
      where room_id = v_rid
        and status in ('waiting', 'countdown', 'playing');
    exception when undefined_table then
      null;
    when others then
      null;
    end;

    v_rooms := v_rooms + 1;
  end loop;

  update public.live_sessions
  set
    is_live = false,
    ended_at = coalesce(ended_at, now()),
    viewer_count = 0
  where host_id = v_uid
    and is_live = true;

  get diagnostics v_yayinlar = row_count;

  -- Host'un taraf oldugu canli PK'lari bitir
  begin
    update public.pk_matches pm
    set
      status = 'cancelled',
      finished_at = coalesce(finished_at, now())
    where pm.status = 'live'
      and (
        pm.room_a_id = any (v_room_ids)
        or pm.room_b_id = any (v_room_ids)
        or exists (
          select 1 from public.live_sessions ls
          where ls.host_id = v_uid
            and (ls.id = pm.live_a_id or ls.id = pm.live_b_id)
        )
      );
  exception when undefined_table then
    null;
  when others then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'rooms_closed', v_rooms,
    'streams_closed', coalesce(v_yayinlar, 0)
  );
end;
$$;

grant execute on function public.cikis_canli_icerikleri_kapat() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: canli yayin listesi
-- ---------------------------------------------------------------------------
create or replace function public.admin_canli_yayinlar(p_limit int default 40)
returns table (
  id uuid,
  title text,
  mode text,
  viewer_count int,
  host_id uuid,
  host_name text,
  host_username text,
  started_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  return query
  select
    s.id,
    s.title,
    s.mode,
    s.viewer_count,
    s.host_id,
    coalesce(p.display_name, p.username, 'Yayinci'),
    p.username,
    s.started_at
  from public.live_sessions s
  left join public.profiles p on p.id = s.host_id
  where s.is_live = true
  order by s.viewer_count desc, s.started_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
end;
$$;

grant execute on function public.admin_canli_yayinlar(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: canli yayini zorla kapat
-- ---------------------------------------------------------------------------
create or replace function public.admin_canli_yayin_kapat(
  p_session_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_title text;
  v_was_live boolean;
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'Yayin admin tarafindan kapatildi');
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  select s.host_id, s.title, s.is_live
  into v_host, v_title, v_was_live
  from public.live_sessions s
  where s.id = p_session_id
  for update;

  if not found then
    raise exception 'Yayin bulunamadi';
  end if;

  update public.live_sessions set
    is_live = false,
    ended_at = coalesce(ended_at, now()),
    viewer_count = 0
  where id = p_session_id;

  begin
    update public.pk_matches
    set
      status = 'cancelled',
      finished_at = coalesce(finished_at, now())
    where status = 'live'
      and (live_a_id = p_session_id or live_b_id = p_session_id);
  exception when undefined_table then
    null;
  when others then
    null;
  end;

  if v_host is not null then
    perform public.bildirim_kuyruga_ekle(
      v_host,
      'system',
      'Canli yayinin kapatildi',
      left(coalesce(v_title, 'Yayin') || ' · ' || v_reason, 400),
      null,
      jsonb_build_object(
        'session_id', p_session_id,
        'action', 'live_force_end',
        'reason', v_reason
      )
    );
  end if;

  perform public.admin_audit_yaz(
    v_host,
    'live_force_end',
    v_reason,
    jsonb_build_object(
      'session_id', p_session_id,
      'title', v_title,
      'was_live', coalesce(v_was_live, false)
    )
  );

  return jsonb_build_object(
    'ok', true,
    'session_id', p_session_id,
    'host_id', v_host,
    'title', v_title,
    'was_live', coalesce(v_was_live, false)
  );
end;
$$;

grant execute on function public.admin_canli_yayin_kapat(uuid, text) to authenticated;

-- Hesap silmede ses odalarini da kapat (031'deki yayin kapatmaya ek)
create or replace function public.hesap_sil_istegi(p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_already boolean := false;
  v_uname text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select deleted_at is not null into v_already
  from public.profiles where id = v_uid;
  if not found then
    return jsonb_build_object('ok', true, 'kod', 'no_profile');
  end if;
  if v_already then
    return jsonb_build_object('ok', true, 'kod', 'already_deleted');
  end if;

  v_uname := 'deleted_' || replace(v_uid::text, '-', '');

  update public.profiles set
    deleted_at = now(),
    deletion_requested_at = now(),
    display_name = 'Silinmiş hesap',
    username = v_uname,
    avatar_url = null,
    cover_url = null,
    bio = '',
    phone_e164 = null,
    public_user_id = left('x' || replace(v_uid::text, '-', ''), 12),
    is_host = false,
    is_verified = false,
    updated_at = now()
  where id = v_uid and deleted_at is null;

  update public.device_sessions
    set revoked_at = now()
  where user_id = v_uid and revoked_at is null;

  begin
    update public.device_push_tokens
      set push_token = null,
          active = false,
          notification_enabled = false
    where user_id = v_uid;
  exception when undefined_table then
    null;
  when undefined_column then
    delete from public.device_push_tokens where user_id = v_uid;
  end;

  begin
    delete from public.user_bank_accounts where user_id = v_uid;
  exception when undefined_table then
    null;
  end;

  begin
    update public.direct_calls set
      status = case when status = 'ringing' then 'cancelled' else 'ended' end,
      ended_at = now(),
      ended_by = v_uid,
      end_reason = 'account_deleted'
    where status in ('ringing', 'active')
      and (caller_id = v_uid or callee_id = v_uid);
  exception when undefined_table then
    null;
  end;

  begin
    update public.live_sessions set
      is_live = false,
      ended_at = coalesce(ended_at, now()),
      viewer_count = 0
    where host_id = v_uid and is_live = true;
  exception when undefined_table then
    null;
  end;

  begin
    update public.rooms set
      is_live = false,
      ended_at = coalesce(ended_at, now()),
      listener_count = 0
    where host_id = v_uid and is_live = true;

    delete from public.room_members
    where room_id in (select id from public.rooms where host_id = v_uid);

    update public.room_seats
    set user_id = null, is_muted = false
    where room_id in (select id from public.rooms where host_id = v_uid);
  exception when undefined_table then
    null;
  when others then
    null;
  end;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    v_uid, 'account_delete_requested', 'medium',
    jsonb_build_object(
      'reason', left(coalesce(p_reason, ''), 200),
      'source', 'hesap_sil_istegi'
    )
  );

  return jsonb_build_object('ok', true, 'kod', 'deleted');
end;
$$;

grant execute on function public.hesap_sil_istegi(text) to authenticated;