-- Tamuso coin paketleri — 8 kademeli nihai tarife.
--
-- App Store Connect / Play Console ürün kimlikleri (DEĞİŞTİRİLMEZ):
--   tamuso_coin_pack_1 .. tamuso_coin_pack_8
--
-- Oran: 99,99 ₺ = 320 coin → 1 ₺ ≈ 3,20 coin.
-- `coins` = orantılı taban, `bonus_coins` = kademe bonusu.
-- Uygulama kartta (coins + bonus_coins) toplamını gösterir.
--
--  1 Başlangıç    ₺99,99      320                         =    320
--  2 Popüler      ₺499,99    1.600 +   100  (+%6)         =  1.700
--  3 Prestij      ₺999,99    3.200 +   300  (+%9)         =  3.500
--  4 Max          ₺4.999,99 16.000 + 2.000  (+%12,5)      = 18.000
--  5 Plus         ₺7.999,99 25.600 + 4.400  (+%17)        = 30.000
--  6 Elite       ₺11.999,00 38.400 + 7.600  (+%20)        = 46.000
--  7 Premium     ₺14.999,99 48.000 +12.000  (+%25)        = 60.000
--  8 Ultra       ₺49.999,99 160.000 + 60.000 (+%37,5)     = 220.000
--
-- price_try / price_usd yalnızca referanstır; gerçek tahsilat StoreKit / Play
-- Billing'den okunur. Mağaza fiyatı farklıysa uygulama mağaza fiyatını gösterir.

insert into public.coin_packages (
  sku, title, coins, bonus_coins, price_usd, price_try, badge, campaign_text,
  sort_order, apple_product_id, google_product_id, is_active
)
values
  (
    'tamuso_coin_pack_1', 'Başlangıç Coin Paketi',
    320, 0, 2.99, 99.99, null, null, 1,
    'tamuso_coin_pack_1', 'tamuso_coin_pack_1', true
  ),
  (
    'tamuso_coin_pack_2', 'Popüler Coin Paketi',
    1600, 100, 14.99, 499.99, 'POPÜLER', null, 2,
    'tamuso_coin_pack_2', 'tamuso_coin_pack_2', true
  ),
  (
    'tamuso_coin_pack_3', 'Prestij Coin Paketi',
    3200, 300, 29.99, 999.99, null, null, 3,
    'tamuso_coin_pack_3', 'tamuso_coin_pack_3', true
  ),
  (
    'tamuso_coin_pack_4', 'Max Coin Paketi',
    16000, 2000, 149.99, 4999.99, null, null, 4,
    'tamuso_coin_pack_4', 'tamuso_coin_pack_4', true
  ),
  (
    'tamuso_coin_pack_5', 'Plus Coin Paketi',
    25600, 4400, 239.99, 7999.99, null, null, 5,
    'tamuso_coin_pack_5', 'tamuso_coin_pack_5', true
  ),
  (
    'tamuso_coin_pack_6', 'Elite Coin Paketi',
    38400, 7600, 359.99, 11999.00, null, null, 6,
    'tamuso_coin_pack_6', 'tamuso_coin_pack_6', true
  ),
  (
    'tamuso_coin_pack_7', 'Premium Coin Paketi',
    48000, 12000, 449.99, 14999.99, null, null, 7,
    'tamuso_coin_pack_7', 'tamuso_coin_pack_7', true
  ),
  (
    'tamuso_coin_pack_8', 'Ultra Coin Paketi',
    160000, 60000, 1499.99, 49999.99, 'EN AVANTAJLI', null, 8,
    'tamuso_coin_pack_8', 'tamuso_coin_pack_8', true
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
  is_active = true,
  updated_at = now();

-- Yalnızca 8 Tamuso paketi satışta kalsın (eski deneme SKU'ları kapanır).
update public.coin_packages
   set is_active = false, updated_at = now()
 where is_active = true
   and sku not like 'tamuso_coin_pack_%';

-- Paket id'leri değişmediği için geçmiş coin_purchases kayıtları korunur.
