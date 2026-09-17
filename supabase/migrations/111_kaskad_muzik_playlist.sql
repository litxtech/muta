-- ============================================================================
-- 111 — Realm of Storms admin müzik playlist
--   - kaskad_game_settings: music_mode (builtin|playlist), music_loop
--   - kaskad_music_tracks: admin yüklenen parçalar (sıralı çalma)
--   - storage bucket: kaskad-music (geniş ses MIME desteği)
--   - Public get + admin CRUD RPC'leri
--   - aktif_config'e muzik payload
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Ayar kolonları
-- ---------------------------------------------------------------------------
alter table public.kaskad_game_settings
  add column if not exists music_mode text not null default 'builtin'
    check (music_mode in ('builtin', 'playlist'));

alter table public.kaskad_game_settings
  add column if not exists music_loop boolean not null default true;

comment on column public.kaskad_game_settings.music_mode is
  'builtin = oyunun kendi BGM; playlist = admin yüklenen müzikler (builtin kapanır)';
comment on column public.kaskad_game_settings.music_loop is
  'playlist bitince başa dön (true) veya dur (false)';

-- ---------------------------------------------------------------------------
-- 2) Parça tablosu
-- ---------------------------------------------------------------------------
create table if not exists public.kaskad_music_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  public_url text not null,
  storage_path text,
  mime_type text,
  file_ext text,
  duration_ms integer,
  sort_order integer not null default 0,
  aktif boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kaskad_music_tracks_aktif_sira_idx
  on public.kaskad_music_tracks (aktif, sort_order, created_at);

alter table public.kaskad_music_tracks enable row level security;

drop policy if exists "kaskad music tracks public read aktif" on public.kaskad_music_tracks;
create policy "kaskad music tracks public read aktif"
  on public.kaskad_music_tracks for select to authenticated
  using (aktif = true);

drop policy if exists "kaskad music tracks admin all" on public.kaskad_music_tracks;
create policy "kaskad music tracks admin all"
  on public.kaskad_music_tracks for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

-- ---------------------------------------------------------------------------
-- 3) Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kaskad-music',
  'kaskad-music',
  true,
  52428800,
  array[
    'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac',
    'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave',
    'audio/ogg', 'audio/opus', 'audio/flac', 'audio/webm',
    'audio/x-aiff', 'audio/aiff', 'audio/basic', 'audio/midi', 'audio/x-midi',
    'application/ogg', 'application/octet-stream',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Kaskad music public read" on storage.objects;
create policy "Kaskad music public read"
  on storage.objects for select to public
  using (bucket_id = 'kaskad-music');

drop policy if exists "Kaskad music admin upload" on storage.objects;
create policy "Kaskad music admin upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'kaskad-music'
    and public.ben_admin_miyim()
  );

drop policy if exists "Kaskad music admin update" on storage.objects;
create policy "Kaskad music admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'kaskad-music' and public.ben_admin_miyim())
  with check (bucket_id = 'kaskad-music' and public.ben_admin_miyim());

drop policy if exists "Kaskad music admin delete" on storage.objects;
create policy "Kaskad music admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'kaskad-music' and public.ben_admin_miyim());

-- ---------------------------------------------------------------------------
-- 4) Yardımcı: track satırını JSON'a çevir
-- ---------------------------------------------------------------------------
create or replace function public.kaskad_music_track_json(t public.kaskad_music_tracks)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'publicUrl', t.public_url,
    'storagePath', t.storage_path,
    'mimeType', t.mime_type,
    'fileExt', t.file_ext,
    'durationMs', t.duration_ms,
    'sortOrder', t.sort_order,
    'aktif', t.aktif,
    'createdAt', t.created_at,
    'updatedAt', t.updated_at
  );
$$;

-- ---------------------------------------------------------------------------
-- 5) Public müzik kataloğu (oyun istemcisi)
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_muzik_public_get()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.kaskad_game_settings%rowtype;
  v_tracks jsonb;
begin
  select * into s from public.kaskad_game_settings where id = 1;

  select coalesce(jsonb_agg(public.kaskad_music_track_json(t) order by t.sort_order, t.created_at), '[]'::jsonb)
  into v_tracks
  from public.kaskad_music_tracks t
  where t.aktif = true;

  return jsonb_build_object(
    'mode', coalesce(s.music_mode, 'builtin'),
    'loop', coalesce(s.music_loop, true),
    'tracks', v_tracks
  );
