-- Tamuso IAP: Store Product ID'leri (tamuso_coin_pack_1..8) + cüzdan feature flag'leri
-- Gerçek tahsilat fiyatı StoreKit / Play Billing'den gelir; price_try yalnızca referans.

alter table public.coin_packages
  add column if not exists campaign_text text,
  add column if not exists updated_at timestamptz default now();

-- Eski aktif paketleri kapat (SKU çakışmasın)
update public.coin_packages
set is_active = false, updated_at = now()
where is_active = true
  and sku not like 'tamuso_coin_pack_%';

insert into public.coin_packages (
  sku, title, coins, bonus_coins, price_usd, price_try, badge, campaign_text,
  sort_order, apple_product_id, google_product_id, is_active
)
values
  (
    'tamuso_coin_pack_1', 'Başlangıç Coin Paketi', 400, 0, 2.99, 99.99,
    null, null, 1,
    'tamuso_coin_pack_1', 'tamuso_coin_pack_1', true
  ),
  (
    'tamuso_coin_pack_2', 'Popüler Coin Paketi', 1500, 0, 14.99, 489.99,
    'POPÜLER', null, 2,
    'tamuso_coin_pack_2', 'tamuso_coin_pack_2', true
  ),
  (
    'tamuso_coin_pack_3', 'Prestij Coin Paketi', 2400, 0, 29.99, 999.99,
    null, null, 3,
    'tamuso_coin_pack_3', 'tamuso_coin_pack_3', true
  ),
  (
    'tamuso_coin_pack_4', 'Max Coin Paketi', 5200, 0, 149.99, 4999.99,
    'MAX', null, 4,
    'tamuso_coin_pack_4', 'tamuso_coin_pack_4', true
  ),
  (
    'tamuso_coin_pack_5', 'Plus Coin Paketi', 0, 0, 0, 0,
    null, null, 5,
    'tamuso_coin_pack_5', 'tamuso_coin_pack_5', false
  ),
  (
    'tamuso_coin_pack_6', 'Elite Coin Paketi', 0, 0, 0, 0,
    null, null, 6,
    'tamuso_coin_pack_6', 'tamuso_coin_pack_6', false
  ),
  (
    'tamuso_coin_pack_7', 'Premium Coin Paketi', 0, 0, 0, 0,
    null, null, 7,
    'tamuso_coin_pack_7', 'tamuso_coin_pack_7', false
  ),
  (
    'tamuso_coin_pack_8', 'Ultra Coin Paketi', 0, 0, 0, 0,
    null, null, 8,
    'tamuso_coin_pack_8', 'tamuso_coin_pack_8', false
  )
on conflict (sku) do update set
  title = excluded.title,
  coins = excluded.coins,
  bonus_coins = excluded.bonus_coins,
  price_usd = excluded.price_usd,
  price_try = excluded.price_try,
  badge = excluded.badge,
  campaign_text = excluded.campaign_text,
  sort_order = excluded.sort_order,
  apple_product_id = excluded.apple_product_id,
  google_product_id = excluded.google_product_id,
  is_active = case
    when excluded.sku in (
      'tamuso_coin_pack_1', 'tamuso_coin_pack_2',
      'tamuso_coin_pack_3', 'tamuso_coin_pack_4'
    ) then true
    else public.coin_packages.is_active
  end,
  updated_at = now();

-- Pack 1–4 coin miktarlarını kesinleştir (admin sonra değiştirebilir)
update public.coin_packages set coins = 400, bonus_coins = 0, updated_at = now()
where sku = 'tamuso_coin_pack_1';
update public.coin_packages set coins = 1500, bonus_coins = 0, updated_at = now()
where sku = 'tamuso_coin_pack_2';
update public.coin_packages set coins = 2400, bonus_coins = 0, updated_at = now()
where sku = 'tamuso_coin_pack_3';
update public.coin_packages set coins = 5200, bonus_coins = 0, updated_at = now()
where sku = 'tamuso_coin_pack_4';

