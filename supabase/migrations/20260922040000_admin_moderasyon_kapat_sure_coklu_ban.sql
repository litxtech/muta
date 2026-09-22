-- Admin moderasyon: coklu kullanici yaptirim, sureli hesap bani,
-- yayin/gorusme kapat+yaptirim, oda/yayin uyeleri listesi

-- ---------------------------------------------------------------------------
-- Ortak: tek kullaniciya yaptirim uygula
-- p_sanctions: coin_penalty, warning, upload_ban_hours, room_create_ban_hours,
--              account_ban, account_ban_hours (-1/null = kalici), reason
-- p_ctx: room_id / session_id / call_id / via
-- ---------------------------------------------------------------------------
create or replace function public._admin_kullaniciya_yaptirim_uygula(
  p_user_id uuid,
  p_sanctions jsonb,
  p_ctx jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s jsonb := coalesce(p_sanctions, '{}'::jsonb);
  v_reason text := coalesce(
    nullif(trim(v_s ->> 'reason'), ''),
    'Yonetim yaptirimi'
  );
  v_coin bigint := 0;
  v_bal bigint;
  v_warn_id uuid;
  v_upload_h int;
  v_room_h int;
  v_account_ban boolean := coalesce((v_s ->> 'account_ban')::boolean, false);
  v_account_h int;
  v_warning boolean := coalesce((v_s ->> 'warning')::boolean, false);
  v_applied jsonb := '[]'::jsonb;
  v_exp timestamptz;
  v_sid uuid;
  v_room_id uuid;
  v_has_any boolean := false;
begin
  if p_user_id is null then
    return '[]'::jsonb;
  end if;

  begin
    v_coin := greatest(coalesce((v_s ->> 'coin_penalty')::bigint, 0), 0);
  exception when others then
    v_coin := 0;
  end;

  begin
    v_upload_h := (v_s ->> 'upload_ban_hours')::int;
  exception when others then
    v_upload_h := null;
  end;

  begin
    v_room_h := (v_s ->> 'room_create_ban_hours')::int;
  exception when others then
    v_room_h := null;
  end;

  begin
    v_account_h := (v_s ->> 'account_ban_hours')::int;
  exception when others then
    v_account_h := null;
  end;

  begin
    v_room_id := nullif(p_ctx ->> 'room_id', '')::uuid;
  exception when others then
    v_room_id := null;
  end;

  v_has_any :=
    v_coin > 0
    or v_warning
    or (v_upload_h is not null and v_upload_h <> 0)
    or (v_room_h is not null and v_room_h <> 0)
    or v_account_ban;

  if not v_has_any then
    return '[]'::jsonb;
  end if;

  if v_coin > 0 then
    insert into public.wallets (user_id, coins, diamonds)
    values (p_user_id, 0, 0)
    on conflict (user_id) do nothing;

    update public.wallets
    set coins = greatest(coins - v_coin, 0), updated_at = now()
    where user_id = p_user_id
    returning coins into v_bal;

    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type)
    values (
      p_user_id,
      'coins',
      -v_coin,
      v_bal,
      'admin_penalty:' || left(v_reason, 100),
      'admin'
    );

    v_applied := v_applied || jsonb_build_array(jsonb_build_object(
      'kind', 'coin_penalty',
      'user_id', p_user_id,
      'amount', v_coin,
      'balance_after', v_bal
    ));
  end if;

  if v_warning or v_coin > 0 or v_upload_h is not null or v_room_h is not null or v_account_ban then
    insert into public.user_warnings (user_id, issued_by, reason, severity, notes)
    values (
      p_user_id,
      auth.uid(),
      v_reason,
      case
        when v_account_ban or v_coin >= 10000 then 'critical'
        when v_coin > 0 or v_upload_h is not null then 'high'
        else 'medium'
      end,
      left(coalesce(p_ctx::text, 'moderation'), 200)
    )
    returning id into v_warn_id;

    v_applied := v_applied || jsonb_build_array(jsonb_build_object(
      'kind', 'warning',
      'user_id', p_user_id,
      'warning_id', v_warn_id
    ));
  end if;

  if v_upload_h is not null and v_upload_h <> 0 then
    if v_upload_h < 0 then
      v_exp := null;
    else
      v_exp := now() + make_interval(hours => greatest(v_upload_h, 1));
    end if;

    update public.user_feature_sanctions
    set is_active = false, cleared_at = now(), cleared_by = auth.uid()
    where user_id = p_user_id and kind = 'upload_ban' and is_active = true;

    insert into public.user_feature_sanctions (
      user_id, kind, reason, issued_by, room_id, expires_at
    ) values (
      p_user_id, 'upload_ban', v_reason, auth.uid(), v_room_id, v_exp
    )
    returning id into v_sid;

    v_applied := v_applied || jsonb_build_array(jsonb_build_object(
      'kind', 'upload_ban',
      'user_id', p_user_id,
      'hours', v_upload_h,
      'expires_at', v_exp,
      'sanction_id', v_sid
    ));
  end if;

  if v_room_h is not null and v_room_h <> 0 then
    if v_room_h < 0 then
      v_exp := null;
    else
      v_exp := now() + make_interval(hours => greatest(v_room_h, 1));
    end if;

    update public.user_feature_sanctions
    set is_active = false, cleared_at = now(), cleared_by = auth.uid()
    where user_id = p_user_id and kind = 'room_create_ban' and is_active = true;

    insert into public.user_feature_sanctions (
      user_id, kind, reason, issued_by, room_id, expires_at
    ) values (
      p_user_id, 'room_create_ban', v_reason, auth.uid(), v_room_id, v_exp
    )
    returning id into v_sid;

    v_applied := v_applied || jsonb_build_array(jsonb_build_object(
      'kind', 'room_create_ban',
      'user_id', p_user_id,
      'hours', v_room_h,
      'expires_at', v_exp,
      'sanction_id', v_sid
    ));
  end if;

  if v_account_ban then
    if v_account_h is not null and v_account_h > 0 then
      update public.profiles set
        banned_at = now(),
        banned_until = now() + make_interval(hours => greatest(v_account_h, 1)),
        ban_reason = left(v_reason, 200),
        updated_at = now()
      where id = p_user_id;
    else
      update public.profiles set
        banned_at = now(),
        banned_until = null,
        ban_reason = left(v_reason, 200),
        updated_at = now()
      where id = p_user_id;
    end if;

    update public.device_sessions
    set revoked_at = now()
    where user_id = p_user_id and revoked_at is null;

    insert into public.security_events (user_id, event_type, severity, metadata)
    values (
      p_user_id,
      'account_banned',
      'high',
      jsonb_build_object(
        'reason', v_reason,
        'by', auth.uid(),
        'account_ban_hours', v_account_h,
        'ctx', p_ctx
      )
    );

    v_applied := v_applied || jsonb_build_array(jsonb_build_object(
      'kind', 'account_ban',
      'user_id', p_user_id,
      'hours', coalesce(v_account_h, -1)
    ));
  end if;

  if jsonb_array_length(v_applied) > 0 then
    perform public.bildirim_kuyruga_ekle(
      p_user_id,
      'system',
      'Yonetim yaptirimi',
      left(v_reason, 400),
      null,
      jsonb_build_object('sanctions', v_applied, 'ctx', p_ctx)
    );
  end if;

  return v_applied;
