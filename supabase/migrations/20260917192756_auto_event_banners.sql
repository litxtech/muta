-- Olay tabanlı otomatik bannerlar
-- Eşikler admin panelinden; TTL varsayılan 12 saat; kaynak kapanınca kalkar.

-- ---------------------------------------------------------------------------
-- Ayarlar (tek satır)
-- ---------------------------------------------------------------------------
create table if not exists public.auto_banner_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default true,
  ttl_hours int not null default 12 check (ttl_hours between 1 and 168),
  cooldown_hours int not null default 12 check (cooldown_hours between 1 and 168),
  room_coin_threshold bigint not null default 50000 check (room_coin_threshold >= 1000),
  live_coin_threshold bigint not null default 50000 check (live_coin_threshold >= 1000),
  game_coin_threshold bigint not null default 10000 check (game_coin_threshold >= 100),
  seats_full_enabled boolean not null default true,
  room_coins_enabled boolean not null default true,
  live_coins_enabled boolean not null default true,
  game_coins_enabled boolean not null default true,
  max_active int not null default 20 check (max_active between 1 and 100),
  carousel_max int not null default 8 check (carousel_max between 1 and 20),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.auto_banner_settings (id) values (1)
on conflict (id) do nothing;

alter table public.auto_banner_settings enable row level security;

drop policy if exists "Auto banner ayar okuma" on public.auto_banner_settings;
create policy "Auto banner ayar okuma"
  on public.auto_banner_settings for select to authenticated
  using (true);

drop policy if exists "Auto banner ayar admin" on public.auto_banner_settings;
create policy "Auto banner ayar admin"
  on public.auto_banner_settings for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

grant select on public.auto_banner_settings to authenticated;
grant update on public.auto_banner_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Aktif otomatik banner kayıtları
-- ---------------------------------------------------------------------------
create table if not exists public.auto_banners (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in ('room_coins', 'live_coins', 'seats_full', 'game_coins')),
  source_key text not null,
  ref_type text not null check (ref_type in ('room', 'live_session', 'game')),
  ref_id text not null,
  title text not null,
  subtitle text,
  badge text,
  media_url text,
  gradient_json jsonb,
  action_type text not null,
  action_target text not null,
  metric_value bigint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  deactivated_at timestamptz,
  deactivate_reason text
);

create unique index if not exists auto_banners_source_active_uidx
  on public.auto_banners (source_key)
  where active = true;

create index if not exists auto_banners_active_expires_idx
  on public.auto_banners (active, expires_at desc);

create index if not exists auto_banners_ref_idx
  on public.auto_banners (ref_type, ref_id)
  where active = true;

alter table public.auto_banners enable row level security;

drop policy if exists "Auto banner okuma" on public.auto_banners;
create policy "Auto banner okuma"
  on public.auto_banners for select to authenticated
  using (true);

drop policy if exists "Auto banner admin yazma" on public.auto_banners;
create policy "Auto banner admin yazma"
  on public.auto_banners for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

grant select on public.auto_banners to authenticated;

-- Feature flag (genel kapatma — ayarlar.enabled ile birlikte)
insert into public.feature_flags (key, enabled, description) values
  (
    'auto_event_banners_enabled',
    true,
    'Olay tabanli otomatik bannerlar (coin esigi, koltuk dolu, oyun)'
  )
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------
create or replace function public.auto_banner_sistem_acik_mi()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select enabled from public.auto_banner_settings where id = 1),
    false
  )
  and coalesce(public.ozellik_bayragi_aktif_mi('auto_event_banners_enabled'), false);
$$;

