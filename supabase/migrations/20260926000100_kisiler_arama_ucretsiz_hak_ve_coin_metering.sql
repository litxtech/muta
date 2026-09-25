-- Mesaj içi arama: ömür boyu ücretsiz hak + coin metering (25–70 default clamp)

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
alter table public.people_discovery_config
  add column if not exists free_call_seconds_grant int not null default 300
    check (free_call_seconds_grant >= 0);

update public.people_discovery_config set
  voice_price_min = 25,
  voice_price_max = 70,
  video_price_min = 25,
  video_price_max = 70,
  free_call_seconds_grant = coalesce(free_call_seconds_grant, 300),
  updated_at = now()
where id = 1;

alter table public.people_call_settings
  add column if not exists free_call_seconds_remaining int not null default 300
    check (free_call_seconds_remaining >= 0);

update public.people_call_settings pcs
set free_call_seconds_remaining = least(
  coalesce(pcs.free_call_seconds_remaining, 300),
  coalesce((select free_call_seconds_grant from public.people_discovery_config where id = 1), 300)
)
where pcs.free_call_seconds_remaining is distinct from least(
  coalesce(pcs.free_call_seconds_remaining, 300),
  coalesce((select free_call_seconds_grant from public.people_discovery_config where id = 1), 300)
);

-- Mevcut kullanıcı fiyatlarını yeni aralığa clamp
update public.people_call_settings set
  voice_price_per_minute = public.kisiler_clamp_price(voice_price_per_minute, 25, 70),
  video_price_per_minute = public.kisiler_clamp_price(video_price_per_minute, 25, 70),
  updated_at = now()
where voice_price_per_minute < 25 or voice_price_per_minute > 70
   or video_price_per_minute < 25 or video_price_per_minute > 70;

alter table public.direct_calls
  add column if not exists free_seconds_consumed int not null default 0
    check (free_seconds_consumed >= 0);

-- ---------------------------------------------------------------------------
-- kisiler_ayar_ensure — grant ile free hak
-- ---------------------------------------------------------------------------
create or replace function public.kisiler_ayar_ensure(p_uid uuid)
returns public.people_call_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.people_call_settings%rowtype;
  v_cfg public.people_discovery_config%rowtype;
  v_grant int;
begin
  select * into v from public.people_call_settings where user_id = p_uid;
  if found then return v; end if;

  select * into v_cfg from public.people_discovery_config where id = 1;
  v_grant := greatest(0, coalesce(v_cfg.free_call_seconds_grant, 300));

  insert into public.people_call_settings (
    user_id, voice_price_per_minute, video_price_per_minute, free_call_seconds_remaining
  ) values (
    p_uid,
    least(greatest(25, coalesce(v_cfg.voice_price_min, 25)), coalesce(v_cfg.voice_price_max, 70)),
    least(greatest(45, coalesce(v_cfg.video_price_min, 25)), coalesce(v_cfg.video_price_max, 70)),
    v_grant
  )
  on conflict (user_id) do nothing
  returning * into v;

  if not found then
    select * into v from public.people_call_settings where user_id = p_uid;
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Config get / admin update — free_call_seconds_grant
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
      'voice_price_min', 25,
      'voice_price_max', 70,
      'video_price_min', 25,
      'video_price_max', 70,
      'platform_call_fee', 0.2,
      'billing_mode', 'per_second_ceil',
      'free_call_seconds_grant', 300
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
    'free_call_seconds_grant', coalesce(v.free_call_seconds_grant, 300),
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
  v_grant int;
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
  v_grant := coalesce((p->>'free_call_seconds_grant')::int, v.free_call_seconds_grant, 300);

  if v_voice_min < 1 or v_voice_max < v_voice_min then
    raise exception 'Gecersiz sesli fiyat araligi';
  end if;
  if v_video_min < 1 or v_video_max < v_video_min then
    raise exception 'Gecersiz goruntulu fiyat araligi';
  end if;
  if v_grant < 0 then
    raise exception 'Gecersiz ucretsiz arama hakki';
  end if;

  update public.people_discovery_config set
    algorithm_version = coalesce(nullif(trim(p->>'algorithm_version'), ''), algorithm_version),
    voice_price_min = v_voice_min,
    voice_price_max = v_voice_max,
    video_price_min = v_video_min,
    video_price_max = v_video_max,
    free_call_seconds_grant = v_grant,
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

