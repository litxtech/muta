-- =============================================================================
-- Kişiler Keşfi + Ücretli Sesli/Görüntülü Arama (people-discovery)
-- Mevcut gorusme / wallets / host_earnings / feature_flags üzerine kurulur.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Feature flags + kill switches
-- ---------------------------------------------------------------------------
insert into public.feature_flags (key, enabled, description) values
  ('people_discovery_enabled', true, 'Kişiler keşfi master'),
  ('people_personalized_enabled', true, 'Sana Özel algoritması'),
  ('people_gender_filter_enabled', true, 'Kadın/Erkek filtresi'),
  ('people_country_filter_enabled', true, 'Ülke filtresi'),
  ('people_online_filter_enabled', true, 'Çevrimiçi filtresi'),
  ('people_price_filter_enabled', true, 'Coin/dk filtresi'),
  ('people_message_enabled', true, 'Keşiften mesaj'),
  ('people_voice_call_enabled', true, 'Keşif sesli arama'),
  ('people_video_call_enabled', true, 'Keşif görüntülü arama'),
  ('people_paid_calling_enabled', true, 'Dakikalık ücretlendirme'),
  ('people_show_prices_enabled', true, 'Kartlarda fiyat göster'),
  ('people_show_country_flags', true, 'Ülke bayrağı göster'),
  ('people_show_online_indicators', true, 'Online gösterge')
on conflict (key) do nothing;

insert into public.kill_switches (key, active, reason) values
  ('kill_people_discovery', false, 'Kişiler keşfini acil kapat (veri silinmez)'),
  ('kill_people_paid_calls', false, 'Ücretli aramayı acil kapat')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2) Merkezi config (admin)
-- ---------------------------------------------------------------------------
create table if not exists public.people_discovery_config (
  id smallint primary key default 1 check (id = 1),
  algorithm_version text not null default 'v1',
  voice_price_min int not null default 20 check (voice_price_min >= 1),
  voice_price_max int not null default 65 check (voice_price_max >= voice_price_min),
  video_price_min int not null default 20 check (video_price_min >= 1),
  video_price_max int not null default 65 check (video_price_max >= video_price_min),
  platform_call_fee numeric(5,4) not null default 0.2000
    check (platform_call_fee >= 0 and platform_call_fee < 1),
  billing_mode text not null default 'per_second_ceil'
    check (billing_mode in ('per_second_ceil', 'per_second_floor', 'started_minute')),
  ring_timeout_sec int not null default 45 check (ring_timeout_sec between 15 and 120),
  online_window_sec int not null default 300 check (online_window_sec between 60 and 3600),
  page_size int not null default 20 check (page_size between 5 and 50),
  weight_preference int not null default 40,
  weight_online int not null default 25,
  weight_recent_activity int not null default 15,
  weight_availability int not null default 15,
  weight_profile_quality int not null default 10,
  weight_relationship int not null default 20,
  weight_new_user int not null default 12,
  weight_repeat_penalty int not null default 30,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.people_discovery_config (id) values (1)
on conflict (id) do nothing;

alter table public.people_discovery_config enable row level security;

drop policy if exists people_discovery_config_select on public.people_discovery_config;
create policy people_discovery_config_select
  on public.people_discovery_config for select to authenticated
  using (true);

drop policy if exists people_discovery_config_admin on public.people_discovery_config;
create policy people_discovery_config_admin
  on public.people_discovery_config for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

-- ---------------------------------------------------------------------------
-- 3) Kullanıcı keşif / arama tercihleri (private)
-- ---------------------------------------------------------------------------
create table if not exists public.people_call_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  discoverable boolean not null default true,
  discovery_preference text not null default 'everyone'
    check (discovery_preference in ('female', 'male', 'everyone')),
  show_country boolean not null default true,
  show_online_status boolean not null default true,
  calls_open boolean not null default true,
  voice_calls_enabled boolean not null default true,
  video_calls_enabled boolean not null default true,
  call_permission text not null default 'everyone'
    check (call_permission in ('everyone', 'following', 'nobody')),
  voice_price_per_minute int not null default 25,
  video_price_per_minute int not null default 45,
  discovery_restricted boolean not null default false,
  discovery_restricted_reason text,
  discovery_restricted_at timestamptz,
  discovery_restricted_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists people_call_settings_discoverable_idx
  on public.people_call_settings (discoverable)
  where discoverable = true and discovery_restricted = false;

alter table public.people_call_settings enable row level security;

drop policy if exists people_call_settings_own on public.people_call_settings;
create policy people_call_settings_own
  on public.people_call_settings for all to authenticated
  using (auth.uid() = user_id or public.ben_admin_miyim())
  with check (auth.uid() = user_id or public.ben_admin_miyim());

-- ---------------------------------------------------------------------------
-- 4) Recently shown (repeat fatigue)
-- ---------------------------------------------------------------------------
create table if not exists public.people_discovery_impressions (
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  shown_user_id uuid not null references public.profiles(id) on delete cascade,
  shown_at timestamptz not null default now(),
  primary key (viewer_id, shown_user_id)
);

create index if not exists people_discovery_impressions_viewer_at_idx
  on public.people_discovery_impressions (viewer_id, shown_at desc);

alter table public.people_discovery_impressions enable row level security;

drop policy if exists people_discovery_impressions_own on public.people_discovery_impressions;
create policy people_discovery_impressions_own
  on public.people_discovery_impressions for all to authenticated
  using (auth.uid() = viewer_id)
  with check (auth.uid() = viewer_id);

-- ---------------------------------------------------------------------------
-- 5) direct_calls billing kolonları (mevcut tabloyu genişlet)
-- ---------------------------------------------------------------------------
alter table public.direct_calls
  add column if not exists is_paid boolean not null default false,
  add column if not exists price_per_minute_snapshot int,
  add column if not exists platform_fee_rate_snapshot numeric(5,4),
  add column if not exists billing_status text
    check (billing_status is null or billing_status in (
      'PENDING', 'RESERVED', 'ACTIVE', 'FINALIZING', 'FINALIZED', 'RELEASED', 'FAILED'
    )),
  add column if not exists reserved_coins bigint not null default 0,
  add column if not exists billable_seconds int not null default 0,
  add column if not exists gross_coin_amount bigint not null default 0,
  add column if not exists platform_fee_coins bigint not null default 0,
  add column if not exists creator_share_coins bigint not null default 0,
  add column if not exists billing_finalized_at timestamptz,
  add column if not exists last_billing_heartbeat_at timestamptz,
  add column if not exists discovery_source text;

create index if not exists direct_calls_billing_active_idx
  on public.direct_calls (caller_id, status)
  where is_paid and status in ('ringing', 'active');

