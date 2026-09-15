-- FAZ 7: Agency, Host, commission snapshot, transfers, withdrawals
-- Run after 001–007

-- Agency levels (admin managed)
create table if not exists public.agency_levels (
  code text primary key,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

insert into public.agency_levels (code, name, sort_order) values
  ('bronze','Bronze',1),('silver','Silver',2),('gold','Gold',3),
  ('diamond','Diamond',4),('royal','Royal',5),('legendary','Legendary',6)
on conflict (code) do nothing;

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  agency_public_id text unique not null,
  name text not null,
  logo_url text,
  banner_url text,
  country text,
  description text,
  owner_id uuid not null references public.profiles(id),
  level_code text references public.agency_levels(code) default 'bronze',
  host_count int not null default 0,
  total_gifts bigint not null default 0,
  monthly_score bigint not null default 0,
  ranking int,
  trust_tier text not null default 'B'
    check (trust_tier in ('A','B','C','Restricted','Suspended')),
  is_coin_distributor boolean not null default false,
  status text not null default 'active'
    check (status in ('active','suspended','closed')),
  invite_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agencies_owner_idx on public.agencies (owner_id);
create index if not exists agencies_status_idx on public.agencies (status, monthly_score desc);

create table if not exists public.agency_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  agency_name text not null,
  country text,
  email text,
  phone text,
  experience text,
  expected_hosts int,
  description text,
  logo_url text,
  documents jsonb default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','under_review','approved','rejected','suspended')),
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.host_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  path text not null check (path in ('independent','join_agency')),
  agency_id uuid references public.agencies(id) on delete set null,
  invite_code text,
  status text not null default 'pending'
    check (status in ('pending','agency_review','platform_review','approved','rejected')),
  note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.host_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  agency_id uuid references public.agencies(id) on delete set null,
  status text not null default 'independent'
    check (status in ('independent','agency','suspended')),
  daily_live_seconds bigint not null default 0,
  monthly_live_seconds bigint not null default 0,
  total_live_seconds bigint not null default 0,
  gift_income_diamonds bigint not null default 0,
  unique_gifters int not null default 0,
  pk_wins int not null default 0,
  violations int not null default 0,
  joined_agency_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Host targets (admin configurable)
create table if not exists public.host_targets (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,
  name text not null,
  live_hours numeric(10,2) default 0,
  diamond_target bigint default 0,
  gift_target bigint default 0,
  active_days int default 0,
  period text not null default 'monthly' check (period in ('daily','weekly','monthly')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Commission rates per agency (current); snapshot on each gift tx
create table if not exists public.agency_commission_rates (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  host_share numeric(5,4) not null default 0.7000,
  agency_share numeric(5,4) not null default 0.2000,
  platform_share numeric(5,4) not null default 0.1000,
  updated_at timestamptz default now(),
  check (host_share + agency_share + platform_share <= 1.0001)
);

-- Gift tx already has agency_commission_snapshot; add agency earnings ledger
create table if not exists public.agency_earnings_ledger (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  delta_diamonds bigint not null,
  balance_after bigint not null,
  reason text not null,
  commission_snapshot numeric(5,4),
  ref_type text,
  ref_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.agency_wallets (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  diamonds bigint not null default 0 check (diamonds >= 0),
  distribution_balance bigint not null default 0 check (distribution_balance >= 0),
  updated_at timestamptz default now()
);

-- Authorized coin distributor
create table if not exists public.agency_coin_auth_applications (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','suspended')),
  note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.agency_transfer_limits (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  single_transfer_limit bigint not null default 10000,
  daily_limit bigint not null default 50000,
  monthly_limit bigint not null default 500000,
  per_user_limit bigint not null default 20000,
  updated_at timestamptz default now()
);

create table if not exists public.agency_coin_transfers (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  from_user_id uuid references public.profiles(id),
  to_user_id uuid not null references public.profiles(id),
  coins bigint not null check (coins > 0),
  idempotency_key text not null unique,
  status text not null default 'completed'
    check (status in ('pending','completed','failed','reversed')),
  created_at timestamptz not null default now()
);

-- Host transfer between agencies
create table if not exists public.host_agency_transfers (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  from_agency_id uuid references public.agencies(id),
  to_agency_id uuid not null references public.agencies(id),
  status text not null default 'requested'
    check (status in ('requested','approved','rejected','completed')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Withdrawals: host vs agency ayrı
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  requester_type text not null check (requester_type in ('host','agency')),
  user_id uuid references public.profiles(id) on delete set null,
  agency_id uuid references public.agencies(id) on delete set null,
  diamonds bigint not null check (diamonds > 0),
  amount_usd numeric(12,2),
  method text not null default 'bank',
  details jsonb default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','under_review','approved','paid','rejected','frozen')),
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Helpers
create or replace function public.yeni_ajans_public_id()
returns text language plpgsql as $$
begin
  return 'AG' || lpad((floor(random()*90000000)+10000000)::text, 8, '0');
end;
$$;

-- Apply agency (guest engelli)
create or replace function public.ajans_basvurusu_olustur(
  p_agency_name text,
  p_country text default null,
  p_email text default null,
  p_phone text default null,
  p_experience text default null,
  p_expected_hosts int default null,
  p_description text default null
)
returns public.agency_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_row public.agency_applications%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot create agency'; end if;
  if p_agency_name is null or length(trim(p_agency_name)) < 2 then
    raise exception 'Agency name required';
  end if;

  insert into public.agency_applications (
    applicant_id, agency_name, country, email, phone, experience, expected_hosts, description
  ) values (
    v_uid, trim(p_agency_name), p_country, p_email, p_phone, p_experience, p_expected_hosts, p_description
  ) returning * into v_row;
  return v_row;
end;
$$;

-- Approve agency (service_role / admin later). FAZ7: owner self-activate for approved apps via admin SQL.
create or replace function public.ajans_onayla_ve_olustur(p_application_id uuid)
returns public.agencies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.agency_applications%rowtype;
  v_agency public.agencies%rowtype;
  v_code text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  select * into v_app from public.agency_applications where id = p_application_id for update;
  if not found then raise exception 'Application not found'; end if;
  if v_app.status <> 'pending' and v_app.status <> 'under_review' then
    raise exception 'Invalid status';
  end if;

  v_code := upper(substr(md5(v_app.id::text), 1, 8));

  insert into public.agencies (
    agency_public_id, name, country, description, owner_id, invite_code, status
  ) values (
    public.yeni_ajans_public_id(), v_app.agency_name, v_app.country, v_app.description,
    v_app.applicant_id, v_code, 'active'
  ) returning * into v_agency;

  insert into public.agency_wallets (agency_id) values (v_agency.id);
  insert into public.agency_commission_rates (agency_id) values (v_agency.id);
  insert into public.agency_transfer_limits (agency_id) values (v_agency.id);

  update public.agency_applications set
    status = 'approved', reviewed_at = now()
  where id = p_application_id;

  return v_agency;
end;
$$;

-- Host application
create or replace function public.host_basvurusu_olustur(
  p_path text,
  p_invite_code text default null
)
returns public.host_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_agency uuid;
  v_row public.host_applications%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot become host'; end if;

  if p_path = 'join_agency' then
    if p_invite_code is null then raise exception 'Invite code required'; end if;
    select id into v_agency from public.agencies
    where invite_code = upper(trim(p_invite_code)) and status = 'active';
    if v_agency is null then raise exception 'Invalid invite code'; end if;
  end if;

  insert into public.host_applications (user_id, path, agency_id, invite_code, status)
  values (
    v_uid, p_path, v_agency, p_invite_code,
    case when p_path = 'join_agency' then 'agency_review' else 'platform_review' end
  ) returning * into v_row;
  return v_row;
end;
$$;

-- Approve host (service_role)
create or replace function public.host_basvurusunu_onayla(p_application_id uuid)
returns public.host_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.host_applications%rowtype;
  v_host public.host_profiles%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Forbidden'; end if;
  select * into v_app from public.host_applications where id = p_application_id for update;
  if not found then raise exception 'Not found'; end if;

  insert into public.host_profiles (user_id, agency_id, status, joined_agency_at)
  values (
    v_app.user_id, v_app.agency_id,
    case when v_app.agency_id is null then 'independent' else 'agency' end,
    case when v_app.agency_id is null then null else now() end
  )
  on conflict (user_id) do update set
    agency_id = excluded.agency_id,
    status = excluded.status,
    joined_agency_at = coalesce(host_profiles.joined_agency_at, excluded.joined_agency_at),
    updated_at = now()
  returning * into v_host;

  update public.profiles set is_host = true, updated_at = now() where id = v_app.user_id;
  update public.user_profile_stats set
    host_status = v_host.status,
    agency_id = v_host.agency_id,
    updated_at = now()
  where user_id = v_app.user_id;

  if v_host.agency_id is not null then
    update public.agencies set host_count = host_count + 1 where id = v_host.agency_id;
  end if;

  update public.host_applications set status = 'approved', reviewed_at = now()
  where id = p_application_id;

  return v_host;
end;
$$;

-- Dev helper: self-approve independent host for testing (remove/restrict in prod)
create or replace function public.host_bagimsiz_aktif_et()
returns public.host_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_host public.host_profiles%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot become host'; end if;

  insert into public.host_profiles (user_id, status)
  values (v_uid, 'independent')
  on conflict (user_id) do update set status = 'independent', updated_at = now()
  returning * into v_host;

  update public.profiles set is_host = true where id = v_uid;
  update public.user_profile_stats set host_status = 'independent', updated_at = now()
  where user_id = v_uid;

  return v_host;
end;
$$;

-- Agency coin transfer (distributor only, limits, kill switch, idempotency)
create or replace function public.ajans_coin_transfer(
  p_agency_id uuid,
  p_to_user_id uuid,
  p_coins bigint,
  p_idempotency_key text
)
returns public.agency_coin_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_agency public.agencies%rowtype;
  v_limits public.agency_transfer_limits%rowtype;
  v_wallet public.agency_wallets%rowtype;
  v_tx public.agency_coin_transfers%rowtype;
  v_daily bigint;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_agency_coin_transfer') then
    raise exception 'Agency transfers temporarily disabled';
  end if;
  if not public.ozellik_bayragi_aktif_mi('agency_enabled') then
    raise exception 'Agency feature disabled';
  end if;
  if p_coins is null or p_coins <= 0 then raise exception 'Invalid coins'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key required';
  end if;

  select * into v_tx from public.agency_coin_transfers where idempotency_key = p_idempotency_key;
  if found then return v_tx; end if;

  select * into v_agency from public.agencies where id = p_agency_id for update;
  if not found then raise exception 'Agency not found'; end if;
  if v_agency.owner_id <> v_uid then raise exception 'Not agency owner'; end if;
  if not v_agency.is_coin_distributor then raise exception 'Not authorized distributor'; end if;
  if v_agency.trust_tier in ('Restricted','Suspended') or v_agency.status <> 'active' then
    raise exception 'Agency not allowed to transfer';
  end if;

  select * into v_limits from public.agency_transfer_limits where agency_id = p_agency_id;
  if not found then raise exception 'Limits missing'; end if;
  if p_coins > v_limits.single_transfer_limit then raise exception 'Single transfer limit'; end if;
  if p_coins > v_limits.per_user_limit then raise exception 'Per user limit'; end if;

  select coalesce(sum(coins),0) into v_daily from public.agency_coin_transfers
  where agency_id = p_agency_id and status = 'completed'
    and created_at >= date_trunc('day', now());
  if v_daily + p_coins > v_limits.daily_limit then raise exception 'Daily limit'; end if;

  select * into v_wallet from public.agency_wallets where agency_id = p_agency_id for update;
  if v_wallet.distribution_balance < p_coins then raise exception 'Insufficient distribution balance'; end if;

  update public.agency_wallets set
    distribution_balance = distribution_balance - p_coins,
    updated_at = now()
  where agency_id = p_agency_id;

  update public.wallets set coins = coins + p_coins, updated_at = now()
  where user_id = p_to_user_id;

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type)
  values (
    p_to_user_id, 'coins', p_coins,
    (select coins from public.wallets where user_id = p_to_user_id),
    'agency_distribution', 'agency_transfer'
  );

  insert into public.agency_coin_transfers (
    agency_id, from_user_id, to_user_id, coins, idempotency_key, status
  ) values (
    p_agency_id, v_uid, p_to_user_id, p_coins, p_idempotency_key, 'completed'
  ) returning * into v_tx;

  return v_tx;
end;
$$;

-- Withdrawal request (host diamonds)
create or replace function public.cekim_talebi_olustur(
  p_diamonds bigint,
  p_method text default 'bank',
  p_details jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_bal bigint;
  v_row public.withdrawal_requests%rowtype;
  v_key text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_withdrawal') then
    raise exception 'Withdrawals temporarily disabled';
  end if;
  if not public.ozellik_bayragi_aktif_mi('withdrawals_enabled') then
    raise exception 'Withdrawals feature disabled';
  end if;

  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot withdraw'; end if;
  if p_diamonds is null or p_diamonds <= 0 then raise exception 'Invalid amount'; end if;

  v_key := coalesce(nullif(trim(p_idempotency_key), ''), 'wd_' || v_uid::text || '_' || p_diamonds::text || '_' || extract(epoch from now())::bigint);

  select * into v_row from public.withdrawal_requests where idempotency_key = v_key;
  if found then return v_row; end if;

  select diamonds into v_bal from public.host_earnings where user_id = v_uid for update;
  if coalesce(v_bal, 0) < p_diamonds then raise exception 'Insufficient diamonds'; end if;

  -- Hold: deduct pending (freeze balance)
  update public.host_earnings set diamonds = diamonds - p_diamonds, updated_at = now()
  where user_id = v_uid;
  update public.wallets set diamonds = greatest(diamonds - p_diamonds, 0), updated_at = now()
  where user_id = v_uid;

  insert into public.host_earnings_ledger (user_id, delta, balance_after, reason, ref_type)
  values (
    v_uid, -p_diamonds,
    (select diamonds from public.host_earnings where user_id = v_uid),
    'withdrawal_hold', 'withdrawal'
  );

  insert into public.withdrawal_requests (
    requester_type, user_id, diamonds, method, details, status, idempotency_key
  ) values (
    'host', v_uid, p_diamonds, coalesce(p_method, 'bank'), coalesce(p_details, '{}'::jsonb),
    'pending', v_key
  ) returning * into v_row;

  return v_row;
end;
$$;

-- On gift received: agency commission snapshot (if host in agency)
create or replace function public.hediye_ajans_komisyon()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host public.host_profiles%rowtype;
  v_rate public.agency_commission_rates%rowtype;
  v_agency_cut bigint;
  v_bal bigint;
begin
  select * into v_host from public.host_profiles
  where user_id = new.receiver_id and status = 'agency' and agency_id is not null;
  if not found then return new; end if;

  select * into v_rate from public.agency_commission_rates where agency_id = v_host.agency_id;
  if not found then return new; end if;

  v_agency_cut := floor(new.diamonds_earned * v_rate.agency_share)::bigint;
  if v_agency_cut <= 0 then return new; end if;

  -- Snapshot on gift tx
  update public.gift_transactions set
    agency_id = v_host.agency_id,
    agency_commission_snapshot = v_rate.agency_share
  where id = new.id;

  insert into public.agency_wallets (agency_id, diamonds)
  values (v_host.agency_id, 0)
  on conflict do nothing;

  update public.agency_wallets set
    diamonds = diamonds + v_agency_cut,
    updated_at = now()
  where agency_id = v_host.agency_id
  returning diamonds into v_bal;

  insert into public.agency_earnings_ledger (
    agency_id, delta_diamonds, balance_after, reason, commission_snapshot, ref_type, ref_id
  ) values (
    v_host.agency_id, v_agency_cut, v_bal, 'gift_commission', v_rate.agency_share, 'gift', new.id
  );

  update public.agencies set total_gifts = total_gifts + new.coins_spent where id = v_host.agency_id;

  return new;
end;
$$;

drop trigger if exists gift_tx_agency_commission_trg on public.gift_transactions;
create trigger gift_tx_agency_commission_trg
  after insert on public.gift_transactions
  for each row execute function public.hediye_ajans_komisyon();

-- RLS
alter table public.agency_levels enable row level security;
alter table public.agencies enable row level security;
alter table public.agency_applications enable row level security;
alter table public.host_applications enable row level security;
alter table public.host_profiles enable row level security;
alter table public.host_targets enable row level security;
alter table public.agency_commission_rates enable row level security;
alter table public.agency_earnings_ledger enable row level security;
alter table public.agency_wallets enable row level security;
alter table public.agency_coin_auth_applications enable row level security;
alter table public.agency_transfer_limits enable row level security;
alter table public.agency_coin_transfers enable row level security;
alter table public.host_agency_transfers enable row level security;
alter table public.withdrawal_requests enable row level security;

drop policy if exists "Agency levels readable" on public.agency_levels;
create policy "Agency levels readable" on public.agency_levels for select to authenticated using (is_active);
drop policy if exists "Agencies readable" on public.agencies;
create policy "Agencies readable" on public.agencies for select to authenticated using (true);
drop policy if exists "Own agency applications" on public.agency_applications;
create policy "Own agency applications" on public.agency_applications for select to authenticated using (auth.uid() = applicant_id);
drop policy if exists "Own host applications" on public.host_applications;
create policy "Own host applications" on public.host_applications for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Host profiles readable" on public.host_profiles;
create policy "Host profiles readable" on public.host_profiles for select to authenticated using (true);
drop policy if exists "Host targets readable" on public.host_targets;
create policy "Host targets readable" on public.host_targets for select to authenticated using (is_active);
drop policy if exists "Commission rates readable owners" on public.agency_commission_rates;
create policy "Commission rates readable owners" on public.agency_commission_rates for select to authenticated
  using (exists (select 1 from public.agencies a where a.id = agency_id and a.owner_id = auth.uid()));
drop policy if exists "Agency wallet owner read" on public.agency_wallets;
create policy "Agency wallet owner read" on public.agency_wallets for select to authenticated
  using (exists (select 1 from public.agencies a where a.id = agency_id and a.owner_id = auth.uid()));
drop policy if exists "Agency earnings owner read" on public.agency_earnings_ledger;
create policy "Agency earnings owner read" on public.agency_earnings_ledger for select to authenticated
  using (exists (select 1 from public.agencies a where a.id = agency_id and a.owner_id = auth.uid()));
drop policy if exists "Own withdrawals" on public.withdrawal_requests;
create policy "Own withdrawals" on public.withdrawal_requests for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "Own agency transfers read" on public.agency_coin_transfers;
create policy "Own agency transfers read" on public.agency_coin_transfers for select to authenticated
  using (
    auth.uid() = to_user_id or auth.uid() = from_user_id or
    exists (select 1 from public.agencies a where a.id = agency_id and a.owner_id = auth.uid())
  );

grant select on public.agency_levels to authenticated;
grant select on public.agencies to authenticated;
grant select on public.agency_applications to authenticated;
grant select on public.host_applications to authenticated;
grant select on public.host_profiles to authenticated;
grant select on public.host_targets to authenticated;
grant select on public.agency_commission_rates to authenticated;
grant select on public.agency_wallets to authenticated;
grant select on public.agency_earnings_ledger to authenticated;
grant select on public.agency_coin_transfers to authenticated;
grant select on public.withdrawal_requests to authenticated;
grant execute on function public.ajans_basvurusu_olustur(text, text, text, text, text, int, text) to authenticated;
grant execute on function public.host_basvurusu_olustur(text, text) to authenticated;
grant execute on function public.host_bagimsiz_aktif_et() to authenticated;
grant execute on function public.ajans_coin_transfer(uuid, uuid, bigint, text) to authenticated;
grant execute on function public.cekim_talebi_olustur(bigint, text, jsonb, text) to authenticated;