end;
$$;

-- ---------------------------------------------------------------------------
-- Oda uyeleri (kapatmadan once secim icin)
-- ---------------------------------------------------------------------------
create or replace function public.admin_oda_uyeleri(p_room_id uuid)
returns table (
  user_id uuid,
  role text,
  display_name text,
  username text,
  is_host boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  select r.host_id into v_host from public.rooms r where r.id = p_room_id;
  if v_host is null then
    raise exception 'Oda bulunamadi';
  end if;

  return query
  select
    m.user_id,
    m.role::text,
    coalesce(p.display_name, p.username, 'Kullanici'),
    p.username,
    (m.user_id = v_host or m.role::text = 'host')
  from public.room_members m
  left join public.profiles p on p.id = m.user_id
  where m.room_id = p_room_id
  order by
    case when m.user_id = v_host or m.role::text = 'host' then 0
         when m.role::text = 'cohost' then 1
         else 2 end,
    coalesce(p.display_name, p.username);
end;
$$;

grant execute on function public.admin_oda_uyeleri(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Yayin izleyicileri (+ host)
-- ---------------------------------------------------------------------------
create or replace function public.admin_yayin_katilimcilari(p_session_id uuid)
returns table (
  user_id uuid,
  role text,
  display_name text,
  username text,
  is_host boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  select s.host_id into v_host
  from public.live_sessions s
  where s.id = p_session_id;

  if v_host is null then
    raise exception 'Yayin bulunamadi';
  end if;

  return query
  select * from (
    select
      v_host as user_id,
      'host'::text as role,
      coalesce(hp.display_name, hp.username, 'Yayinci') as display_name,
      hp.username,
      true as is_host
    from public.profiles hp
    where hp.id = v_host

    union all

    select
      v.user_id,
      'viewer'::text,
      coalesce(p.display_name, p.username, 'Izleyici'),
      p.username,
      false
    from public.live_session_viewers v
    left join public.profiles p on p.id = v.user_id
    where v.session_id = p_session_id
      and v.user_id is distinct from v_host
  ) q
  order by q.is_host desc, q.display_name
  limit 80;
end;
$$;

grant execute on function public.admin_yayin_katilimcilari(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Ses odasi: kapat + coklu yaptirim
-- ---------------------------------------------------------------------------
create or replace function public.admin_ses_odasi_kapat_ve_yaptirim(
  p_room_id uuid,
  p_sanctions jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s jsonb := coalesce(p_sanctions, '{}'::jsonb);
  v_reason text := coalesce(
    nullif(trim(v_s ->> 'reason'), ''),
    'Kurallara aykiri ses odasi'
  );
  v_close jsonb;
  v_host uuid;
  v_title text;
  v_targets uuid[] := '{}';
  v_uid uuid;
  v_elem text;
  v_applied jsonb := '[]'::jsonb;
  v_one jsonb;
  v_san jsonb;
  v_ctx jsonb;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  -- Hedef listesi (bos ise host)
  if jsonb_typeof(v_s -> 'target_user_ids') = 'array' then
    for v_elem in
      select jsonb_array_elements_text(v_s -> 'target_user_ids')
    loop
      begin
        v_uid := v_elem::uuid;
        if v_uid is not null and not (v_uid = any (v_targets)) then
          v_targets := array_append(v_targets, v_uid);
        end if;
      exception when others then
        null;
      end;
    end loop;
  end if;

  v_close := public._admin_ses_odasi_kapat_ic(p_room_id, v_reason);
  v_host := (v_close ->> 'host_id')::uuid;
  v_title := v_close ->> 'title';

  if v_host is null then
    raise exception 'Host bulunamadi';
  end if;

  if coalesce(array_length(v_targets, 1), 0) = 0 then
    v_targets := array[v_host];
  end if;

  v_san := v_s || jsonb_build_object('reason', v_reason);
  v_ctx := jsonb_build_object(
    'room_id', p_room_id,
    'title', v_title,
    'via', 'room_moderation'
  );

  foreach v_uid in array v_targets loop
    v_one := public._admin_kullaniciya_yaptirim_uygula(v_uid, v_san, v_ctx);
    v_applied := v_applied || v_one;
  end loop;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    v_host,
    'room_force_end',
    case
      when coalesce((v_s ->> 'account_ban')::boolean, false) then 'critical'
      when coalesce((v_s ->> 'coin_penalty')::bigint, 0) > 0 then 'high'
      else 'medium'
    end,
    jsonb_build_object(
      'room_id', p_room_id,
      'title', v_title,
      'reason', v_reason,
      'targets', to_jsonb(v_targets),
      'sanctions', v_applied,
      'by', auth.uid()
    )
  );

  perform public.admin_audit_yaz(
    v_host,
    'room_moderation',
    'Ses odasi kapatildi' || case when jsonb_array_length(v_applied) > 0
      then ' + yaptirim' else '' end || ': ' || left(v_reason, 80),
    jsonb_build_object(
      'room_id', p_room_id,
      'title', v_title,
      'reason', v_reason,
      'targets', to_jsonb(v_targets),
      'close', v_close,
      'sanctions', v_applied
    )
  );

  return jsonb_build_object(
    'ok', true,
    'room_id', p_room_id,
    'host_id', v_host,
    'title', v_title,
    'targets', to_jsonb(v_targets),
    'close', v_close,
    'sanctions', v_applied,
    'reason', v_reason
  );
end;
$$;

grant execute on function public.admin_ses_odasi_kapat_ve_yaptirim(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Canli yayin: kapat + coklu yaptirim
-- ---------------------------------------------------------------------------
create or replace function public.admin_canli_yayin_kapat_ve_yaptirim(
  p_session_id uuid,
  p_sanctions jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s jsonb := coalesce(p_sanctions, '{}'::jsonb);
  v_reason text := coalesce(
    nullif(trim(v_s ->> 'reason'), ''),
    'Kurallara aykiri canli yayin'
  );
  v_close jsonb;
  v_host uuid;
  v_title text;
  v_targets uuid[] := '{}';
  v_uid uuid;
  v_elem text;
  v_applied jsonb := '[]'::jsonb;
  v_one jsonb;
  v_san jsonb;
  v_ctx jsonb;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  if jsonb_typeof(v_s -> 'target_user_ids') = 'array' then
    for v_elem in
      select jsonb_array_elements_text(v_s -> 'target_user_ids')
    loop
      begin
        v_uid := v_elem::uuid;
        if v_uid is not null and not (v_uid = any (v_targets)) then
          v_targets := array_append(v_targets, v_uid);
        end if;
      exception when others then
        null;
      end;
    end loop;
  end if;

  v_close := public.admin_canli_yayin_kapat(p_session_id, v_reason);
  v_host := (v_close ->> 'host_id')::uuid;
  v_title := v_close ->> 'title';

  if v_host is null then
    raise exception 'Host bulunamadi';
  end if;

  if coalesce(array_length(v_targets, 1), 0) = 0 then
    v_targets := array[v_host];
  end if;

  v_san := v_s || jsonb_build_object('reason', v_reason);
  v_ctx := jsonb_build_object(
    'session_id', p_session_id,
    'title', v_title,
    'via', 'live_moderation'
  );

  foreach v_uid in array v_targets loop
    v_one := public._admin_kullaniciya_yaptirim_uygula(v_uid, v_san, v_ctx);
    v_applied := v_applied || v_one;
  end loop;

  perform public.admin_audit_yaz(
    v_host,
    'live_moderation',
    'Canli yayin kapatildi' || case when jsonb_array_length(v_applied) > 0
      then ' + yaptirim' else '' end || ': ' || left(v_reason, 80),
    jsonb_build_object(
      'session_id', p_session_id,
      'title', v_title,
      'reason', v_reason,
      'targets', to_jsonb(v_targets),
      'close', v_close,
      'sanctions', v_applied
    )
  );

  return jsonb_build_object(
    'ok', true,
    'session_id', p_session_id,
    'host_id', v_host,
    'title', v_title,
    'targets', to_jsonb(v_targets),
    'close', v_close,
    'sanctions', v_applied,
    'reason', v_reason
  );
end;
$$;

grant execute on function public.admin_canli_yayin_kapat_ve_yaptirim(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Aktif gorusmeler
-- ---------------------------------------------------------------------------
create or replace function public.admin_aktif_gorusmeler(p_limit int default 40)
returns table (
  id uuid,
  call_type text,
  status text,
  caller_id uuid,
  callee_id uuid,
  caller_name text,
  callee_name text,
  caller_username text,
  callee_username text,
  started_at timestamptz,
  answered_at timestamptz
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
    c.id,
    c.call_type,
    c.status,
    c.caller_id,
    c.callee_id,
    coalesce(a.display_name, a.username, 'Arayan'),
    coalesce(b.display_name, b.username, 'Alici'),
    a.username,
    b.username,
    c.started_at,
    c.answered_at
  from public.direct_calls c
  left join public.profiles a on a.id = c.caller_id
  left join public.profiles b on b.id = c.callee_id
  where c.status in ('ringing', 'active')
  order by
    case when c.status = 'active' then 0 else 1 end,
    coalesce(c.answered_at, c.started_at) desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
end;
$$;

grant execute on function public.admin_aktif_gorusmeler(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Gorusme zorla kapat + istege bagli yaptirim (secilen taraflar)
-- ---------------------------------------------------------------------------
create or replace function public.admin_gorusme_kapat_ve_yaptirim(
  p_call_id uuid,
  p_sanctions jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s jsonb := coalesce(p_sanctions, '{}'::jsonb);
  v_reason text := coalesce(
    nullif(trim(v_s ->> 'reason'), ''),
    'Gorusme admin tarafindan sonlandirildi'
  );
  v_row public.direct_calls%rowtype;
  v_targets uuid[] := '{}';
  v_uid uuid;
  v_elem text;
  v_applied jsonb := '[]'::jsonb;
  v_one jsonb;
  v_san jsonb;
  v_ctx jsonb;
  v_status text;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  select * into v_row from public.direct_calls where id = p_call_id for update;
  if not found then
    raise exception 'Cagri yok';
  end if;

  if v_row.status not in ('ended', 'rejected', 'missed', 'cancelled') then
    if v_row.status = 'ringing' then
      v_status := 'cancelled';
    else
      v_status := 'ended';
    end if;

    update public.direct_calls set
      status = v_status,
      ended_at = now(),
      ended_by = auth.uid(),
      end_reason = 'admin:' || left(v_reason, 80)
    where id = p_call_id
    returning * into v_row;
  end if;

  if jsonb_typeof(v_s -> 'target_user_ids') = 'array' then
    for v_elem in
      select jsonb_array_elements_text(v_s -> 'target_user_ids')
    loop
      begin
        v_uid := v_elem::uuid;
        if v_uid is not null
          and (v_uid = v_row.caller_id or v_uid = v_row.callee_id)
          and not (v_uid = any (v_targets))
        then
          v_targets := array_append(v_targets, v_uid);
        end if;
      exception when others then
        null;
      end;
    end loop;
  end if;

  -- Yaptirim yoksa sadece kapat
  if coalesce((v_s ->> 'account_ban')::boolean, false)
    or coalesce((v_s ->> 'warning')::boolean, false)
    or coalesce((v_s ->> 'coin_penalty')::bigint, 0) > 0
    or (v_s ? 'upload_ban_hours')
    or (v_s ? 'room_create_ban_hours')
  then
    if coalesce(array_length(v_targets, 1), 0) = 0 then
      v_targets := array[v_row.caller_id, v_row.callee_id];
    end if;

    v_san := v_s || jsonb_build_object('reason', v_reason);
    v_ctx := jsonb_build_object(
      'call_id', p_call_id,
      'call_type', v_row.call_type,
      'via', 'call_moderation'
    );

    foreach v_uid in array v_targets loop
      v_one := public._admin_kullaniciya_yaptirim_uygula(v_uid, v_san, v_ctx);
      v_applied := v_applied || v_one;
    end loop;
  end if;

  perform public.admin_audit_yaz(
    v_row.caller_id,
    'call_force_end',
    left(v_reason, 120),
    jsonb_build_object(
      'call_id', p_call_id,
      'status', v_row.status,
      'targets', to_jsonb(v_targets),
      'sanctions', v_applied,
      'callee_id', v_row.callee_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'call_id', p_call_id,
    'status', v_row.status,
    'caller_id', v_row.caller_id,
    'callee_id', v_row.callee_id,
    'targets', to_jsonb(v_targets),
    'sanctions', v_applied,
    'reason', v_reason,
    'started_at', v_row.started_at,
    'answered_at', v_row.answered_at,
    'ended_at', v_row.ended_at
  );
end;
$$;

grant execute on function public.admin_gorusme_kapat_ve_yaptirim(uuid, jsonb) to authenticated;
