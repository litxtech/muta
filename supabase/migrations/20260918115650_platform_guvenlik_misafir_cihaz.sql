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

  select coalesce(
    (
      select array_agg(distinct x)
      from (
        select unnest(coalesce(v_devices, '{}')) as x
        union
        select b.device_id
        from public.device_account_bindings b
        where b.guest_user_id = p_user_id or b.bound_user_id = p_user_id
      ) q
      where x is not null and length(trim(x)) > 0
    ),
    '{}'
  )
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
  v_domain text;
  v_is_guest boolean := false;
  v_tomb_device public.account_identity_tombstones%rowtype;
  v_tomb_email public.account_identity_tombstones%rowtype;
  v_bind public.device_account_bindings%rowtype;
  v_alert_id uuid;
  v_reasons jsonb := '[]'::jsonb;
  v_type text;
  v_severity text := 'high';
  v_matched uuid;
  v_score numeric := 0;
  v_email_matched text;
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
  v_domain := case
    when v_canon is null then null
    else split_part(v_canon, '@', 2)
  end;

  if v_device is not null then
    select * into v_bind from public.device_account_bindings where device_id = v_device;
  end if;

  if v_bind.status = 'banned_blocked' then
    v_type := 'device_reregister_after_ban';
    v_severity := 'critical';
    v_matched := coalesce(v_bind.bound_user_id, v_bind.guest_user_id);
    v_reasons := v_reasons || jsonb_build_array('device_banned_blocked');
    v_score := v_score + 80;
  end if;

  if v_device is not null then
    select t.* into v_tomb_device
    from public.account_identity_tombstones t
    where v_device = any(t.device_ids)
    order by t.deleted_at desc
    limit 1;

    if v_tomb_device.id is not null then
      v_type := coalesce(v_type, 'device_reregister_after_delete');
      v_matched := coalesce(v_matched, v_tomb_device.deleted_user_id);
      v_email_matched := coalesce(v_email_matched, v_tomb_device.email_normalized);
      v_reasons := v_reasons || jsonb_build_array('same_device_tombstone');
      v_score := v_score + 50;
      if v_tomb_device.was_banned then
        v_severity := 'critical';
        v_reasons := v_reasons || jsonb_build_array('prior_ban');
        v_score := v_score + 20;
      end if;
    end if;
  end if;

  if v_canon is not null then
    select t.* into v_tomb_email
    from public.account_identity_tombstones t
    where t.email_canon = v_canon
    order by t.deleted_at desc
    limit 1;

    if v_tomb_email.id is not null then
      v_type := coalesce(v_type, 'similar_email_reregister');
      v_matched := coalesce(v_matched, v_tomb_email.deleted_user_id);
      v_email_matched := coalesce(v_email_matched, v_tomb_email.email_normalized);
      v_reasons := v_reasons || jsonb_build_array('email_canon_exact');
      v_score := v_score + 70;
      if v_tomb_email.was_banned then
        v_severity := 'critical';
      end if;
    elsif v_local is not null and v_domain is not null then
      select t.* into v_tomb_email
      from public.account_identity_tombstones t
      where t.email_local_part = v_local
        and t.email_canon is not null
        and split_part(t.email_canon, '@', 2) = v_domain
      order by t.deleted_at desc
      limit 1;

      if v_tomb_email.id is not null then
        v_type := coalesce(v_type, 'similar_email_reregister');
        v_matched := coalesce(v_matched, v_tomb_email.deleted_user_id);
        v_email_matched := coalesce(v_email_matched, v_tomb_email.email_normalized);
        v_reasons := v_reasons || jsonb_build_array('email_local_same_domain');
        v_score := v_score + 40;
        if v_tomb_email.was_banned then
          v_severity := 'critical';
        end if;
      end if;
    end if;
  end if;

  if v_type is null or jsonb_array_length(v_reasons) = 0 then
    return jsonb_build_object('ok', true, 'matched', false);
  end if;

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
    v_email_matched,
    least(v_score, 100),
    v_reasons,
    jsonb_build_object(
      'email_canon', v_canon,
      'email_local', v_local,
      'binding_status', v_bind.status
    )
  )
  returning id into v_alert_id;

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

  return jsonb_build_object('ok', true, 'matched', true, 'alert_id', v_alert_id);
