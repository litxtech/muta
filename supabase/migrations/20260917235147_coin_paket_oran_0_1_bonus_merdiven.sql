-- Coin paketleri: 1 coin = 0.10 TL + kademeli bonus (0/5/12/20%)
-- Hesap: taban = round(price_try / 0.1), bonus = round(taban * %)

update public.coin_packages
set is_active = false
where is_active = true;

insert into public.coin_packages (
  sku, title, coins, bonus_coins, price_usd, price_try, badge, sort_order,
  apple_product_id, google_product_id, is_active
)
values
  (
    'coins_try_2_99', 'Başlangıç', 30, 0, 0.29, 2.99, null, 1,
    'com.litxtech.muta.coins_try_2_99', 'com.litxtech.muta.coins_try_2_99', true
  ),
  (
    'coins_try_99_99', 'Popüler', 1000, 50, 2.99, 99.99, 'POPÜLER', 2,
    'com.litxtech.muta.coins_try_99_99', 'com.litxtech.muta.coins_try_99_99', true
  ),
  (
    'coins_try_999_99', 'Prestij', 10000, 1200, 29.99, 999.99, 'VIP', 3,
    'com.litxtech.muta.coins_try_999_99', 'com.litxtech.muta.coins_try_999_99', true
  ),
  (
    'coins_try_299999_99', 'Max', 3000000, 600000, 9999.99, 299999.99, 'MAX', 4,
    'com.litxtech.muta.coins_try_299999_99', 'com.litxtech.muta.coins_try_299999_99', true
  )
on conflict (sku) do update set
  title = excluded.title,
  coins = excluded.coins,
  bonus_coins = excluded.bonus_coins,
  price_usd = excluded.price_usd,
  price_try = excluded.price_try,
  badge = excluded.badge,
  sort_order = excluded.sort_order,
  apple_product_id = excluded.apple_product_id,
  google_product_id = excluded.google_product_id,
  is_active = true;
