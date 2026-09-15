-- Admin: ses odasi kapatma / feed'den dusurme + host yaptirim sistemi
-- Yaptirim turleri: upload_ban, room_create_ban, coin_penalty, warning, account_ban

-- ---------------------------------------------------------------------------
-- Ozellik bazli sureli yaptirimlar
-- ---------------------------------------------------------------------------
create table if not exists public.user_feature_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null
    check (kind in ('upload_ban', 'room_create_ban')),
  reason text not null,
  issued_by uuid references public.profiles (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  cleared_at timestamptz,
  cleared_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists user_feature_sanctions_user_kind_idx
  on public.user_feature_sanctions (user_id, kind, is_active)
  where is_active = true;

create index if not exists user_feature_sanctions_expires_idx
  on public.user_feature_sanctions (expires_at)
  where is_active = true and expires_at is not null;

alter table public.user_feature_sanctions enable row level security;

drop policy if exists "Sanctions admin all" on public.user_feature_sanctions;
create policy "Sanctions admin all"
  on public.user_feature_sanctions for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

drop policy if exists "Own sanctions read" on public.user_feature_sanctions;
create policy "Own sanctions read"
  on public.user_feature_sanctions for select to authenticated
  using (auth.uid() = user_id);

grant select on public.user_feature_sanctions to authenticated;

-- ---------------------------------------------------------------------------
-- Aktif yaptirim kontrolu
-- ---------------------------------------------------------------------------
create or replace function public.kullanici_yaptirim_aktif_mi(
  p_user_id uuid,
  p_kind text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_kind text := lower(trim(coalesce(p_kind, '')));
begin
  if p_user_id is null or v_kind = '' then
    return false;
  end if;

  -- Not: STABLE fonksiyonlarda UPDATE yasak (RLS oda acmayi kirardi).
  -- Suresi dolmus kayitlar expires_at filtresiyle zaten aktif sayilmaz.
  return exists (
    select 1
    from public.user_feature_sanctions s
    where s.user_id = p_user_id
      and s.kind = v_kind
      and s.is_active = true
      and (s.expires_at is null or s.expires_at > now())
  );
end;
$$;

grant execute on function public.kullanici_yaptirim_aktif_mi(uuid, text) to authenticated, anon, service_role;

create or replace function public.benim_aktif_yaptirimlarim()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  -- STABLE: yazma yok; suresi dolmuslar expires_at ile elenir.
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'kind', s.kind,
      'reason', s.reason,
      'starts_at', s.starts_at,
      'expires_at', s.expires_at,
      'room_id', s.room_id
    ) order by s.created_at desc)
    from public.user_feature_sanctions s
    where s.user_id = v_uid
      and s.is_active = true
      and (s.expires_at is null or s.expires_at > now())
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.benim_aktif_yaptirimlarim() to authenticated;

-- ---------------------------------------------------------------------------
-- Oda kapatma + uyeleri dagitma (feed: is_live=false)
-- ---------------------------------------------------------------------------
create or replace function public._admin_ses_odasi_kapat_ic(
  p_room_id uuid,
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
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'Admin tarafindan kapatildi');
  v_member_count int := 0;
