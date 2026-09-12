-- FAZ 3: Finans sertlestirme — idempotency, kill switch, IAP, ledger
-- Run after 001–003

-- Idempotency store (finansal islemler)
create table if not exists public.finance_idempotency_keys (
  idempotency_key text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  operation text not null,
  result_ref uuid,
  result_payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists finance_idempotency_user_idx
  on public.finance_idempotency_keys (user_id, created_at desc);

alter table public.gift_transactions
  add column if not exists idempotency_key text,
  add column if not exists agency_commission_snapshot numeric(10,4) default 0,
  add column if not exists agency_id uuid;

create unique index if not exists gift_tx_idempotency_uidx
  on public.gift_transactions (idempotency_key)
  where idempotency_key is not null;

alter table public.coin_purchases
  add column if not exists idempotency_key text,
  add column if not exists store text check (store in ('apple','google','manual','admin')),
  add column if not exists receipt_payload jsonb default '{}'::jsonb,
  add column if not exists verified_at timestamptz;

create unique index if not exists coin_purchases_idempotency_uidx
  on public.coin_purchases (idempotency_key)
  where idempotency_key is not null;

create unique index if not exists coin_purchases_provider_tx_uidx
  on public.coin_purchases (provider, provider_tx_id)
  where provider_tx_id is not null;

-- Host earnings ayri defter (diamond ile senkron; ileride wallets.diamonds deprecate)
create table if not exists public.host_earnings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  diamonds bigint not null default 0 check (diamonds >= 0),
  updated_at timestamptz default now()
);

create table if not exists public.host_earnings_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta bigint not null,
  balance_after bigint not null,
  reason text not null,
  ref_type text,
  ref_id uuid,
  created_at timestamptz default now()
);

-- Mevcut diamond bakiyelerini host_earnings'e kopyala
insert into public.host_earnings (user_id, diamonds, updated_at)
select user_id, diamonds, updated_at from public.wallets
on conflict (user_id) do update set diamonds = excluded.diamonds;

-- Ledger reason genisletmesi icin check yok (text serbest); reconciliation log
create table if not exists public.reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  status text not null default 'ok' check (status in ('ok','mismatch','error')),
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create or replace function public.kill_switch_aktif_mi(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select active from public.kill_switches where key = p_key),
    false
  );
$$;

create or replace function public.ozellik_bayragi_aktif_mi(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select enabled from public.feature_flags where key = p_key),
    false
  );
$$;

-- Atomic gift with kill switch + guest block + idempotency
create or replace function public.send_gift(
  p_room_id uuid,
  p_receiver_id uuid,
  p_gift_id uuid,
  p_quantity int default 1,
  p_idempotency_key text default null
)
returns public.gift_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_gift public.gifts%rowtype;
  v_cost bigint;
  v_diamonds bigint;
  v_sender_coins bigint;
  v_tx public.gift_transactions%rowtype;
  v_is_guest boolean;
  v_existing uuid;