create index if not exists direct_calls_callee_active_idx
  on public.direct_calls (callee_id, status)
  where status in ('ringing', 'active');

-- ---------------------------------------------------------------------------
-- 6) Helpers
-- ---------------------------------------------------------------------------
create or replace function public.kisiler_feature_effective()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_master boolean;
  v_kill boolean;
begin
  v_kill := coalesce(public.kill_switch_aktif_mi('kill_people_discovery'), false);
  v_master := coalesce(public.ozellik_bayragi_aktif_mi('people_discovery_enabled'), false)
    and not v_kill;

  return jsonb_build_object(
    'people_discovery_enabled', v_master,
    'personalized_enabled', v_master and coalesce(public.ozellik_bayragi_aktif_mi('people_personalized_enabled'), false),
    'gender_filter_enabled', v_master and coalesce(public.ozellik_bayragi_aktif_mi('people_gender_filter_enabled'), false),
    'country_filter_enabled', v_master and coalesce(public.ozellik_bayragi_aktif_mi('people_country_filter_enabled'), false),
    'online_filter_enabled', v_master and coalesce(public.ozellik_bayragi_aktif_mi('people_online_filter_enabled'), false),
    'price_filter_enabled', v_master and coalesce(public.ozellik_bayragi_aktif_mi('people_price_filter_enabled'), false),
    'message_enabled', v_master and coalesce(public.ozellik_bayragi_aktif_mi('people_message_enabled'), false),
    'voice_call_enabled', v_master and coalesce(public.ozellik_bayragi_aktif_mi('people_voice_call_enabled'), false),
    'video_call_enabled', v_master and coalesce(public.ozellik_bayragi_aktif_mi('people_video_call_enabled'), false),
    'paid_calling_enabled', v_master
      and coalesce(public.ozellik_bayragi_aktif_mi('people_paid_calling_enabled'), false)
      and not coalesce(public.kill_switch_aktif_mi('kill_people_paid_calls'), false),
    'show_prices', v_master and coalesce(public.ozellik_bayragi_aktif_mi('people_show_prices_enabled'), false),
    'show_country_flags', v_master and coalesce(public.ozellik_bayragi_aktif_mi('people_show_country_flags'), false),
    'show_online_indicators', v_master and coalesce(public.ozellik_bayragi_aktif_mi('people_show_online_indicators'), false)
  );
end;
$$;

grant execute on function public.kisiler_feature_effective() to authenticated;
grant execute on function public.kisiler_feature_effective() to anon;

create or replace function public.kisiler_ayar_ensure(p_uid uuid)
returns public.people_call_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.people_call_settings%rowtype;
  v_cfg public.people_discovery_config%rowtype;
begin
  select * into v from public.people_call_settings where user_id = p_uid;
  if found then return v; end if;

  select * into v_cfg from public.people_discovery_config where id = 1;

  insert into public.people_call_settings (
    user_id, voice_price_per_minute, video_price_per_minute
  ) values (
    p_uid,
    least(greatest(25, coalesce(v_cfg.voice_price_min, 20)), coalesce(v_cfg.voice_price_max, 65)),
    least(greatest(45, coalesce(v_cfg.video_price_min, 20)), coalesce(v_cfg.video_price_max, 65))
  )
  on conflict (user_id) do nothing
  returning * into v;

  if not found then
    select * into v from public.people_call_settings where user_id = p_uid;
  end if;
  return v;
end;
$$;

create or replace function public.kisiler_clamp_price(p_price int, p_min int, p_max int)
returns int
language sql
immutable
as $$
  select least(greatest(coalesce(p_price, p_min), p_min), p_max);
$$;

create or replace function public.kisiler_billable_coins(
  p_seconds int,
  p_price_per_minute int,
  p_mode text
)
returns bigint
language plpgsql
immutable
as $$
declare
  v_sec int := greatest(coalesce(p_seconds, 0), 0);
  v_price int := greatest(coalesce(p_price_per_minute, 0), 0);
begin
  if v_sec <= 0 or v_price <= 0 then return 0; end if;

  if p_mode = 'started_minute' then
    return (ceil(v_sec::numeric / 60.0) * v_price)::bigint;
  elsif p_mode = 'per_second_floor' then
    return floor((v_sec::numeric * v_price) / 60.0)::bigint;
  else
    -- per_second_ceil (default, adil üst yuvarlama)
    return ceil((v_sec::numeric * v_price) / 60.0)::bigint;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) Config get / admin update
-- ---------------------------------------------------------------------------
create or replace function public.kisiler_config_getir()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v public.people_discovery_config%rowtype;
  v_feat jsonb;
begin
  v_feat := public.kisiler_feature_effective();
  select * into v from public.people_discovery_config where id = 1;
  if not found then
    return v_feat || jsonb_build_object(
      'algorithm_version', 'v1',
      'voice_price_min', 20,
      'voice_price_max', 65,
      'video_price_min', 20,
      'video_price_max', 65,
      'platform_call_fee', 0.2,
      'billing_mode', 'per_second_ceil'
    );
  end if;

  return v_feat || jsonb_build_object(
    'algorithm_version', v.algorithm_version,
    'voice_price_min', v.voice_price_min,
    'voice_price_max', v.voice_price_max,
    'video_price_min', v.video_price_min,
    'video_price_max', v.video_price_max,
    'platform_call_fee', v.platform_call_fee,
    'billing_mode', v.billing_mode,
    'ring_timeout_sec', v.ring_timeout_sec,
    'online_window_sec', v.online_window_sec,
    'page_size', v.page_size,
    'weights', jsonb_build_object(
      'preference', v.weight_preference,
      'online', v.weight_online,
      'recent_activity', v.weight_recent_activity,
      'availability', v.weight_availability,
      'profile_quality', v.weight_profile_quality,
      'relationship', v.weight_relationship,
      'new_user', v.weight_new_user,
      'repeat_penalty', v.weight_repeat_penalty
    ),
    'updated_at', v.updated_at
  );
end;
$$;

grant execute on function public.kisiler_config_getir() to authenticated;
grant execute on function public.kisiler_config_getir() to anon;