begin
  select r.host_id, r.title, r.is_live
  into v_host, v_title, v_was_live
  from public.rooms r
  where r.id = p_room_id
  for update;

  if not found then
    raise exception 'Oda bulunamadi';
  end if;

  update public.rooms set
    is_live = false,
    ended_at = coalesce(ended_at, now()),
    listener_count = 0
  where id = p_room_id;

  -- Koltuklari bosalt
  update public.room_seats
  set user_id = null, is_muted = false
  where room_id = p_room_id;

  select count(*)::int into v_member_count
  from public.room_members
  where room_id = p_room_id;

  -- Uyeleri dagit (oda yok sayilir)
  delete from public.room_members where room_id = p_room_id;

  -- Aktif oyun oturumlarini bitir (varsa)
  begin
    update public.game_sessions
    set status = 'cancelled',
        finished_at = coalesce(finished_at, now()),
        ends_at = coalesce(ends_at, now())
    where room_id = p_room_id
      and status in ('waiting', 'countdown', 'playing');
  exception when undefined_table then
    null;
  when others then
    null;
  end;

  if v_host is not null then
    perform public.bildirim_kuyruga_ekle(
      v_host,
      'system',
      'Ses odan kapatildi',
      left(coalesce(v_title, 'Oda') || ' · ' || v_reason, 400),
      null,
      jsonb_build_object(
        'room_id', p_room_id,
        'action', 'room_force_end',
        'reason', v_reason
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'room_id', p_room_id,
    'host_id', v_host,
    'title', v_title,
    'was_live', coalesce(v_was_live, false),
    'dispersed_members', v_member_count
  );
end;
$$;

-- Eski RPC: geriye uyumlu + temizlik
create or replace function public.admin_oda_canli_kapat(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res jsonb;
  v_host uuid;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  v_res := public._admin_ses_odasi_kapat_ic(p_room_id, 'Oda admin tarafindan kapatildi');
  v_host := (v_res ->> 'host_id')::uuid;

  perform public.admin_audit_yaz(
    v_host,
    'room_force_end',
    'Oda admin tarafindan kapatildi',
    jsonb_build_object(
      'room_id', p_room_id,
      'dispersed_members', v_res -> 'dispersed_members'
    )
  );

  return v_res;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tek RPC: kapat + istege bagli host yaptirimlari
-- p_sanctions ornek:
-- {
--   "coin_penalty": 5000,
--   "warning": true,
--   "upload_ban_hours": 24,
--   "room_create_ban_hours": 72,
--   "account_ban": false,
--   "reason": "Kurallara aykiri icerik"
-- }
-- hours = -1 => kalici
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
  v_coin bigint := 0;
  v_bal bigint;
  v_warn_id uuid;
  v_upload_h int;
  v_room_h int;
  v_account_ban boolean := coalesce((v_s ->> 'account_ban')::boolean, false);
  v_warning boolean := coalesce((v_s ->> 'warning')::boolean, false);
  v_applied jsonb := '[]'::jsonb;
  v_exp timestamptz;
  v_sid uuid;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
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

  v_close := public._admin_ses_odasi_kapat_ic(p_room_id, v_reason);
  v_host := (v_close ->> 'host_id')::uuid;
  v_title := v_close ->> 'title';

  if v_host is null then
    raise exception 'Host bulunamadi';
  end if;

  -- Coin cezasi
  if v_coin > 0 then
    insert into public.wallets (user_id, coins, diamonds)
    values (v_host, 0, 0)
    on conflict (user_id) do nothing;

    update public.wallets
    set coins = greatest(coins - v_coin, 0), updated_at = now()
    where user_id = v_host
    returning coins into v_bal;

    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type)
    values (
      v_host,
      'coins',
      -v_coin,
      v_bal,
      'admin_penalty:' || left(v_reason, 100),
      'admin'
    );

    v_applied := v_applied || jsonb_build_array(jsonb_build_object(
      'kind', 'coin_penalty',
      'amount', v_coin,
      'balance_after', v_bal
    ));
  end if;

  -- Ihtar
  if v_warning or v_coin > 0 or v_upload_h is not null or v_room_h is not null then
    insert into public.user_warnings (user_id, issued_by, reason, severity, notes)
    values (
      v_host,
      auth.uid(),
      v_reason,
      case when v_account_ban or v_coin >= 10000 then 'critical'
           when v_coin > 0 or v_upload_h is not null then 'high'
           else 'medium' end,
      'room_moderation:' || p_room_id::text
    )
    returning id into v_warn_id;

    v_applied := v_applied || jsonb_build_array(jsonb_build_object(
      'kind', 'warning',
      'warning_id', v_warn_id
    ));
  end if;

  -- Yukleme cezasi
  if v_upload_h is not null and v_upload_h <> 0 then
    if v_upload_h < 0 then
      v_exp := null;
    else
      v_exp := now() + make_interval(hours => greatest(v_upload_h, 1));
    end if;

    update public.user_feature_sanctions
    set is_active = false, cleared_at = now(), cleared_by = auth.uid()
    where user_id = v_host and kind = 'upload_ban' and is_active = true;

    insert into public.user_feature_sanctions (
      user_id, kind, reason, issued_by, room_id, expires_at
    ) values (
      v_host, 'upload_ban', v_reason, auth.uid(), p_room_id, v_exp
    )
    returning id into v_sid;

    v_applied := v_applied || jsonb_build_array(jsonb_build_object(
      'kind', 'upload_ban',
      'hours', v_upload_h,
      'expires_at', v_exp,
      'sanction_id', v_sid
    ));
  end if;

  -- Ses odasi acma yasagi
  if v_room_h is not null and v_room_h <> 0 then
    if v_room_h < 0 then
      v_exp := null;
    else
      v_exp := now() + make_interval(hours => greatest(v_room_h, 1));
    end if;

    update public.user_feature_sanctions
    set is_active = false, cleared_at = now(), cleared_by = auth.uid()
    where user_id = v_host and kind = 'room_create_ban' and is_active = true;

    insert into public.user_feature_sanctions (
      user_id, kind, reason, issued_by, room_id, expires_at
    ) values (
      v_host, 'room_create_ban', v_reason, auth.uid(), p_room_id, v_exp
    )
    returning id into v_sid;

    v_applied := v_applied || jsonb_build_array(jsonb_build_object(
      'kind', 'room_create_ban',
      'hours', v_room_h,
      'expires_at', v_exp,
      'sanction_id', v_sid
    ));
  end if;

  -- Hesap bani
  if v_account_ban then
    update public.profiles set
      banned_at = now(),
      ban_reason = left(v_reason, 200),
      updated_at = now()
    where id = v_host;

    update public.device_sessions
    set revoked_at = now()
    where user_id = v_host and revoked_at is null;

    insert into public.security_events (user_id, event_type, severity, metadata)
    values (
      v_host,
      'account_banned',
      'high',
      jsonb_build_object(
        'reason', v_reason,
        'by', auth.uid(),
        'room_id', p_room_id,
        'via', 'room_moderation'
      )
    );

    v_applied := v_applied || jsonb_build_array(jsonb_build_object(
      'kind', 'account_ban'
    ));
  end if;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    v_host,
    'room_force_end',
    case when v_account_ban then 'critical' when v_coin > 0 then 'high' else 'medium' end,
    jsonb_build_object(
      'room_id', p_room_id,
      'title', v_title,
      'reason', v_reason,
      'sanctions', v_applied,
      'by', auth.uid()
    )
  );

  -- Host'a yaptirim ozeti
  if jsonb_array_length(v_applied) > 0 then
    perform public.bildirim_kuyruga_ekle(
      v_host,
      'system',
      'Yonetim yaptirimi',
      left(v_reason, 400),
      null,
      jsonb_build_object(
        'room_id', p_room_id,
        'sanctions', v_applied
      )
    );
  end if;

  perform public.admin_audit_yaz(
    v_host,
    'room_moderation',
    'Ses odasi kapatildi' || case when jsonb_array_length(v_applied) > 0
      then ' + yaptirim' else '' end || ': ' || left(v_reason, 80),
    jsonb_build_object(
      'room_id', p_room_id,
      'title', v_title,
      'reason', v_reason,
      'close', v_close,
      'sanctions', v_applied
    )
  );

  return jsonb_build_object(
    'ok', true,
    'room_id', p_room_id,
    'host_id', v_host,
    'title', v_title,
    'close', v_close,
    'sanctions', v_applied,
    'reason', v_reason
  );