begin
  if v_sender is null then
    raise exception 'Not authenticated';
  end if;

  if public.kill_switch_aktif_mi('kill_gift_send') then
    raise exception 'Gift send temporarily disabled';
  end if;

  if not public.ozellik_bayragi_aktif_mi('gifts_enabled') then
    raise exception 'Gifts feature disabled';
  end if;

  select is_guest into v_is_guest from public.profiles where id = v_sender;
  if coalesce(v_is_guest, false) then
    raise exception 'Guest cannot send gifts';
  end if;

  if p_quantity < 1 then
    raise exception 'Invalid quantity';
  end if;
  if v_sender = p_receiver_id then
    raise exception 'Cannot gift yourself';
  end if;

  -- Idempotent replay
  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    select result_ref into v_existing
    from public.finance_idempotency_keys
    where idempotency_key = p_idempotency_key and user_id = v_sender;

    if v_existing is not null then
      select * into v_tx from public.gift_transactions where id = v_existing;
      if found then
        return v_tx;
      end if;
    end if;
  end if;

  select * into v_gift from public.gifts where id = p_gift_id and is_active;
  if not found then
    raise exception 'Gift not found';
  end if;

  -- Fiyat her zaman DB'den
  v_cost := v_gift.coin_cost * p_quantity;
  v_diamonds := v_gift.diamond_value * p_quantity;

  select coins into v_sender_coins from public.wallets where user_id = v_sender for update;
  if v_sender_coins is null or v_sender_coins < v_cost then
    raise exception 'Insufficient coins';
  end if;

  -- Receiver wallet + host_earnings lock
  perform 1 from public.wallets where user_id = p_receiver_id for update;
  insert into public.host_earnings (user_id, diamonds)
  values (p_receiver_id, 0)
  on conflict (user_id) do nothing;
  perform 1 from public.host_earnings where user_id = p_receiver_id for update;

  update public.wallets
    set coins = coins - v_cost, updated_at = now()
    where user_id = v_sender;

  update public.wallets
    set diamonds = diamonds + v_diamonds, updated_at = now()
    where user_id = p_receiver_id;

  update public.host_earnings
    set diamonds = diamonds + v_diamonds, updated_at = now()
    where user_id = p_receiver_id;

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type)
  values (
    v_sender, 'coins', -v_cost,
    (select coins from public.wallets where user_id = v_sender),
    'gift_sent', 'gift'
  );

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type)
  values (
    p_receiver_id, 'diamonds', v_diamonds,
    (select diamonds from public.wallets where user_id = p_receiver_id),
    'gift_received', 'gift'
  );

  insert into public.host_earnings_ledger (user_id, delta, balance_after, reason, ref_type)
  values (
    p_receiver_id, v_diamonds,
    (select diamonds from public.host_earnings where user_id = p_receiver_id),
    'gift_received', 'gift'
  );

  if p_room_id is not null then
    update public.rooms
      set total_coins_earned = total_coins_earned + v_cost
      where id = p_room_id;
  end if;

  insert into public.gift_transactions (
    room_id, sender_id, receiver_id, gift_id, quantity,
    coins_spent, diamonds_earned, idempotency_key, agency_commission_snapshot
  ) values (
    p_room_id, v_sender, p_receiver_id, p_gift_id, p_quantity,
    v_cost, v_diamonds, nullif(trim(p_idempotency_key), ''), 0
  ) returning * into v_tx;

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    insert into public.finance_idempotency_keys (
      idempotency_key, user_id, operation, result_ref, result_payload
    ) values (
      p_idempotency_key, v_sender, 'gift_send', v_tx.id,
      jsonb_build_object('coins_spent', v_cost, 'diamonds', v_diamonds)
    )
    on conflict (idempotency_key) do nothing;
  end if;

  return v_tx;
end;
$$;

-- IAP / coin credit (server-authoritative; Edge Function receipt verify sonrasi cagirir)
create or replace function public.coin_satin_al_onayla(
  p_package_id uuid,
  p_idempotency_key text,
  p_provider text,
  p_provider_tx_id text,
  p_store text default 'manual',
  p_amount_usd numeric default null,
  p_receipt jsonb default '{}'::jsonb
)
returns public.coin_purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pkg public.coin_packages%rowtype;
  v_coins bigint;
  v_purchase public.coin_purchases%rowtype;
  v_existing uuid;
  v_is_guest boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if public.kill_switch_aktif_mi('kill_coin_purchase') then
    raise exception 'Coin purchase temporarily disabled';
  end if;

  select is_guest into v_is_guest from public.profiles where id = v_uid;
  if coalesce(v_is_guest, false) then
    raise exception 'Guest cannot purchase coins';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key required';
  end if;

  select result_ref into v_existing
  from public.finance_idempotency_keys
  where idempotency_key = p_idempotency_key and user_id = v_uid;

  if v_existing is not null then
    select * into v_purchase from public.coin_purchases where id = v_existing;
    if found then
      return v_purchase;
    end if;
  end if;

  -- Duplicate store transaction
  if p_provider_tx_id is not null then
    select * into v_purchase
    from public.coin_purchases
    where provider = p_provider and provider_tx_id = p_provider_tx_id
    limit 1;
    if found then
      return v_purchase;
    end if;
  end if;

  select * into v_pkg from public.coin_packages where id = p_package_id and is_active;
  if not found then
    raise exception 'Package not found';
  end if;

  v_coins := v_pkg.coins + coalesce(v_pkg.bonus_coins, 0);

  perform 1 from public.wallets where user_id = v_uid for update;

  update public.wallets
    set coins = coins + v_coins, updated_at = now()
    where user_id = v_uid;

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type)
  values (
    v_uid, 'coins', v_coins,
    (select coins from public.wallets where user_id = v_uid),
    'coin_purchase', 'purchase'
  );

  insert into public.coin_purchases (
    user_id, package_id, coins_added, amount_usd, provider, provider_tx_id,
    status, idempotency_key, store, receipt_payload, verified_at
  ) values (
    v_uid, p_package_id, v_coins, coalesce(p_amount_usd, v_pkg.price_usd),
    p_provider, p_provider_tx_id, 'completed', p_idempotency_key,
    p_store, coalesce(p_receipt, '{}'::jsonb), now()
  ) returning * into v_purchase;

  insert into public.finance_idempotency_keys (
    idempotency_key, user_id, operation, result_ref, result_payload
  ) values (
    p_idempotency_key, v_uid, 'coin_purchase', v_purchase.id,
    jsonb_build_object('coins', v_coins)
  )
  on conflict (idempotency_key) do nothing;

  return v_purchase;