-- Cüzdan: takas / sat / çekim — varsayılan KAPALI (store uyumu)
insert into public.feature_flags (key, enabled, description) values
  ('wallet_exchange_enabled', false, 'Cüzdan takas / anlaşma (kullanıcı UI)'),
  ('wallet_sell_enabled', false, 'Coin sat (kullanıcı UI)'),
  ('wallet_withdraw_enabled', false, 'Cüzdan çekim sekmesi (kullanıcı UI)')
on conflict (key) do update set
  enabled = excluded.enabled,
  description = excluded.description,
  updated_at = now();

-- withdrawals_enabled ile hizala (çekim default kapalı)
update public.feature_flags
set enabled = false, updated_at = now()
where key = 'withdrawals_enabled';

-- Admin: paket düzenleme (product_id kilitli)
create or replace function public.admin_coin_paket_guncelle(
  p_id uuid,
  p_title text default null,
  p_coins bigint default null,
  p_bonus_coins bigint default null,
  p_badge text default null,
  p_campaign_text text default null,
  p_sort_order int default null,
  p_is_active boolean default null,
  p_price_try numeric default null,
  p_price_usd numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.coin_packages%rowtype;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  update public.coin_packages set
    title = coalesce(nullif(trim(p_title), ''), title),
    coins = coalesce(p_coins, coins),
    bonus_coins = coalesce(p_bonus_coins, bonus_coins),
    badge = case when p_badge is null then badge else nullif(trim(p_badge), '') end,
    campaign_text = case
      when p_campaign_text is null then campaign_text
      else nullif(trim(p_campaign_text), '')
    end,
    sort_order = coalesce(p_sort_order, sort_order),
    is_active = coalesce(p_is_active, is_active),
    price_try = coalesce(p_price_try, price_try),
    price_usd = coalesce(p_price_usd, price_usd),
    updated_at = now()
  where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'Paket bulunamadi';
  end if;

  -- Aktif paket coin 0 olamaz
  if v_row.is_active and coalesce(v_row.coins, 0) <= 0 then
    raise exception 'Aktif paket icin coin miktari > 0 olmali';
  end if;

  return jsonb_build_object(
    'ok', true,
    'paket', jsonb_build_object(
      'id', v_row.id,
      'sku', v_row.sku,
      'title', v_row.title,
      'coins', v_row.coins,
      'bonus_coins', v_row.bonus_coins,
      'price_usd', v_row.price_usd,
      'price_try', v_row.price_try,
      'badge', v_row.badge,
      'campaign_text', v_row.campaign_text,
      'sort_order', v_row.sort_order,
      'is_active', v_row.is_active,
      'apple_product_id', v_row.apple_product_id,
      'google_product_id', v_row.google_product_id
    )
  );
end;
$$;

grant execute on function public.admin_coin_paket_guncelle(
  uuid, text, bigint, bigint, text, text, int, boolean, numeric, numeric
) to authenticated;

-- Admin katalog: campaign + product id + sort
create or replace function public.admin_ekonomi_katalogu()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  return jsonb_build_object(
    'paketler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'sku', sku,
        'title', title,
        'coins', coins,
        'bonus_coins', bonus_coins,
        'price_usd', price_usd,
        'price_try', price_try,
        'is_active', is_active,
        'badge', badge,
        'campaign_text', campaign_text,
        'sort_order', sort_order,
        'apple_product_id', apple_product_id,
        'google_product_id', google_product_id
      ) order by sort_order, price_usd)
      from public.coin_packages
    ), '[]'::jsonb),
    'hediyeler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'code', code, 'name', name, 'emoji', emoji,
        'coin_cost', coin_cost, 'diamond_value', diamond_value,
        'rarity', rarity, 'is_active', is_active
      ) order by sort_order, coin_cost)
      from public.gifts
    ), '[]'::jsonb)
  );
end;
$$;

