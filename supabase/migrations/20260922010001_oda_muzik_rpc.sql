-- Oda müzik RPC: admin CRUD + oda session kontrol

create or replace function public.music_admin_audit(
  p_action text,
  p_track_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.music_admin_audit_logs (actor_id, action, track_id, details)
  values (auth.uid(), p_action, p_track_id, coalesce(p_details, '{}'::jsonb));
end;
$$;

create or replace function public.room_music_manage_izin(p_room_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
  v_role text;
begin
  if v_uid is null then return false; end if;
  if public.ben_admin_miyim() then return true; end if;

  select host_id into v_host from public.rooms where id = p_room_id;
  if not found then return false; end if;
  if v_host = v_uid then return true; end if;

  select role into v_role
  from public.room_members
  where room_id = p_room_id and user_id = v_uid;
  if v_role in ('host', 'cohost') then return true; end if;

  return exists (
    select 1 from public.room_music_permissions
    where room_id = p_room_id and user_id = v_uid and can_manage
  );
end;
$$;

create or replace function public.music_track_playable(p_track public.music_tracks)
returns boolean
language sql
stable
as $$
  select
    p_track.status = 'READY'
    and p_track.is_active
    and p_track.audio_url is not null
    and (p_track.license_valid_until is null or p_track.license_valid_until >= current_date);
$$;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
create or replace function public.music_admin_list(p_status text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(t) order by t.sort_order, t.created_at desc)
    from public.music_tracks t
    where p_status is null or t.status = p_status
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.music_admin_list(text) to authenticated;

create or replace function public.music_admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  return jsonb_build_object(
    'toplam', (select count(*)::int from public.music_tracks),
    'aktif', (select count(*)::int from public.music_tracks where status = 'READY' and is_active),
    'pasif', (select count(*)::int from public.music_tracks where status = 'READY' and not is_active),
    'arsiv', (select count(*)::int from public.music_tracks where status = 'ARCHIVED'),
    'processing', (select count(*)::int from public.music_tracks where status in ('UPLOADING','PROCESSING')),
    'failed', (select count(*)::int from public.music_tracks where status = 'FAILED')
  );
end;
$$;

grant execute on function public.music_admin_dashboard() to authenticated;

create or replace function public.music_admin_create(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_title text := nullif(trim(coalesce(p_payload->>'title', '')), '');
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  if v_title is null then raise exception 'Müzik adı zorunlu'; end if;

  insert into public.music_tracks (
    title, artist_name, description, cover_url, cover_storage_path,
    audio_url, audio_storage_path, duration_ms, mime_type, file_size, file_ext,
    category_id, tags, status, is_active, is_featured, sort_order,
    rights_status, license_type, license_reference, rights_holder, license_notes,
    license_valid_from, license_valid_until, allowed_regions, rights_ack,
    created_by, metadata
  ) values (
    v_title,
    nullif(trim(coalesce(p_payload->>'artist_name', '')), ''),
    nullif(trim(coalesce(p_payload->>'description', '')), ''),
    nullif(p_payload->>'cover_url', ''),
    nullif(p_payload->>'cover_storage_path', ''),
    nullif(p_payload->>'audio_url', ''),
    nullif(p_payload->>'audio_storage_path', ''),
    nullif(p_payload->>'duration_ms', '')::int,
    nullif(p_payload->>'mime_type', ''),
    nullif(p_payload->>'file_size', '')::bigint,
    nullif(p_payload->>'file_ext', ''),
    nullif(p_payload->>'category_id', '')::uuid,
    coalesce(
      (select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'tags', '[]'::jsonb)) t(x)),
      '{}'::text[]
    ),
    coalesce(nullif(p_payload->>'status', ''), 'PROCESSING'),
    coalesce((p_payload->>'is_active')::boolean, false),
    coalesce((p_payload->>'is_featured')::boolean, false),
    coalesce((p_payload->>'sort_order')::int, 0),
    coalesce(nullif(p_payload->>'rights_status', ''), 'unknown'),
    nullif(p_payload->>'license_type', ''),
    nullif(p_payload->>'license_reference', ''),
    nullif(p_payload->>'rights_holder', ''),
    nullif(p_payload->>'license_notes', ''),
    nullif(p_payload->>'license_valid_from', '')::date,
    nullif(p_payload->>'license_valid_until', '')::date,
    coalesce(
      (select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'allowed_regions', '[]'::jsonb)) r(x)),
      '{}'::text[]
    ),
    coalesce((p_payload->>'rights_ack')::boolean, false),
    auth.uid(),
    coalesce(p_payload->'metadata', '{}'::jsonb)
  )
  returning id into v_id;

  perform public.music_admin_audit('MUSIC_CREATED', v_id, p_payload);
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.music_admin_create(jsonb) to authenticated;