end;
$$;

grant execute on function public.platform_guvenlik_kayit_tara(text) to authenticated;

-- ─── cihaz_oturumu_kaydet: tarama tetikle ──────────────────────────────────

create or replace function public.cihaz_oturumu_kaydet(
  p_device_id text,
  p_platform text default 'unknown',
  p_device_model text default null,
  p_app_version text default null,
  p_locale text default null,
  p_timezone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_device_id is null or length(trim(p_device_id)) = 0 then
    raise exception 'device_id required';
  end if;

  insert into public.device_sessions (
    user_id, device_id, platform, device_model, app_version, locale, timezone, last_seen_at
  ) values (
    v_uid, p_device_id, coalesce(p_platform, 'unknown'),
    p_device_model, p_app_version, p_locale, p_timezone, now()
  )
  on conflict (user_id, device_id) do update set
    platform = excluded.platform,
    device_model = coalesce(excluded.device_model, device_sessions.device_model),
    app_version = coalesce(excluded.app_version, device_sessions.app_version),
    locale = coalesce(excluded.locale, device_sessions.locale),
    timezone = coalesce(excluded.timezone, device_sessions.timezone),
    last_seen_at = now(),
    revoked_at = null
  returning id into v_id;

  begin
    perform public.platform_guvenlik_kayit_tara(p_device_id);
  exception when others then
    raise warning 'cihaz_oturumu_kaydet tarama: %', sqlerrm;
  end;

  return v_id;
end;
$$;

grant execute on function public.cihaz_oturumu_kaydet(text, text, text, text, text, text) to authenticated;

-- ─── Ban / sil hook ────────────────────────────────────────────────────────

create or replace function public.admin_kullanici_banla(
  p_user_id uuid,
  p_reason text default 'policy_violation'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'policy_violation');
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_user_id = auth.uid() then raise exception 'Kendini banlayamazsin'; end if;

  update public.profiles set
    banned_at = now(),
    ban_reason = v_reason,
    updated_at = now()
  where id = p_user_id;

  update public.device_sessions
    set revoked_at = now()
  where user_id = p_user_id and revoked_at is null;

  perform public.platform_guvenlik_ban_cihazlar(p_user_id, v_reason);

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    p_user_id, 'account_banned', 'high',
    jsonb_build_object('reason', v_reason, 'by', auth.uid())
  );

  perform public.admin_audit_yaz(
    p_user_id, 'ban',
    'Kullanici banlandi: ' || v_reason,
    jsonb_build_object('reason', v_reason)
  );

  return jsonb_build_object('ok', true, 'kod', 'banned');
end;
$$;

create or replace function public.admin_kullanici_sil(
  p_user_id uuid,
  p_reason text default 'admin_delete'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'admin_delete');
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_user_id = auth.uid() then raise exception 'Kendini silemezsin'; end if;

  perform public.platform_guvenlik_tombstone_yaz(p_user_id, 'admin', v_reason);

  update public.profiles set
    deleted_at = now(),
    deletion_requested_at = now(),
    banned_at = coalesce(banned_at, now()),
    ban_reason = coalesce(ban_reason, v_reason),
    display_name = 'Silinmis hesap',
    username = 'deleted_' || replace(id::text, '-', ''),
    avatar_url = null,
    bio = '',
    phone_e164 = null,
    updated_at = now()
  where id = p_user_id and deleted_at is null;

  update public.device_sessions
    set revoked_at = now()
  where user_id = p_user_id and revoked_at is null;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    p_user_id, 'account_admin_deleted', 'critical',
    jsonb_build_object('reason', v_reason, 'by', auth.uid())
  );

  perform public.admin_audit_yaz(
    p_user_id, 'delete',
    'Hesap admin tarafindan silindi',
    jsonb_build_object('reason', v_reason)
  );

  return jsonb_build_object('ok', true, 'kod', 'deleted');
