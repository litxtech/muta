-- Coin magaza: 4 paket — Apple IAP en dusuk → en yuksek (TRY fiyat noktalari)
-- Connect'te ayni 4 SKU icin en yakin price point secilmeli.
-- Apple TRY (dokuman): min ~2.99, max ~299.999,99 (X.99); USD min $0.29, max $9.999,99

update public.coin_packages
set is_active = false
where is_active = true;

insert into public.coin_packages (
  sku, title, coins, bonus_coins, price_usd, price_try, badge, sort_order,
  apple_product_id, google_product_id, is_active
)
values
  (
    'coins_try_2_99',
    'Başlangıç',
    50,
    0,
    0.29,
    2.99,
    null,
    1,
    'com.litxtech.muta.coins_try_2_99',
    'com.litxtech.muta.coins_try_2_99',
    true
  ),
  (
    'coins_try_99_99',
    'Popüler',
    1800,
    200,
    2.99,
    99.99,
    'POPÜLER',
    2,
    'com.litxtech.muta.coins_try_99_99',
    'com.litxtech.muta.coins_try_99_99',
    true
  ),
  (
    'coins_try_999_99',
    'Prestij',
    20000,
    3000,
    29.99,
    999.99,
    'VIP',
    3,
    'com.litxtech.muta.coins_try_999_99',
    'com.litxtech.muta.coins_try_999_99',
    true
  ),
  (
    'coins_try_299999_99',
    'Max',
    4800000,
    960000,
    9999.99,
    299999.99,
    'MAX',
    4,
    'com.litxtech.muta.coins_try_299999_99',
    'com.litxtech.muta.coins_try_299999_99',
    true
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