create or replace function public.admin_kisiler_config_guncelle(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.people_discovery_config%rowtype;
  v_voice_min int;
  v_voice_max int;
  v_video_min int;
  v_video_max int;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;

  select * into v from public.people_discovery_config where id = 1 for update;
  if not found then
    insert into public.people_discovery_config (id) values (1);
    select * into v from public.people_discovery_config where id = 1 for update;
  end if;

  v_voice_min := coalesce((p->>'voice_price_min')::int, v.voice_price_min);
  v_voice_max := coalesce((p->>'voice_price_max')::int, v.voice_price_max);
  v_video_min := coalesce((p->>'video_price_min')::int, v.video_price_min);
  v_video_max := coalesce((p->>'video_price_max')::int, v.video_price_max);

  if v_voice_min < 1 or v_voice_max < v_voice_min then
    raise exception 'Gecersiz sesli fiyat araligi';
  end if;
  if v_video_min < 1 or v_video_max < v_video_min then
    raise exception 'Gecersiz goruntulu fiyat araligi';
  end if;

  update public.people_discovery_config set
    algorithm_version = coalesce(nullif(trim(p->>'algorithm_version'), ''), algorithm_version),
    voice_price_min = v_voice_min,
    voice_price_max = v_voice_max,
    video_price_min = v_video_min,
    video_price_max = v_video_max,
    platform_call_fee = coalesce((p->>'platform_call_fee')::numeric, platform_call_fee),
    billing_mode = coalesce(nullif(trim(p->>'billing_mode'), ''), billing_mode),
    ring_timeout_sec = coalesce((p->>'ring_timeout_sec')::int, ring_timeout_sec),
    online_window_sec = coalesce((p->>'online_window_sec')::int, online_window_sec),
    page_size = coalesce((p->>'page_size')::int, page_size),
    weight_preference = coalesce((p->'weights'->>'preference')::int, weight_preference),
    weight_online = coalesce((p->'weights'->>'online')::int, weight_online),
    weight_recent_activity = coalesce((p->'weights'->>'recent_activity')::int, weight_recent_activity),
    weight_availability = coalesce((p->'weights'->>'availability')::int, weight_availability),
    weight_profile_quality = coalesce((p->'weights'->>'profile_quality')::int, weight_profile_quality),
    weight_relationship = coalesce((p->'weights'->>'relationship')::int, weight_relationship),
    weight_new_user = coalesce((p->'weights'->>'new_user')::int, weight_new_user),
    weight_repeat_penalty = coalesce((p->'weights'->>'repeat_penalty')::int, weight_repeat_penalty),
    updated_at = now(),
    updated_by = auth.uid()
  where id = 1;

  -- Kullanıcı fiyatlarını yeni aralığa clamp et (açık migration policy)
  update public.people_call_settings set
    voice_price_per_minute = public.kisiler_clamp_price(voice_price_per_minute, v_voice_min, v_voice_max),
    video_price_per_minute = public.kisiler_clamp_price(video_price_per_minute, v_video_min, v_video_max),
    updated_at = now()
  where voice_price_per_minute < v_voice_min
     or voice_price_per_minute > v_voice_max
     or video_price_per_minute < v_video_min
     or video_price_per_minute > v_video_max;

  return public.kisiler_config_getir();
end;
$$;

grant execute on function public.admin_kisiler_config_guncelle(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) Kullanıcı ayarları get/update
-- ---------------------------------------------------------------------------
create or replace function public.kisiler_ayarlari_getir(p_user_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid := coalesce(p_user_id, v_uid);
  v public.people_call_settings%rowtype;
  v_cfg public.people_discovery_config%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_target <> v_uid and not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;

  v := public.kisiler_ayar_ensure(v_target);
  select * into v_cfg from public.people_discovery_config where id = 1;

  return jsonb_build_object(
    'user_id', v.user_id,
    'discoverable', v.discoverable and not v.discovery_restricted,
    'discoverable_raw', v.discoverable,
    'discovery_restricted', v.discovery_restricted,
    'discovery_preference', v.discovery_preference,
    'show_country', v.show_country,
    'show_online_status', v.show_online_status,
    'calls_open', v.calls_open,
    'voice_calls_enabled', v.voice_calls_enabled,
    'video_calls_enabled', v.video_calls_enabled,
    'call_permission', v.call_permission,
    'voice_price_per_minute', public.kisiler_clamp_price(
      v.voice_price_per_minute, coalesce(v_cfg.voice_price_min, 20), coalesce(v_cfg.voice_price_max, 65)
    ),
    'video_price_per_minute', public.kisiler_clamp_price(
      v.video_price_per_minute, coalesce(v_cfg.video_price_min, 20), coalesce(v_cfg.video_price_max, 65)
    ),
    'voice_price_min', coalesce(v_cfg.voice_price_min, 20),
    'voice_price_max', coalesce(v_cfg.voice_price_max, 65),
    'video_price_min', coalesce(v_cfg.video_price_min, 20),
    'video_price_max', coalesce(v_cfg.video_price_max, 65)
  );
end;
$$;

grant execute on function public.kisiler_ayarlari_getir(uuid) to authenticated;

create or replace function public.kisiler_ayarlari_guncelle(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v public.people_call_settings%rowtype;
  v_cfg public.people_discovery_config%rowtype;
  v_voice int;
  v_video int;
  v_pref text;
  v_perm text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  v := public.kisiler_ayar_ensure(v_uid);
  select * into v_cfg from public.people_discovery_config where id = 1;

  if p ? 'discovery_preference' then
    v_pref := lower(trim(p->>'discovery_preference'));
    if v_pref not in ('female', 'male', 'everyone') then
      raise exception 'Gecersiz kesif tercihi';
    end if;
  else
    v_pref := v.discovery_preference;
  end if;

  if p ? 'call_permission' then
    v_perm := lower(trim(p->>'call_permission'));
    if v_perm not in ('everyone', 'following', 'nobody') then
      raise exception 'Gecersiz arama izni';
    end if;
  else
    v_perm := v.call_permission;
  end if;

  v_voice := public.kisiler_clamp_price(
    coalesce((p->>'voice_price_per_minute')::int, v.voice_price_per_minute),
    coalesce(v_cfg.voice_price_min, 20),
    coalesce(v_cfg.voice_price_max, 65)
  );
  v_video := public.kisiler_clamp_price(
    coalesce((p->>'video_price_per_minute')::int, v.video_price_per_minute),
    coalesce(v_cfg.video_price_min, 20),
    coalesce(v_cfg.video_price_max, 65)
  );

  if p ? 'voice_price_per_minute' then
    if (p->>'voice_price_per_minute')::int < coalesce(v_cfg.voice_price_min, 20)
       or (p->>'voice_price_per_minute')::int > coalesce(v_cfg.voice_price_max, 65) then
      raise exception 'Sesli arama ucreti %-% coin arasinda olmalidir',
        v_cfg.voice_price_min, v_cfg.voice_price_max;
    end if;
  end if;
  if p ? 'video_price_per_minute' then
    if (p->>'video_price_per_minute')::int < coalesce(v_cfg.video_price_min, 20)
       or (p->>'video_price_per_minute')::int > coalesce(v_cfg.video_price_max, 65) then
      raise exception 'Goruntulu arama ucreti %-% coin arasinda olmalidir',
        v_cfg.video_price_min, v_cfg.video_price_max;
    end if;
  end if;

  update public.people_call_settings set
    -- Admin restriction varken user discoverable ON ile bypass edemez
    discoverable = case
      when discovery_restricted then false
      when p ? 'discoverable' then coalesce((p->>'discoverable')::boolean, discoverable)
      else discoverable
    end,
    discovery_preference = v_pref,
    show_country = case when p ? 'show_country' then coalesce((p->>'show_country')::boolean, show_country) else show_country end,
    show_online_status = case when p ? 'show_online_status' then coalesce((p->>'show_online_status')::boolean, show_online_status) else show_online_status end,
    calls_open = case when p ? 'calls_open' then coalesce((p->>'calls_open')::boolean, calls_open) else calls_open end,
    voice_calls_enabled = case when p ? 'voice_calls_enabled' then coalesce((p->>'voice_calls_enabled')::boolean, voice_calls_enabled) else voice_calls_enabled end,
    video_calls_enabled = case when p ? 'video_calls_enabled' then coalesce((p->>'video_calls_enabled')::boolean, video_calls_enabled) else video_calls_enabled end,
    call_permission = v_perm,
    voice_price_per_minute = v_voice,
    video_price_per_minute = v_video,
    updated_at = now()
  where user_id = v_uid;

  return public.kisiler_ayarlari_getir(v_uid);
end;
$$;

grant execute on function public.kisiler_ayarlari_guncelle(jsonb) to authenticated;

-- Admin: discovery restrict
create or replace function public.admin_kisiler_kesif_kisitla(
  p_user_id uuid,
  p_restricted boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  perform public.kisiler_ayar_ensure(p_user_id);

  update public.people_call_settings set
    discovery_restricted = coalesce(p_restricted, false),
    discovery_restricted_reason = case when p_restricted then nullif(trim(p_reason), '') else null end,
    discovery_restricted_at = case when p_restricted then now() else null end,
    discovery_restricted_by = case when p_restricted then auth.uid() else null end,
    discoverable = case when p_restricted then false else discoverable end,
    updated_at = now()
  where user_id = p_user_id;

  return public.kisiler_ayarlari_getir(p_user_id);
end;
$$;

grant execute on function public.admin_kisiler_kesif_kisitla(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9) Discovery RPC (public projection only)
-- ---------------------------------------------------------------------------
create or replace function public.kisiler_kesif_getir(
  p_tab text default 'for_you',
  p_gender text default null,
  p_country_code text default null,
  p_online_only boolean default false,
  p_price_min int default null,
  p_price_max int default null,
  p_price_kind text default 'voice',
  p_query text default null,
  p_cursor float8 default null,
  p_limit int default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_feat jsonb;
  v_cfg public.people_discovery_config%rowtype;
  v_my public.people_call_settings%rowtype;
  v_tab text := lower(coalesce(nullif(trim(p_tab), ''), 'for_you'));
  v_gender text := lower(nullif(trim(p_gender), ''));
  v_country text := upper(nullif(trim(p_country_code), ''));
  v_q text := nullif(trim(p_query), '');
  v_limit int;
  v_online_window interval;
  v_items jsonb := '[]'::jsonb;
  v_next float8;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  v_feat := public.kisiler_feature_effective();
  if not coalesce((v_feat->>'people_discovery_enabled')::boolean, false) then
    return jsonb_build_object(
      'ok', false,
      'error', 'feature_unavailable',
      'message', 'Bu ozellik su anda kullanilamiyor.',
      'items', '[]'::jsonb,
      'next_cursor', null
    );
  end if;

  select * into v_cfg from public.people_discovery_config where id = 1;
  v_limit := least(greatest(coalesce(p_limit, coalesce(v_cfg.page_size, 20)), 1), 40);
  v_online_window := make_interval(secs => coalesce(v_cfg.online_window_sec, 300));
  v_my := public.kisiler_ayar_ensure(v_uid);

  if v_tab = 'female' then
    if not coalesce((v_feat->>'gender_filter_enabled')::boolean, false) then
      v_tab := 'for_you';
    else
      v_gender := 'female';
    end if;
  elsif v_tab = 'male' then
    if not coalesce((v_feat->>'gender_filter_enabled')::boolean, false) then
      v_tab := 'for_you';
    else
      v_gender := 'male';
    end if;
  end if;

  if v_q is not null and char_length(v_q) < 2 then
    v_q := null;
  end if;
  if v_q is not null then
    v_q := left(v_q, 40);
  end if;

  with candidates as (
    select
      p.id,
      p.display_name,
      p.username,
      p.avatar_url,
      p.is_verified,
      p.level,
      p.gender,
      p.country_code,
      p.created_at,
      p.updated_at,
      coalesce(s.discoverable, true) as discoverable,
      coalesce(s.discovery_restricted, false) as discovery_restricted,
      coalesce(s.show_country, true) as show_country,
      coalesce(s.show_online_status, true) as show_online_status,
      coalesce(s.calls_open, true) as calls_open,
      coalesce(s.voice_calls_enabled, true) as voice_calls_enabled,
      coalesce(s.video_calls_enabled, true) as video_calls_enabled,
      coalesce(s.call_permission, 'everyone') as call_permission,
      public.kisiler_clamp_price(coalesce(s.voice_price_per_minute, 25), v_cfg.voice_price_min, v_cfg.voice_price_max) as voice_price,
      public.kisiler_clamp_price(coalesce(s.video_price_per_minute, 45), v_cfg.video_price_min, v_cfg.video_price_max) as video_price,
      exists (
        select 1 from public.device_sessions ds
        where ds.user_id = p.id
          and ds.revoked_at is null
          and ds.last_seen_at > now() - v_online_window
      ) as raw_online,
      exists (
        select 1 from public.direct_calls dc
        where dc.status in ('ringing', 'active')
          and (dc.caller_id = p.id or dc.callee_id = p.id)
      ) as is_busy,
      exists (
        select 1 from public.follows f
        where f.follower_id = v_uid and f.following_id = p.id
      ) as i_follow,
      exists (
        select 1 from public.follows f
        where f.follower_id = p.id and f.following_id = v_uid
      ) as follows_me,
      coalesce((
        select extract(epoch from (now() - i.shown_at))
        from public.people_discovery_impressions i
        where i.viewer_id = v_uid and i.shown_user_id = p.id
      ), 999999)::float8 as secs_since_shown,
      -- privacy-safe online
      case
        when coalesce(ups.hide_online_status, false) then false
        when not coalesce(s.show_online_status, true) then false
        else exists (
          select 1 from public.device_sessions ds
          where ds.user_id = p.id
            and ds.revoked_at is null
            and ds.last_seen_at > now() - v_online_window
        )
      end as online_display
    from public.profiles p
    left join public.people_call_settings s on s.user_id = p.id
    left join public.user_privacy_settings ups on ups.user_id = p.id
    where p.id <> v_uid
      and p.deleted_at is null
      and coalesce(p.is_guest, false) = false
      and coalesce(p.account_status, 'active') = 'active'
      and p.banned_at is null
      and (p.banned_until is null or p.banned_until < now())
      and coalesce(s.discoverable, true) = true
      and coalesce(s.discovery_restricted, false) = false
      and not public.kullanicilar_engelli_mi(v_uid, p.id)
      and (
        v_gender is null
        or (
          v_gender = 'female' and lower(coalesce(p.gender, '')) = 'female'
        )
        or (
          v_gender = 'male' and lower(coalesce(p.gender, '')) = 'male'
        )
      )
      and (
        v_country is null
        or not coalesce((v_feat->>'country_filter_enabled')::boolean, false)
        or (coalesce(s.show_country, true) and upper(coalesce(p.country_code, '')) = v_country)
      )
      and (
        not coalesce(p_online_only, false)
        or not coalesce((v_feat->>'online_filter_enabled')::boolean, false)
        or (
          not coalesce(ups.hide_online_status, false)
          and coalesce(s.show_online_status, true)
          and exists (
            select 1 from public.device_sessions ds
            where ds.user_id = p.id
              and ds.revoked_at is null
              and ds.last_seen_at > now() - v_online_window
          )
        )
      )
      and (
        p_price_min is null
        or not coalesce((v_feat->>'price_filter_enabled')::boolean, false)
        or (
          case when lower(coalesce(p_price_kind, 'voice')) = 'video'
            then public.kisiler_clamp_price(coalesce(s.video_price_per_minute, 45), v_cfg.video_price_min, v_cfg.video_price_max)
            else public.kisiler_clamp_price(coalesce(s.voice_price_per_minute, 25), v_cfg.voice_price_min, v_cfg.voice_price_max)
          end
        ) >= p_price_min
      )
      and (
        p_price_max is null
        or not coalesce((v_feat->>'price_filter_enabled')::boolean, false)
        or (
          case when lower(coalesce(p_price_kind, 'voice')) = 'video'
            then public.kisiler_clamp_price(coalesce(s.video_price_per_minute, 45), v_cfg.video_price_min, v_cfg.video_price_max)
            else public.kisiler_clamp_price(coalesce(s.voice_price_per_minute, 25), v_cfg.voice_price_min, v_cfg.voice_price_max)
          end
        ) <= p_price_max
      )
      and (
        v_q is null
        or p.display_name ilike '%' || replace(replace(v_q, '%', ''), '_', '') || '%'
        or p.username ilike '%' || replace(replace(v_q, '%', ''), '_', '') || '%'
      )
      -- for_you preference filter (explicit gender preference only; unspecified genders stay in everyone pool)
      and (
        v_tab <> 'for_you'
        or not coalesce((v_feat->>'personalized_enabled')::boolean, false)
        or v_my.discovery_preference = 'everyone'
        or (
          v_my.discovery_preference = 'female'
          and (
            lower(coalesce(p.gender, '')) = 'female'
            or lower(coalesce(p.gender, '')) in ('other', 'prefer_not', '')
            or p.gender is null
          )
        )
        or (
          v_my.discovery_preference = 'male'
          and (
            lower(coalesce(p.gender, '')) = 'male'
            or lower(coalesce(p.gender, '')) in ('other', 'prefer_not', '')
            or p.gender is null
          )
        )
      )
  ),
  scored as (
    select
      c.*,
      (
        case
          when v_tab = 'for_you' and v_my.discovery_preference <> 'everyone'
               and lower(coalesce(c.gender, '')) = v_my.discovery_preference
            then coalesce(v_cfg.weight_preference, 40)
          else 0
        end
        + case when c.online_display then coalesce(v_cfg.weight_online, 25) else 0 end
        + case
            when c.updated_at > now() - interval '7 days' then coalesce(v_cfg.weight_recent_activity, 15)
            when c.updated_at > now() - interval '30 days' then coalesce(v_cfg.weight_recent_activity, 15) / 2
            else 0
          end
        + case
            when c.calls_open and not c.is_busy then coalesce(v_cfg.weight_availability, 15)
            when c.calls_open then coalesce(v_cfg.weight_availability, 15) / 3
            else 0
          end
        + case
            when c.avatar_url is not null and nullif(trim(c.display_name), '') is not null
              then coalesce(v_cfg.weight_profile_quality, 10)
            when c.avatar_url is not null or nullif(trim(c.display_name), '') is not null
              then coalesce(v_cfg.weight_profile_quality, 10) / 2
            else 0
          end
        + case
            when c.i_follow and c.follows_me then coalesce(v_cfg.weight_relationship, 20)
            when c.i_follow or c.follows_me then coalesce(v_cfg.weight_relationship, 20) / 2
            else 0
          end
        + case
            when c.created_at > now() - interval '14 days' then coalesce(v_cfg.weight_new_user, 12)
            else 0
          end
        - case
            when c.secs_since_shown < 3600 then coalesce(v_cfg.weight_repeat_penalty, 30)
            when c.secs_since_shown < 86400 then coalesce(v_cfg.weight_repeat_penalty, 30) / 2
            else 0
          end
        + (extract(epoch from c.created_at) / 1000000000.0)
      )::float8 as score
    from candidates c
  ),
  page as (
    select *
    from scored
    where p_cursor is null or score < p_cursor
    order by score desc, id asc
    limit v_limit
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'user_id', p.id,
        'display_name', p.display_name,
        'username', p.username,
        'avatar_url', p.avatar_url,
        'is_verified', coalesce(p.is_verified, false),
        'level', p.level,
        'public_country_code', case
          when coalesce((v_feat->>'show_country_flags')::boolean, false)
               and p.show_country
            then p.country_code
          else null
        end,
        'online_display', case
          when coalesce((v_feat->>'show_online_indicators')::boolean, false)
            then p.online_display
          else false
        end,
        'call_availability', case
          when p.is_busy then 'BUSY'
          when not p.calls_open then 'OFFLINE'
          else 'AVAILABLE'
        end,
        'voice_call_enabled', coalesce((v_feat->>'voice_call_enabled')::boolean, false)
          and p.calls_open and p.voice_calls_enabled and not p.is_busy,
        'video_call_enabled', coalesce((v_feat->>'video_call_enabled')::boolean, false)
          and p.calls_open and p.video_calls_enabled and not p.is_busy,
        'message_enabled', coalesce((v_feat->>'message_enabled')::boolean, false),
        'voice_price', case
          when coalesce((v_feat->>'show_prices')::boolean, false) then p.voice_price
          else null
        end,
        'video_price', case
          when coalesce((v_feat->>'show_prices')::boolean, false) then p.video_price
          else null
        end,
        'score', p.score
      )
      order by p.score desc, p.id asc
    ), '[]'::jsonb),
    (select min(score) from page)
  into v_items, v_next
  from page p;

  -- impression upsert (best-effort)
  insert into public.people_discovery_impressions (viewer_id, shown_user_id, shown_at)
  select v_uid, (x->>'user_id')::uuid, now()
  from jsonb_array_elements(v_items) x
  on conflict (viewer_id, shown_user_id) do update
    set shown_at = excluded.shown_at;

  return jsonb_build_object(
    'ok', true,
    'items', coalesce(v_items, '[]'::jsonb),
    'next_cursor', case when jsonb_array_length(coalesce(v_items, '[]'::jsonb)) >= v_limit then v_next else null end,
    'features', v_feat,
    'algorithm_version', coalesce(v_cfg.algorithm_version, 'v1')
  );
end;
$$;

grant execute on function public.kisiler_kesif_getir(text, text, text, boolean, int, int, text, text, float8, int) to authenticated;
-- ---------------------------------------------------------------------------
-- 10) Paid call start + billing finalize (extends direct_calls)
-- ---------------------------------------------------------------------------
create or replace function public.kisiler_ucretli_gorusme_baslat(
  p_callee_id uuid,
  p_call_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_feat jsonb;
  v_type text := lower(trim(p_call_type));
  v_cfg public.people_discovery_config%rowtype;
  v_callee public.people_call_settings%rowtype;
  v_guest boolean;
  v_peer_guest boolean;
  v_price int;
  v_balance bigint;
  v_thread uuid;
  v_row public.direct_calls%rowtype;
  v_channel text;
  v_follows boolean;
  v_paid boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_callee_id is null or p_callee_id = v_uid then
    raise exception 'Self-call yasak';
  end if;
  if v_type not in ('audio', 'video') then raise exception 'Gecersiz cagri turu'; end if;

  v_feat := public.kisiler_feature_effective();
  if not coalesce((v_feat->>'people_discovery_enabled')::boolean, false) then
    raise exception 'Bu ozellik su anda kullanilamiyor';
  end if;
  if v_type = 'audio' and not coalesce((v_feat->>'voice_call_enabled')::boolean, false) then
    raise exception 'Sesli arama kapali';
  end if;
  if v_type = 'video' and not coalesce((v_feat->>'video_call_enabled')::boolean, false) then
    raise exception 'Goruntulu arama kapali';
  end if;

  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir arama yapamaz'; end if;

  select is_guest into v_peer_guest from public.profiles
  where id = p_callee_id and deleted_at is null and banned_at is null;
  if not found or coalesce(v_peer_guest, false) then
    raise exception 'Karsi kullanici uygun degil';
  end if;

  if public.kullanicilar_engelli_mi(v_uid, p_callee_id) then
    raise exception 'Bu kullaniciyla iletisim engellenmis';
  end if;

  select * into v_cfg from public.people_discovery_config where id = 1;
  v_callee := public.kisiler_ayar_ensure(p_callee_id);

  if not v_callee.calls_open then raise exception 'Kullanici aramalara kapali'; end if;
  if v_type = 'audio' and not v_callee.voice_calls_enabled then
    raise exception 'Sesli arama kabul etmiyor';
  end if;
  if v_type = 'video' and not v_callee.video_calls_enabled then
    raise exception 'Goruntulu arama kabul etmiyor';
  end if;

  if v_callee.call_permission = 'nobody' then
    raise exception 'Kullanici arama kabul etmiyor';
  elsif v_callee.call_permission = 'following' then
    select exists (
      select 1 from public.follows
      where follower_id = p_callee_id and following_id = v_uid
    ) into v_follows;
    if not v_follows then
      raise exception 'Sadece takip ettikleri arayabilir';
    end if;
  end if;

  -- Concurrent call protection (any active for either party)
  if exists (
    select 1 from public.direct_calls
    where status in ('ringing', 'active')
      and (caller_id = v_uid or callee_id = v_uid or caller_id = p_callee_id or callee_id = p_callee_id)
  ) then
    raise exception 'Zaten aktif bir gorusme var';
  end if;

  perform public.gorusme_stale_temizle();

  v_paid := coalesce((v_feat->>'paid_calling_enabled')::boolean, false);
  if v_type = 'audio' then
    v_price := public.kisiler_clamp_price(
      v_callee.voice_price_per_minute, v_cfg.voice_price_min, v_cfg.voice_price_max
    );
  else
    v_price := public.kisiler_clamp_price(
      v_callee.video_price_per_minute, v_cfg.video_price_min, v_cfg.video_price_max
    );
  end if;

  if v_paid then
    insert into public.wallets (user_id, coins, diamonds)
    values (v_uid, 0, 0) on conflict (user_id) do nothing;
    select coins into v_balance from public.wallets where user_id = v_uid for update;
    if coalesce(v_balance, 0) < v_price then
      raise exception 'Yetersiz coin bakiyesi';
    end if;
  end if;

  -- Open or get DM thread
  select public.ozel_sohbet_ac_veya_getir(p_callee_id) into v_thread;

  v_channel := 'dm_call_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.direct_calls (
    thread_id, caller_id, callee_id, call_type, status, channel_name,
    is_paid, price_per_minute_snapshot, platform_fee_rate_snapshot,
    billing_status, reserved_coins, discovery_source
  ) values (
    v_thread, v_uid, p_callee_id, v_type, 'ringing', v_channel,
    v_paid,
    case when v_paid then v_price else null end,
    case when v_paid then v_cfg.platform_call_fee else null end,
    case when v_paid then 'RESERVED' else null end,
    case when v_paid then v_price else 0 end,
    'people_discovery'
  ) returning * into v_row;

  insert into public.direct_messages (thread_id, sender_id, body, message_type)
  values (
    v_thread,
    v_uid,
    case when v_type = 'video' then '📹 Görüntülü arama' else '📞 Sesli arama' end,
    'system'
  );

  update public.message_threads set
    updated_at = now(),
    last_message_at = now(),
    last_message_preview = case when v_type = 'video' then 'Görüntülü arama' else 'Sesli arama' end
  where id = v_thread;

  return jsonb_build_object(
    'ok', true,
    'call', row_to_json(v_row)::jsonb,
    'price_per_minute', v_row.price_per_minute_snapshot,
    'is_paid', v_row.is_paid,
    'caller_balance', coalesce(v_balance, 0)
  );
end;
$$;

grant execute on function public.kisiler_ucretli_gorusme_baslat(uuid, text) to authenticated;

-- Billing finalize (idempotent)
create or replace function public.kisiler_gorusme_billing_finalize(p_call_id uuid)
returns public.direct_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.direct_calls%rowtype;
  v_cfg public.people_discovery_config%rowtype;
  v_seconds int;
  v_gross bigint;
  v_fee bigint;
  v_creator bigint;
  v_balance bigint;
  v_charge bigint;
begin
  select * into v_row from public.direct_calls where id = p_call_id for update;
  if not found then raise exception 'Cagri yok'; end if;

  if not v_row.is_paid then return v_row; end if;
  if v_row.billing_status in ('FINALIZED', 'RELEASED') then return v_row; end if;

  select * into v_cfg from public.people_discovery_config where id = 1;

  -- Only bill when actually connected
  if v_row.answered_at is null or v_row.status in ('rejected', 'missed', 'cancelled') then
    update public.direct_calls set
      billing_status = 'RELEASED',
      billable_seconds = 0,
      gross_coin_amount = 0,
      platform_fee_coins = 0,
      creator_share_coins = 0,
      reserved_coins = 0,
      billing_finalized_at = now()
    where id = p_call_id
    returning * into v_row;
    return v_row;
  end if;

  v_seconds := greatest(
    0,
    floor(extract(epoch from (coalesce(v_row.ended_at, now()) - v_row.answered_at)))::int
  );

  v_gross := public.kisiler_billable_coins(
    v_seconds,
    coalesce(v_row.price_per_minute_snapshot, 0),
    coalesce(v_cfg.billing_mode, 'per_second_ceil')
  );

  v_fee := floor(v_gross::numeric * coalesce(v_row.platform_fee_rate_snapshot, v_cfg.platform_call_fee, 0.2))::bigint;
  v_creator := greatest(v_gross - v_fee, 0);

  -- Lock wallets
  insert into public.wallets (user_id, coins, diamonds)
  values (v_row.caller_id, 0, 0) on conflict (user_id) do nothing;
  insert into public.wallets (user_id, coins, diamonds)
  values (v_row.callee_id, 0, 0) on conflict (user_id) do nothing;

  select coins into v_balance from public.wallets where user_id = v_row.caller_id for update;
  perform 1 from public.wallets where user_id = v_row.callee_id for update;

  v_charge := least(v_gross, greatest(coalesce(v_balance, 0), 0));
  if v_charge < v_gross then
    -- Clamp to available (should be rare if heartbeat works)
    v_gross := v_charge;
    v_fee := floor(v_gross::numeric * coalesce(v_row.platform_fee_rate_snapshot, 0.2))::bigint;
    v_creator := greatest(v_gross - v_fee, 0);
  end if;

  if v_charge > 0 then
    update public.wallets
      set coins = coins - v_charge, updated_at = now()
      where user_id = v_row.caller_id;

    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
    values (
      v_row.caller_id, 'coins', -v_charge,
      (select coins from public.wallets where user_id = v_row.caller_id),
      'people_call_spend', 'direct_call', p_call_id
    );

    if v_creator > 0 then
      insert into public.host_earnings (user_id, diamonds)
      values (v_row.callee_id, 0) on conflict (user_id) do nothing;
      perform 1 from public.host_earnings where user_id = v_row.callee_id for update;

      update public.wallets
        set diamonds = diamonds + v_creator, updated_at = now()
        where user_id = v_row.callee_id;

      update public.host_earnings
        set diamonds = diamonds + v_creator, updated_at = now()
        where user_id = v_row.callee_id;

      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (
        v_row.callee_id, 'diamonds', v_creator,
        (select diamonds from public.wallets where user_id = v_row.callee_id),
        'people_call_earn', 'direct_call', p_call_id
      );

      insert into public.host_earnings_ledger (user_id, delta, balance_after, reason, ref_type, ref_id)
      values (
        v_row.callee_id, v_creator,
        (select diamonds from public.host_earnings where user_id = v_row.callee_id),
        'people_call_earn', 'direct_call', p_call_id
      );
    end if;
  end if;

  update public.direct_calls set
    billing_status = 'FINALIZED',
    billable_seconds = v_seconds,
    gross_coin_amount = v_gross,
    platform_fee_coins = v_fee,
    creator_share_coins = v_creator,
    reserved_coins = 0,
    billing_finalized_at = now()
  where id = p_call_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.kisiler_gorusme_billing_finalize(uuid) to authenticated;

-- Heartbeat: estimate remaining, end if insolvent
create or replace function public.kisiler_gorusme_billing_heartbeat(p_call_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.direct_calls%rowtype;
  v_cfg public.people_discovery_config%rowtype;
  v_seconds int;
  v_est bigint;
  v_balance bigint;
  v_remaining_sec int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_row from public.direct_calls where id = p_call_id for update;
  if not found then raise exception 'Cagri yok'; end if;
  if v_uid <> v_row.caller_id and v_uid <> v_row.callee_id then
    raise exception 'Forbidden';
  end if;

  update public.direct_calls set last_billing_heartbeat_at = now() where id = p_call_id;

  if not v_row.is_paid or v_row.status <> 'active' or v_row.answered_at is null then
    return jsonb_build_object('ok', true, 'continue', true, 'low_balance', false);
  end if;

  select * into v_cfg from public.people_discovery_config where id = 1;
  v_seconds := greatest(0, floor(extract(epoch from (now() - v_row.answered_at)))::int);
  v_est := public.kisiler_billable_coins(
    v_seconds + 60,
    coalesce(v_row.price_per_minute_snapshot, 0),
    coalesce(v_cfg.billing_mode, 'per_second_ceil')
  );

  select coins into v_balance from public.wallets where user_id = v_row.caller_id;

  if coalesce(v_balance, 0) < public.kisiler_billable_coins(
    v_seconds + 5,
    coalesce(v_row.price_per_minute_snapshot, 0),
    coalesce(v_cfg.billing_mode, 'per_second_ceil')
  ) then
    -- End call due to insufficient balance
    update public.direct_calls set
      status = 'ended',
      ended_at = now(),
      ended_by = v_row.caller_id,
      end_reason = 'insufficient_balance',
      billing_status = 'FINALIZING'
    where id = p_call_id and status = 'active';

    perform public.kisiler_gorusme_billing_finalize(p_call_id);

    return jsonb_build_object(
      'ok', true,
      'continue', false,
      'low_balance', true,
      'ended', true,
      'reason', 'insufficient_balance'
    );
  end if;

  v_remaining_sec := case
    when coalesce(v_row.price_per_minute_snapshot, 0) <= 0 then null
    else floor((coalesce(v_balance, 0)::numeric * 60) / v_row.price_per_minute_snapshot)::int - v_seconds
  end;

  return jsonb_build_object(
    'ok', true,
    'continue', true,
    'low_balance', coalesce(v_remaining_sec, 999) <= 60,
    'estimated_remaining_sec', v_remaining_sec,
    'billable_seconds_so_far', v_seconds,
    'estimated_charge_next_min', v_est
  );
end;
$$;

grant execute on function public.kisiler_gorusme_billing_heartbeat(uuid) to authenticated;

-- Patch gorusme_cevapla: mark billing ACTIVE
create or replace function public.gorusme_cevapla(p_call_id uuid)
returns public.direct_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.direct_calls%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_row from public.direct_calls where id = p_call_id;
  if not found then raise exception 'Cagri yok'; end if;

  if public.kullanicilar_engelli_mi(v_uid, v_row.caller_id) then
    update public.direct_calls set
      status = 'rejected',
      ended_at = now(),
      ended_by = v_uid,
      end_reason = 'blocked',
      billing_status = case when is_paid then 'RELEASED' else billing_status end
    where id = p_call_id
    returning * into v_row;
    raise exception 'Bu kullaniciyla iletisim engellenmis';
  end if;

  update public.direct_calls set
    status = 'active',
    answered_at = now(),
    billing_status = case when is_paid then 'ACTIVE' else billing_status end,
    last_billing_heartbeat_at = now()
  where id = p_call_id
    and callee_id = v_uid
    and status = 'ringing'
  returning * into v_row;

  if not found then raise exception 'Cagri cevaplanamadi'; end if;
  return v_row;
end;
$$;

grant execute on function public.gorusme_cevapla(uuid) to authenticated;

-- Patch gorusme_bitir: finalize billing
create or replace function public.gorusme_bitir(
  p_call_id uuid,
  p_reason text default 'hangup'
)
returns public.direct_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.direct_calls%rowtype;
  v_status text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_row from public.direct_calls where id = p_call_id for update;
  if not found then raise exception 'Cagri yok'; end if;
  if v_uid <> v_row.caller_id and v_uid <> v_row.callee_id then
    raise exception 'Forbidden';
  end if;
  if v_row.status in ('ended', 'rejected', 'missed', 'cancelled') then
    if v_row.is_paid and v_row.billing_status not in ('FINALIZED', 'RELEASED') then
      return public.kisiler_gorusme_billing_finalize(p_call_id);
    end if;
    return v_row;
  end if;

  if v_row.status = 'ringing' and v_uid = v_row.caller_id then
    v_status := 'cancelled';
  elsif v_row.status = 'ringing' then
    v_status := 'missed';
  else
    v_status := 'ended';
  end if;

  update public.direct_calls set
    status = v_status,
    ended_at = now(),
    ended_by = v_uid,
    end_reason = coalesce(nullif(trim(p_reason), ''), 'hangup'),
    billing_status = case
      when is_paid and billing_status not in ('FINALIZED', 'RELEASED') then 'FINALIZING'
      else billing_status
    end
  where id = p_call_id
  returning * into v_row;

  if v_row.is_paid then
    return public.kisiler_gorusme_billing_finalize(p_call_id);
  end if;

  return v_row;
end;
$$;

grant execute on function public.gorusme_bitir(uuid, text) to authenticated;

-- Patch gorusme_reddet for paid release
create or replace function public.gorusme_reddet(p_call_id uuid)
returns public.direct_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.direct_calls%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  update public.direct_calls set
    status = 'rejected',
    ended_at = now(),
    ended_by = v_uid,
    end_reason = 'rejected',
    billing_status = case when is_paid then 'FINALIZING' else billing_status end
  where id = p_call_id
    and callee_id = v_uid
    and status = 'ringing'
  returning * into v_row;

  if not found then raise exception 'Cagri reddedilemedi'; end if;

  if v_row.is_paid then
    return public.kisiler_gorusme_billing_finalize(p_call_id);
  end if;
  return v_row;
end;
$$;

grant execute on function public.gorusme_reddet(uuid) to authenticated;

-- Preview quote for confirmation sheet
create or replace function public.kisiler_arama_onizleme(
  p_callee_id uuid,
  p_call_type text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_feat jsonb;
  v_type text := lower(trim(p_call_type));
  v_cfg public.people_discovery_config%rowtype;
  v_callee public.people_call_settings%rowtype;
  v_price int;
  v_balance bigint;
  v_prof record;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  v_feat := public.kisiler_feature_effective();
  if not coalesce((v_feat->>'people_discovery_enabled')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'feature_unavailable');
  end if;

  select * into v_cfg from public.people_discovery_config where id = 1;
  v_callee := public.kisiler_ayar_ensure(p_callee_id);

  if v_type = 'audio' then
    v_price := public.kisiler_clamp_price(v_callee.voice_price_per_minute, v_cfg.voice_price_min, v_cfg.voice_price_max);
  else
    v_price := public.kisiler_clamp_price(v_callee.video_price_per_minute, v_cfg.video_price_min, v_cfg.video_price_max);
  end if;

  select coins into v_balance from public.wallets where user_id = v_uid;
  select display_name, username, avatar_url into v_prof
  from public.profiles where id = p_callee_id;

  return jsonb_build_object(
    'ok', true,
    'callee_id', p_callee_id,
    'display_name', v_prof.display_name,
    'username', v_prof.username,
    'avatar_url', v_prof.avatar_url,
    'call_type', v_type,
    'price_per_minute', v_price,
    'is_paid', coalesce((v_feat->>'paid_calling_enabled')::boolean, false),
    'caller_balance', coalesce(v_balance, 0),
    'estimated_seconds', case
      when v_price > 0 then floor((coalesce(v_balance, 0)::numeric * 60) / v_price)::int
      else null
    end,
    'billing_mode', v_cfg.billing_mode,
    'platform_call_fee', v_cfg.platform_call_fee,
    'can_start', coalesce(v_balance, 0) >= v_price
      or not coalesce((v_feat->>'paid_calling_enabled')::boolean, false)
  );
end;
$$;

grant execute on function public.kisiler_arama_onizleme(uuid, text) to authenticated;

-- Indexes for discovery filters
create index if not exists profiles_discovery_gender_idx
  on public.profiles (gender)
  where deleted_at is null and coalesce(is_guest, false) = false;

create index if not exists profiles_discovery_country_idx
  on public.profiles (country_code)
  where deleted_at is null and country_code is not null;

create index if not exists device_sessions_presence_idx
  on public.device_sessions (user_id, last_seen_at desc)
  where revoked_at is null;