end;
$$;

-- hesap_sil_istegi — tombstone önce, sonra mevcut scrub
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

  perform public.platform_guvenlik_tombstone_yaz(v_uid, 'self', p_reason);

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
    birth_date = null,
    gender = null,
    country_code = null,
    region_id = null,
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

    delete from public.room_members where user_id = v_uid;

    delete from public.room_members
    where room_id in (select id from public.rooms where host_id = v_uid);

    update public.room_seats
    set user_id = null, is_muted = false
    where user_id = v_uid
       or room_id in (select id from public.rooms where host_id = v_uid);
  exception when undefined_table then
    null;
  when others then
    null;
  end;

  begin
    update public.status_posts
      set deleted_at = coalesce(deleted_at, now()), updated_at = now()
    where user_id = v_uid and deleted_at is null;

    update public.status_comments
      set deleted_at = coalesce(deleted_at, now())
    where user_id = v_uid and deleted_at is null;
  exception when undefined_table then
    null;
  end;

  begin
    update public.room_chat_messages
      set body = '[silindi]',
          removed_at = coalesce(removed_at, now()),
          removed_by = coalesce(removed_by, v_uid)
    where user_id = v_uid and removed_at is null;
  exception when undefined_table then
    null;
  when undefined_column then
    null;
  end;

  begin
    update public.live_chat_messages
      set body = '[silindi]',
          removed_at = coalesce(removed_at, now()),
          removed_by = coalesce(removed_by, v_uid)
    where user_id = v_uid and removed_at is null;
  exception when undefined_table then
    null;
  when undefined_column then
    null;
  end;

  begin
    update public.message_thread_members
      set deleted_at = coalesce(deleted_at, now())
    where user_id = v_uid and deleted_at is null;
  exception when undefined_table then
    null;
  end;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    v_uid, 'account_delete_requested', 'medium',
    jsonb_build_object(
      'reason', left(coalesce(p_reason, ''), 200),
      'source', 'hesap_sil_istegi',
      'pii_cleared', true,
      'content_scrubbed', true
    )
  );

  return jsonb_build_object('ok', true, 'kod', 'deleted');
end;
$$;

grant execute on function public.hesap_sil_istegi(text) to authenticated;

-- ─── Admin Platform Güvenliği RPC ──────────────────────────────────────────

create or replace function public.admin_platform_guvenlik_listele(
  p_limit int default 60,
  p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 60), 100));
  v_status text := nullif(trim(coalesce(p_status, '')), '');
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc)
    from (
      select
        a.id,
        a.alert_type,
        a.severity,
        a.status,
        a.new_user_id,
        a.matched_user_id,
        a.device_id,
        a.email_new,
        a.email_matched,
        a.match_score,
        a.match_reasons,
        a.metadata,
        a.admin_note,
        a.resolved_by,
        a.resolved_at,
        a.created_at,
        pn.display_name as new_display_name,
        pn.username as new_username,
        pm.display_name as matched_display_name,
        pm.username as matched_username
      from public.platform_security_alerts a
      left join public.profiles pn on pn.id = a.new_user_id
      left join public.profiles pm on pm.id = a.matched_user_id
      where v_status is null or a.status = v_status
      order by a.created_at desc
      limit v_limit
    ) x
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_platform_guvenlik_listele(int, text) to authenticated;