end;
$$;

grant execute on function public.kozmik_kaskad_muzik_public_get() to authenticated;
grant execute on function public.kozmik_kaskad_muzik_public_get() to anon;
grant execute on function public.kozmik_kaskad_muzik_public_get() to service_role;

-- ---------------------------------------------------------------------------
-- 6) Admin: liste (aktif + pasif)
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_admin_muzik_list()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.kaskad_game_settings%rowtype;
  v_tracks jsonb;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  select * into s from public.kaskad_game_settings where id = 1;

  select coalesce(jsonb_agg(public.kaskad_music_track_json(t) order by t.sort_order, t.created_at), '[]'::jsonb)
  into v_tracks
  from public.kaskad_music_tracks t;

  return jsonb_build_object(
    'mode', coalesce(s.music_mode, 'builtin'),
    'loop', coalesce(s.music_loop, true),
    'tracks', v_tracks
  );
end;
$$;

grant execute on function public.kozmik_kaskad_admin_muzik_list() to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Admin: parça ekle (+ ilk yüklemede otomatik playlist moda geç)
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_admin_muzik_ekle(
  p_title text,
  p_public_url text,
  p_storage_path text default null,
  p_mime_type text default null,
  p_file_ext text default null,
  p_duration_ms integer default null,
  p_auto_playlist boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sira integer;
  v_id uuid;
  v_switched boolean := false;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_title is null or length(trim(p_title)) < 1 then
    raise exception 'Başlık zorunlu';
  end if;
  if p_public_url is null or length(trim(p_public_url)) < 5 then
    raise exception 'URL zorunlu';
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_sira from public.kaskad_music_tracks;

  insert into public.kaskad_music_tracks (
    title, public_url, storage_path, mime_type, file_ext, duration_ms, sort_order, created_by
  ) values (
    trim(p_title),
    trim(p_public_url),
    p_storage_path,
    p_mime_type,
    p_file_ext,
    p_duration_ms,
    v_sira,
    auth.uid()
  )
  returning id into v_id;

  -- Yükleme sonrası: varsayılan builtin → playlist (oyunun kendi BGM kalkar)
  if p_auto_playlist is true then
    update public.kaskad_game_settings
    set
      music_mode = 'playlist',
      updated_by = auth.uid(),
      updated_at = now()
    where id = 1
      and music_mode = 'builtin';
    if found then
      v_switched := true;
    end if;
  end if;

  insert into public.kaskad_audit_logs (admin_user_id, action, payload)
  values (
    auth.uid(),
    'admin_music_track_add',
    jsonb_build_object(
      'trackId', v_id,
      'title', trim(p_title),
      'switchedToPlaylist', v_switched
    )
  );

  return public.kozmik_kaskad_admin_muzik_list();
end;
$$;

grant execute on function public.kozmik_kaskad_admin_muzik_ekle(text, text, text, text, text, integer, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) Admin: parça güncelle
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_admin_muzik_guncelle(
  p_id uuid,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_id is null then raise exception 'id zorunlu'; end if;

  update public.kaskad_music_tracks set
    title = case when p_patch ? 'title' then nullif(trim(p_patch->>'title'), '') else title end,
    aktif = case when p_patch ? 'aktif' then (p_patch->>'aktif')::boolean else aktif end,
    sort_order = case when p_patch ? 'sortOrder' then (p_patch->>'sortOrder')::integer else sort_order end,
    duration_ms = case when p_patch ? 'durationMs' then nullif(p_patch->>'durationMs', '')::integer else duration_ms end,
    updated_at = now()
  where id = p_id;

  if not found then raise exception 'Parça bulunamadı'; end if;

  insert into public.kaskad_audit_logs (admin_user_id, action, payload)
  values (
    auth.uid(),
    'admin_music_track_update',
    jsonb_build_object('trackId', p_id, 'patch', p_patch)
  );

  return public.kozmik_kaskad_admin_muzik_list();
end;
$$;

grant execute on function public.kozmik_kaskad_admin_muzik_guncelle(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 9) Admin: parça sil
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_admin_muzik_sil(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
  v_remaining integer;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  select storage_path into v_path from public.kaskad_music_tracks where id = p_id;
  delete from public.kaskad_music_tracks where id = p_id;
  if not found then raise exception 'Parça bulunamadı'; end if;

  select count(*)::integer into v_remaining from public.kaskad_music_tracks where aktif = true;

  -- Aktif parça kalmadıysa otomatik builtin'e dön
  if v_remaining = 0 then
    update public.kaskad_game_settings
    set music_mode = 'builtin', updated_by = auth.uid(), updated_at = now()
    where id = 1 and music_mode = 'playlist';
  end if;

  insert into public.kaskad_audit_logs (admin_user_id, action, payload)
  values (
    auth.uid(),
    'admin_music_track_delete',
    jsonb_build_object('trackId', p_id, 'storagePath', v_path, 'remainingAktif', v_remaining)
  );

  return public.kozmik_kaskad_admin_muzik_list()
    || jsonb_build_object('deletedStoragePath', v_path);
end;
$$;

grant execute on function public.kozmik_kaskad_admin_muzik_sil(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 10) Admin: sıra güncelle (id dizisi)
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_admin_muzik_sirala(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i integer;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_ids is null or array_length(p_ids, 1) is null then
    raise exception 'Sıra listesi boş';
  end if;

  for i in 1 .. array_length(p_ids, 1) loop
    update public.kaskad_music_tracks
    set sort_order = i - 1, updated_at = now()
    where id = p_ids[i];
  end loop;

  insert into public.kaskad_audit_logs (admin_user_id, action, payload)
  values (
    auth.uid(),
    'admin_music_track_reorder',
    jsonb_build_object('ids', to_jsonb(p_ids))
  );

  return public.kozmik_kaskad_admin_muzik_list();
end;
$$;

grant execute on function public.kozmik_kaskad_admin_muzik_sirala(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 11) Admin: müzik modu / loop
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_admin_muzik_ayar(
  p_mode text default null,
  p_loop boolean default null,
  p_reason text default 'admin music settings'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_aktif integer;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'Gerekçe zorunlu (audit)';
  end if;

  if p_mode is not null and p_mode not in ('builtin', 'playlist') then
    raise exception 'Geçersiz mode (builtin|playlist)';
  end if;

  if p_mode = 'playlist' then
    select count(*)::integer into v_aktif from public.kaskad_music_tracks where aktif = true;
    if v_aktif = 0 then
      raise exception 'Playlist modu için en az bir aktif müzik yükleyin';
    end if;
  end if;

  select jsonb_build_object('mode', music_mode, 'loop', music_loop)
  into v_old
  from public.kaskad_game_settings where id = 1;

  update public.kaskad_game_settings set
    music_mode = coalesce(p_mode, music_mode),
    music_loop = coalesce(p_loop, music_loop),
    updated_by = auth.uid(),
    updated_at = now()
  where id = 1;

  insert into public.kaskad_audit_logs (admin_user_id, action, payload)
  values (
    auth.uid(),
    'admin_music_settings',
    jsonb_build_object(
      'old', v_old,
      'mode', p_mode,
      'loop', p_loop,
      'reason', p_reason
    )
  );

  return public.kozmik_kaskad_admin_muzik_list();
end;
$$;

grant execute on function public.kozmik_kaskad_admin_muzik_ayar(text, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 12) settings_get / settings_update — music alanları
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_admin_settings_get()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.kaskad_game_settings%rowtype;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  select * into s from public.kaskad_game_settings where id = 1;
  return jsonb_build_object(
    'gamePaused', s.game_paused,
    'maintenanceMode', s.maintenance_mode,
    'maintenanceMessage', coalesce(s.maintenance_message, ''),
    'minBet', s.min_bet,
    'maxBet', s.max_bet,
    'betPresets', s.bet_presets,
    'autoplayEnabled', s.autoplay_enabled,
    'turboEnabled', s.turbo_enabled,
    'maxDailyWager', s.max_daily_wager,
    'maxDailyLoss', s.max_daily_loss,
    'maxRoundsPerDay', s.max_rounds_per_day,
    'musicMode', coalesce(s.music_mode, 'builtin'),
    'musicLoop', coalesce(s.music_loop, true),
    'updatedAt', s.updated_at
  );
end;
$$;

create or replace function public.kozmik_kaskad_admin_settings_update(
  p_patch jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'Gerekçe zorunlu (audit)';
  end if;

  select to_jsonb(s) into v_old from public.kaskad_game_settings s where id = 1;

  update public.kaskad_game_settings set
    game_paused = coalesce((p_patch->>'gamePaused')::boolean, game_paused),
    maintenance_mode = coalesce((p_patch->>'maintenanceMode')::boolean, maintenance_mode),
    maintenance_message = case
      when p_patch ? 'maintenanceMessage' then p_patch->>'maintenanceMessage'
      else maintenance_message
    end,
    min_bet = case when p_patch ? 'minBet'
      then nullif(p_patch->>'minBet', '')::bigint else min_bet end,
    max_bet = case when p_patch ? 'maxBet'
      then nullif(p_patch->>'maxBet', '')::bigint else max_bet end,
    bet_presets = case when p_patch ? 'betPresets'
      then p_patch->'betPresets' else bet_presets end,
    autoplay_enabled = case when p_patch ? 'autoplayEnabled'
      then (p_patch->>'autoplayEnabled')::boolean else autoplay_enabled end,
    turbo_enabled = case when p_patch ? 'turboEnabled'
      then (p_patch->>'turboEnabled')::boolean else turbo_enabled end,
    max_daily_wager = case when p_patch ? 'maxDailyWager'
      then nullif(p_patch->>'maxDailyWager', '')::bigint else max_daily_wager end,
    max_daily_loss = case when p_patch ? 'maxDailyLoss'
      then nullif(p_patch->>'maxDailyLoss', '')::bigint else max_daily_loss end,
    max_rounds_per_day = case when p_patch ? 'maxRoundsPerDay'
      then nullif(p_patch->>'maxRoundsPerDay', '')::integer else max_rounds_per_day end,
    music_mode = case when p_patch ? 'musicMode'
      then coalesce(nullif(p_patch->>'musicMode', ''), music_mode) else music_mode end,
    music_loop = case when p_patch ? 'musicLoop'
      then (p_patch->>'musicLoop')::boolean else music_loop end,
    updated_by = auth.uid(),
    updated_at = now()
  where id = 1;

  insert into public.kaskad_audit_logs (admin_user_id, action, payload)
  values (
    auth.uid(),
    'admin_settings_update',
    jsonb_build_object('patch', p_patch, 'old', v_old, 'reason', p_reason)
  );

  return public.kozmik_kaskad_admin_settings_get();
end;
$$;

-- ---------------------------------------------------------------------------
-- 13) aktif_config — muzik payload
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_aktif_config()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_cfg jsonb;
  s public.kaskad_game_settings%rowtype;
  v_muzik jsonb;
begin
  v := public.kozmik_kaskad_gecerli_math();
  v_cfg := v->'config';

  select * into s from public.kaskad_game_settings where id = 1;
  if found then
    if s.min_bet is not null then
      v_cfg := v_cfg || jsonb_build_object('minBet', s.min_bet);
    end if;
    if s.max_bet is not null then
      v_cfg := v_cfg || jsonb_build_object('maxBet', s.max_bet);
    end if;
    if s.bet_presets is not null then
      v_cfg := v_cfg || jsonb_build_object('betPresets', s.bet_presets);
    end if;
    if s.autoplay_enabled is not null then
      v_cfg := v_cfg || jsonb_build_object('autoplayEnabled', s.autoplay_enabled);
    end if;
    if s.turbo_enabled is not null then
      v_cfg := v_cfg || jsonb_build_object('turboEnabled', s.turbo_enabled);
    end if;
  end if;

  v_muzik := public.kozmik_kaskad_muzik_public_get();

  return v_cfg || jsonb_build_object(
    'durum', jsonb_build_object(
      'gamePaused', coalesce(s.game_paused, false),
      'maintenance', coalesce(s.maintenance_mode, false),
      'maintenanceMessage', coalesce(s.maintenance_message, ''),
      'mathSource', v->>'source'
    ),
    'muzik', v_muzik
  );
end;
$$;

grant execute on function public.kozmik_kaskad_aktif_config() to authenticated;
grant execute on function public.kozmik_kaskad_aktif_config() to service_role;
