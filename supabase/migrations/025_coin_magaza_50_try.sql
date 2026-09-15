-- Coin magaza: 50 TRY paket (112-32000) + genis hediye katalogu

alter table public.coin_packages
  add column if not exists price_try numeric(12,2);

update public.coin_packages set is_active = false where sku not like 'coins_try_%';

insert into public.coin_packages (
  sku, title, coins, bonus_coins, price_usd, price_try, badge, sort_order,
  apple_product_id, google_product_id
)
values
  ('coins_try_112', 'Başlangıç', 1120, 0, 3.2, 112, null, 1, 'com.litxtech.muta.coins_try_112', 'com.litxtech.muta.coins_try_112'),
  ('coins_try_126', 'Mini', 1270, 0, 3.6, 126, null, 2, 'com.litxtech.muta.coins_try_126', 'com.litxtech.muta.coins_try_126'),
  ('coins_try_141', 'Kıvılcım', 1440, 0, 4.03, 141, null, 3, 'com.litxtech.muta.coins_try_141', 'com.litxtech.muta.coins_try_141'),
  ('coins_try_158', 'Parıltı', 1630, 0, 4.51, 158, null, 4, 'com.litxtech.muta.coins_try_158', 'com.litxtech.muta.coins_try_158'),
  ('coins_try_178', 'Işık', 1850, 0, 5.09, 178, null, 5, 'com.litxtech.muta.coins_try_178', 'com.litxtech.muta.coins_try_178'),
  ('coins_try_199', 'Yıldız', 2090, 100, 5.69, 199, null, 6, 'com.litxtech.muta.coins_try_199', 'com.litxtech.muta.coins_try_199'),
  ('coins_try_224', 'Nova', 2380, 120, 6.4, 224, null, 7, 'com.litxtech.muta.coins_try_224', 'com.litxtech.muta.coins_try_224'),
  ('coins_try_250', 'Aura', 2680, 130, 7.14, 250, null, 8, 'com.litxtech.muta.coins_try_250', 'com.litxtech.muta.coins_try_250'),
  ('coins_try_280', 'Ritim', 3030, 150, 8, 280, null, 9, 'com.litxtech.muta.coins_try_280', 'com.litxtech.muta.coins_try_280'),
  ('coins_try_315', 'Popüler', 3440, 170, 9, 315, 'POPÜLER', 10, 'com.litxtech.muta.coins_try_315', 'com.litxtech.muta.coins_try_315'),
  ('coins_try_355', 'Sahne', 3910, 200, 10.14, 355, null, 11, 'com.litxtech.muta.coins_try_355', 'com.litxtech.muta.coins_try_355'),
  ('coins_try_400', 'Sahne+', 4450, 220, 11.43, 400, null, 12, 'com.litxtech.muta.coins_try_400', 'com.litxtech.muta.coins_try_400'),
  ('coins_try_445', 'Parti', 4990, 250, 12.71, 445, null, 13, 'com.litxtech.muta.coins_try_445', 'com.litxtech.muta.coins_try_445'),
  ('coins_try_500', 'Parti+', 5660, 280, 14.29, 500, null, 14, 'com.litxtech.muta.coins_try_500', 'com.litxtech.muta.coins_try_500'),
  ('coins_try_565', 'Gece', 6460, 320, 16.14, 565, null, 15, 'com.litxtech.muta.coins_try_565', 'com.litxtech.muta.coins_try_565'),
  ('coins_try_630', 'VIP', 7260, 730, 18, 630, null, 16, 'com.litxtech.muta.coins_try_630', 'com.litxtech.muta.coins_try_630'),
  ('coins_try_710', 'VIP+', 8260, 830, 20.29, 710, null, 17, 'com.litxtech.muta.coins_try_710', 'com.litxtech.muta.coins_try_710'),
  ('coins_try_795', 'Elit', 9330, 930, 22.71, 795, null, 18, 'com.litxtech.muta.coins_try_795', 'com.litxtech.muta.coins_try_795'),
  ('coins_try_890', 'Elit+', 10530, 1050, 25.43, 890, null, 19, 'com.litxtech.muta.coins_try_890', 'com.litxtech.muta.coins_try_890'),
  ('coins_try_1000', 'Prestij', 11940, 1190, 28.57, 1000, 'VIP', 20, 'com.litxtech.muta.coins_try_1000', 'com.litxtech.muta.coins_try_1000'),
  ('coins_try_1130', 'Prestij+', 13610, 1360, 32.29, 1130, null, 21, 'com.litxtech.muta.coins_try_1130', 'com.litxtech.muta.coins_try_1130'),
  ('coins_try_1260', 'Lüks', 15300, 1530, 36, 1260, null, 22, 'com.litxtech.muta.coins_try_1260', 'com.litxtech.muta.coins_try_1260'),
  ('coins_try_1420', 'Lüks+', 17390, 1740, 40.57, 1420, null, 23, 'com.litxtech.muta.coins_try_1420', 'com.litxtech.muta.coins_try_1420'),
  ('coins_try_1590', 'Kraliyet', 19630, 1960, 45.43, 1590, null, 24, 'com.litxtech.muta.coins_try_1590', 'com.litxtech.muta.coins_try_1590'),
  ('coins_try_1790', 'En İyi', 22280, 2230, 51.14, 1790, 'EN İYİ', 25, 'com.litxtech.muta.coins_try_1790', 'com.litxtech.muta.coins_try_1790'),
  ('coins_try_2010', 'İmparator', 25230, 2520, 57.43, 2010, null, 26, 'com.litxtech.muta.coins_try_2010', 'com.litxtech.muta.coins_try_2010'),
  ('coins_try_2250', 'İmparator+', 28470, 2850, 64.29, 2250, null, 27, 'com.litxtech.muta.coins_try_2250', 'com.litxtech.muta.coins_try_2250'),
  ('coins_try_2525', 'Efsane', 32210, 3220, 72.14, 2525, null, 28, 'com.litxtech.muta.coins_try_2525', 'com.litxtech.muta.coins_try_2525'),
  ('coins_try_2825', 'Efsane+', 36320, 3630, 80.71, 2825, null, 29, 'com.litxtech.muta.coins_try_2825', 'com.litxtech.muta.coins_try_2825'),
  ('coins_try_3175', 'Mitik', 41150, 4120, 90.71, 3175, null, 30, 'com.litxtech.muta.coins_try_3175', 'com.litxtech.muta.coins_try_3175'),
  ('coins_try_3575', 'Mitik+', 46690, 7000, 102.14, 3575, null, 31, 'com.litxtech.muta.coins_try_3575', 'com.litxtech.muta.coins_try_3575'),
  ('coins_try_4000', 'Galaksi', 52650, 7900, 114.29, 4000, null, 32, 'com.litxtech.muta.coins_try_4000', 'com.litxtech.muta.coins_try_4000'),
  ('coins_try_4500', 'Galaksi+', 59690, 8950, 128.57, 4500, null, 33, 'com.litxtech.muta.coins_try_4500', 'com.litxtech.muta.coins_try_4500'),
  ('coins_try_5050', 'Evren', 67510, 10130, 144.29, 5050, null, 34, 'com.litxtech.muta.coins_try_5050', 'com.litxtech.muta.coins_try_5050'),
  ('coins_try_5675', 'Evren+', 76440, 11470, 162.14, 5675, null, 35, 'com.litxtech.muta.coins_try_5675', 'com.litxtech.muta.coins_try_5675'),
  ('coins_try_6350', 'Titans', 86180, 12930, 181.43, 6350, null, 36, 'com.litxtech.muta.coins_try_6350', 'com.litxtech.muta.coins_try_6350'),
  ('coins_try_7150', 'Titans+', 97770, 14670, 204.29, 7150, null, 37, 'com.litxtech.muta.coins_try_7150', 'com.litxtech.muta.coins_try_7150'),
  ('coins_try_8000', 'Dominus', 110200, 16530, 228.57, 8000, null, 38, 'com.litxtech.muta.coins_try_8000', 'com.litxtech.muta.coins_try_8000'),
  ('coins_try_9000', 'Dominus+', 124900, 18740, 257.14, 9000, null, 39, 'com.litxtech.muta.coins_try_9000', 'com.litxtech.muta.coins_try_9000'),
  ('coins_try_10100', 'Infinity', 141190, 21180, 288.57, 10100, null, 40, 'com.litxtech.muta.coins_try_10100', 'com.litxtech.muta.coins_try_10100'),
  ('coins_try_11350', 'Infinity+', 159830, 31970, 324.29, 11350, null, 41, 'com.litxtech.muta.coins_try_11350', 'com.litxtech.muta.coins_try_11350'),
  ('coins_try_12700', 'Ultimate', 180130, 36030, 362.86, 12700, null, 42, 'com.litxtech.muta.coins_try_12700', 'com.litxtech.muta.coins_try_12700'),
  ('coins_try_14250', 'Ultimate+', 203570, 40710, 407.14, 14250, null, 43, 'com.litxtech.muta.coins_try_14250', 'com.litxtech.muta.coins_try_14250'),
  ('coins_try_16000', 'Supreme', 230200, 46040, 457.14, 16000, null, 44, 'com.litxtech.muta.coins_try_16000', 'com.litxtech.muta.coins_try_16000'),
  ('coins_try_17950', 'Supreme+', 260090, 52020, 512.86, 17950, null, 45, 'com.litxtech.muta.coins_try_17950', 'com.litxtech.muta.coins_try_17950'),
  ('coins_try_20200', 'Celestial', 294760, 58950, 577.14, 20200, null, 46, 'com.litxtech.muta.coins_try_20200', 'com.litxtech.muta.coins_try_20200'),
  ('coins_try_22600', 'Celestial+', 332080, 66420, 645.71, 22600, null, 47, 'com.litxtech.muta.coins_try_22600', 'com.litxtech.muta.coins_try_22600'),
  ('coins_try_25400', 'Omega', 375820, 75160, 725.71, 25400, null, 48, 'com.litxtech.muta.coins_try_25400', 'com.litxtech.muta.coins_try_25400'),
  ('coins_try_28500', 'Omega+', 424590, 84920, 814.29, 28500, null, 49, 'com.litxtech.muta.coins_try_28500', 'com.litxtech.muta.coins_try_28500'),
  ('coins_try_32000', 'Max', 480000, 96000, 914.29, 32000, 'MAX', 50, 'com.litxtech.muta.coins_try_32000', 'com.litxtech.muta.coins_try_32000')
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

