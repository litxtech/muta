-- Platform güvenliği: cihaz başına tek misafir + silinen hesap dönüş uyarıları

-- ─── Helpers ───────────────────────────────────────────────────────────────

create or replace function public.platform_email_normalize(p_email text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(coalesce(p_email, ''))), '');
$$;

create or replace function public.platform_email_local(p_email text)
returns text
language sql
immutable
as $$
  select case
    when public.platform_email_normalize(p_email) is null then null
    else split_part(
      split_part(public.platform_email_normalize(p_email), '@', 1),
      '+',
      1
    )
  end;
$$;

create or replace function public.platform_email_canon(p_email text)
returns text
language sql
immutable
as $$
  select case
    when public.platform_email_normalize(p_email) is null then null
    when position('@' in public.platform_email_normalize(p_email)) = 0 then null
    else public.platform_email_local(p_email)
         || '@'
         || split_part(public.platform_email_normalize(p_email), '@', 2)
  end;
$$;

-- ─── Tables ────────────────────────────────────────────────────────────────

create table if not exists public.device_account_bindings (
  device_id text primary key,
  guest_user_id uuid references public.profiles(id) on delete set null,
  bound_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'guest_active'
    check (status in ('guest_active', 'upgraded', 'deleted', 'banned_blocked')),
  last_email_normalized text,
  email_local_part text,
  block_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_device_bindings_guest
  on public.device_account_bindings (guest_user_id)
  where guest_user_id is not null;

create index if not exists idx_device_bindings_status
  on public.device_account_bindings (status);

create table if not exists public.account_identity_tombstones (
  id uuid primary key default gen_random_uuid(),
  deleted_user_id uuid not null,
  email_normalized text,
  email_canon text,
  email_local_part text,
  device_ids text[] not null default '{}',
  delete_source text not null check (delete_source in ('self', 'admin')),
  was_banned boolean not null default false,
  username_snapshot text,
  display_name_snapshot text,
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz not null default now()
);

create index if not exists idx_tombstones_email_canon
  on public.account_identity_tombstones (email_canon)
  where email_canon is not null;

create index if not exists idx_tombstones_email_local
  on public.account_identity_tombstones (email_local_part)
  where email_local_part is not null;

create index if not exists idx_tombstones_deleted_user
  on public.account_identity_tombstones (deleted_user_id);

create table if not exists public.platform_security_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  severity text not null default 'high'
    check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'ignored')),
  new_user_id uuid references public.profiles(id) on delete set null,
  matched_user_id uuid,
  device_id text,
  email_new text,
  email_matched text,
  match_score numeric(5,2) default 0,
  match_reasons jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  admin_note text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_alerts_status_created
  on public.platform_security_alerts (status, created_at desc);

create index if not exists idx_platform_alerts_new_user
  on public.platform_security_alerts (new_user_id);

alter table public.device_account_bindings enable row level security;
alter table public.account_identity_tombstones enable row level security;
alter table public.platform_security_alerts enable row level security;

-- No direct client policies — SECURITY DEFINER RPCs only

-- ─── Tombstone writer ──────────────────────────────────────────────────────

