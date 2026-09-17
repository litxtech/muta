-- ZEUS — katalog + kontrol + özellik bayrağı
-- Oynanabilir önizleme; coin settle sonraki adım (coin_rewards_enabled = false)

insert into public.feature_flags (key, enabled, description) values
  ('zeus_enabled', true, 'ZEUS Olympus cascade oyunu')
on conflict (key) do nothing;

insert into public.game_catalog (
  game_code, name, description, min_players, max_players, default_duration_seconds, is_active
) values (
  'zeus',
  'ZEUS',
  '6x5 Olympus cascade — pay anywhere, carpan, 4 Zeus = 15 ucretsiz tur',
  1,
  1,
  0,
  true
)
on conflict (game_code) do nothing;

insert into public.game_control_configs (
  game_code, is_enabled, mode, min_entry, max_entry, coin_rewards_enabled, min_players, max_players
) values (
  'zeus', true, 'NORMAL', 20, 50000, false, 1, 1
)
on conflict (game_code) do nothing;
