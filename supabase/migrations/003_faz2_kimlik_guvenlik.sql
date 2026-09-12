-- FAZ 2: Public User ID, guest, device sessions, security events
-- Run after 001 + 002

-- Permanent public ID (8 digit, immutable, never reused)
create sequence if not exists public.public_user_id_seq
  as bigint
  start with 10000001
  increment by 1
  minvalue 10000001
  maxvalue 99999999
  no cycle;

alter table public.profiles
  add column if not exists public_user_id text unique,
  add column if not exists is_guest boolean not null default false,
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active','suspended','deleted')),
  add column if not exists phone_e164 text,
  add column if not exists email_verified_at timestamptz,
  add column if not exists phone_verified_at timestamptz;

create unique index if not exists profiles_phone_e164_unique
  on public.profiles (phone_e164)
  where phone_e164 is not null;

create unique index if not exists profiles_public_user_id_uidx
  on public.profiles (public_user_id)
  where public_user_id is not null;

create or replace function public.yeni_public_kullanici_id()
returns text
language plpgsql
as $$
declare
  aday text;
begin
  aday := lpad(nextval('public.public_user_id_seq')::text, 8, '0');
  return aday;
end;
$$;

-- Backfill existing profiles
update public.profiles
set public_user_id = public.yeni_public_kullanici_id()
where public_user_id is null;

-- Replace signup trigger to assign public_id + guest flag from metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
  is_guest_meta boolean;
  pid text;
begin
  is_guest_meta := coalesce((new.raw_user_meta_data->>'is_guest')::boolean, false);
  uname := coalesce(
    new.raw_user_meta_data->>'username',
    case when is_guest_meta then 'guest_' || substr(replace(new.id::text, '-', ''), 1, 8)
         else 'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
    end
  );
  pid := public.yeni_public_kullanici_id();

  insert into public.profiles (
    id, username, display_name, gender, public_user_id, is_guest, language
  ) values (
    new.id,
    uname,
    coalesce(new.raw_user_meta_data->>'display_name', uname),
    coalesce(new.raw_user_meta_data->>'gender', null),
    pid,
    is_guest_meta,
    coalesce(new.raw_user_meta_data->>'language', 'tr')
  );

  insert into public.wallets (user_id, coins, diamonds)
  values (new.id, case when is_guest_meta then 0 else 100 end, 0);

  if not is_guest_meta then
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason)
    values (new.id, 'coins', 100, 100, 'welcome_bonus');
  end if;

  return new;
end;
$$;

-- Device sessions (active devices)
create table if not exists public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  platform text check (platform in ('ios','android','web','unknown')),
  device_model text,
  app_version text,
  locale text,
  timezone text,
  ip_hash text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, device_id)
);

create index if not exists device_sessions_user_idx
  on public.device_sessions (user_id, last_seen_at desc);

-- Guest local preferences (server-side so upgrade keeps history)
create table if not exists public.guest_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  language text default 'tr',
  referral_code text,
  favoriler jsonb default '[]'::jsonb,
  goruntuleme_gecmisi jsonb default '[]'::jsonb,
  device_settings jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Security events (backend heavy analysis; mobile inserts light signals only via RPC)
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  device_id text,
  ip_hash text,
  event_type text not null,
  risk_score int not null default 0 check (risk_score between 0 and 100),
  severity text not null default 'low'
    check (severity in ('safe','low','medium','high','critical')),
  metadata jsonb default '{}'::jsonb,
  status text not null default 'open'
    check (status in ('open','reviewing','resolved','ignored')),
  created_at timestamptz not null default now()
);

create index if not exists security_events_user_idx
  on public.security_events (user_id, created_at desc);
create index if not exists security_events_type_idx
  on public.security_events (event_type, created_at desc);

-- Light security event from authenticated client
create or replace function public.guvenlik_olayi_kaydet(
  p_event_type text,
  p_device_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
begin
  if p_event_type is null or length(trim(p_event_type)) = 0 then
    raise exception 'event_type required';
  end if;

  insert into public.security_events (user_id, device_id, event_type, risk_score, severity, metadata)
  values (
    v_uid,
    p_device_id,
    left(p_event_type, 64),
    5,
    'low',
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Upsert device session
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
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
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

  return v_id;
end;
$$;

-- Guest → registered (same UUID): clear is_guest after email attached
create or replace function public.misafir_hesabi_tamamlandi(
  p_display_name text,
  p_username text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set
    is_guest = false,
    display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
    username = coalesce(nullif(trim(lower(p_username)), ''), username),
    updated_at = now()
  where id = v_uid
  returning * into v_profile;

  -- Welcome coins once when upgrading guest with 0 ledger welcome
  if not exists (
    select 1 from public.wallet_ledger
    where user_id = v_uid and reason = 'welcome_bonus'
  ) then
    update public.wallets
      set coins = coins + 100, updated_at = now()
      where user_id = v_uid;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason)
    values (
      v_uid, 'coins', 100,
      (select coins from public.wallets where user_id = v_uid),
      'welcome_bonus'
    );
  end if;

  return v_profile;
end;
$$;

-- RLS
alter table public.device_sessions enable row level security;
alter table public.guest_preferences enable row level security;
alter table public.security_events enable row level security;

create policy "Own device sessions read"
  on public.device_sessions for select to authenticated
  using (auth.uid() = user_id);

create policy "Own device sessions update revoke"
  on public.device_sessions for update to authenticated
  using (auth.uid() = user_id);

create policy "Own guest preferences"
  on public.guest_preferences for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Clients cannot freely insert security_events; use RPC
create policy "Own security events read"
  on public.security_events for select to authenticated
  using (auth.uid() = user_id);

grant select, update on public.device_sessions to authenticated;
grant select, insert, update on public.guest_preferences to authenticated;
grant select on public.security_events to authenticated;
grant execute on function public.guvenlik_olayi_kaydet to authenticated;
grant execute on function public.cihaz_oturumu_kaydet to authenticated;
grant execute on function public.misafir_hesabi_tamamlandi to authenticated;
grant execute on function public.yeni_public_kullanici_id to authenticated;
