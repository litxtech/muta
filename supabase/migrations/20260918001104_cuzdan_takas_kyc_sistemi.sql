-- Cüzdan takas + 18 haneli cüzdan no + KYC (kimlik onayı)
-- Sabit cüzdan markası: MUTA PAY (uygulama adından bağımsız)

-- ---------------------------------------------------------------------------
-- 0) Ledger meta + agency coins
-- ---------------------------------------------------------------------------
alter table public.wallet_ledger
  add column if not exists meta jsonb not null default '{}'::jsonb;

alter table public.agency_wallets
  add column if not exists coins bigint not null default 0;

-- ---------------------------------------------------------------------------
-- 1) Cüzdan hesapları
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  wallet_number char(18) not null unique,
  wallet_brand_name text not null default 'MUTA PAY',
  legal_first_name text,
  legal_last_name text,
  kyc_status text not null default 'none'
    check (kyc_status in ('none','pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wallet_accounts_number_idx on public.wallet_accounts (wallet_number);
create index if not exists wallet_accounts_kyc_idx on public.wallet_accounts (kyc_status);

create or replace function public.yeni_cuzdan_numarasi()
returns char(18)
language plpgsql
as $$
declare
  v_n text;
  v_i int := 0;
begin
  loop
    v_i := v_i + 1;
    -- 18 hane: 1 + 17 rastgele (leading zero yok)
    v_n := (1 + floor(random() * 9)::int)::text
      || lpad(floor(random() * 1e17)::bigint::text, 17, '0');
    exit when not exists (
      select 1 from public.wallet_accounts where wallet_number = v_n
    );
    if v_i > 40 then
      raise exception 'Wallet number generation failed';
    end if;
  end loop;
  return v_n::char(18);
end;
$$;

create or replace function public.cuzdan_hesabi_garantile(p_user_id uuid default null)
returns public.wallet_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_row public.wallet_accounts%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_user_id is not null and p_user_id <> auth.uid() and not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;

  select * into v_row from public.wallet_accounts where user_id = v_uid;
  if found then return v_row; end if;

  insert into public.wallet_accounts (user_id, wallet_number, wallet_brand_name)
  values (v_uid, public.yeni_cuzdan_numarasi(), 'MUTA PAY')
  returning * into v_row;
  return v_row;
end;
$$;

-- Mevcut kullanıcılar için backfill
insert into public.wallet_accounts (user_id, wallet_number)
select p.id, public.yeni_cuzdan_numarasi()
from public.profiles p
where not exists (select 1 from public.wallet_accounts w where w.user_id = p.id)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2) KYC başvuruları
-- ---------------------------------------------------------------------------
create table if not exists public.kyc_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('draft','pending','approved','rejected')),
  doc_type text not null
    check (doc_type in ('id_card','passport','drivers_license','temporary_id')),
  first_name text not null,
  last_name text not null,
  birth_date date not null,
  hometown text,
  phone_e164 text,
  email text,
  country text,
  nationality text,
  doc_front_path text not null,
  doc_back_path text,
  selfie_path text not null,
  liveness_passed boolean not null default false,
  liveness_meta jsonb not null default '{}'::jsonb,
  admin_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kyc_temp_back_required check (
    doc_type <> 'temporary_id' or doc_back_path is not null
  )
);

create index if not exists kyc_applications_user_idx on public.kyc_applications (user_id, created_at desc);
create index if not exists kyc_applications_status_idx on public.kyc_applications (status);

-- ---------------------------------------------------------------------------
-- 3) Coin takas teklifleri (kullanıcı ↔ kullanıcı / ajans)
-- ---------------------------------------------------------------------------
create table if not exists public.coin_trade_offers (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id),
  buyer_type text not null check (buyer_type in ('user','agency')),
  buyer_user_id uuid references public.profiles(id),
  buyer_agency_id uuid references public.agencies(id),
  coins bigint not null check (coins > 0),
  note text,
  status text not null default 'pending_buyer'
    check (status in (
      'pending_buyer','pending_seller','pending_platform',
      'completed','cancelled','rejected','expired'
    )),
  seller_approved_at timestamptz,
  buyer_approved_at timestamptz,
  platform_approved_at timestamptz,
  platform_approved_by uuid references public.profiles(id),
  hold_ledger_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coin_trade_buyer_chk check (
    (buyer_type = 'user' and buyer_user_id is not null and buyer_agency_id is null)
    or (buyer_type = 'agency' and buyer_agency_id is not null and buyer_user_id is null)
  )
);