create or replace function public.auto_banner_suresi_dolmuslari_temizle()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  update public.auto_banners
    set active = false,
        deactivated_at = now(),
        deactivate_reason = coalesce(deactivate_reason, 'ttl')
  where active = true
    and expires_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.auto_banner_kaynak_kapat(
  p_ref_type text,
  p_ref_id text,
  p_reason text default 'source_closed'
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  update public.auto_banners
    set active = false,
        deactivated_at = now(),
        deactivate_reason = p_reason
  where active = true
    and ref_type = p_ref_type
    and ref_id = p_ref_id;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.auto_banner_olustur(
  p_kind text,
  p_source_key text,
  p_ref_type text,
  p_ref_id text,
  p_title text,
  p_subtitle text,
  p_badge text,
  p_media_url text,
  p_gradient_json jsonb,
  p_action_type text,
  p_action_target text,
  p_metric_value bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ayar public.auto_banner_settings%rowtype;
  v_id uuid;
  v_aktif int;
  v_cooldown_var boolean;
begin
  if not public.auto_banner_sistem_acik_mi() then
    return null;
  end if;

  select * into v_ayar from public.auto_banner_settings where id = 1;
  if not found then
    return null;
  end if;

  if p_kind = 'room_coins' and not v_ayar.room_coins_enabled then return null; end if;
  if p_kind = 'live_coins' and not v_ayar.live_coins_enabled then return null; end if;
  if p_kind = 'seats_full' and not v_ayar.seats_full_enabled then return null; end if;
  if p_kind = 'game_coins' and not v_ayar.game_coins_enabled then return null; end if;

  perform public.auto_banner_suresi_dolmuslari_temizle();

  -- Aynı kaynakta hâlâ aktif veya cooldown penceresinde kayıt varsa yenileme yok
  select exists (
    select 1 from public.auto_banners b
    where b.source_key = p_source_key
      and (
        b.active = true
        or b.created_at > now() - make_interval(hours => v_ayar.cooldown_hours)
      )
  ) into v_cooldown_var;

  if v_cooldown_var then
    -- Aktif olanın metrik/başlığını güncelle (yeni satır yok)
    update public.auto_banners
      set metric_value = greatest(metric_value, coalesce(p_metric_value, 0)),
          title = coalesce(nullif(trim(p_title), ''), title),
          subtitle = coalesce(p_subtitle, subtitle),
          media_url = coalesce(p_media_url, media_url)
    where source_key = p_source_key
      and active = true;
    return null;
  end if;

  select count(*)::int into v_aktif
  from public.auto_banners
  where active = true and expires_at > now();

  if v_aktif >= v_ayar.max_active then
    -- En eski aktif bannerı düşür
    update public.auto_banners
      set active = false,
          deactivated_at = now(),
          deactivate_reason = 'max_active'
    where id = (
      select id from public.auto_banners
      where active = true
      order by created_at asc
      limit 1
    );
  end if;

  insert into public.auto_banners (
    kind, source_key, ref_type, ref_id,
    title, subtitle, badge, media_url, gradient_json,
    action_type, action_target, metric_value,
    expires_at
  ) values (
    p_kind, p_source_key, p_ref_type, p_ref_id,
    left(trim(p_title), 80),
    left(nullif(trim(p_subtitle), ''), 120),
    left(nullif(trim(p_badge), ''), 24),
    nullif(trim(p_media_url), ''),
    p_gradient_json,
    p_action_type,
    p_action_target,
    coalesce(p_metric_value, 0),
    now() + make_interval(hours => v_ayar.ttl_hours)
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    return null;
end;
$$;

revoke all on function public.auto_banner_olustur(text, text, text, text, text, text, text, text, jsonb, text, text, bigint) from public;
grant execute on function public.auto_banner_olustur(text, text, text, text, text, text, text, text, jsonb, text, text, bigint) to service_role;

-- ---------------------------------------------------------------------------
-- Listele / admin
-- ---------------------------------------------------------------------------
create or replace function public.auto_banner_aktif_listele()
returns setof public.auto_banners
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
begin
  perform public.auto_banner_suresi_dolmuslari_temizle();

  -- Canlı olmayan oda / yayınları kapat
  update public.auto_banners ab
    set active = false,
        deactivated_at = now(),
        deactivate_reason = 'source_not_live'
  where ab.active = true
    and ab.ref_type = 'room'
    and not exists (
      select 1 from public.rooms r
      where r.id::text = ab.ref_id and r.is_live = true
    );

  update public.auto_banners ab
    set active = false,
        deactivated_at = now(),
        deactivate_reason = 'source_not_live'
  where ab.active = true
    and ab.ref_type = 'live_session'
    and not exists (
      select 1 from public.live_sessions ls
      where ls.id::text = ab.ref_id and ls.is_live = true
    );

  if not public.auto_banner_sistem_acik_mi() then
    return;
  end if;

  select carousel_max into v_max from public.auto_banner_settings where id = 1;

  return query
  select ab.*
  from public.auto_banners ab
  where ab.active = true
    and ab.expires_at > now()
  order by ab.created_at desc
  limit greatest(coalesce(v_max, 8), 1);
end;
$$;

grant execute on function public.auto_banner_aktif_listele() to authenticated;

create or replace function public.auto_banner_ayarlari_getir()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.auto_banner_settings%rowtype;
  v_flag boolean;
begin
  select * into v_row from public.auto_banner_settings where id = 1;
  v_flag := coalesce(public.ozellik_bayragi_aktif_mi('auto_event_banners_enabled'), false);
  return jsonb_build_object(
    'enabled', coalesce(v_row.enabled, false),
    'feature_flag', v_flag,
    'ttl_hours', v_row.ttl_hours,
    'cooldown_hours', v_row.cooldown_hours,
    'room_coin_threshold', v_row.room_coin_threshold,
    'live_coin_threshold', v_row.live_coin_threshold,
    'game_coin_threshold', v_row.game_coin_threshold,
    'seats_full_enabled', v_row.seats_full_enabled,
    'room_coins_enabled', v_row.room_coins_enabled,
    'live_coins_enabled', v_row.live_coins_enabled,
    'game_coins_enabled', v_row.game_coins_enabled,
    'max_active', v_row.max_active,
    'carousel_max', v_row.carousel_max,
    'updated_at', v_row.updated_at
  );
end;
$$;

grant execute on function public.auto_banner_ayarlari_getir() to authenticated;

create or replace function public.admin_auto_banner_ayarlari_kaydet(p_ayarlar jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then
    raise exception 'Admin required';
  end if;

  update public.auto_banner_settings set
    enabled = coalesce((p_ayarlar->>'enabled')::boolean, enabled),
    ttl_hours = coalesce((p_ayarlar->>'ttl_hours')::int, ttl_hours),
    cooldown_hours = coalesce((p_ayarlar->>'cooldown_hours')::int, cooldown_hours),
    room_coin_threshold = coalesce((p_ayarlar->>'room_coin_threshold')::bigint, room_coin_threshold),
    live_coin_threshold = coalesce((p_ayarlar->>'live_coin_threshold')::bigint, live_coin_threshold),
    game_coin_threshold = coalesce((p_ayarlar->>'game_coin_threshold')::bigint, game_coin_threshold),
    seats_full_enabled = coalesce((p_ayarlar->>'seats_full_enabled')::boolean, seats_full_enabled),
    room_coins_enabled = coalesce((p_ayarlar->>'room_coins_enabled')::boolean, room_coins_enabled),
    live_coins_enabled = coalesce((p_ayarlar->>'live_coins_enabled')::boolean, live_coins_enabled),
    game_coins_enabled = coalesce((p_ayarlar->>'game_coins_enabled')::boolean, game_coins_enabled),
    max_active = coalesce((p_ayarlar->>'max_active')::int, max_active),
    carousel_max = coalesce((p_ayarlar->>'carousel_max')::int, carousel_max),
    updated_at = now(),
    updated_by = auth.uid()
  where id = 1;

  if p_ayarlar ? 'enabled' then
    update public.feature_flags
      set enabled = (p_ayarlar->>'enabled')::boolean,
          updated_at = now()
    where key = 'auto_event_banners_enabled';
  end if;

  -- Sistem kapatıldıysa aktifleri düşür
  if coalesce((p_ayarlar->>'enabled')::boolean, true) = false then
    update public.auto_banners
      set active = false,
          deactivated_at = now(),
          deactivate_reason = 'admin_disabled'
    where active = true;
  end if;

  return public.auto_banner_ayarlari_getir();
end;
$$;

grant execute on function public.admin_auto_banner_ayarlari_kaydet(jsonb) to authenticated;

create or replace function public.admin_auto_banner_listele()
returns setof public.auto_banners
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then
    raise exception 'Admin required';
  end if;
  perform public.auto_banner_suresi_dolmuslari_temizle();
  return query
  select * from public.auto_banners
  order by created_at desc
  limit 100;
end;
$$;

grant execute on function public.admin_auto_banner_listele() to authenticated;

create or replace function public.admin_auto_banner_kapat(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then
    raise exception 'Admin required';
  end if;
  update public.auto_banners
    set active = false,
        deactivated_at = now(),
        deactivate_reason = 'admin'
  where id = p_id and active = true;
end;
$$;

grant execute on function public.admin_auto_banner_kapat(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tetik: oda coin eşiği
-- ---------------------------------------------------------------------------
create or replace function public.auto_banner_oda_coin_tetik()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_esik bigint;
  v_host text;
  v_cover text;
begin
  if tg_op = 'UPDATE' and new.is_live is distinct from old.is_live and new.is_live = false then
    perform public.auto_banner_kaynak_kapat('room', new.id::text, 'room_closed');
    return new;
  end if;

  if not coalesce(new.is_live, false) then
    return new;
  end if;

  select room_coin_threshold into v_esik from public.auto_banner_settings where id = 1;
  if v_esik is null then return new; end if;

  if coalesce(old.total_coins_earned, 0) < v_esik
     and coalesce(new.total_coins_earned, 0) >= v_esik then
    select display_name, avatar_url into v_host, v_cover
    from public.profiles where id = new.host_id;

    perform public.auto_banner_olustur(
      'room_coins',
      'room_coins:' || new.id::text,
      'room',
      new.id::text,
      coalesce(nullif(trim(new.title), ''), 'Canlı ses odası'),
      coalesce(v_host, 'Host') || ' · ' || new.total_coins_earned::text || ' coin',
      'ATEŞ',
      coalesce(nullif(trim(new.cover_url), ''), v_cover),
      jsonb_build_object('colors', jsonb_build_array('#0F3A36', '#3DCFB0')),
      'INTERNAL_ROOM',
      new.id::text,
      new.total_coins_earned
    );
  end if;

  return new;
end;
$$;

drop trigger if exists auto_banner_oda_coin_trg on public.rooms;
create trigger auto_banner_oda_coin_trg
  after update of total_coins_earned, is_live on public.rooms
  for each row
  execute function public.auto_banner_oda_coin_tetik();

-- ---------------------------------------------------------------------------
-- Tetik: canlı yayın coin eşiği
-- ---------------------------------------------------------------------------
create or replace function public.auto_banner_canli_coin_tetik()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_esik bigint;
  v_host text;
  v_avatar text;
begin
  if tg_op = 'UPDATE' and new.is_live is distinct from old.is_live and new.is_live = false then
    perform public.auto_banner_kaynak_kapat('live_session', new.id::text, 'live_closed');
    return new;
  end if;

  if not coalesce(new.is_live, false) then
    return new;
  end if;

  select live_coin_threshold into v_esik from public.auto_banner_settings where id = 1;
  if v_esik is null then return new; end if;

  if coalesce(old.total_coins_earned, 0) < v_esik
     and coalesce(new.total_coins_earned, 0) >= v_esik then
    select display_name, avatar_url into v_host, v_avatar
    from public.profiles where id = new.host_id;

    perform public.auto_banner_olustur(
      'live_coins',
      'live_coins:' || new.id::text,
      'live_session',
      new.id::text,
      coalesce(nullif(trim(new.title), ''), 'Canlı yayın'),
      coalesce(v_host, 'Yayıncı') || ' · ' || new.total_coins_earned::text || ' coin',
      'CANLI',
      v_avatar,
      jsonb_build_object('colors', jsonb_build_array('#3A1A38', '#E84091')),
      'INTERNAL_LIVE',
      new.id::text,
      new.total_coins_earned
    );
  end if;

  return new;
end;
$$;

drop trigger if exists auto_banner_canli_coin_trg on public.live_sessions;
create trigger auto_banner_canli_coin_trg
  after update of total_coins_earned, is_live on public.live_sessions
  for each row
  execute function public.auto_banner_canli_coin_tetik();

-- ---------------------------------------------------------------------------
-- Tetik: tüm koltuklar dolu
-- ---------------------------------------------------------------------------
create or replace function public.auto_banner_koltuk_dolu_tetik()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room uuid;
  v_total int;
  v_dolu int;
  v_title text;
  v_cover text;
  v_live boolean;
  v_max int;
begin
  v_room := coalesce(new.room_id, old.room_id);
  if v_room is null then return coalesce(new, old); end if;

  select is_live, title, cover_url, coalesce(max_seats, 0)
    into v_live, v_title, v_cover, v_max
  from public.rooms where id = v_room;

  if not coalesce(v_live, false) then
    perform public.auto_banner_kaynak_kapat('room', v_room::text, 'room_closed');
    return coalesce(new, old);
  end if;

  select count(*)::int,
         count(*) filter (where user_id is not null)::int
    into v_total, v_dolu
  from public.room_seats
  where room_id = v_room;

  if v_max > 0 then
    v_total := v_max;
  end if;

  if v_total > 0 and v_dolu >= v_total then
    perform public.auto_banner_olustur(
      'seats_full',
      'seats_full:' || v_room::text,
      'room',
      v_room::text,
      coalesce(nullif(trim(v_title), ''), 'Ses odası'),
      'Tüm koltuklar dolu · ' || v_dolu::text || '/' || v_total::text,
      'DOLU',
      v_cover,
      jsonb_build_object('colors', jsonb_build_array('#1A1228', '#8B5CF6')),
      'INTERNAL_ROOM',
      v_room::text,
      v_dolu
    );
  else
    -- Koltuk boşaldıysa seats_full bannerını kapat
    update public.auto_banners
      set active = false,
          deactivated_at = now(),
          deactivate_reason = 'seats_freed'
    where active = true
      and kind = 'seats_full'
      and ref_id = v_room::text;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists auto_banner_koltuk_dolu_trg on public.room_seats;
create trigger auto_banner_koltuk_dolu_trg
  after insert or update or delete on public.room_seats
  for each row
  execute function public.auto_banner_koltuk_dolu_tetik();

-- ---------------------------------------------------------------------------
-- Tetik: odada oyun coin harcaması eşiği
-- ---------------------------------------------------------------------------
create or replace function public.auto_banner_oyun_coin_tetik()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_esik bigint;
  v_toplam bigint;
  v_title text;
  v_cover text;
  v_live boolean;
begin
  select game_coin_threshold into v_esik from public.auto_banner_settings where id = 1;
  if v_esik is null then return new; end if;

  select coalesce(sum(spent_coin), 0) into v_toplam
  from public.oda_oyun_coin_istatistik
  where room_id = new.room_id;

  select is_live, title, cover_url into v_live, v_title, v_cover
  from public.rooms where id = new.room_id;

  if not coalesce(v_live, false) then
    return new;
  end if;

  if v_toplam >= v_esik then
    perform public.auto_banner_olustur(
      'game_coins',
      'game_coins:' || new.room_id::text,
      'room',
      new.room_id::text,
      coalesce(nullif(trim(v_title), ''), 'Oyun odası'),
      'Oyunda ' || v_toplam::text || ' coin harcandı',
      'OYUN',
      v_cover,
      jsonb_build_object('colors', jsonb_build_array('#1A1020', '#F0B429')),
      'INTERNAL_ROOM',
      new.room_id::text,
      v_toplam
    );
  end if;

  return new;
end;
$$;

drop trigger if exists auto_banner_oyun_coin_trg on public.oda_oyun_coin_istatistik;
create trigger auto_banner_oyun_coin_trg
  after insert or update of spent_coin on public.oda_oyun_coin_istatistik
  for each row
  execute function public.auto_banner_oyun_coin_tetik();

-- Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table public.auto_banners;
  exception when duplicate_object then
    null;
  end;
end $$;
