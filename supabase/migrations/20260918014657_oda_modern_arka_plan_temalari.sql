-- Modern oda arka plan temaları (client OdaTemaKatalogu ile uyumlu)

insert into public.room_themes (code, name, sort_order) values
  ('midnight_plum', 'Gece eriği', 1),
  ('neon_aurora', 'Neon aurora', 2),
  ('royal_gold', 'Kraliyet', 3),
  ('cosmic_void', 'Kozmik', 4),
  ('arctic_mist', 'Arktik', 5),
  ('cherry_noir', 'Kiraz noir', 6),
  ('emerald_haze', 'Zümrüt', 7),
  ('sunset_pulse', 'Gün batımı', 8),
  ('electric_lilac', 'Elektrik', 9),
  ('ocean_depth', 'Okyanus', 10),
  ('velvet_rose', 'Kadife gül', 11),
  ('cyber_mint', 'Siber mint', 12)
on conflict (code) do update
  set name = excluded.name,
      sort_order = excluded.sort_order,
      is_active = true;