create or replace function public.music_admin_update(p_track_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  update public.music_tracks set
    title = coalesce(nullif(trim(coalesce(p_payload->>'title', '')), ''), title),
    artist_name = case when p_payload ? 'artist_name' then nullif(trim(p_payload->>'artist_name'), '') else artist_name end,
    description = case when p_payload ? 'description' then nullif(trim(p_payload->>'description'), '') else description end,
    cover_url = case when p_payload ? 'cover_url' then nullif(p_payload->>'cover_url', '') else cover_url end,
    cover_storage_path = case when p_payload ? 'cover_storage_path' then nullif(p_payload->>'cover_storage_path', '') else cover_storage_path end,
    audio_url = case when p_payload ? 'audio_url' then nullif(p_payload->>'audio_url', '') else audio_url end,
    audio_storage_path = case when p_payload ? 'audio_storage_path' then nullif(p_payload->>'audio_storage_path', '') else audio_storage_path end,
    duration_ms = case when p_payload ? 'duration_ms' then nullif(p_payload->>'duration_ms', '')::int else duration_ms end,
    mime_type = case when p_payload ? 'mime_type' then nullif(p_payload->>'mime_type', '') else mime_type end,
    file_size = case when p_payload ? 'file_size' then nullif(p_payload->>'file_size', '')::bigint else file_size end,
    file_ext = case when p_payload ? 'file_ext' then nullif(p_payload->>'file_ext', '') else file_ext end,
    category_id = case when p_payload ? 'category_id' then nullif(p_payload->>'category_id', '')::uuid else category_id end,
    tags = case when p_payload ? 'tags' then coalesce(
      (select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'tags', '[]'::jsonb)) t(x)),
      '{}'::text[]
    ) else tags end,
    is_featured = case when p_payload ? 'is_featured' then (p_payload->>'is_featured')::boolean else is_featured end,
    sort_order = case when p_payload ? 'sort_order' then (p_payload->>'sort_order')::int else sort_order end,
    rights_status = case when p_payload ? 'rights_status' then coalesce(nullif(p_payload->>'rights_status', ''), rights_status) else rights_status end,
    license_type = case when p_payload ? 'license_type' then nullif(p_payload->>'license_type', '') else license_type end,
    license_reference = case when p_payload ? 'license_reference' then nullif(p_payload->>'license_reference', '') else license_reference end,
    rights_holder = case when p_payload ? 'rights_holder' then nullif(p_payload->>'rights_holder', '') else rights_holder end,
    license_notes = case when p_payload ? 'license_notes' then nullif(p_payload->>'license_notes', '') else license_notes end,
    license_valid_from = case when p_payload ? 'license_valid_from' then nullif(p_payload->>'license_valid_from', '')::date else license_valid_from end,
    license_valid_until = case when p_payload ? 'license_valid_until' then nullif(p_payload->>'license_valid_until', '')::date else license_valid_until end,
    allowed_regions = case when p_payload ? 'allowed_regions' then coalesce(
      (select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'allowed_regions', '[]'::jsonb)) r(x)),
      '{}'::text[]
    ) else allowed_regions end,
    rights_ack = case when p_payload ? 'rights_ack' then (p_payload->>'rights_ack')::boolean else rights_ack end,
    updated_at = now()
  where id = p_track_id;
  if not found then raise exception 'Parça bulunamadı'; end if;
  perform public.music_admin_audit('MUSIC_UPDATED', p_track_id, p_payload);
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.music_admin_update(uuid, jsonb) to authenticated;