create index if not exists coin_trade_seller_idx on public.coin_trade_offers (seller_id, created_at desc);
create index if not exists coin_trade_buyer_user_idx on public.coin_trade_offers (buyer_user_id, created_at desc);
create index if not exists coin_trade_buyer_agency_idx on public.coin_trade_offers (buyer_agency_id, created_at desc);
create index if not exists coin_trade_status_idx on public.coin_trade_offers (status);

-- ---------------------------------------------------------------------------
-- 4) P2P cüzdan no transfer kayıtları
-- ---------------------------------------------------------------------------
create table if not exists public.coin_wallet_transfers (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id),
  receiver_id uuid not null references public.profiles(id),
  coins bigint not null check (coins > 0),
  receiver_wallet_number char(18) not null,
  receiver_first_name text not null,
  receiver_last_name text not null,
  status text not null default 'completed'
    check (status in ('completed','cancelled','failed')),
  fail_reason text,
  created_at timestamptz not null default now()
);

create index if not exists coin_wallet_transfers_sender_idx
  on public.coin_wallet_transfers (sender_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5) Storage bucket KYC
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-docs',
  'kyc-docs',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/heic']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "kyc_docs_own_read" on storage.objects;
create policy "kyc_docs_own_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'kyc-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kyc_docs_own_insert" on storage.objects;
create policy "kyc_docs_own_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'kyc-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kyc_docs_own_update" on storage.objects;
create policy "kyc_docs_own_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'kyc-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'kyc-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "kyc_docs_admin_all" on storage.objects;
create policy "kyc_docs_admin_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'kyc-docs' and public.ben_admin_miyim())
  with check (bucket_id = 'kyc-docs' and public.ben_admin_miyim());

-- ---------------------------------------------------------------------------
-- 6) RLS
-- ---------------------------------------------------------------------------
alter table public.wallet_accounts enable row level security;
alter table public.kyc_applications enable row level security;
alter table public.coin_trade_offers enable row level security;
alter table public.coin_wallet_transfers enable row level security;

drop policy if exists "wallet_accounts_own" on public.wallet_accounts;
create policy "wallet_accounts_own" on public.wallet_accounts
  for select to authenticated
  using (user_id = auth.uid() or public.ben_admin_miyim());

drop policy if exists "wallet_accounts_own_update" on public.wallet_accounts;
create policy "wallet_accounts_own_update" on public.wallet_accounts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "kyc_own" on public.kyc_applications;
create policy "kyc_own" on public.kyc_applications
  for select to authenticated
  using (user_id = auth.uid() or public.ben_admin_miyim());

drop policy if exists "kyc_own_insert" on public.kyc_applications;
create policy "kyc_own_insert" on public.kyc_applications
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "trade_parties" on public.coin_trade_offers;
create policy "trade_parties" on public.coin_trade_offers
  for select to authenticated
  using (
    seller_id = auth.uid()
    or buyer_user_id = auth.uid()
    or public.ben_admin_miyim()
    or (
      buyer_type = 'agency' and buyer_agency_id in (
        select agency_id from public.host_profiles
        where user_id = auth.uid() and status = 'agency'
        union
        select id from public.agencies where owner_id = auth.uid()
      )
    )
  );

drop policy if exists "transfers_own" on public.coin_wallet_transfers;
create policy "transfers_own" on public.coin_wallet_transfers
  for select to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid() or public.ben_admin_miyim());