update public.coin_packages set is_active = false where sku not like 'coins_try_%';

insert into public.gifts (code, name, emoji, coin_cost, diamond_value, rarity, sort_order, is_active)
values
  ('rose', 'Gül', '🌹', 1, 1, 'common', 1, true),
  ('spark', 'Kıvılcım', '✨', 5, 4, 'common', 2, true),
  ('kiss', 'Öpücük', '💋', 10, 8, 'common', 3, true),
  ('heart', 'Kalp', '💖', 25, 20, 'common', 4, true),
  ('balloon', 'Balon', '🎈', 50, 40, 'common', 5, true),
  ('candy', 'Şeker', '🍬', 80, 64, 'common', 6, true),
  ('flower', 'Buket', '💐', 120, 96, 'rare', 7, true),
  ('diamond_ring', 'Yüzük', '💍', 200, 160, 'rare', 8, true),
  ('perfume', 'Parfüm', '🧴', 350, 280, 'rare', 9, true),
  ('champagne', 'Şampanya', '🍾', 500, 400, 'rare', 10, true),
  ('watch', 'Saat', '⌚', 800, 640, 'rare', 11, true),
  ('teddy', 'Ayıcık', '🧸', 1200, 960, 'epic', 12, true),
  ('sports_car', 'Spor Araba', '🏎️', 2500, 2000, 'epic', 13, true),
  ('yacht', 'Yat', '🛥️', 4500, 3600, 'epic', 14, true),
  ('castle', 'Kale', '🏰', 8000, 6400, 'epic', 15, true),
  ('jet', 'Jet', '✈️', 12000, 9600, 'epic', 16, true),
  ('crown', 'Taç', '👑', 20000, 16000, 'legendary', 17, true),
  ('rocket', 'Roket', '🚀', 35000, 28000, 'legendary', 18, true),
  ('phoenix', 'Anka', '🔥', 55000, 44000, 'legendary', 19, true),
  ('dragon', 'Ejder', '🐉', 80000, 64000, 'legendary', 20, true),
  ('universe', 'Evren', '🌌', 120000, 96000, 'legendary', 21, true),
  ('galaxy_heart', 'Galaksi Kalp', '💗', 180000, 144000, 'legendary', 22, true),
  ('golden_mic', 'Altın Mikrofon', '🎤', 250000, 200000, 'legendary', 23, true),
  ('diamond_rain', 'Elmas Yağmuru', '💎', 400000, 320000, 'legendary', 24, true)
on conflict (code) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  coin_cost = excluded.coin_cost,
  diamond_value = excluded.diamond_value,
  rarity = excluded.rarity,
  sort_order = excluded.sort_order,
  is_active = true;

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
        'id', id, 'sku', sku, 'title', title, 'coins', coins,
        'bonus_coins', bonus_coins, 'price_usd', price_usd,
        'price_try', price_try,
        'is_active', is_active, 'badge', badge
      ) order by sort_order, coalesce(price_try, price_usd))
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