create or replace function public.music_admin_publish(p_track_id uuid, p_active boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.music_tracks%rowtype;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  select * into v_row from public.music_tracks where id = p_track_id;
  if not found then raise exception 'Parça bulunamadı'; end if;
  if v_row.audio_url is null then raise exception 'Ses dosyası yok'; end if;
  if coalesce(v_row.duration_ms, 0) <= 0 then raise exception 'Geçersiz süre'; end if;
  if not coalesce(v_row.rights_ack, false) then raise exception 'Lisans onayı gerekli'; end if;

  update public.music_tracks set
    status = 'READY',
    is_active = p_active,
    published_at = coalesce(published_at, now()),
    updated_at = now()
  where id = p_track_id;

  perform public.music_admin_audit(
    case when p_active then 'MUSIC_PUBLISHED' else 'MUSIC_DISABLED' end,
    p_track_id,
    jsonb_build_object('is_active', p_active)
  );
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.music_admin_publish(uuid, boolean) to authenticated;

create or replace function public.music_admin_set_active(p_track_id uuid, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  update public.music_tracks set
    is_active = p_active,
    updated_at = now()
  where id = p_track_id and status = 'READY';
  if not found then raise exception 'Parça hazır değil'; end if;
  perform public.music_admin_audit(
    case when p_active then 'MUSIC_PUBLISHED' else 'MUSIC_DISABLED' end,
    p_track_id,
    jsonb_build_object('is_active', p_active)
  );

  if not p_active then
    update public.room_music_sessions s set
      state = 'STOPPED',
      track_id = null,
      position_ms = 0,
      started_at = null,
      paused_at = null,
      version = version + 1,
      updated_at = now()
    where s.track_id = p_track_id and s.state in ('PLAYING','PAUSED','LOADING');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.music_admin_set_active(uuid, boolean) to authenticated;

create or replace function public.music_admin_archive(p_track_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  update public.music_tracks set
    status = 'ARCHIVED',
    is_active = false,
    archived_at = now(),
    updated_at = now()
  where id = p_track_id;
  if not found then raise exception 'Parça bulunamadı'; end if;
  perform public.music_admin_audit('MUSIC_ARCHIVED', p_track_id, '{}'::jsonb);

  update public.room_music_sessions s set
    state = 'STOPPED',
    track_id = null,
    position_ms = 0,
    started_at = null,
    paused_at = null,
    version = version + 1,
    updated_at = now()
  where s.track_id = p_track_id and s.state in ('PLAYING','PAUSED','LOADING');

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.music_admin_archive(uuid) to authenticated;

create or replace function public.music_admin_categories()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'code', c.code, 'name', c.name, 'sort_order', c.sort_order, 'is_active', c.is_active
    ) order by c.sort_order)
    from public.music_categories c
    where c.is_active or public.ben_admin_miyim()
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.music_admin_categories() to authenticated;

create or replace function public.music_admin_category_upsert(
  p_code text,
  p_name text,
  p_sort_order int default 0,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  insert into public.music_categories (code, name, sort_order, is_active)
  values (lower(trim(p_code)), trim(p_name), coalesce(p_sort_order, 0), coalesce(p_is_active, true))
  on conflict (code) do update set
    name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.music_admin_category_upsert(text, text, int, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Library (client)
-- ---------------------------------------------------------------------------
create or replace function public.music_library_list(
  p_query text default null,
  p_tab text default 'all',
  p_limit int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_q text := nullif(lower(trim(coalesce(p_query, ''))), '');
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_flag boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select enabled into v_flag from public.feature_flags where key = 'voice_room_music_enabled';
  if coalesce(v_flag, true) = false then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb)
    from (
      select
        t.id, t.title, t.artist_name, t.description, t.cover_url, t.audio_url,
        t.duration_ms, t.category_id, t.tags, t.is_featured, t.sort_order,
        t.published_at, t.play_count, t.room_play_count,
        c.name as category_name,
        exists (
          select 1 from public.music_favorites f
          where f.user_id = v_uid and f.track_id = t.id
        ) as is_favorite
      from public.music_tracks t
      left join public.music_categories c on c.id = t.category_id
      where public.music_track_playable(t)
        and (
          v_q is null
          or lower(t.title) like '%' || v_q || '%'
          or lower(coalesce(t.artist_name, '')) like '%' || v_q || '%'
          or exists (
            select 1 from unnest(t.tags) g where lower(g) like '%' || v_q || '%'
          )
        )
        and (
          p_tab is null or p_tab = 'all'
          or (p_tab = 'featured' and t.is_featured)
          or (p_tab = 'new' and t.published_at >= now() - interval '30 days')
          or (p_tab = 'popular' and t.play_count > 0)
          or (p_tab = 'favorites' and exists (
            select 1 from public.music_favorites f
            where f.user_id = v_uid and f.track_id = t.id
          ))
        )
      order by
        case when p_tab = 'popular' then t.play_count else 0 end desc,
        case when p_tab = 'new' then extract(epoch from t.published_at) else 0 end desc,
        t.is_featured desc,
        t.sort_order,
        t.published_at desc nulls last
      limit v_limit
    ) x
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.music_library_list(text, text, int) to authenticated;

create or replace function public.music_favorite_toggle(p_track_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_fav boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.music_favorites where user_id = v_uid and track_id = p_track_id) then
    delete from public.music_favorites where user_id = v_uid and track_id = p_track_id;
    v_fav := false;
  else
    insert into public.music_favorites (user_id, track_id) values (v_uid, p_track_id)
    on conflict do nothing;
    v_fav := true;
  end if;
  return jsonb_build_object('ok', true, 'is_favorite', v_fav);
end;
$$;

grant execute on function public.music_favorite_toggle(uuid) to authenticated;

create or replace function public.music_runtime_config_get()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(c) from public.music_runtime_config c where id = 1;
$$;

grant execute on function public.music_runtime_config_get() to authenticated;

-- ---------------------------------------------------------------------------
-- Room session
-- ---------------------------------------------------------------------------
create or replace function public.room_music_session_get(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.room_music_sessions%rowtype;
  t public.music_tracks%rowtype;
  q jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into s from public.room_music_sessions where room_id = p_room_id;
  if not found then
    return jsonb_build_object(
      'room_id', p_room_id,
      'state', 'STOPPED',
      'version', 0,
      'queue', '[]'::jsonb
    );
  end if;
  if s.track_id is not null then
    select * into t from public.music_tracks where id = s.track_id;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', qi.id,
    'track_id', qi.track_id,
    'sort_order', qi.sort_order,
    'title', mt.title,
    'artist_name', mt.artist_name,
    'cover_url', mt.cover_url,
    'audio_url', mt.audio_url,
    'duration_ms', mt.duration_ms
  ) order by qi.sort_order), '[]'::jsonb)
  into q
  from public.room_music_queue qi
  join public.music_tracks mt on mt.id = qi.track_id
  where qi.room_id = p_room_id;

  return jsonb_build_object(
    'room_id', s.room_id,
    'track_id', s.track_id,
    'state', s.state,
    'position_ms', s.position_ms,
    'started_at', s.started_at,
    'paused_at', s.paused_at,
    'leader_user_id', s.leader_user_id,
    'volume', s.volume,
    'ducking_enabled', s.ducking_enabled,
    'normal_volume', s.normal_volume,
    'ducked_volume', s.ducked_volume,
    'repeat_mode', s.repeat_mode,
    'shuffle_enabled', s.shuffle_enabled,
    'version', s.version,
    'updated_at', s.updated_at,
    'error_message', s.error_message,
    'track', case when t.id is null then null else jsonb_build_object(
      'id', t.id,
      'title', t.title,
      'artist_name', t.artist_name,
      'cover_url', t.cover_url,
      'audio_url', t.audio_url,
      'duration_ms', t.duration_ms
    ) end,
    'queue', q,
    'can_manage', public.room_music_manage_izin(p_room_id)
  );
end;
$$;

grant execute on function public.room_music_session_get(uuid) to authenticated;

create or replace function public.room_music_set(
  p_room_id uuid,
  p_track_id uuid,
  p_expected_version int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_track public.music_tracks%rowtype;
  v_cfg public.music_runtime_config%rowtype;
  v_ver int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.room_music_manage_izin(p_room_id) then raise exception 'Forbidden'; end if;

  select * into v_track from public.music_tracks where id = p_track_id;
  if not found or not public.music_track_playable(v_track) then
    raise exception 'Parça çalınamaz';
  end if;
  select * into v_cfg from public.music_runtime_config where id = 1;

  insert into public.room_music_sessions as s (
    room_id, track_id, state, position_ms, started_at, paused_at,
    leader_user_id, volume, ducking_enabled, normal_volume, ducked_volume, version, updated_at
  ) values (
    p_room_id, p_track_id, 'PLAYING', 0, now(), null,
    v_uid, v_cfg.default_normal_volume, true,
    v_cfg.default_normal_volume, v_cfg.default_ducked_volume, 1, now()
  )
  on conflict (room_id) do update set
    track_id = excluded.track_id,
    state = 'PLAYING',
    position_ms = 0,
    started_at = now(),
    paused_at = null,
    leader_user_id = v_uid,
    version = case
      when p_expected_version is not null and s.version <> p_expected_version
        then s.version
      else s.version + 1
    end,
    updated_at = now(),
    error_message = null
  where p_expected_version is null or s.version = p_expected_version
  returning version into v_ver;

  if v_ver is null then
    raise exception 'Version conflict';
  end if;

  update public.music_tracks set
    play_count = play_count + 1,
    room_play_count = room_play_count + 1,
    updated_at = now()
  where id = p_track_id;

  insert into public.music_play_aggregates (track_id, start_count, distinct_rooms, updated_at)
  values (p_track_id, 1, 1, now())
  on conflict (track_id) do update set
    start_count = music_play_aggregates.start_count + 1,
    updated_at = now();

  return public.room_music_session_get(p_room_id);
end;
$$;

grant execute on function public.room_music_set(uuid, uuid, int) to authenticated;

create or replace function public.room_music_pause(
  p_room_id uuid,
  p_position_ms int default null,
  p_expected_version int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ver int;
begin
  if not public.room_music_manage_izin(p_room_id) then raise exception 'Forbidden'; end if;
  update public.room_music_sessions s set
    state = 'PAUSED',
    position_ms = coalesce(p_position_ms, s.position_ms),
    paused_at = now(),
    version = s.version + 1,
    updated_at = now()
  where s.room_id = p_room_id
    and s.state = 'PLAYING'
    and (p_expected_version is null or s.version = p_expected_version)
  returning version into v_ver;
  if v_ver is null then raise exception 'Version conflict or not playing'; end if;
  return public.room_music_session_get(p_room_id);
end;
$$;

grant execute on function public.room_music_pause(uuid, int, int) to authenticated;

create or replace function public.room_music_resume(
  p_room_id uuid,
  p_expected_version int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ver int;
  v_pos int;
begin
  if not public.room_music_manage_izin(p_room_id) then raise exception 'Forbidden'; end if;
  select position_ms into v_pos from public.room_music_sessions where room_id = p_room_id;
  update public.room_music_sessions s set
    state = 'PLAYING',
    started_at = now() - make_interval(secs => greatest(coalesce(s.position_ms, 0), 0) / 1000.0),
    paused_at = null,
    version = s.version + 1,
    updated_at = now()
  where s.room_id = p_room_id
    and s.state = 'PAUSED'
    and (p_expected_version is null or s.version = p_expected_version)
  returning version into v_ver;
  if v_ver is null then raise exception 'Version conflict or not paused'; end if;
  return public.room_music_session_get(p_room_id);
end;
$$;

grant execute on function public.room_music_resume(uuid, int) to authenticated;

create or replace function public.room_music_stop(
  p_room_id uuid,
  p_expected_version int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ver int;
begin
  if not public.room_music_manage_izin(p_room_id) then raise exception 'Forbidden'; end if;
  update public.room_music_sessions s set
    state = 'STOPPED',
    track_id = null,
    position_ms = 0,
    started_at = null,
    paused_at = null,
    version = s.version + 1,
    updated_at = now()
  where s.room_id = p_room_id
    and (p_expected_version is null or s.version = p_expected_version)
  returning version into v_ver;
  if v_ver is null and exists (select 1 from public.room_music_sessions where room_id = p_room_id) then
    raise exception 'Version conflict';
  end if;
  return public.room_music_session_get(p_room_id);
end;
$$;

grant execute on function public.room_music_stop(uuid, int) to authenticated;

create or replace function public.room_music_skip(
  p_room_id uuid,
  p_direction int default 1,
  p_expected_version int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next uuid;
  v_cur uuid;
begin
  if not public.room_music_manage_izin(p_room_id) then raise exception 'Forbidden'; end if;
  select track_id into v_cur from public.room_music_sessions where room_id = p_room_id;

  if p_direction >= 0 then
    select track_id into v_next
    from public.room_music_queue
    where room_id = p_room_id
    order by sort_order
    limit 1;
    if v_next is not null then
      delete from public.room_music_queue
      where id = (
        select id from public.room_music_queue
        where room_id = p_room_id order by sort_order limit 1
      );
    else
      select t.id into v_next
      from public.music_tracks t
      where public.music_track_playable(t)
      order by t.sort_order, t.published_at desc nulls last
      limit 1 offset 1;
    end if;
  end if;

  if v_next is null then
    return public.room_music_stop(p_room_id, p_expected_version);
  end if;
  return public.room_music_set(p_room_id, v_next, p_expected_version);
end;
$$;

grant execute on function public.room_music_skip(uuid, int, int) to authenticated;

create or replace function public.room_music_seek(
  p_room_id uuid,
  p_position_ms int,
  p_expected_version int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ver int;
  v_pos int := greatest(coalesce(p_position_ms, 0), 0);
begin
  if not public.room_music_manage_izin(p_room_id) then raise exception 'Forbidden'; end if;
  update public.room_music_sessions s set
    position_ms = v_pos,
    started_at = case
      when s.state = 'PLAYING' then now() - make_interval(secs => v_pos / 1000.0)
      else s.started_at
    end,
    version = s.version + 1,
    updated_at = now()
  where s.room_id = p_room_id
    and (p_expected_version is null or s.version = p_expected_version)
  returning version into v_ver;
  if v_ver is null then raise exception 'Version conflict'; end if;
  return public.room_music_session_get(p_room_id);
end;
$$;

grant execute on function public.room_music_seek(uuid, int, int) to authenticated;

create or replace function public.room_music_set_volume(
  p_room_id uuid,
  p_volume numeric,
  p_expected_version int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ver int;
  v_max numeric;
  v_vol numeric;
begin
  if not public.room_music_manage_izin(p_room_id) then raise exception 'Forbidden'; end if;
  select max_music_volume into v_max from public.music_runtime_config where id = 1;
  v_vol := least(greatest(coalesce(p_volume, 0.28), 0), coalesce(v_max, 0.7));
  update public.room_music_sessions s set
    volume = v_vol,
    normal_volume = v_vol,
    version = s.version + 1,
    updated_at = now()
  where s.room_id = p_room_id
    and (p_expected_version is null or s.version = p_expected_version)
  returning version into v_ver;
  if v_ver is null then raise exception 'Version conflict'; end if;
  return public.room_music_session_get(p_room_id);
end;
$$;

grant execute on function public.room_music_set_volume(uuid, numeric, int) to authenticated;

create or replace function public.room_music_queue_add(
  p_room_id uuid,
  p_track_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ord int;
begin
  if not public.room_music_manage_izin(p_room_id) then raise exception 'Forbidden'; end if;
  if not exists (
    select 1 from public.music_tracks t where t.id = p_track_id and public.music_track_playable(t)
  ) then raise exception 'Parça çalınamaz'; end if;
  select coalesce(max(sort_order), 0) + 1 into v_ord
  from public.room_music_queue where room_id = p_room_id;
  insert into public.room_music_queue (room_id, track_id, sort_order, added_by)
  values (p_room_id, p_track_id, v_ord, auth.uid());
  update public.room_music_sessions set version = version + 1, updated_at = now()
  where room_id = p_room_id;
  return public.room_music_session_get(p_room_id);
end;
$$;

grant execute on function public.room_music_queue_add(uuid, uuid) to authenticated;

create or replace function public.room_music_perm_grant(
  p_room_id uuid,
  p_user_id uuid,
  p_can_manage boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not (
    public.ben_admin_miyim()
    or exists (select 1 from public.rooms r where r.id = p_room_id and r.host_id = auth.uid())
  ) then raise exception 'Forbidden'; end if;

  insert into public.room_music_permissions (room_id, user_id, can_manage, granted_by)
  values (p_room_id, p_user_id, coalesce(p_can_manage, true), auth.uid())
  on conflict (room_id, user_id) do update set
    can_manage = excluded.can_manage,
    granted_by = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.room_music_perm_grant(uuid, uuid, boolean) to authenticated;