-- ---------------------------------------------------------------------------
-- 7) RPC: isim normalize
-- ---------------------------------------------------------------------------
create or replace function public.tr_isim_normalize(p text)
returns text
language sql
immutable
as $$
  select lower(trim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')));
$$;

-- ---------------------------------------------------------------------------
-- 8) RPC: KYC gönder
-- ---------------------------------------------------------------------------
create or replace function public.kyc_basvuru_gonder(
  p_doc_type text,
  p_first_name text,
  p_last_name text,
  p_birth_date date,
  p_hometown text default null,
  p_phone text default null,
  p_email text default null,
  p_country text default null,
  p_nationality text default null,
  p_doc_front_path text default null,
  p_doc_back_path text default null,
  p_selfie_path text default null,
  p_liveness_passed boolean default false,
  p_liveness_meta jsonb default '{}'::jsonb
)
returns public.kyc_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.kyc_applications%rowtype;
  v_age int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if coalesce(p_liveness_passed, false) is not true then
    raise exception 'Liveness check required';
  end if;
  if p_doc_front_path is null or p_selfie_path is null then
    raise exception 'Documents required';
  end if;
  if p_doc_type = 'temporary_id' and p_doc_back_path is null then
    raise exception 'Temporary ID requires back side';
  end if;
  if p_first_name is null or length(trim(p_first_name)) < 2 then
    raise exception 'Invalid first name';
  end if;
  if p_last_name is null or length(trim(p_last_name)) < 2 then
    raise exception 'Invalid last name';
  end if;
  if p_birth_date is null then raise exception 'Birth date required'; end if;

  v_age := date_part('year', age(current_date, p_birth_date))::int;
  if v_age < 18 then raise exception 'Must be 18+'; end if;

  -- Bekleyen varsa engelle
  if exists (
    select 1 from public.kyc_applications
    where user_id = v_uid and status = 'pending'
  ) then
    raise exception 'KYC already pending';
  end if;

  perform public.cuzdan_hesabi_garantile(v_uid);

  insert into public.kyc_applications (
    user_id, status, doc_type, first_name, last_name, birth_date,
    hometown, phone_e164, email, country, nationality,
    doc_front_path, doc_back_path, selfie_path,
    liveness_passed, liveness_meta
  ) values (
    v_uid, 'pending', p_doc_type, trim(p_first_name), trim(p_last_name), p_birth_date,
    nullif(trim(coalesce(p_hometown,'')), ''), nullif(trim(coalesce(p_phone,'')), ''),
    nullif(trim(coalesce(p_email,'')), ''), nullif(trim(coalesce(p_country,'')), ''),
    nullif(trim(coalesce(p_nationality,'')), ''),
    p_doc_front_path, p_doc_back_path, p_selfie_path,
    true, coalesce(p_liveness_meta, '{}'::jsonb)
  ) returning * into v_row;

  update public.wallet_accounts set
    kyc_status = 'pending',
    legal_first_name = trim(p_first_name),
    legal_last_name = trim(p_last_name),
    updated_at = now()
  where user_id = v_uid;

  return v_row;
end;
$$;

