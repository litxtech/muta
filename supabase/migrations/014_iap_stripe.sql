-- FAZ 11: IAP / Stripe katalog alanlari + odeme siparisleri
-- Run after 001–010

alter table public.coin_packages
  add column if not exists apple_product_id text,
  add column if not exists google_product_id text,
  add column if not exists stripe_price_id text;

-- sku ile store product id'leri hizala (App Store / Play'de ayni ID kullan)
update public.coin_packages
set
  apple_product_id = coalesce(apple_product_id, 'com.litxtech.muta.' || sku),
  google_product_id = coalesce(google_product_id, 'com.litxtech.muta.' || sku)
where apple_product_id is null or google_product_id is null;

insert into public.coin_packages (sku, title, coins, bonus_coins, price_usd, badge, sort_order, apple_product_id, google_product_id)
values
  ('coins_60', 'Starter', 60, 0, 0.99, null, 1, 'com.litxtech.muta.coins_60', 'com.litxtech.muta.coins_60'),
  ('coins_300', 'Popular', 300, 30, 4.99, 'HOT', 2, 'com.litxtech.muta.coins_300', 'com.litxtech.muta.coins_300'),
  ('coins_1280', 'VIP', 1280, 220, 19.99, 'BEST', 3, 'com.litxtech.muta.coins_1280', 'com.litxtech.muta.coins_1280'),
  ('coins_6480', 'Legend', 6480, 1600, 99.99, 'MAX', 4, 'com.litxtech.muta.coins_6480', 'com.litxtech.muta.coins_6480')
on conflict (sku) do update set
  apple_product_id = excluded.apple_product_id,
  google_product_id = excluded.google_product_id,
  is_active = true;

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  package_id uuid not null references public.coin_packages(id),
  provider text not null check (provider in ('apple','google','stripe','manual')),
  provider_session_id text,
  provider_tx_id text,
  amount_usd numeric(10,2),
  status text not null default 'pending'
    check (status in ('pending','paid','failed','cancelled','refunded')),
  idempotency_key text unique not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists payment_orders_user_idx
  on public.payment_orders (user_id, created_at desc);

alter table public.payment_orders enable row level security;
drop policy if exists "Own payment orders" on public.payment_orders;
create policy "Own payment orders" on public.payment_orders
  for select to authenticated using (auth.uid() = user_id);
grant select on public.payment_orders to authenticated;

insert into public.feature_flags (key, enabled, description) values
  ('iap_enabled', true, 'StoreKit / Play Billing'),
  ('stripe_enabled', false, 'Stripe Checkout (web / izinli kanallar)')
on conflict (key) do nothing;

-- Stripe odeme basari (service_role Edge Function)
create or replace function public.stripe_odeme_tamamla(
  p_user_id uuid,
  p_package_id uuid,
  p_idempotency_key text,
  p_provider_tx_id text,
  p_amount_usd numeric default null,
  p_receipt jsonb default '{}'::jsonb
)
returns public.coin_purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.coin_purchases%rowtype;
begin
  if p_user_id is null then raise exception 'user required'; end if;
  if not public.ozellik_bayragi_aktif_mi('stripe_enabled') then
    raise exception 'Stripe disabled';
  end if;
  if public.kill_switch_aktif_mi('kill_coin_purchase') then
    raise exception 'Coin purchase temporarily disabled';
  end if;

  -- Temporarily set auth context via direct credit path:
  -- Edge Function calls with service_role; replicate coin_satin_al_onayla body for user.
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);

  select * into v_purchase from public.coin_satin_al_onayla(
    p_package_id,
    p_idempotency_key,
    'stripe',
    p_provider_tx_id,
    'manual',
    p_amount_usd,
    p_receipt
  );
  -- NOTE: coin_satin_al_onayla uses auth.uid() — so Edge must call as user JWT
  -- after Stripe webhook verifies, OR we inline credit below.

  return v_purchase;
end;
$$;

-- Service-role safe credit (Stripe webhook / IAP verify Edge)
create or replace function public.coin_satin_al_onayla_servis(
  p_user_id uuid,
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
  v_pkg public.coin_packages%rowtype;
  v_coins bigint;
  v_purchase public.coin_purchases%rowtype;
  v_existing uuid;
begin
  if p_user_id is null then raise exception 'user required'; end if;
  if public.kill_switch_aktif_mi('kill_coin_purchase') then
    raise exception 'Coin purchase temporarily disabled';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key required';
  end if;

  select result_ref into v_existing
  from public.finance_idempotency_keys
  where idempotency_key = p_idempotency_key and user_id = p_user_id;
  if v_existing is not null then
    select * into v_purchase from public.coin_purchases where id = v_existing;
    if found then return v_purchase; end if;
  end if;

  if p_provider_tx_id is not null then
    select * into v_purchase from public.coin_purchases
    where provider = p_provider and provider_tx_id = p_provider_tx_id limit 1;
    if found then return v_purchase; end if;
  end if;

  select * into v_pkg from public.coin_packages where id = p_package_id and is_active;
  if not found then raise exception 'Package not found'; end if;
  v_coins := v_pkg.coins + coalesce(v_pkg.bonus_coins, 0);

  insert into public.wallets (user_id, coins, diamonds)
  values (p_user_id, 0, 0)
  on conflict (user_id) do nothing;

  update public.wallets set coins = coins + v_coins, updated_at = now()
  where user_id = p_user_id;

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type)
  values (
    p_user_id, 'coins', v_coins,
    (select coins from public.wallets where user_id = p_user_id),
    'coin_purchase', 'purchase'
  );

  insert into public.coin_purchases (
    user_id, package_id, coins_added, amount_usd, provider, provider_tx_id,
    status, idempotency_key, store, receipt_payload, verified_at
  ) values (
    p_user_id, p_package_id, v_coins, coalesce(p_amount_usd, v_pkg.price_usd),
    p_provider, p_provider_tx_id, 'completed', p_idempotency_key,
    p_store, coalesce(p_receipt, '{}'::jsonb), now()
  ) returning * into v_purchase;

  insert into public.finance_idempotency_keys (
    idempotency_key, user_id, operation, result_ref, result_payload
  ) values (
    p_idempotency_key, p_user_id, 'coin_purchase', v_purchase.id,
    jsonb_build_object('coins', v_coins)
  )
  on conflict (idempotency_key) do nothing;

  update public.payment_orders set
    status = 'paid',
    provider_tx_id = p_provider_tx_id,
    paid_at = now()
  where idempotency_key = p_idempotency_key and user_id = p_user_id;

  return v_purchase;
end;
$$;

-- Drop broken helper (uses auth.uid incorrectly)
drop function if exists public.stripe_odeme_tamamla(uuid, uuid, text, text, numeric, jsonb);

grant execute on function public.coin_satin_al_onayla_servis(uuid, uuid, text, text, text, text, numeric, jsonb) to service_role;
