-- Coin magaza: 4 paket — Apple IAP 99,99 ₺ → 4.999,99 ₺
-- Connect'te ayni SKU icin en yakin TRY price point secilmeli.

update public.coin_packages
set is_active = false
where is_active = true;

insert into public.coin_packages (
  sku, title, coins, bonus_coins, price_usd, price_try, badge, sort_order,
  apple_product_id, google_product_id, is_active
)
values
  (
    'coins_try_99_99', 'Başlangıç', 1000, 0, 2.99, 99.99, null, 1,
    'com.litxtech.muta.coins_try_99_99', 'com.litxtech.muta.coins_try_99_99', true
  ),
  (
    'coins_try_499_99', 'Popüler', 5000, 250, 14.99, 499.99, 'POPÜLER', 2,
    'com.litxtech.muta.coins_try_499_99', 'com.litxtech.muta.coins_try_499_99', true
  ),
  (
    'coins_try_999_99', 'Prestij', 10000, 1200, 29.99, 999.99, 'VIP', 3,
    'com.litxtech.muta.coins_try_999_99', 'com.litxtech.muta.coins_try_999_99', true
  ),
  (
    'coins_try_4999_99', 'Max', 50000, 10000, 149.99, 4999.99, 'MAX', 4,
    'com.litxtech.muta.coins_try_4999_99', 'com.litxtech.muta.coins_try_4999_99', true
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