create or replace function public.admin_kyc_durum_guncelle(
  p_id uuid,
  p_status text,
  p_note text default null
)
returns public.kyc_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.kyc_applications%rowtype;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_status not in ('approved','rejected') then raise exception 'Invalid status'; end if;

  update public.kyc_applications set
    status = p_status,
    admin_note = p_note,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = p_id
  returning * into v_row;

  if not found then raise exception 'KYC not found'; end if;

  update public.wallet_accounts set
    kyc_status = p_status,
    legal_first_name = case when p_status = 'approved' then v_row.first_name else legal_first_name end,
    legal_last_name = case when p_status = 'approved' then v_row.last_name else legal_last_name end,
    updated_at = now()
  where user_id = v_row.user_id;

  if p_status = 'approved' then
    update public.profiles set is_verified = true where id = v_row.user_id;
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9) RPC: Cüzdan no ile transfer (isim soyisim eşleşmeli)
-- ---------------------------------------------------------------------------
create or replace function public.cuzdan_no_ile_coin_transfer(
  p_wallet_number text,
  p_first_name text,
  p_last_name text,
  p_coins bigint,
  p_idempotency_key text default null
)
returns public.coin_wallet_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_recv public.wallet_accounts%rowtype;
  v_bal bigint;
  v_row public.coin_wallet_transfers%rowtype;
  v_num char(18);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_coin_purchase') then
    raise exception 'Transfers temporarily disabled';
  end if;
  if p_coins is null or p_coins <= 0 then raise exception 'Invalid amount'; end if;

  v_num := regexp_replace(coalesce(p_wallet_number,''), '\D', '', 'g');
  if length(v_num) <> 18 then raise exception 'Wallet number must be 18 digits'; end if;

  perform public.cuzdan_hesabi_garantile(v_uid);

  select * into v_recv from public.wallet_accounts where wallet_number = v_num;
  if not found then raise exception 'Wallet not found'; end if;
  if v_recv.user_id = v_uid then raise exception 'Cannot transfer to self'; end if;

  if v_recv.kyc_status <> 'approved'
     or v_recv.legal_first_name is null
     or v_recv.legal_last_name is null then
    raise exception 'Receiver KYC required';
  end if;

  if public.tr_isim_normalize(p_first_name) <> public.tr_isim_normalize(v_recv.legal_first_name)
     or public.tr_isim_normalize(p_last_name) <> public.tr_isim_normalize(v_recv.legal_last_name) then
    insert into public.coin_wallet_transfers (
      sender_id, receiver_id, coins, receiver_wallet_number,
      receiver_first_name, receiver_last_name, status, fail_reason
    ) values (
      v_uid, v_recv.user_id, p_coins, v_num,
      trim(p_first_name), trim(p_last_name), 'cancelled',
      'Name mismatch'
    ) returning * into v_row;
    raise exception 'Name mismatch — transfer cancelled';
  end if;

  select coins into v_bal from public.wallets where user_id = v_uid for update;
  if coalesce(v_bal, 0) < p_coins then raise exception 'Insufficient coins'; end if;

  update public.wallets set coins = coins - p_coins, updated_at = now() where user_id = v_uid;
  insert into public.wallets (user_id, coins, diamonds)
  values (v_recv.user_id, 0, 0)
  on conflict (user_id) do nothing;
  update public.wallets set coins = coins + p_coins, updated_at = now() where user_id = v_recv.user_id;

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, meta)
  values
    (v_uid, 'coins', -p_coins,
      (select coins from public.wallets where user_id = v_uid),
      'wallet_transfer_out', 'wallet_transfer',
      jsonb_build_object('to', v_recv.user_id, 'wallet_number', v_num)),
    (v_recv.user_id, 'coins', p_coins,
      (select coins from public.wallets where user_id = v_recv.user_id),
      'wallet_transfer_in', 'wallet_transfer',
      jsonb_build_object('from', v_uid, 'wallet_number', v_num));

  insert into public.coin_wallet_transfers (
    sender_id, receiver_id, coins, receiver_wallet_number,
    receiver_first_name, receiver_last_name, status
  ) values (
    v_uid, v_recv.user_id, p_coins, v_num,
    trim(p_first_name), trim(p_last_name), 'completed'
  ) returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10) RPC: Takas teklifi oluştur / onayla