create or replace function public.platform_guvenlik_tombstone_yaz(
  p_user_id uuid,
  p_source text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_norm text;
  v_canon text;
  v_local text;
  v_devices text[];
  v_was_banned boolean := false;
  v_uname text;
  v_display text;
  v_id uuid;
begin
  if p_user_id is null then return null; end if;
  if p_source not in ('self', 'admin') then
    raise exception 'invalid delete_source';
  end if;

  select email into v_email from auth.users where id = p_user_id;

  select
    coalesce(p.banned_at is not null, false),
    p.username,
    p.display_name
  into v_was_banned, v_uname, v_display
  from public.profiles p
  where p.id = p_user_id;

  v_norm := public.platform_email_normalize(v_email);
  v_canon := public.platform_email_canon(v_email);
  v_local := public.platform_email_local(v_email);

  select coalesce(array_agg(distinct ds.device_id), '{}')
  into v_devices
  from public.device_sessions ds
  where ds.user_id = p_user_id;

  -- binding cihazları da ekle
  select coalesce(v_devices, '{}') || coalesce(array_agg(b.device_id), '{}')
  into v_devices
  from public.device_account_bindings b
  where b.guest_user_id = p_user_id or b.bound_user_id = p_user_id;

  select array(select distinct x from unnest(coalesce(v_devices, '{}')) t(x) where x is not null and length(trim(x)) > 0)
  into v_devices;

  insert into public.account_identity_tombstones (
    deleted_user_id, email_normalized, email_canon, email_local_part,
    device_ids, delete_source, was_banned, username_snapshot, display_name_snapshot,
    metadata
  ) values (
    p_user_id, v_norm, v_canon, v_local,
    coalesce(v_devices, '{}'), p_source, coalesce(v_was_banned, false),
    v_uname, v_display,
    jsonb_build_object('reason', left(coalesce(p_reason, ''), 200))
  )
  returning id into v_id;

  update public.device_account_bindings
  set
    status = 'deleted',
    updated_at = now(),
    block_reason = coalesce(block_reason, 'account_deleted')
  where guest_user_id = p_user_id
     or bound_user_id = p_user_id
     or device_id = any(coalesce(v_devices, '{}'));

  return v_id;
end;
$$;

create or replace function public.platform_guvenlik_ban_cihazlar(
  p_user_id uuid,
  p_reason text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int := 0;
  v_devices text[];
begin
  if p_user_id is null then return 0; end if;

  select coalesce(array_agg(distinct ds.device_id), '{}')
  into v_devices
  from public.device_sessions ds
  where ds.user_id = p_user_id;

  update public.device_account_bindings b
  set
    status = 'banned_blocked',
    block_reason = left(coalesce(p_reason, 'account_banned'), 200),
    updated_at = now(),
    bound_user_id = coalesce(b.bound_user_id, p_user_id)
  where b.guest_user_id = p_user_id
     or b.bound_user_id = p_user_id
     or b.device_id = any(coalesce(v_devices, '{}'));

  get diagnostics v_n = row_count;

  -- Cihaz kaydı yoksa yine de bilinen session cihazlarını upsert et
  if coalesce(array_length(v_devices, 1), 0) > 0 then
    insert into public.device_account_bindings (
      device_id, bound_user_id, status, block_reason, updated_at
    )
    select d, p_user_id, 'banned_blocked', left(coalesce(p_reason, 'account_banned'), 200), now()
    from unnest(v_devices) as d
    on conflict (device_id) do update set
      status = 'banned_blocked',
      block_reason = excluded.block_reason,
      bound_user_id = coalesce(device_account_bindings.bound_user_id, excluded.bound_user_id),
      updated_at = now();
  end if;

  return v_n;
end;
$$;

-- ─── Misafir cihaz RPC ─────────────────────────────────────────────────────

create or replace function public.misafir_cihaz_durumu(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device text := nullif(trim(coalesce(p_device_id, '')), '');
  v_bind public.device_account_bindings%rowtype;
  v_guest public.profiles%rowtype;
  v_banned boolean := false;
begin
  if v_device is null then
    return jsonb_build_object('action', 'block', 'reason', 'device_id_required');
  end if;

  select * into v_bind
  from public.device_account_bindings
  where device_id = v_device;

  -- Geçmiş ban: session geçmişinde banned kullanıcı
  select exists (
    select 1
    from public.device_sessions ds
    join public.profiles p on p.id = ds.user_id
    where ds.device_id = v_device
      and p.banned_at is not null
      and p.deleted_at is null
  ) into v_banned;

  if v_banned or (v_bind.device_id is not null and v_bind.status = 'banned_blocked') then
    return jsonb_build_object(
      'action', 'block',
      'reason', 'banned_blocked',
      'user_id', v_bind.bound_user_id
    );
  end if;

  if v_bind.device_id is null then
    return jsonb_build_object('action', 'create', 'reason', 'no_binding');
  end if;

  if v_bind.status in ('upgraded', 'deleted') then
    return jsonb_build_object('action', 'create', 'reason', v_bind.status);
  end if;

  if v_bind.status = 'guest_active' and v_bind.guest_user_id is not null then
    select * into v_guest from public.profiles where id = v_bind.guest_user_id;

    if v_guest.id is null
       or v_guest.deleted_at is not null then
      update public.device_account_bindings
        set status = 'deleted', updated_at = now()
      where device_id = v_device;
      return jsonb_build_object('action', 'create', 'reason', 'guest_gone');
    end if;

    if v_guest.banned_at is not null then
      update public.device_account_bindings
        set status = 'banned_blocked',
            block_reason = coalesce(v_guest.ban_reason, 'guest_banned'),
            updated_at = now()
      where device_id = v_device;
      return jsonb_build_object('action', 'block', 'reason', 'banned_blocked', 'user_id', v_guest.id);
    end if;

    -- E-posta doğrulanmış + artık misafir değil → serbest
    if v_guest.is_guest = false then
      if exists (
        select 1 from auth.users u
        where u.id = v_guest.id and u.email_confirmed_at is not null
      ) then
        update public.device_account_bindings
        set status = 'upgraded',
            bound_user_id = v_guest.id,
            updated_at = now()
        where device_id = v_device;
        return jsonb_build_object('action', 'create', 'reason', 'upgraded');
      end if;
    end if;

    return jsonb_build_object(
      'action', 'reuse',
      'reason', 'guest_active',
      'user_id', v_guest.id
    );
  end if;

  return jsonb_build_object('action', 'create', 'reason', 'fallback');
end;
$$;

grant execute on function public.misafir_cihaz_durumu(text) to anon, authenticated;

create or replace function public.misafir_cihaz_bagla(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_device text := nullif(trim(coalesce(p_device_id, '')), '');
  v_durum jsonb;
  v_action text;
  v_prof public.profiles%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'hata', 'Not authenticated');
  end if;
  if v_device is null then
    return jsonb_build_object('ok', false, 'hata', 'device_id required');
  end if;

  select * into v_prof from public.profiles where id = v_uid;
  if v_prof.id is null then
    return jsonb_build_object('ok', false, 'hata', 'Profile not found');
  end if;
  if coalesce(v_prof.is_guest, false) = false then
    return jsonb_build_object('ok', false, 'hata', 'Not a guest');
  end if;
  if v_prof.banned_at is not null or v_prof.deleted_at is not null then
    return jsonb_build_object('ok', false, 'hata', 'Account blocked');
  end if;

  v_durum := public.misafir_cihaz_durumu(v_device);
  v_action := v_durum->>'action';

  if v_action = 'block' then
    return jsonb_build_object('ok', false, 'hata', 'Bu cihazdan misafir hesabı açılamaz', 'reason', v_durum->>'reason');
  end if;

  if v_action = 'reuse' and (v_durum->>'user_id')::uuid is distinct from v_uid then
    return jsonb_build_object(
      'ok', false,
      'hata', 'Bu cihazda zaten bir misafir hesabı var',
      'reason', 'reuse_required',
      'user_id', v_durum->>'user_id'
    );
  end if;

  insert into public.device_account_bindings (
    device_id, guest_user_id, bound_user_id, status, updated_at
  ) values (
    v_device, v_uid, null, 'guest_active', now()
  )
  on conflict (device_id) do update set
    guest_user_id = excluded.guest_user_id,
    status = 'guest_active',
    block_reason = null,
    updated_at = now()
  where device_account_bindings.status in ('guest_active', 'upgraded', 'deleted')
     or device_account_bindings.guest_user_id = v_uid;

  if not found and exists (
    select 1 from public.device_account_bindings
    where device_id = v_device and status = 'banned_blocked'
  ) then
    return jsonb_build_object('ok', false, 'hata', 'Bu cihazdan misafir hesabı açılamaz', 'reason', 'banned_blocked');
  end if;

  -- conflict where clause may skip update — ensure row exists
  if not exists (
    select 1 from public.device_account_bindings
    where device_id = v_device and guest_user_id = v_uid and status = 'guest_active'
  ) then
    -- race: another guest bound
    if exists (
      select 1 from public.device_account_bindings
      where device_id = v_device and status = 'guest_active' and guest_user_id is distinct from v_uid
    ) then
      return jsonb_build_object('ok', false, 'hata', 'Bu cihazda zaten bir misafir hesabı var', 'reason', 'reuse_required');
    end if;
    insert into public.device_account_bindings (
      device_id, guest_user_id, status, updated_at
    ) values (v_device, v_uid, 'guest_active', now())
    on conflict (device_id) do update set
      guest_user_id = excluded.guest_user_id,
      status = 'guest_active',
      block_reason = null,
      updated_at = now();
  end if;

  return jsonb_build_object('ok', true, 'device_id', v_device, 'user_id', v_uid);
end;
$$;

grant execute on function public.misafir_cihaz_bagla(text) to authenticated;

-- Edge doğrulama: cihaz+user eşleşmesi (service role çağırır)
create or replace function public.misafir_cihaz_oturum_dogrula(
  p_device_id text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device text := nullif(trim(coalesce(p_device_id, '')), '');
  v_bind public.device_account_bindings%rowtype;
  v_guest public.profiles%rowtype;
begin
  if v_device is null or p_user_id is null then
    return jsonb_build_object('ok', false, 'hata', 'missing_params');
  end if;

  select * into v_bind from public.device_account_bindings where device_id = v_device;
  if v_bind.device_id is null or v_bind.status <> 'guest_active' then
    return jsonb_build_object('ok', false, 'hata', 'not_reusable');
  end if;
  if v_bind.guest_user_id is distinct from p_user_id then
    return jsonb_build_object('ok', false, 'hata', 'user_mismatch');
  end if;

  select * into v_guest from public.profiles where id = p_user_id;
  if v_guest.id is null or v_guest.deleted_at is not null or v_guest.banned_at is not null then
    return jsonb_build_object('ok', false, 'hata', 'guest_blocked');
  end if;
  if coalesce(v_guest.is_guest, false) = false
     and exists (
       select 1 from auth.users u
       where u.id = p_user_id and u.email_confirmed_at is not null
     ) then
    return jsonb_build_object('ok', false, 'hata', 'already_upgraded');
  end if;

  return jsonb_build_object('ok', true, 'user_id', p_user_id);
end;
$$;

-- Auth email doğrulandıktan sonra client çağırır
create or replace function public.misafir_cihaz_upgrade_onay(p_device_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_device text := nullif(trim(coalesce(p_device_id, '')), '');
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'hata', 'Not authenticated');
  end if;

  select email into v_email from auth.users where id = v_uid;
  if not exists (
    select 1 from auth.users u
    where u.id = v_uid and u.email_confirmed_at is not null
  ) then
    return jsonb_build_object('ok', false, 'hata', 'email_not_confirmed');
  end if;

  update public.profiles
  set is_guest = false, updated_at = now()
  where id = v_uid and is_guest = true;

  if v_device is null then
    select b.device_id into v_device
    from public.device_account_bindings b
    where b.guest_user_id = v_uid
    order by b.updated_at desc
    limit 1;
  end if;

  if v_device is not null then
    update public.device_account_bindings
    set
      status = 'upgraded',
      bound_user_id = v_uid,
      last_email_normalized = public.platform_email_normalize(v_email),
      email_local_part = public.platform_email_local(v_email),
      updated_at = now()
    where device_id = v_device
       or guest_user_id = v_uid;
  else
    update public.device_account_bindings
    set
      status = 'upgraded',
      bound_user_id = v_uid,
      last_email_normalized = public.platform_email_normalize(v_email),
      email_local_part = public.platform_email_local(v_email),
      updated_at = now()
    where guest_user_id = v_uid;
  end if;

  return jsonb_build_object('ok', true, 'status', 'upgraded');
end;
$$;

grant execute on function public.misafir_cihaz_upgrade_onay(text) to authenticated;

-- ─── Kayıt tarama (cihaz oturumu sonrası) ──────────────────────────────────

create or replace function public.platform_guvenlik_kayit_tara(p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_device text := nullif(trim(coalesce(p_device_id, '')), '');
  v_email text;
  v_canon text;
  v_local text;
  v_is_guest boolean := false;
  v_tomb public.account_identity_tombstones%rowtype;
  v_bind public.device_account_bindings%rowtype;
  v_alert_id uuid;
  v_reasons jsonb := '[]'::jsonb;
  v_type text;
  v_severity text := 'high';
  v_matched uuid;
  v_score numeric := 0;
  v_created int := 0;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'hata', 'Not authenticated');
  end if;

  select coalesce(is_guest, false) into v_is_guest from public.profiles where id = v_uid;
  if v_is_guest then
    return jsonb_build_object('ok', true, 'skipped', 'guest');
  end if;

  select email into v_email from auth.users where id = v_uid;
  v_canon := public.platform_email_canon(v_email);
  v_local := public.platform_email_local(v_email);

  if v_device is not null then
    select * into v_bind from public.device_account_bindings where device_id = v_device;
  end if;

  -- Banlı cihazdan e-posta kayıt
  if v_bind.status = 'banned_blocked' then
    v_type := 'device_reregister_after_ban';
    v_severity := 'critical';
    v_matched := coalesce(v_bind.bound_user_id, v_bind.guest_user_id);
    v_reasons := v_reasons || jsonb_build_array('device_banned_blocked');
    v_score := v_score + 80;
  end if;

  -- Aynı cihazdan silinmiş hesap dönüşü
  if v_device is not null then
    select t.* into v_tomb
    from public.account_identity_tombstones t
    where v_device = any(t.device_ids)
    order by t.deleted_at desc
    limit 1;

    if v_tomb.id is not null then
      v_type := coalesce(v_type, 'device_reregister_after_delete');
      v_matched := coalesce(v_matched, v_tomb.deleted_user_id);
      v_reasons := v_reasons || jsonb_build_array('same_device_tombstone');
      v_score := v_score + 50;
      if v_tomb.was_banned then
        v_severity := 'critical';
        v_reasons := v_reasons || jsonb_build_array('prior_ban');
        v_score := v_score + 20;
      end if;
    end if;
  end if;

  -- Benzer e-posta
  if v_canon is not null or v_local is not null then
    select t.* into v_tomb
    from public.account_identity_tombstones t
    where (v_canon is not null and t.email_canon = v_canon)
       or (v_local is not null and t.email_local_part = v_local
           and t.email_canon is not null
           and split_part(t.email_canon, '@', 2) = split_part(coalesce(v_canon, ''), '@', 2))
    order by t.deleted_at desc
    limit 1;

    if v_tomb.id is not null then
      v_type := coalesce(v_type, 'similar_email_reregister');
      v_matched := coalesce(v_matched, v_tomb.deleted_user_id);
      if v_canon is not null and t.email_canon = v_canon then
        v_reasons := v_reasons || jsonb_build_array('email_canon_exact');
        v_score := v_score + 70;
      else
        v_reasons := v_reasons || jsonb_build_array('email_local_same_domain');
        v_score := v_score + 40;
      end if;
      if v_tomb.was_banned then
        v_severity := 'critical';
      end if;
    end if;
  end if;

  if v_type is null or jsonb_array_length(v_reasons) = 0 then
    return jsonb_build_object('ok', true, 'matched', false);
  end if;

  -- Aynı kullanıcı için açık duplicate engelle (24s)
  if exists (
    select 1 from public.platform_security_alerts a
    where a.new_user_id = v_uid
      and a.alert_type = v_type
      and a.status in ('open', 'reviewing')
      and a.created_at > now() - interval '24 hours'
  ) then
    return jsonb_build_object('ok', true, 'matched', true, 'duplicate', true);
  end if;

  insert into public.platform_security_alerts (
    alert_type, severity, status, new_user_id, matched_user_id, device_id,
    email_new, email_matched, match_score, match_reasons, metadata
  ) values (
    v_type, v_severity, 'open', v_uid, v_matched, v_device,
    public.platform_email_normalize(v_email),
    (select email_normalized from public.account_identity_tombstones where deleted_user_id = v_matched order by deleted_at desc limit 1),
    least(v_score, 100),
    v_reasons,
    jsonb_build_object(
      'email_canon', v_canon,
      'email_local', v_local,
      'binding_status', v_bind.status
    )
  )
  returning id into v_alert_id;

  v_created := 1;

  perform public.admin_operasyon_bildirimi(
    'Platform güvenliği uyarısı',
    left(coalesce(v_type, 'şüpheli kayıt') || ' · skor ' || v_score::text, 400),
    '/admin/platform-guvenlik',
    jsonb_build_object(
      'type', 'admin_platform_security',
      'alert_id', v_alert_id,
      'alert_type', v_type,
      'new_user_id', v_uid,
      'matched_user_id', v_matched,
      'device_id', v_device
    )
  );

  insert into public.security_events (user_id, event_type, severity, device_id, metadata)
  values (
    v_uid,
    'platform_reregister_suspect',
    case when v_severity = 'critical' then 'critical' else 'high' end,
    v_device,
    jsonb_build_object('alert_id', v_alert_id, 'alert_type', v_type, 'reasons', v_reasons)
  );

  return jsonb_build_object('ok', true, 'matched', true, 'alert_id', v_alert_id, 'created', v_created);
exception when others then
  -- benzer e-posta bloğundaki bug: t. yerine v_tomb.
  raise warning 'platform_guvenlik_kayit_tara: %', sqlerrm;
  return jsonb_build_object('ok', false, 'hata', sqlerrm);
end;
$$;

grant execute on function public.platform_guvenlik_kayit_tara(text) to authenticated;
