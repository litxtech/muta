-- Teklif oluştururken coin düşmesin; alıcı onayında escrow hold alınsın

alter table public.coin_trade_offers
  add column if not exists coins_held boolean not null default false;

comment on column public.coin_trade_offers.coins_held is
  'true ise satıcı coinleri escrowda; iade yalnızca bu durumda';

-- Daha önce oluşturulurken düşülmüş açık teklifler
update public.coin_trade_offers
set coins_held = true
where coins_held = false
  and status in (
    'pending_buyer',
    'pending_payment_info',
    'pending_receipt',
    'receipt_overdue',
    'pending_platform'
  );

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
  v_owner uuid;
  v_agency_name text;
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
    select owner_id, name into v_owner, v_agency_name
    from public.agencies
    where id = p_buyer_agency_id and status = 'active';
    if not found then
      raise exception 'Agency not found';
    end if;
  end if;

  -- Sadece yeterlilik kontrolü — coin henüz düşmez
  select coins into v_bal from public.wallets where user_id = v_uid;
  if coalesce(v_bal, 0) < p_coins then raise exception 'Insufficient coins'; end if;

  insert into public.coin_trade_offers (
    seller_id, buyer_type, buyer_user_id, buyer_agency_id, coins, note,
    status, seller_approved_at, coins_held
  ) values (
    v_uid, p_buyer_type,
    case when p_buyer_type = 'user' then p_buyer_user_id end,
    case when p_buyer_type = 'agency' then p_buyer_agency_id end,
    p_coins, nullif(trim(coalesce(p_note,'')), ''),
    'pending_buyer', now(), false
  ) returning * into v_row;

  if p_buyer_type = 'agency' and v_owner is not null then
    perform public.bildirim_kuyruga_ekle(
      v_owner,
      'system',
      'Yeni coin teklifi',
      coalesce(v_agency_name, 'Ajans') || ' için '
        || p_coins::text || ' coin teklifi geldi. Ajans panelinden yanıtlayın.',
      '/ajans/teklifler',
      jsonb_build_object('offer_id', v_row.id, 'agency_id', p_buyer_agency_id)
    );
  elsif p_buyer_type = 'user' and p_buyer_user_id is not null then
    perform public.bildirim_kuyruga_ekle(
      p_buyer_user_id,
      'system',
      'Yeni coin teklifi',
      p_coins::text || ' coin teklifi aldınız. Takas ekranından yanıtlayın.',
      '/cuzdan/takas',
      jsonb_build_object('offer_id', v_row.id)
    );
  end if;

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
  v_bal bigint;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_row from public.coin_trade_offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  if v_row.status <> 'pending_buyer' then raise exception 'Offer not awaiting buyer'; end if;

  if v_row.buyer_type = 'user' then
    v_ok := v_row.buyer_user_id = v_uid;
  else
    v_ok := public.coin_takas_ajans_yetkili_mi(v_row.buyer_agency_id, v_uid);
  end if;
  if not v_ok then raise exception 'Forbidden'; end if;

  if not p_accept then
    -- Escrow yoksa iade yok
    if coalesce(v_row.coins_held, false) then
      update public.wallets set coins = coins + v_row.coins, updated_at = now()
      where user_id = v_row.seller_id;
      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, meta)
      values (
        v_row.seller_id, 'coins', v_row.coins,
        (select coins from public.wallets where user_id = v_row.seller_id),
        'trade_hold_refund', 'coin_trade', jsonb_build_object('offer_id', p_offer_id)
      );
    end if;
    update public.coin_trade_offers set
      status = 'rejected',
      coins_held = false,
      updated_at = now()
    where id = p_offer_id
    returning * into v_row;
    return v_row;
  end if;

  -- Kabul: şimdi escrow hold
  if not coalesce(v_row.coins_held, false) then
    select coins into v_bal from public.wallets where user_id = v_row.seller_id for update;
    if coalesce(v_bal, 0) < v_row.coins then
      raise exception 'Seller has insufficient coins';
    end if;
    update public.wallets set coins = coins - v_row.coins, updated_at = now()
    where user_id = v_row.seller_id;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, meta)
    values (
      v_row.seller_id, 'coins', -v_row.coins,
      (select coins from public.wallets where user_id = v_row.seller_id),
      'trade_hold', 'coin_trade',
      jsonb_build_object('offer_id', p_offer_id, 'coins', v_row.coins)
    );
  end if;

  if v_row.buyer_type = 'agency' then
    update public.coin_trade_offers set
      status = 'pending_payment_info',
      buyer_approved_at = now(),
      coins_held = true,
      updated_at = now()
    where id = p_offer_id
    returning * into v_row;
  else
    update public.coin_trade_offers set
      status = 'pending_platform',
      buyer_approved_at = now(),
      coins_held = true,
      updated_at = now()
    where id = p_offer_id
    returning * into v_row;
  end if;

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
  if v_row.status not in ('pending_platform', 'receipt_overdue') then
    raise exception 'Offer not awaiting platform';
  end if;

  if not p_accept then
    if coalesce(v_row.coins_held, false) then
      update public.wallets set coins = coins + v_row.coins, updated_at = now()
      where user_id = v_row.seller_id;
      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, meta)
      values (
        v_row.seller_id, 'coins', v_row.coins,
        (select coins from public.wallets where user_id = v_row.seller_id),
        'trade_hold_refund', 'coin_trade', jsonb_build_object('offer_id', p_offer_id)
      );
    end if;
    update public.coin_trade_offers set
      status = 'cancelled',
      coins_held = false,
      platform_approved_by = auth.uid(),
      updated_at = now()
    where id = p_offer_id
    returning * into v_row;
    return v_row;
  end if;

  -- Hold zaten alınmış olmalı; değilse şimdi al
  if not coalesce(v_row.coins_held, false) then
    if coalesce((select coins from public.wallets where user_id = v_row.seller_id), 0) < v_row.coins then
      raise exception 'Seller has insufficient coins';
    end if;
    update public.wallets set coins = coins - v_row.coins, updated_at = now()
    where user_id = v_row.seller_id;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, meta)
    values (
      v_row.seller_id, 'coins', -v_row.coins,
      (select coins from public.wallets where user_id = v_row.seller_id),
      'trade_hold', 'coin_trade',
      jsonb_build_object('offer_id', p_offer_id)
    );
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
    begin
      update public.agency_wallets set
        coins = coalesce(coins, 0) + v_row.coins,
        updated_at = now()
      where agency_id = v_row.buyer_agency_id;
    exception when undefined_column then
      null;
    end;
  end if;

  update public.coin_trade_offers set
    status = 'completed',
    coins_held = false,
    platform_approved_at = now(),
    platform_approved_by = auth.uid(),
    completed_at = now(),
    updated_at = now()
  where id = p_offer_id
  returning * into v_row;

  return v_row;
end;
$$;