-- ---------------------------------------------------------------------------
-- Ayarlar get — free_call_seconds_remaining
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
      v.voice_price_per_minute, coalesce(v_cfg.voice_price_min, 25), coalesce(v_cfg.voice_price_max, 70)
    ),
    'video_price_per_minute', public.kisiler_clamp_price(
      v.video_price_per_minute, coalesce(v_cfg.video_price_min, 25), coalesce(v_cfg.video_price_max, 70)
    ),
    'voice_price_min', coalesce(v_cfg.voice_price_min, 25),
    'voice_price_max', coalesce(v_cfg.voice_price_max, 70),
    'video_price_min', coalesce(v_cfg.video_price_min, 25),
    'video_price_max', coalesce(v_cfg.video_price_max, 70),
    'free_call_seconds_remaining', greatest(0, coalesce(v.free_call_seconds_remaining, 0)),
    'free_call_seconds_grant', coalesce(v_cfg.free_call_seconds_grant, 300)
  );
end;
$$;

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
    coalesce(v_cfg.voice_price_min, 25),
    coalesce(v_cfg.voice_price_max, 70)
  );
  v_video := public.kisiler_clamp_price(
    coalesce((p->>'video_price_per_minute')::int, v.video_price_per_minute),
    coalesce(v_cfg.video_price_min, 25),
    coalesce(v_cfg.video_price_max, 70)
  );

  if p ? 'voice_price_per_minute' then
    if (p->>'voice_price_per_minute')::int < coalesce(v_cfg.voice_price_min, 25)
       or (p->>'voice_price_per_minute')::int > coalesce(v_cfg.voice_price_max, 70) then
      raise exception 'Sesli arama ucreti %-% coin arasinda olmalidir',
        v_cfg.voice_price_min, v_cfg.voice_price_max;
    end if;
  end if;
  if p ? 'video_price_per_minute' then
    if (p->>'video_price_per_minute')::int < coalesce(v_cfg.video_price_min, 25)
       or (p->>'video_price_per_minute')::int > coalesce(v_cfg.video_price_max, 70) then
      raise exception 'Goruntulu arama ucreti %-% coin arasinda olmalidir',
        v_cfg.video_price_min, v_cfg.video_price_max;
    end if;
  end if;

  update public.people_call_settings set
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