end;
$$;

-- Ledger reversal (silme yok)
create or replace function public.cuzdan_ters_kayit(
  p_user_id uuid,
  p_currency text,
  p_delta bigint,
  p_reason text,
  p_ref_type text default 'reversal',
  p_ref_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_bal bigint;
begin
  -- Sadece service_role / gelecekte admin; authenticated engelle
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  if p_currency = 'coins' then
    update public.wallets set coins = coins + p_delta, updated_at = now()
    where user_id = p_user_id
    returning coins into v_bal;
  elsif p_currency = 'diamonds' then
    update public.wallets set diamonds = diamonds + p_delta, updated_at = now()
    where user_id = p_user_id
    returning diamonds into v_bal;
    update public.host_earnings set diamonds = diamonds + p_delta, updated_at = now()
    where user_id = p_user_id;
  else
    raise exception 'Invalid currency';
  end if;

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
  values (p_user_id, p_currency, p_delta, v_bal, p_reason, p_ref_type, p_ref_id)
  returning id into v_id;

  return v_id;
end;
$$;

-- Basit reconciliation: wallet coins vs ledger sum
create or replace function public.cuzdan_mutabakat_calistir()
returns public.reconciliation_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mismatch int;
  v_run public.reconciliation_runs%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  select count(*) into v_mismatch
  from public.wallets w
  left join (
    select user_id, coalesce(sum(delta),0) as s
    from public.wallet_ledger
    where currency = 'coins'
    group by user_id
  ) l on l.user_id = w.user_id
  where w.coins <> coalesce(l.s, 0);

  insert into public.reconciliation_runs (kind, status, details)
  values (
    'wallet_coins_vs_ledger',
    case when v_mismatch = 0 then 'ok' else 'mismatch' end,
    jsonb_build_object('mismatch_users', v_mismatch)
  ) returning * into v_run;

  return v_run;
end;
$$;

alter table public.finance_idempotency_keys enable row level security;
alter table public.host_earnings enable row level security;
alter table public.host_earnings_ledger enable row level security;
alter table public.reconciliation_runs enable row level security;

create policy "Own idempotency read"
  on public.finance_idempotency_keys for select to authenticated
  using (auth.uid() = user_id);

create policy "Own host earnings read"
  on public.host_earnings for select to authenticated
  using (auth.uid() = user_id);

create policy "Own host earnings ledger read"
  on public.host_earnings_ledger for select to authenticated
  using (auth.uid() = user_id);

grant select on public.finance_idempotency_keys to authenticated;
grant select on public.host_earnings to authenticated;
grant select on public.host_earnings_ledger to authenticated;
grant execute on function public.send_gift to authenticated;
grant execute on function public.coin_satin_al_onayla to authenticated;
grant execute on function public.kill_switch_aktif_mi to authenticated;
grant execute on function public.ozellik_bayragi_aktif_mi to authenticated;
