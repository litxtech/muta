-- Coin takas: katalog TL + %40 satıcı / %60 platform + IAP soğutma + iade risk engeli
-- 1 coin = 0.10 ₺

alter table public.coin_trade_offers
  add column if not exists katalog_tl numeric(14,2),
  add column if not exists satici_net_tl numeric(14,2),
  add column if not exists platform_pay_tl numeric(14,2),
  add column if not exists odeme_pencere text;

comment on column public.coin_trade_offers.katalog_tl is
  'Teklif anında kilitlenen katalog değeri (coin * 0.10 ₺)';
comment on column public.coin_trade_offers.satici_net_tl is
  'Satıcı payı %40 (katalog * 0.40)';
comment on column public.coin_trade_offers.platform_pay_tl is
  'Platform payı %60 (katalog * 0.60)';
comment on column public.coin_trade_offers.odeme_pencere is
  'Hedef ödeme penceresi: 01–15 veya 15–31';

-- Mevcut teklifleri geri doldur
update public.coin_trade_offers
set
  katalog_tl = round((coins::numeric * 0.10), 2),
  satici_net_tl = round((coins::numeric * 0.10 * 0.40), 2),
  platform_pay_tl = round((coins::numeric * 0.10 * 0.60), 2),
  odeme_pencere = case
    when extract(day from created_at) <= 15 then '01–15'
    else '15–31'
  end
where katalog_tl is null;

-- ---------------------------------------------------------------------------
-- Yardımcı: takas TL özeti
-- ---------------------------------------------------------------------------
create or replace function public.coin_takas_tl_hesapla(p_coins bigint)
returns table (
  katalog_tl numeric,
  satici_net_tl numeric,
  platform_pay_tl numeric
)
language sql
immutable
as $$
  select
    round((greatest(p_coins, 0)::numeric * 0.10), 2),
    round((greatest(p_coins, 0)::numeric * 0.10 * 0.40), 2),
    round((greatest(p_coins, 0)::numeric * 0.10 * 0.60), 2);
$$;

create or replace function public.coin_takas_odeme_pencere(p_at timestamptz default now())
returns text
language sql
immutable
as $$
  select case
    when extract(day from p_at) <= 15 then '01–15'
    else '15–31'
  end;
$$;

-- ---------------------------------------------------------------------------
-- IAP soğutma: son 14 günde mağaza yüklemesi takasa kilitli kısım
-- ---------------------------------------------------------------------------
create or replace function public.coin_takas_iap_kilitli_coin(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(cp.coins_added), 0)::bigint
  from public.coin_purchases cp
  where cp.user_id = p_user_id
    and cp.status = 'completed'
    and cp.created_at > now() - interval '14 days'
    and lower(coalesce(cp.provider, '')) in (
      'apple', 'google', 'iap', 'app_store', 'play_store',
      'ios', 'android', 'appstore', 'playstore'
    );
$$;

-- ---------------------------------------------------------------------------
-- İade riski: refunded purchase varsa yeni takas yok
-- ---------------------------------------------------------------------------
create or replace function public.coin_takas_iade_riski_var(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coin_purchases cp
    where cp.user_id = p_user_id
      and cp.status = 'refunded'
  );
$$;

-- ---------------------------------------------------------------------------
-- Teklif oluştur: TL alanları + IAP soğutma + iade risk
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
  v_katalog numeric(14,2);
  v_satici numeric(14,2);
  v_platform numeric(14,2);
  v_pencere text;
  v_iap_kilit bigint;
  v_takas_edilebilir bigint;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_coins is null or p_coins <= 0 then raise exception 'Invalid amount'; end if;
  if p_buyer_type not in ('user','agency') then raise exception 'Invalid buyer type'; end if;

  select kyc_status into v_kyc from public.wallet_accounts where user_id = v_uid;
  if coalesce(v_kyc, 'none') <> 'approved' then
    raise exception 'KYC required to trade';
  end if;

  if public.coin_takas_iade_riski_var(v_uid) then
    raise exception 'Refund risk: trade blocked. Contact support.';
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

  v_iap_kilit := public.coin_takas_iap_kilitli_coin(v_uid);
  v_takas_edilebilir := greatest(coalesce(v_bal, 0) - coalesce(v_iap_kilit, 0), 0);
  if p_coins > v_takas_edilebilir then
    raise exception
      'IAP cooling: % coins locked for 14 days after store purchase. Tradable: %',
      v_iap_kilit, v_takas_edilebilir;
  end if;

  select t.katalog_tl, t.satici_net_tl, t.platform_pay_tl
    into v_katalog, v_satici, v_platform
  from public.coin_takas_tl_hesapla(p_coins) t;

  v_pencere := public.coin_takas_odeme_pencere(now());

  insert into public.coin_trade_offers (
    seller_id, buyer_type, buyer_user_id, buyer_agency_id, coins, note,
    status, seller_approved_at, coins_held,
    katalog_tl, satici_net_tl, platform_pay_tl, odeme_pencere
  ) values (
    v_uid, p_buyer_type,
    case when p_buyer_type = 'user' then p_buyer_user_id end,
    case when p_buyer_type = 'agency' then p_buyer_agency_id end,
    p_coins, nullif(trim(coalesce(p_note,'')), ''),
    'pending_buyer', now(), false,
    v_katalog, v_satici, v_platform, v_pencere
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
        'katalog_tl', v_katalog,
        'satici_net_tl', v_satici,
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
        'katalog_tl', v_katalog,
        'satici_net_tl', v_satici,
        'from_user_id', v_uid
      )
    );
  end if;

  return v_row;
end;
$$;

grant execute on function public.coin_takas_tl_hesapla(bigint) to authenticated;
grant execute on function public.coin_takas_odeme_pencere(timestamptz) to authenticated;
grant execute on function public.coin_takas_iap_kilitli_coin(uuid) to authenticated;
grant execute on function public.coin_takas_iade_riski_var(uuid) to authenticated;
grant execute on function public.coin_takas_teklif_olustur(text, uuid, uuid, bigint, text) to authenticated;