-- ---------------------------------------------------------------------------
-- Önizleme — free hak ile can_start
-- ---------------------------------------------------------------------------
create or replace function public.kisiler_arama_onizleme(
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
  v_caller public.people_call_settings%rowtype;
  v_price int;
  v_balance bigint;
  v_free int := 0;
  v_prof record;
  v_calls_open boolean;
  v_voice_ok boolean;
  v_video_ok boolean;
  v_block boolean;
  v_reason text := null;
  v_can boolean := true;
  v_paid boolean;
  v_est int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_callee_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_callee', 'error_code', 'invalid_callee');
  end if;

  v_feat := public.kisiler_feature_effective();
  if not coalesce((v_feat->>'people_discovery_enabled')::boolean, false) then
    return jsonb_build_object(
      'ok', false,
      'error', 'feature_unavailable',
      'error_code', 'feature_unavailable',
      'can_start', false
    );
  end if;

  if v_type not in ('audio', 'video') then
    return jsonb_build_object('ok', false, 'error', 'invalid_type', 'error_code', 'invalid_type', 'can_start', false);
  end if;

  select * into v_cfg from public.people_discovery_config where id = 1;
  v_callee := public.kisiler_ayar_ensure(p_callee_id);
  v_caller := public.kisiler_ayar_ensure(v_uid);
  v_free := greatest(0, coalesce(v_caller.free_call_seconds_remaining, 0));

  insert into public.wallets (user_id, coins, diamonds)
  values (v_uid, 0, 0)
  on conflict (user_id) do nothing;
  select coalesce(coins, 0) into v_balance
  from public.wallets
  where user_id = v_uid;

  if v_type = 'audio' then
    v_price := public.kisiler_clamp_price(
      v_callee.voice_price_per_minute, coalesce(v_cfg.voice_price_min, 25), coalesce(v_cfg.voice_price_max, 70)
    );
  else
    v_price := public.kisiler_clamp_price(
      v_callee.video_price_per_minute, coalesce(v_cfg.video_price_min, 25), coalesce(v_cfg.video_price_max, 70)
    );
  end if;

  select display_name, username, avatar_url into v_prof
  from public.profiles where id = p_callee_id;

  v_block := public.kullanicilar_engelli_mi(v_uid, p_callee_id);
  v_calls_open := coalesce(v_callee.calls_open, true);
  v_voice_ok := coalesce(v_callee.voice_calls_enabled, true);
  v_video_ok := coalesce(v_callee.video_calls_enabled, true);
  v_paid := coalesce((v_feat->>'paid_calling_enabled')::boolean, false);

  if v_block then
    v_can := false;
    v_reason := 'blocked';
  elsif not v_calls_open then
    v_can := false;
    v_reason := 'calls_closed';
  elsif v_type = 'audio' and not v_voice_ok then
    v_can := false;
    v_reason := 'voice_disabled';
  elsif v_type = 'video' and not v_video_ok then
    v_can := false;
    v_reason := 'video_disabled';
  elsif v_callee.call_permission = 'nobody' then
    v_can := false;
    v_reason := 'permission_nobody';
  elsif v_paid and v_free <= 0 and coalesce(v_balance, 0) < v_price then
    v_can := false;
    v_reason := 'insufficient_coins';
  end if;

  if v_type = 'audio' and not coalesce((v_feat->>'voice_call_enabled')::boolean, false) then
    v_can := false;
    v_reason := 'feature_voice_off';
  end if;
  if v_type = 'video' and not coalesce((v_feat->>'video_call_enabled')::boolean, false) then
    v_can := false;
    v_reason := 'feature_video_off';
  end if;

  v_est := v_free + case
    when v_price > 0 then floor((coalesce(v_balance, 0)::numeric * 60) / v_price)::int
    else 0
  end;

  return jsonb_build_object(
    'ok', true,
    'callee_id', p_callee_id,
    'display_name', v_prof.display_name,
    'username', v_prof.username,
    'avatar_url', v_prof.avatar_url,
    'call_type', v_type,
    'price_per_minute', v_price,
    'is_paid', v_paid,
    'caller_balance', coalesce(v_balance, 0),
    'free_seconds_remaining', v_free,
    'estimated_seconds', v_est,
    'billing_mode', v_cfg.billing_mode,
    'platform_call_fee', v_cfg.platform_call_fee,
    'calls_open', v_calls_open,
    'can_start', v_can,
    'block_reason', v_reason,
    'message', case v_reason
      when 'calls_closed' then 'Bu kullanıcı aramalara kendini kapattı.'
      when 'insufficient_coins' then 'Yetersiz coin bakiyesi — ücretsiz hak veya en az 1 dakika için coin gerekir.'
      when 'voice_disabled' then 'Bu kullanıcı sesli arama kabul etmiyor.'
      when 'video_disabled' then 'Bu kullanıcı görüntülü arama kabul etmiyor.'
      when 'permission_nobody' then 'Bu kullanıcı arama kabul etmiyor.'
      when 'blocked' then 'Bu kullanıcıyla iletişim engellenmiş.'
      else null
    end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Ücretli görüşme başlat — free hak ile
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
  v_caller public.people_call_settings%rowtype;
  v_guest boolean;
  v_peer_guest boolean;
  v_price int;
  v_balance bigint;
  v_free int := 0;
  v_thread uuid;
  v_row public.direct_calls%rowtype;
  v_channel text;
  v_follows boolean;
  v_paid boolean;
  v_caller_name text;
  v_tur text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_callee_id is null or p_callee_id = v_uid then
    return jsonb_build_object('ok', false, 'error', 'Self-call yasak', 'error_code', 'self_call');
  end if;
  if v_type not in ('audio', 'video') then
    return jsonb_build_object('ok', false, 'error', 'Gecersiz cagri turu', 'error_code', 'invalid_type');
  end if;

  v_feat := public.kisiler_feature_effective();
  if not coalesce((v_feat->>'people_discovery_enabled')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'Bu ozellik su anda kullanilamiyor', 'error_code', 'feature_unavailable');
  end if;
  if v_type = 'audio' and not coalesce((v_feat->>'voice_call_enabled')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'Sesli arama kapali', 'error_code', 'feature_voice_off');
  end if;
  if v_type = 'video' and not coalesce((v_feat->>'video_call_enabled')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'Goruntulu arama kapali', 'error_code', 'feature_video_off');
  end if;

  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then
    return jsonb_build_object('ok', false, 'error', 'Misafir arama yapamaz', 'error_code', 'guest');
  end if;

  select is_guest into v_peer_guest from public.profiles
  where id = p_callee_id and deleted_at is null and banned_at is null;
  if not found or coalesce(v_peer_guest, false) then
    return jsonb_build_object('ok', false, 'error', 'Karsi kullanici uygun degil', 'error_code', 'invalid_callee');
  end if;

  if public.kullanicilar_engelli_mi(v_uid, p_callee_id) then
    return jsonb_build_object('ok', false, 'error', 'Bu kullaniciyla iletisim engellenmis', 'error_code', 'blocked');
  end if;

  select * into v_cfg from public.people_discovery_config where id = 1;
  v_callee := public.kisiler_ayar_ensure(p_callee_id);
  v_caller := public.kisiler_ayar_ensure(v_uid);
  v_free := greatest(0, coalesce(v_caller.free_call_seconds_remaining, 0));

  if not coalesce(v_callee.calls_open, true) then
    select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), 'Birisi')
    into v_caller_name from public.profiles where id = v_uid;
    v_tur := case when v_type = 'video' then 'görüntülü' else 'sesli' end;

    if not exists (
      select 1 from public.user_notifications n
      where n.user_id = p_callee_id
        and n.category = 'calls'
        and n.created_at > now() - interval '10 minutes'
        and (n.payload->>'actor_id') = v_uid::text
        and (n.payload->>'kind') = 'call_closed_missed'
    ) then
      perform public.bildirim_kuyruga_ekle(
        p_callee_id,
        'calls',
        'Arama denemesi',
        v_caller_name || ' seni ' || v_tur || ' aramaya çalıştı ama aramalara kapalısın.',
        '/ayarlar/kisiler-aramalar',
        jsonb_build_object(
          'actor_id', v_uid,
          'kind', 'call_closed_missed',
          'call_type', v_type
        )
      );
    end if;

    return jsonb_build_object(
      'ok', false,
      'error', 'Bu kullanıcı aramalara kendini kapattı.',
      'error_code', 'calls_closed',
      'notified', true
    );
  end if;

  if v_type = 'audio' and not coalesce(v_callee.voice_calls_enabled, true) then
    return jsonb_build_object('ok', false, 'error', 'Sesli arama kabul etmiyor', 'error_code', 'voice_disabled');
  end if;
  if v_type = 'video' and not coalesce(v_callee.video_calls_enabled, true) then
    return jsonb_build_object('ok', false, 'error', 'Goruntulu arama kabul etmiyor', 'error_code', 'video_disabled');
  end if;

  if v_callee.call_permission = 'nobody' then
    return jsonb_build_object('ok', false, 'error', 'Kullanici arama kabul etmiyor', 'error_code', 'permission_nobody');
  elsif v_callee.call_permission = 'following' then
    select exists (
      select 1 from public.follows
      where follower_id = p_callee_id and following_id = v_uid
    ) into v_follows;
    if not v_follows then
      return jsonb_build_object('ok', false, 'error', 'Sadece takip ettikleri arayabilir', 'error_code', 'permission_following');
    end if;
  end if;

  if exists (
    select 1 from public.direct_calls
    where status in ('ringing', 'active')
      and (caller_id = v_uid or callee_id = v_uid or caller_id = p_callee_id or callee_id = p_callee_id)
  ) then
    return jsonb_build_object('ok', false, 'error', 'Zaten aktif bir gorusme var', 'error_code', 'busy');
  end if;

  perform public.gorusme_stale_temizle();

  v_paid := coalesce((v_feat->>'paid_calling_enabled')::boolean, false);
  if v_type = 'audio' then
    v_price := public.kisiler_clamp_price(
      v_callee.voice_price_per_minute, coalesce(v_cfg.voice_price_min, 25), coalesce(v_cfg.voice_price_max, 70)
    );
  else
    v_price := public.kisiler_clamp_price(
      v_callee.video_price_per_minute, coalesce(v_cfg.video_price_min, 25), coalesce(v_cfg.video_price_max, 70)
    );
  end if;

  insert into public.wallets (user_id, coins, diamonds)
  values (v_uid, 0, 0) on conflict (user_id) do nothing;

  select coins into v_balance from public.wallets where user_id = v_uid for update;
  v_balance := coalesce(v_balance, 0);

  if v_paid and v_free <= 0 and v_balance < v_price then
    return jsonb_build_object(
      'ok', false,
      'error', 'Yetersiz coin bakiyesi',
      'error_code', 'insufficient_coins',
      'caller_balance', v_balance,
      'price_per_minute', v_price,
      'free_seconds_remaining', v_free
    );
  end if;

  select public.ozel_sohbet_ac_veya_getir(p_callee_id) into v_thread;

  v_channel := 'dm_call_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.direct_calls (
    thread_id, caller_id, callee_id, call_type, status, channel_name,
    is_paid, price_per_minute_snapshot, platform_fee_rate_snapshot,
    billing_status, reserved_coins, discovery_source, free_seconds_consumed
  ) values (
    v_thread, v_uid, p_callee_id, v_type, 'ringing', v_channel,
    v_paid,
    case when v_paid then v_price else null end,
    case when v_paid then v_cfg.platform_call_fee else null end,
    case when v_paid then 'RESERVED' else null end,
    case
      when v_paid and v_free <= 0 then v_price
      else 0
    end,
    'people_discovery',
    0
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
    'caller_balance', v_balance,
    'free_seconds_remaining', v_free
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Finalize — yalnızca paid saniyeler faturalanır
-- ---------------------------------------------------------------------------
create or replace function public.kisiler_gorusme_billing_finalize(p_call_id uuid)
returns public.direct_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.direct_calls%rowtype;
  v_cfg public.people_discovery_config%rowtype;
  v_caller public.people_call_settings%rowtype;
  v_seconds int;
  v_free_on_call int;
  v_free_target int;
  v_free_delta int;
  v_paid_seconds int;
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

  if v_row.answered_at is null or v_row.status in ('rejected', 'missed', 'cancelled') then
    update public.direct_calls set
      billing_status = 'RELEASED',
      billable_seconds = 0,
      free_seconds_consumed = 0,
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

  -- Son free sync (heartbeat kaçmış olabilir)
  v_caller := public.kisiler_ayar_ensure(v_row.caller_id);
  perform 1 from public.people_call_settings where user_id = v_row.caller_id for update;
  select * into v_caller from public.people_call_settings where user_id = v_row.caller_id;

  v_free_target := least(
    v_seconds,
    coalesce(v_row.free_seconds_consumed, 0) + greatest(0, coalesce(v_caller.free_call_seconds_remaining, 0))
  );
  v_free_delta := greatest(0, v_free_target - coalesce(v_row.free_seconds_consumed, 0));
  if v_free_delta > 0 then
    update public.people_call_settings set
      free_call_seconds_remaining = greatest(0, free_call_seconds_remaining - v_free_delta),
      updated_at = now()
    where user_id = v_row.caller_id;
    update public.direct_calls set
      free_seconds_consumed = v_free_target
    where id = p_call_id;
    v_row.free_seconds_consumed := v_free_target;
  end if;

  v_free_on_call := least(v_seconds, coalesce(v_row.free_seconds_consumed, 0));
  v_paid_seconds := greatest(0, v_seconds - v_free_on_call);

  v_gross := public.kisiler_billable_coins(
    v_paid_seconds,
    coalesce(v_row.price_per_minute_snapshot, 0),
    coalesce(v_cfg.billing_mode, 'per_second_ceil')
  );

  v_fee := floor(v_gross::numeric * coalesce(v_row.platform_fee_rate_snapshot, v_cfg.platform_call_fee, 0.2))::bigint;
  v_creator := greatest(v_gross - v_fee, 0);

  insert into public.wallets (user_id, coins, diamonds)
  values (v_row.caller_id, 0, 0) on conflict (user_id) do nothing;
  insert into public.wallets (user_id, coins, diamonds)
  values (v_row.callee_id, 0, 0) on conflict (user_id) do nothing;

  select coins into v_balance from public.wallets where user_id = v_row.caller_id for update;
  perform 1 from public.wallets where user_id = v_row.callee_id for update;

  v_charge := least(v_gross, greatest(coalesce(v_balance, 0), 0));
  if v_charge < v_gross then
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
    billable_seconds = v_paid_seconds,
    free_seconds_consumed = v_free_on_call,
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

-- ---------------------------------------------------------------------------
-- Heartbeat — free tüket, coin ile devam, son 1 dk low_balance
-- ---------------------------------------------------------------------------
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
  v_caller public.people_call_settings%rowtype;
  v_seconds int;
  v_price int;
  v_balance bigint;
  v_free_remaining int;
  v_free_target int;
  v_free_delta int;
  v_paid_seconds int;
  v_coin_afford_sec int;
  v_remaining_sec int;
  v_need_coins bigint;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_row from public.direct_calls where id = p_call_id for update;
  if not found then raise exception 'Cagri yok'; end if;
  if v_uid <> v_row.caller_id and v_uid <> v_row.callee_id then
    raise exception 'Forbidden';
  end if;

  update public.direct_calls set last_billing_heartbeat_at = now() where id = p_call_id;

  if not v_row.is_paid or v_row.status <> 'active' or v_row.answered_at is null then
    return jsonb_build_object(
      'ok', true,
      'continue', true,
      'low_balance', false,
      'estimated_remaining_sec', null,
      'free_seconds_remaining', null
    );
  end if;

  select * into v_cfg from public.people_discovery_config where id = 1;
  v_price := coalesce(v_row.price_per_minute_snapshot, 0);
  v_seconds := greatest(0, floor(extract(epoch from (now() - v_row.answered_at)))::int);

  -- Caller free sync
  perform 1 from public.people_call_settings where user_id = v_row.caller_id for update;
  v_caller := public.kisiler_ayar_ensure(v_row.caller_id);
  select * into v_caller from public.people_call_settings where user_id = v_row.caller_id;
  v_free_remaining := greatest(0, coalesce(v_caller.free_call_seconds_remaining, 0));

  v_free_target := least(
    v_seconds,
    coalesce(v_row.free_seconds_consumed, 0) + v_free_remaining
  );
  v_free_delta := greatest(0, v_free_target - coalesce(v_row.free_seconds_consumed, 0));
  if v_free_delta > 0 then
    update public.people_call_settings set
      free_call_seconds_remaining = greatest(0, free_call_seconds_remaining - v_free_delta),
      updated_at = now()
    where user_id = v_row.caller_id
    returning free_call_seconds_remaining into v_free_remaining;

    update public.direct_calls set
      free_seconds_consumed = v_free_target
    where id = p_call_id;
    v_row.free_seconds_consumed := v_free_target;
  else
    v_free_remaining := greatest(0, coalesce(v_caller.free_call_seconds_remaining, 0));
  end if;

  v_paid_seconds := greatest(0, v_seconds - coalesce(v_row.free_seconds_consumed, 0));

  select coalesce(coins, 0) into v_balance
  from public.wallets where user_id = v_row.caller_id;

  -- +5 sn için yeterli mi? (free + coin)
  v_need_coins := public.kisiler_billable_coins(
    greatest(0, (v_seconds + 5) - (
      least(
        v_seconds + 5,
        coalesce(v_row.free_seconds_consumed, 0) + v_free_remaining
      )
    )),
    v_price,
    coalesce(v_cfg.billing_mode, 'per_second_ceil')
  );

  if v_need_coins > coalesce(v_balance, 0) then
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
      'reason', 'insufficient_balance',
      'estimated_remaining_sec', 0,
      'free_seconds_remaining', v_free_remaining,
      'billable_seconds_so_far', v_paid_seconds
    );
  end if;

  if v_price <= 0 then
    v_coin_afford_sec := 999999;
  else
    v_coin_afford_sec := floor((coalesce(v_balance, 0)::numeric * 60) / v_price)::int;
  end if;

  v_remaining_sec := v_free_remaining + greatest(0, v_coin_afford_sec - v_paid_seconds);

  return jsonb_build_object(
    'ok', true,
    'continue', true,
    'low_balance', v_remaining_sec <= 60,
    'estimated_remaining_sec', v_remaining_sec,
    'free_seconds_remaining', v_free_remaining,
    'billable_seconds_so_far', v_paid_seconds,
    'paid_seconds_so_far', v_paid_seconds,
    'free_seconds_consumed', coalesce(v_row.free_seconds_consumed, 0)
  );
end;
$$;

grant execute on function public.kisiler_arama_onizleme(uuid, text) to authenticated;
grant execute on function public.kisiler_ucretli_gorusme_baslat(uuid, text) to authenticated;
grant execute on function public.kisiler_gorusme_billing_finalize(uuid) to authenticated;
grant execute on function public.kisiler_gorusme_billing_heartbeat(uuid) to authenticated;
