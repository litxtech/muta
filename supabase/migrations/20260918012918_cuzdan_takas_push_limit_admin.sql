-- Transfer/takas push bildirimleri + aylık limit (varsayılan 3M) + admin ayar

-- ---------------------------------------------------------------------------
-- 1) Platform limit ayarları (tek satır)
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_trade_limit_settings (
  id int primary key default 1 check (id = 1),
  monthly_transfer_limit bigint not null default 3000000
    check (monthly_transfer_limit >= 0),
  monthly_trade_limit bigint not null default 3000000
    check (monthly_trade_limit >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.wallet_trade_limit_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.wallet_trade_limit_settings enable row level security;

drop policy if exists "wallet_trade_limit_admin" on public.wallet_trade_limit_settings;
create policy "wallet_trade_limit_admin" on public.wallet_trade_limit_settings
  for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

drop policy if exists "wallet_trade_limit_read" on public.wallet_trade_limit_settings;
create policy "wallet_trade_limit_read" on public.wallet_trade_limit_settings
  for select to authenticated
  using (true);

grant select on public.wallet_trade_limit_settings to authenticated;

create index if not exists coin_wallet_transfers_created_idx
  on public.coin_wallet_transfers (created_at desc);
create index if not exists coin_wallet_transfers_receiver_idx
  on public.coin_wallet_transfers (receiver_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2) Yardımcılar
-- ---------------------------------------------------------------------------
create or replace function public.profil_gosterim_adi(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(p.display_name), ''),
    nullif(trim(p.username), ''),
    'Kullanıcı'
  )
  from public.profiles p
  where p.id = p_user_id;
$$;

create or replace function public.cuzdan_aylik_transfer_toplami(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(t.coins), 0)::bigint
  from public.coin_wallet_transfers t
  where t.sender_id = p_user_id
    and t.status = 'completed'
    and t.created_at >= date_trunc('month', now());
$$;

create or replace function public.cuzdan_aylik_takas_toplami(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(o.coins), 0)::bigint
  from public.coin_trade_offers o
  where o.seller_id = p_user_id
    and o.created_at >= date_trunc('month', now())
    and o.status not in ('rejected', 'cancelled', 'expired');
$$;

create or replace function public.cuzdan_aylik_limit_kontrol(
  p_user_id uuid,
  p_kind text,
  p_coins bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lim bigint;
  v_used bigint;
begin
  if p_coins is null or p_coins <= 0 then
    raise exception 'Invalid amount';
  end if;

  select
    case
      when p_kind = 'transfer' then monthly_transfer_limit
      when p_kind = 'trade' then monthly_trade_limit
      else null
    end
  into v_lim
  from public.wallet_trade_limit_settings
  where id = 1;

  if v_lim is null then
    raise exception 'Invalid limit kind';
  end if;

  -- 0 = limitsiz
  if v_lim = 0 then
    return;
  end if;

  if p_kind = 'transfer' then
    v_used := public.cuzdan_aylik_transfer_toplami(p_user_id);
  else
    v_used := public.cuzdan_aylik_takas_toplami(p_user_id);
  end if;

  if v_used + p_coins > v_lim then
    raise exception
      'Aylık % limit aşıldı (% / %). Kalan: %',
      case when p_kind = 'transfer' then 'transfer' else 'takas' end,
      v_used,
      v_lim,
      greatest(v_lim - v_used, 0);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Admin limit get/set
-- ---------------------------------------------------------------------------
create or replace function public.admin_cuzdan_takas_limit_getir()
returns public.wallet_trade_limit_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.wallet_trade_limit_settings%rowtype;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  select * into v_row from public.wallet_trade_limit_settings where id = 1;
  return v_row;
end;
$$;

create or replace function public.admin_cuzdan_takas_limit_ayarla(
  p_monthly_transfer_limit bigint,
  p_monthly_trade_limit bigint
)
returns public.wallet_trade_limit_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.wallet_trade_limit_settings%rowtype;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  if p_monthly_transfer_limit is null or p_monthly_transfer_limit < 0 then
    raise exception 'Invalid transfer limit';
  end if;
  if p_monthly_trade_limit is null or p_monthly_trade_limit < 0 then
    raise exception 'Invalid trade limit';
  end if;

  update public.wallet_trade_limit_settings set
    monthly_transfer_limit = p_monthly_transfer_limit,
    monthly_trade_limit = p_monthly_trade_limit,
    updated_at = now(),
    updated_by = auth.uid()
  where id = 1
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.admin_cuzdan_takas_limit_getir() from public;
revoke all on function public.admin_cuzdan_takas_limit_ayarla(bigint, bigint) from public;
grant execute on function public.admin_cuzdan_takas_limit_getir() to authenticated;
grant execute on function public.admin_cuzdan_takas_limit_ayarla(bigint, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Transfer: limit + push
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
  v_sender_ad text;
  v_recv_ad text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_coin_purchase') then
    raise exception 'Transfers temporarily disabled';
  end if;
  if p_coins is null or p_coins <= 0 then raise exception 'Invalid amount'; end if;

  v_num := regexp_replace(coalesce(p_wallet_number,''), '\D', '', 'g');
  if length(v_num) <> 18 then raise exception 'Wallet number must be 18 digits'; end if;

  perform public.cuzdan_hesabi_garantile(v_uid);
  perform public.cuzdan_aylik_limit_kontrol(v_uid, 'transfer', p_coins);

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

  v_sender_ad := public.profil_gosterim_adi(v_uid);
  v_recv_ad := public.profil_gosterim_adi(v_recv.user_id);

  perform public.bildirim_kuyruga_ekle(
    v_recv.user_id,
    'wallet',
    'Coin transferi aldın',
    v_sender_ad || ' sana ' || p_coins::text || ' coin gönderdi.',
    '/(tabs)/wallet',
    jsonb_build_object(
      'type', 'wallet_transfer_in',
      'transfer_id', v_row.id,
      'from_user_id', v_uid,
      'coins', p_coins
    )
  );

  perform public.bildirim_kuyruga_ekle(
    v_uid,
    'wallet',
    'Transfer tamamlandı',
    v_recv_ad || ' hesabına ' || p_coins::text || ' coin gönderildi.',
    '/cuzdan/takas',
    jsonb_build_object(
      'type', 'wallet_transfer_out',
      'transfer_id', v_row.id,
      'to_user_id', v_recv.user_id,
      'coins', p_coins
    )
  );

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Teklif oluştur: limit + wallet push
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
  v_owner uuid;
  v_agency_name text;
  v_seller_ad text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_coins is null or p_coins <= 0 then raise exception 'Invalid amount'; end if;
  if p_buyer_type not in ('user','agency') then raise exception 'Invalid buyer type'; end if;

  select kyc_status into v_kyc from public.wallet_accounts where user_id = v_uid;
  if coalesce(v_kyc, 'none') <> 'approved' then
    raise exception 'KYC required to trade';
  end if;

  perform public.cuzdan_aylik_limit_kontrol(v_uid, 'trade', p_coins);

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

  v_seller_ad := public.profil_gosterim_adi(v_uid);

  if p_buyer_type = 'agency' and v_owner is not null then
    perform public.bildirim_kuyruga_ekle(
      v_owner,
      'wallet',
      'Yeni coin teklifi',
      v_seller_ad || ' · ' || coalesce(v_agency_name, 'Ajans') || ' için '
        || p_coins::text || ' coin teklifi. Ajans panelinden yanıtla.',
      '/ajans/teklifler',
      jsonb_build_object(
        'type', 'trade_offer_new',
        'offer_id', v_row.id,
        'agency_id', p_buyer_agency_id,
        'coins', p_coins,
        'from_user_id', v_uid
      )
    );
  elsif p_buyer_type = 'user' and p_buyer_user_id is not null then
    perform public.bildirim_kuyruga_ekle(
      p_buyer_user_id,
      'wallet',
      'Yeni coin teklifi',
      v_seller_ad || ' sana ' || p_coins::text || ' coin teklifi gönderdi.',
      '/cuzdan/takas',
      jsonb_build_object(
        'type', 'trade_offer_new',
        'offer_id', v_row.id,
        'coins', p_coins,
        'from_user_id', v_uid
      )
    );
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) Alıcı yanıt: hold + satıcıya push
-- ---------------------------------------------------------------------------
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
  v_buyer_ad text;
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

  v_buyer_ad := public.profil_gosterim_adi(v_uid);

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
      status = 'rejected',
      coins_held = false,
      updated_at = now()
    where id = p_offer_id
    returning * into v_row;

    perform public.bildirim_kuyruga_ekle(
      v_row.seller_id,
      'wallet',
      'Teklif reddedildi',
      v_buyer_ad || ' ' || v_row.coins::text || ' coin teklifini reddetti.',
      '/cuzdan/takas',
      jsonb_build_object(
        'type', 'trade_offer_rejected',
        'offer_id', p_offer_id,
        'coins', v_row.coins
      )
    );
    return v_row;
  end if;

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

  perform public.bildirim_kuyruga_ekle(
    v_row.seller_id,
    'wallet',
    'Teklif kabul edildi',
    v_buyer_ad || ' ' || v_row.coins::text
      || ' coin teklifini kabul etti. Coinler geçici kilitlendi; platform onayı bekleniyor.',
    '/cuzdan/takas',
    jsonb_build_object(
      'type', 'trade_offer_accepted',
      'offer_id', p_offer_id,
      'coins', v_row.coins,
      'status', v_row.status
    )
  );

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) Ödeme bilgisi + dekont: satıcıya push
-- ---------------------------------------------------------------------------
create or replace function public.coin_takas_odeme_bilgisi_kaydet(
  p_offer_id uuid,
  p_coins_bought bigint,
  p_payment_source text
)
returns public.coin_trade_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.coin_trade_offers%rowtype;
  v_src text := nullif(trim(coalesce(p_payment_source, '')), '');
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_coins_bought is null or p_coins_bought <= 0 then
    raise exception 'Satin alinan coin pozitif olmali';
  end if;
  if v_src is null or length(v_src) < 3 then
    raise exception 'Odeme kaynagi gerekli';
  end if;

  select * into v_row from public.coin_trade_offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  if v_row.buyer_type <> 'agency' then raise exception 'Only agency offers'; end if;
  if v_row.status <> 'pending_payment_info' then
    raise exception 'Offer not awaiting payment info';
  end if;
  if not public.coin_takas_ajans_yetkili_mi(v_row.buyer_agency_id, v_uid) then
    raise exception 'Forbidden';
  end if;

  update public.coin_trade_offers set
    payment_coins_bought = p_coins_bought,
    payment_source = left(v_src, 500),
    payment_info_at = now(),
    receipt_deadline_at = now() + interval '1 day',
    status = 'pending_receipt',
    updated_at = now()
  where id = p_offer_id
  returning * into v_row;

  perform public.bildirim_kuyruga_ekle(
    v_row.seller_id,
    'wallet',
    'Ödeme bilgisi girildi',
    v_row.coins::text || ' coin takasında ajans ödeme bilgisini kaydetti. Dekont bekleniyor.',
    '/cuzdan/takas',
    jsonb_build_object(
      'type', 'trade_payment_info',
      'offer_id', p_offer_id,
      'coins', v_row.coins
    )
  );

  return v_row;
end;
$$;

create or replace function public.coin_takas_dekont_yukle(
  p_offer_id uuid,
  p_receipt_path text
)
returns public.coin_trade_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.coin_trade_offers%rowtype;
  v_path text := nullif(trim(coalesce(p_receipt_path, '')), '');
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_path is null then raise exception 'Dekont yolu gerekli'; end if;

  select * into v_row from public.coin_trade_offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  if v_row.buyer_type <> 'agency' then raise exception 'Only agency offers'; end if;
  if v_row.status not in ('pending_receipt', 'receipt_overdue') then
    raise exception 'Offer not awaiting receipt';
  end if;
  if not public.coin_takas_ajans_yetkili_mi(v_row.buyer_agency_id, v_uid) then
    raise exception 'Forbidden';
  end if;

  update public.coin_trade_offers set
    receipt_path = v_path,
    receipt_uploaded_at = now(),
    status = 'pending_platform',
    updated_at = now()
  where id = p_offer_id
  returning * into v_row;

  perform public.bildirim_kuyruga_ekle(
    v_row.seller_id,
    'wallet',
    'Dekont yüklendi',
    v_row.coins::text || ' coin takası platform onayına alındı.',
    '/cuzdan/takas',
    jsonb_build_object(
      'type', 'trade_receipt_uploaded',
      'offer_id', p_offer_id,
      'coins', v_row.coins
    )
  );

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8) Platform onay: satıcı + alıcı push
-- ---------------------------------------------------------------------------
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
  v_owner uuid;
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

    perform public.bildirim_kuyruga_ekle(
      v_row.seller_id,
      'wallet',
      'Takas iptal',
      v_row.coins::text || ' coin takası platform tarafından reddedildi. Coinler iade edildi.',
      '/cuzdan/takas',
      jsonb_build_object('type', 'trade_platform_rejected', 'offer_id', p_offer_id, 'coins', v_row.coins)
    );

    if v_row.buyer_type = 'user' and v_row.buyer_user_id is not null then
      perform public.bildirim_kuyruga_ekle(
        v_row.buyer_user_id,
        'wallet',
        'Takas iptal',
        v_row.coins::text || ' coin takası platform tarafından reddedildi.',
        '/cuzdan/takas',
        jsonb_build_object('type', 'trade_platform_rejected', 'offer_id', p_offer_id, 'coins', v_row.coins)
      );
    elsif v_row.buyer_type = 'agency' and v_row.buyer_agency_id is not null then
      select owner_id into v_owner from public.agencies where id = v_row.buyer_agency_id;
      if v_owner is not null then
        perform public.bildirim_kuyruga_ekle(
          v_owner,
          'wallet',
          'Takas iptal',
          v_row.coins::text || ' coin takası platform tarafından reddedildi.',
          '/ajans/teklifler',
          jsonb_build_object('type', 'trade_platform_rejected', 'offer_id', p_offer_id, 'coins', v_row.coins)
        );
      end if;
    end if;

    return v_row;
  end if;

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

  perform public.bildirim_kuyruga_ekle(
    v_row.seller_id,
    'wallet',
    'Takas tamamlandı',
    v_row.coins::text || ' coin takası platform onayından geçti.',
    '/cuzdan/takas',
    jsonb_build_object('type', 'trade_completed', 'offer_id', p_offer_id, 'coins', v_row.coins)
  );

  if v_row.buyer_type = 'user' and v_row.buyer_user_id is not null then
    perform public.bildirim_kuyruga_ekle(
      v_row.buyer_user_id,
      'wallet',
      'Takas tamamlandı',
      v_row.coins::text || ' coin hesabına geçti.',
      '/(tabs)/wallet',
      jsonb_build_object('type', 'trade_completed', 'offer_id', p_offer_id, 'coins', v_row.coins)
    );
  elsif v_row.buyer_type = 'agency' and v_row.buyer_agency_id is not null then
    select owner_id into v_owner from public.agencies where id = v_row.buyer_agency_id;
    if v_owner is not null then
      perform public.bildirim_kuyruga_ekle(
        v_owner,
        'wallet',
        'Takas tamamlandı',
        v_row.coins::text || ' coin ajans cüzdanına eklendi.',
        '/ajans/teklifler',
        jsonb_build_object('type', 'trade_completed', 'offer_id', p_offer_id, 'coins', v_row.coins)
      );
    end if;
  end if;

  return v_row;
end;
$$;