create or replace function public.admin_platform_guvenlik_detay(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alert public.platform_security_alerts%rowtype;
  v_logs jsonb := '[]'::jsonb;
  v_tombs jsonb := '[]'::jsonb;
  v_sessions jsonb := '[]'::jsonb;
  v_binding jsonb := null;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  select * into v_alert from public.platform_security_alerts where id = p_id;
  if v_alert.id is null then
    return jsonb_build_object('ok', false, 'hata', 'not_found');
  end if;

  select coalesce(jsonb_agg(row_to_json(e)::jsonb order by e.created_at desc), '[]'::jsonb)
  into v_logs
  from (
    select id, event_type, severity, device_id, metadata, created_at
    from public.security_events
    where user_id in (v_alert.new_user_id, v_alert.matched_user_id)
       or (v_alert.device_id is not null and device_id = v_alert.device_id)
    order by created_at desc
    limit 40
  ) e;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.deleted_at desc), '[]'::jsonb)
  into v_tombs
  from (
    select id, deleted_user_id, email_normalized, email_canon, email_local_part,
           device_ids, delete_source, was_banned, username_snapshot, deleted_at, metadata
    from public.account_identity_tombstones
    where deleted_user_id = v_alert.matched_user_id
       or (v_alert.device_id is not null and v_alert.device_id = any(device_ids))
       or (v_alert.email_new is not null and email_normalized = v_alert.email_new)
    order by deleted_at desc
    limit 10
  ) t;

  if v_alert.device_id is not null then
    select to_jsonb(b) into v_binding
    from public.device_account_bindings b
    where b.device_id = v_alert.device_id;

    select coalesce(jsonb_agg(row_to_json(s)::jsonb order by s.last_seen_at desc), '[]'::jsonb)
    into v_sessions
    from (
      select user_id, device_id, platform, device_model, app_version, last_seen_at, revoked_at
      from public.device_sessions
      where device_id = v_alert.device_id
      order by last_seen_at desc nulls last
      limit 20
    ) s;
  end if;

  return jsonb_build_object(
    'ok', true,
    'alert', to_jsonb(v_alert),
    'logs', v_logs,
    'tombstones', v_tombs,
    'binding', v_binding,
    'device_sessions', v_sessions
  );
end;
$$;

grant execute on function public.admin_platform_guvenlik_detay(uuid) to authenticated;

create or replace function public.admin_platform_guvenlik_durum(
  p_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := nullif(trim(coalesce(p_status, '')), '');
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if v_status is null or v_status not in ('open', 'reviewing', 'resolved', 'ignored') then
    raise exception 'invalid status';
  end if;

  update public.platform_security_alerts set
    status = v_status,
    admin_note = case
      when p_note is null then admin_note
      else left(trim(p_note), 500)
    end,
    resolved_by = case when v_status in ('resolved', 'ignored') then auth.uid() else resolved_by end,
    resolved_at = case when v_status in ('resolved', 'ignored') then now() else resolved_at end
  where id = p_id;

  if not found then
    return jsonb_build_object('ok', false, 'hata', 'not_found');
  end if;

  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

grant execute on function public.admin_platform_guvenlik_durum(uuid, text, text) to authenticated;

create or replace function public.admin_cihaz_engelle(
  p_device_id text,
  p_reason text default 'admin_device_block'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device text := nullif(trim(coalesce(p_device_id, '')), '');
  v_reason text := left(coalesce(nullif(trim(p_reason), ''), 'admin_device_block'), 200);
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if v_device is null then raise exception 'device_id required'; end if;

  insert into public.device_account_bindings (
    device_id, status, block_reason, updated_at
  ) values (
    v_device, 'banned_blocked', v_reason, now()
  )
  on conflict (device_id) do update set
    status = 'banned_blocked',
    block_reason = excluded.block_reason,
    updated_at = now();

  insert into public.security_events (user_id, event_type, severity, device_id, metadata)
  values (
    auth.uid(), 'device_blocked', 'high', v_device,
    jsonb_build_object('reason', v_reason, 'by', auth.uid())
  );

  perform public.admin_audit_yaz(
    auth.uid(), 'device_block',
    'Cihaz engellendi: ' || v_device,
    jsonb_build_object('device_id', v_device, 'reason', v_reason)
  );

  return jsonb_build_object('ok', true, 'device_id', v_device);
end;
$$;

grant execute on function public.admin_cihaz_engelle(text, text) to authenticated;

grant execute on function public.misafir_cihaz_oturum_dogrula(text, uuid) to service_role;
grant execute on function public.platform_guvenlik_tombstone_yaz(uuid, text, text) to service_role;