end;
$$;

grant execute on function public.admin_ses_odasi_kapat_ve_yaptirim(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Bagimsiz yaptirim uygula / kaldir (kullanici dosyasindan da)
-- ---------------------------------------------------------------------------
create or replace function public.admin_yaptirim_uygula(
  p_user_id uuid,
  p_kind text,
  p_hours int default 24,
  p_reason text default null,
  p_room_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'Yonetim yaptirimi');
  v_exp timestamptz;
  v_sid uuid;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  if p_user_id is null then
    raise exception 'Kullanici gerekli';
  end if;
  if v_kind not in ('upload_ban', 'room_create_ban') then
    raise exception 'Gecersiz yaptirim turu';
  end if;

  if coalesce(p_hours, 0) < 0 then
    v_exp := null;
  else
    v_exp := now() + make_interval(hours => greatest(coalesce(p_hours, 24), 1));
  end if;

  update public.user_feature_sanctions
  set is_active = false, cleared_at = now(), cleared_by = auth.uid()
  where user_id = p_user_id and kind = v_kind and is_active = true;

  insert into public.user_feature_sanctions (
    user_id, kind, reason, issued_by, room_id, expires_at
  ) values (
    p_user_id, v_kind, v_reason, auth.uid(), p_room_id, v_exp
  )
  returning id into v_sid;

  perform public.admin_audit_yaz(
    p_user_id,
    'sanction_' || v_kind,
    case v_kind
      when 'upload_ban' then 'Yukleme cezasi'
      else 'Ses odasi acma yasagi'
    end || coalesce(' · ' || left(v_reason, 60), ''),
    jsonb_build_object(
      'sanction_id', v_sid,
      'hours', p_hours,
      'expires_at', v_exp,
      'room_id', p_room_id
    )
  );

  perform public.bildirim_kuyruga_ekle(
    p_user_id,
    'system',
    case v_kind when 'upload_ban' then 'Yukleme cezasi' else 'Oda acma yasagi' end,
    left(v_reason, 400),
    null,
    jsonb_build_object('kind', v_kind, 'expires_at', v_exp)
  );

  return jsonb_build_object(
    'ok', true,
    'sanction_id', v_sid,
    'kind', v_kind,
    'expires_at', v_exp
  );
end;
$$;

create or replace function public.admin_yaptirim_kaldir(
  p_sanction_id uuid default null,
  p_user_id uuid default null,
  p_kind text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int := 0;
  v_kind text := lower(trim(coalesce(p_kind, '')));
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  if p_sanction_id is not null then
    update public.user_feature_sanctions
    set is_active = false, cleared_at = now(), cleared_by = auth.uid()
    where id = p_sanction_id and is_active = true;
    get diagnostics v_n = row_count;
  elsif p_user_id is not null and v_kind in ('upload_ban', 'room_create_ban') then
    update public.user_feature_sanctions
    set is_active = false, cleared_at = now(), cleared_by = auth.uid()
    where user_id = p_user_id and kind = v_kind and is_active = true;
    get diagnostics v_n = row_count;
  else
    raise exception 'sanction_id veya user_id+kind gerekli';
  end if;

  if v_n > 0 then
    perform public.admin_audit_yaz(
      p_user_id,
      'sanction_clear',
      'Yaptirim kaldirildi',
      jsonb_build_object(
        'sanction_id', p_sanction_id,
        'kind', nullif(v_kind, ''),
        'cleared', v_n
      )
    );
  end if;

  return jsonb_build_object('ok', true, 'cleared', v_n);
end;
$$;

grant execute on function public.admin_yaptirim_uygula(uuid, text, int, text, uuid) to authenticated;
grant execute on function public.admin_yaptirim_kaldir(uuid, uuid, text) to authenticated;

-- Canli oda listesine host username ekle (return type degisti → once drop)
drop function if exists public.admin_canli_odalar(int);
create or replace function public.admin_canli_odalar(p_limit int default 40)
returns table (
  id uuid,
  title text,
  mode text,
  listener_count int,
  host_id uuid,
  host_name text,
  host_username text,
  created_at timestamptz
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
    r.id,
    r.title,
    r.mode,
    r.listener_count,
    r.host_id,
    coalesce(p.display_name, p.username, 'Host'),
    p.username,
    r.created_at
  from public.rooms r
  left join public.profiles p on p.id = r.host_id
  where r.is_live
  order by r.listener_count desc, r.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: oda acma yasagi
-- ---------------------------------------------------------------------------
drop policy if exists "Hosts create rooms" on public.rooms;
create policy "Hosts create rooms"
  on public.rooms for insert to authenticated
  with check (
    auth.uid() = host_id
    and not public.kullanici_yaptirim_aktif_mi(auth.uid(), 'room_create_ban')
  );

-- ---------------------------------------------------------------------------
-- Storage: yukleme cezasi
-- ---------------------------------------------------------------------------
drop policy if exists "Profile media own upload" on storage.objects;
create policy "Profile media own upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.kullanici_yaptirim_aktif_mi(auth.uid(), 'upload_ban')
  );

drop policy if exists "Profile media own update" on storage.objects;
create policy "Profile media own update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.kullanici_yaptirim_aktif_mi(auth.uid(), 'upload_ban')
  );

drop policy if exists "Status media own upload" on storage.objects;
create policy "Status media own upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'status-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.kullanici_yaptirim_aktif_mi(auth.uid(), 'upload_ban')
  );

drop policy if exists "Status media own update" on storage.objects;
create policy "Status media own update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'status-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.kullanici_yaptirim_aktif_mi(auth.uid(), 'upload_ban')
  );

drop policy if exists "DM media insert" on storage.objects;
create policy "DM media insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'dm-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.kullanici_yaptirim_aktif_mi(auth.uid(), 'upload_ban')
  );

drop policy if exists "DM media update own" on storage.objects;
create policy "DM media update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'dm-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.kullanici_yaptirim_aktif_mi(auth.uid(), 'upload_ban')
  );
