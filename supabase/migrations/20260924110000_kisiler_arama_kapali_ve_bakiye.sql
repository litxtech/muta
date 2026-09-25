-- Kişiler: aramalara kapalı akışı + bildirim + coin bakiye düzeltmesi

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
  v_price int;
  v_balance bigint;
  v_prof record;
  v_calls_open boolean;
  v_voice_ok boolean;
  v_video_ok boolean;
  v_block boolean;
  v_reason text := null;
  v_can boolean := true;
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

  -- Bakiye: cüzdan yoksa oluştur, her zaman güncel oku
  insert into public.wallets (user_id, coins, diamonds)
  values (v_uid, 0, 0)
  on conflict (user_id) do nothing;
  select coalesce(coins, 0) into v_balance
  from public.wallets
  where user_id = v_uid;

  if v_type = 'audio' then
    v_price := public.kisiler_clamp_price(
      v_callee.voice_price_per_minute, coalesce(v_cfg.voice_price_min, 20), coalesce(v_cfg.voice_price_max, 65)
    );
  else
    v_price := public.kisiler_clamp_price(
      v_callee.video_price_per_minute, coalesce(v_cfg.video_price_min, 20), coalesce(v_cfg.video_price_max, 65)
    );
  end if;

  select display_name, username, avatar_url into v_prof
  from public.profiles where id = p_callee_id;

  v_block := public.kullanicilar_engelli_mi(v_uid, p_callee_id);
  v_calls_open := coalesce(v_callee.calls_open, true);
  v_voice_ok := coalesce(v_callee.voice_calls_enabled, true);
  v_video_ok := coalesce(v_callee.video_calls_enabled, true);

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
  elsif coalesce((v_feat->>'paid_calling_enabled')::boolean, false)
        and coalesce(v_balance, 0) < v_price then
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
    'calls_open', v_calls_open,
    'can_start', v_can,
    'block_reason', v_reason,
    'message', case v_reason
      when 'calls_closed' then 'Bu kullanıcı aramalara kendini kapattı.'
      when 'insufficient_coins' then 'Yetersiz coin bakiyesi — en az 1 dakika için coin gerekir.'
      when 'voice_disabled' then 'Bu kullanıcı sesli arama kabul etmiyor.'
      when 'video_disabled' then 'Bu kullanıcı görüntülü arama kabul etmiyor.'
      when 'permission_nobody' then 'Bu kullanıcı arama kabul etmiyor.'
      when 'blocked' then 'Bu kullanıcıyla iletişim engellenmiş.'
      else null
    end
  );
end;
$$;

grant execute on function public.kisiler_arama_onizleme(uuid, text) to authenticated;

-- Kapalı arama denemesinde bildirim (rate-limited)
create or replace function public.kisiler_arama_kapali_bildir(
  p_callee_id uuid,
  p_call_type text default 'audio'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_type text := lower(coalesce(nullif(trim(p_call_type), ''), 'audio'));
  v_tur text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_callee_id is null or p_callee_id = v_uid then
    return jsonb_build_object('ok', false);
  end if;

  -- Son 10 dk aynı aktörden tekrar spam etme
  if exists (
    select 1 from public.user_notifications n
    where n.user_id = p_callee_id
      and n.category = 'calls'
      and n.created_at > now() - interval '10 minutes'
      and (n.payload->>'actor_id') = v_uid::text
      and (n.payload->>'kind') = 'call_closed_missed'
  ) then
    return jsonb_build_object('ok', true, 'notified', false, 'deduped', true);
  end if;

  select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), 'Birisi')
  into v_name
  from public.profiles where id = v_uid;

  v_tur := case when v_type = 'video' then 'görüntülü' else 'sesli' end;

  perform public.bildirim_kuyruga_ekle(
    p_callee_id,
    'calls',
    'Arama denemesi',
    v_name || ' seni ' || v_tur || ' aramaya çalıştı ama aramalara kapalısın.',
    '/ayarlar/kisiler-aramalar',
    jsonb_build_object(
      'actor_id', v_uid,
      'kind', 'call_closed_missed',
      'call_type', v_type
    )
  );

  return jsonb_build_object('ok', true, 'notified', true);
end;
$$;

grant execute on function public.kisiler_arama_kapali_bildir(uuid, text) to authenticated;

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

  -- Aramalara kapalı: arama açma, aranan kişiye bildir
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
      v_callee.voice_price_per_minute, coalesce(v_cfg.voice_price_min, 20), coalesce(v_cfg.voice_price_max, 65)
    );
  else
    v_price := public.kisiler_clamp_price(
      v_callee.video_price_per_minute, coalesce(v_cfg.video_price_min, 20), coalesce(v_cfg.video_price_max, 65)
    );
  end if;

  insert into public.wallets (user_id, coins, diamonds)
  values (v_uid, 0, 0) on conflict (user_id) do nothing;

  select coins into v_balance from public.wallets where user_id = v_uid for update;
  v_balance := coalesce(v_balance, 0);

  if v_paid and v_balance < v_price then
    return jsonb_build_object(
      'ok', false,
      'error', 'Yetersiz coin bakiyesi',
      'error_code', 'insufficient_coins',
      'caller_balance', v_balance,
      'price_per_minute', v_price
    );
  end if;

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
    'caller_balance', v_balance
  );
end;
$$;

grant execute on function public.kisiler_ucretli_gorusme_baslat(uuid, text) to authenticated;
