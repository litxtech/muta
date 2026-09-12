-- Seed gifts + coin packages
insert into public.coin_packages (sku, title, coins, bonus_coins, price_usd, badge, sort_order) values
  ('coins_60', 'Starter', 60, 0, 0.99, null, 1),
  ('coins_300', 'Popular', 300, 30, 4.99, 'HOT', 2),
  ('coins_680', 'Party', 680, 80, 9.99, null, 3),
  ('coins_1280', 'VIP', 1280, 220, 19.99, 'BEST', 4),
  ('coins_3280', 'Whale', 3280, 720, 49.99, null, 5),
  ('coins_6480', 'Legend', 6480, 1600, 99.99, 'MAX', 6)
on conflict (sku) do nothing;

insert into public.gifts (code, name, emoji, coin_cost, diamond_value, rarity, sort_order) values
  ('rose', 'Gül', '🌹', 1, 1, 'common', 1),
  ('kiss', 'Öpücük', '💋', 5, 4, 'common', 2),
  ('heart', 'Kalp', '💖', 10, 8, 'common', 3),
  ('diamond_ring', 'Yüzük', '💍', 50, 40, 'rare', 4),
  ('champagne', 'Şampanya', '🍾', 99, 80, 'rare', 5),
  ('sports_car', 'Spor Araba', '🏎️', 299, 240, 'epic', 6),
  ('castle', 'Kale', '🏰', 999, 800, 'epic', 7),
  ('crown', 'Taç', '👑', 1999, 1600, 'legendary', 8),
  ('rocket', 'Roket', '🚀', 4999, 4000, 'legendary', 9),
  ('universe', 'Evren', '🌌', 9999, 8500, 'legendary', 10)
on conflict (code) do nothing;