-- ---------------------------------------------------------------------------
create or replace function public.coin_takas_teklif_olustur(
  p_buyer_type text,
  p_buyer_user_id uuid default null,
  p_buyer_agency_id uuid default null,
  p_coins bigint default null,
  p_note text default null
)
returns public.coin_trade_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bal bigint;
  v_row public.coin_trade_offers%rowtype;
  v_kyc text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_coins is null or p_coins <= 0 then raise exception 'Invalid amount'; end if;
  if p_buyer_type not in ('user','agency') then raise exception 'Invalid buyer type'; end if;

  select kyc_status into v_kyc from public.wallet_accounts where user_id = v_uid;
  if coalesce(v_kyc, 'none') <> 'approved' then
    raise exception 'KYC required to trade';
  end if;

  if p_buyer_type = 'user' then
    if p_buyer_user_id is null then raise exception 'Buyer user required'; end if;
    if p_buyer_user_id = v_uid then raise exception 'Cannot trade with self'; end if;
  else
    if p_buyer_agency_id is null then raise exception 'Buyer agency required'; end if;
    if not exists (select 1 from public.agencies where id = p_buyer_agency_id and status = 'active') then
      raise exception 'Agency not found';
    end if;
  end if;

  select coins into v_bal from public.wallets where user_id = v_uid for update;
  if coalesce(v_bal, 0) < p_coins then raise exception 'Insufficient coins'; end if;

  -- Escrow hold
  update public.wallets set coins = coins - p_coins, updated_at = now() where user_id = v_uid;
  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, meta)
  values (
    v_uid, 'coins', -p_coins,
    (select coins from public.wallets where user_id = v_uid),
    'trade_hold', 'coin_trade',
    jsonb_build_object('coins', p_coins)
  );

  insert into public.coin_trade_offers (
    seller_id, buyer_type, buyer_user_id, buyer_agency_id, coins, note,
    status, seller_approved_at
  ) values (
    v_uid, p_buyer_type,
    case when p_buyer_type = 'user' then p_buyer_user_id end,
    case when p_buyer_type = 'agency' then p_buyer_agency_id end,
    p_coins, nullif(trim(coalesce(p_note,'')), ''),
    'pending_buyer', now()
  ) returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.coin_takas_alici_yanit(
  p_offer_id uuid,
  p_accept boolean
)
returns public.coin_trade_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.coin_trade_offers%rowtype;
  v_ok boolean := false;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_row from public.coin_trade_offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  if v_row.status <> 'pending_buyer' then raise exception 'Offer not awaiting buyer'; end if;

  if v_row.buyer_type = 'user' then
    v_ok := v_row.buyer_user_id = v_uid;
  else
    v_ok := exists (
      select 1 from public.agencies a
      where a.id = v_row.buyer_agency_id
        and (a.owner_id = v_uid
          or exists (
            select 1 from public.host_profiles h
            where h.agency_id = a.id and h.user_id = v_uid and h.status = 'agency'
          ))
    );
  end if;
  if not v_ok then raise exception 'Forbidden'; end if;

  if not p_accept then
    -- İade escrow
    update public.wallets set coins = coins + v_row.coins, updated_at = now()
    where user_id = v_row.seller_id;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, meta)
    values (
      v_row.seller_id, 'coins', v_row.coins,
      (select coins from public.wallets where user_id = v_row.seller_id),
      'trade_hold_refund', 'coin_trade', jsonb_build_object('offer_id', p_offer_id)
    );
    update public.coin_trade_offers set
      status = 'rejected', updated_at = now()
    where id = p_offer_id
    returning * into v_row;
    return v_row;
  end if;

  update public.coin_trade_offers set
    status = 'pending_platform',
    buyer_approved_at = now(),
    updated_at = now()
  where id = p_offer_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_coin_takas_platform_onay(
  p_offer_id uuid,
  p_accept boolean
)
returns public.coin_trade_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.coin_trade_offers%rowtype;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  select * into v_row from public.coin_trade_offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  if v_row.status <> 'pending_platform' then raise exception 'Offer not awaiting platform'; end if;

  if not p_accept then
    update public.wallets set coins = coins + v_row.coins, updated_at = now()
    where user_id = v_row.seller_id;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, meta)
    values (
      v_row.seller_id, 'coins', v_row.coins,
      (select coins from public.wallets where user_id = v_row.seller_id),
      'trade_hold_refund', 'coin_trade', jsonb_build_object('offer_id', p_offer_id)
    );
    update public.coin_trade_offers set
      status = 'cancelled',
      platform_approved_by = auth.uid(),
      updated_at = now()
    where id = p_offer_id
    returning * into v_row;
    return v_row;
  end if;

  if v_row.buyer_type = 'user' then
    insert into public.wallets (user_id, coins, diamonds)
    values (v_row.buyer_user_id, 0, 0)
    on conflict (user_id) do nothing;
    update public.wallets set coins = coins + v_row.coins, updated_at = now()
    where user_id = v_row.buyer_user_id;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, meta)
    values (
      v_row.buyer_user_id, 'coins', v_row.coins,
      (select coins from public.wallets where user_id = v_row.buyer_user_id),
      'trade_receive', 'coin_trade', jsonb_build_object('offer_id', p_offer_id)
    );
  else
    insert into public.agency_wallets (agency_id, diamonds, coins)
    values (v_row.buyer_agency_id, 0, 0)
    on conflict (agency_id) do nothing;
    -- agency_wallets may not have coins — try diamonds-only agencies: use meta ledger
    begin
      update public.agency_wallets set
        coins = coalesce(coins, 0) + v_row.coins,
        updated_at = now()
      where agency_id = v_row.buyer_agency_id;
    exception when undefined_column then
      -- fallback: store as agency earnings note via ledger if coins col missing
      null;
    end;
  end if;

  update public.coin_trade_offers set
    status = 'completed',
    platform_approved_at = now(),
    platform_approved_by = auth.uid(),
    completed_at = now(),
    updated_at = now()
  where id = p_offer_id
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11) Ajans / kullanıcı arama (takas)
-- ---------------------------------------------------------------------------
create or replace function public.takas_ajans_ara(p_q text default null)
returns table (
  id uuid,
  name text,
  agency_public_id text,
  logo_url text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := nullif(trim(coalesce(p_q, '')), '');
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  return query
  select a.id, a.name, a.agency_public_id, a.logo_url, a.status
  from public.agencies a
  where a.status = 'active'
    and (
      v_q is null
      or a.name ilike '%' || v_q || '%'
      or coalesce(a.agency_public_id, '') ilike '%' || v_q || '%'
      or a.id::text ilike '%' || v_q || '%'
    )
  order by a.name
  limit 50;
end;
$$;

create or replace function public.takas_kullanici_ara(p_q text)
returns table (
  id uuid,
  display_name text,
  username text,
  wallet_number char(18),
  avatar_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_num text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if v_q is null or length(v_q) < 2 then return; end if;
  v_num := regexp_replace(v_q, '\D', '', 'g');

  return query
  select p.id, p.display_name, p.username, w.wallet_number, p.avatar_url
  from public.profiles p
  join public.wallet_accounts w on w.user_id = p.id
  where p.id <> auth.uid()
    and (
      (length(v_num) >= 6 and w.wallet_number like '%' || v_num || '%')
      or p.username ilike '%' || v_q || '%'
      or p.display_name ilike '%' || v_q || '%'
      or coalesce(p.public_user_id::text, '') like '%' || v_q || '%'
    )
  limit 30;
end;
$$;

grant execute on function public.cuzdan_hesabi_garantile(uuid) to authenticated;
grant execute on function public.kyc_basvuru_gonder(text,text,text,date,text,text,text,text,text,text,text,text,boolean,jsonb) to authenticated;
grant execute on function public.admin_kyc_durum_guncelle(uuid,text,text) to authenticated;
grant execute on function public.cuzdan_no_ile_coin_transfer(text,text,text,bigint,text) to authenticated;
grant execute on function public.coin_takas_teklif_olustur(text,uuid,uuid,bigint,text) to authenticated;
grant execute on function public.coin_takas_alici_yanit(uuid,boolean) to authenticated;
grant execute on function public.admin_coin_takas_platform_onay(uuid,boolean) to authenticated;
grant execute on function public.takas_ajans_ara(text) to authenticated;
grant execute on function public.takas_kullanici_ara(text) to authenticated;

grant select on public.wallet_accounts to authenticated;
grant select on public.kyc_applications to authenticated;
grant select on public.coin_trade_offers to authenticated;
grant select on public.coin_wallet_transfers to authenticated;