-- Feature flag guard RPC (navigation / işlem)
create or replace function public.ozellik_bayragi_zorunlu(p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return coalesce(
    (select enabled from public.feature_flags where key = p_key),
    false
  );
end;
$$;

grant execute on function public.ozellik_bayragi_zorunlu(text) to authenticated;

-- Takas oluşturma: bayrak kapalıysa RPC reddeder
create or replace function public.coin_takas_bayrak_kontrol()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(
    (select enabled from public.feature_flags where key = 'wallet_exchange_enabled'),
    false
  ) then
    raise exception 'Takas kapali (wallet_exchange_enabled)';
  end if;
end;
$$;

grant execute on function public.coin_takas_bayrak_kontrol() to authenticated;

-- Çekim: wallet_withdraw_enabled da kapalıysa engelle (withdrawals_enabled ile AND)
create or replace function public.cekim_wallet_bayrak_kontrol()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(
    (select enabled from public.feature_flags where key = 'wallet_withdraw_enabled'),
    false
  ) and not coalesce(
    (select enabled from public.feature_flags where key = 'withdrawals_enabled'),
    false
  ) then
    raise exception 'Cekim kapali (wallet_withdraw_enabled)';
  end if;
end;
$$;

grant execute on function public.cekim_wallet_bayrak_kontrol() to authenticated;

-- Mevcut takas RPC başına bayrak (tam gövde — son sürüm + kontrol)
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
  v_note text;
  v_usd numeric;
  v_push text;
begin
  perform public.coin_takas_bayrak_kontrol();

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
  v_usd := greatest(1, round(v_satici / 35.0));

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is null then
    v_note :=
      'Merhaba, benim ' || trim(to_char(p_coins, 'FM999G999G999')) ||
      ' coinim var; bunu sana ' || trim(to_char(v_satici, 'FM999G999G990D00')) ||
      ' ₺ veya yaklaşık ' || trim(to_char(v_usd, 'FM999G999G999')) ||
      ' $''a satmak istiyorum. Kabul edersen işlemleri başlatalım.';
  end if;

  insert into public.coin_trade_offers (
    seller_id, buyer_type, buyer_user_id, buyer_agency_id, coins, note,
    status, seller_approved_at, coins_held,
    katalog_tl, satici_net_tl, platform_pay_tl, odeme_pencere
  ) values (
    v_uid, p_buyer_type,
    case when p_buyer_type = 'user' then p_buyer_user_id end,
    case when p_buyer_type = 'agency' then p_buyer_agency_id end,
    p_coins, v_note,
    'pending_buyer', now(), false,
    v_katalog, v_satici, v_platform, v_pencere
  ) returning * into v_row;

  v_seller_ad := public.profil_gosterim_adi(v_uid);
  v_push :=
    v_seller_ad || ': Merhaba, benim ' || trim(to_char(p_coins, 'FM999G999G999')) ||
    ' coinim var; bunu sana ' || trim(to_char(v_satici, 'FM999G999G990D00')) ||
    ' ₺ veya yaklaşık ' || trim(to_char(v_usd, 'FM999G999G999')) ||
    ' $''a satmak istiyorum. Kabul edersen işlemleri başlatalım.';

  if p_buyer_type = 'agency' and v_owner is not null then
    perform public.bildirim_kuyruga_ekle(
      v_owner,
      'wallet',
      'Yeni coin teklifi',
      v_push || ' · ' || coalesce(v_agency_name, 'Ajans'),
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
      v_push,
      '/cuzdan/takas?sekme=teklifler',
      jsonb_build_object(
        'type', 'trade_offer_new',
        'offer_id', v_row.id,
        'coins', p_coins,
        'katalog_tl', v_katalog,
        'satici_net_tl', v_satici,
        'from_user_id', v_uid,
        'sekme', 'teklifler'
      )
    );
  end if;

  return v_row;
end;
$$;

-- Çekim talebi: wallet_withdraw bayrağı
do $$
declare
  v_src text;
begin
  -- cekim_talebi_olustur gövdesine dokunmadan çağrı noktasını client + helper ile koruyoruz.
  -- RPC içi: mevcut ozellik_bayragi_aktif_mi('withdrawals_enabled') zaten var; bayrak false.
  null;
end $$;
