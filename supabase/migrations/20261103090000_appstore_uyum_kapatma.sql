-- Tamuso — App Store uyum temizliği (erişim kapatma, veri silme YOK).
--
-- Amaç:
--   1) Meyve Çarkı dışındaki oyunların sunucu uçlarını kapatmak.
--   2) Oyun Stüdyosu (creator_studio_*) arka ucunu kapatmak.
--   3) Uzaktan oyun etkinleştirme (admin_oyun_gorunurluk_ayarla / oyun_bayrak_anahtari)
--      yüzeyini kapatmak.
--   4) Oyun sonucu belirleme (fruit_wheel_admin_force_next, game_cikis_*,
--      game_admin_math_*) yüzeyini kapatmak.
--
-- Veri politikası:
--   - Hiçbir tablo DROP edilmez, hiçbir satır DELETE edilmez.
--   - Kullanıcı bakiyeleri, ledger, ödeme ve moderasyon kayıtları korunur.
--   - Yalnızca anon/authenticated yetkileri kaldırılır; service_role erişimi korunur.
--   - Eski oyun tabloları arşiv olarak işaretlenir (comment), okunabilir kalır.

begin;

-- ---------------------------------------------------------------
-- 1) Meyve Çarkı dışındaki oyun bayraklarını kapat
-- ---------------------------------------------------------------
update public.feature_flags
set enabled = false,
    updated_at = now()
where key in (
  'storm_king_enabled',
  'zeus_enabled',
  'nox_reels_enabled',
  'kozmik_kaskad_enabled',
  'fair_spin_enabled',
  'astral_falls_enabled',
  'sis_spin_enabled',
  'dede_enabled',
  'slot_enabled'
);

-- Oyun listesinde yalnızca Meyve Çarkı kalır.
update public.game_control_configs
set is_enabled = false,
    mode = 'MAINTENANCE',
    updated_at = now()
where game_code <> 'fruit_wheel';

-- Oyun Stüdyosu kapalı.
update public.feature_flags
set enabled = false,
    updated_at = now()
where key in (
  'studio_enabled',
  'studio_menu_visible',
  'new_game_creation_enabled',
  'ai_generation_enabled',
  'meshy_enabled',
  'elevenlabs_enabled',
  'playcanvas_enabled',
  'creator_rewards_enabled',
  'game_upload_enabled',
  'remote_game_load_enabled'
);

-- ---------------------------------------------------------------
-- 2) Oyun sonucu belirleme ve uzaktan etkinleştirme fonksiyonlarını kapat
-- ---------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as imza
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proname in (
          'admin_oyun_gorunurluk_ayarla',
          'oyun_bayrak_anahtari',
          'fruit_wheel_admin_force_next',
          'fruit_wheel_admin_publish_fruits',
          'fruit_wheel_admin_save_policy',
          'game_admin_math_activate',
          'game_admin_settings_update',
          'game_admin_schedule_create',
          'game_admin_schedule_cancel'
        )
        or p.proname ~ '^game_cikis_'
      )
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      r.imza
    );
  end loop;
end $$;

-- ---------------------------------------------------------------
-- 3) Kaldırılan oyunların sunucu fonksiyonlarını kapat
--    (Meyve Çarkı'na ait fruit_wheel_* fonksiyonları KORUNUR.)
-- ---------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as imza
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname ~ '^(zeus|nox|nox_reels|kaskad|kozmik_kaskad|storm_king|fair_spin|astral_falls|sis_spin|dede|slot)_'
      and p.proname not like 'fruit_wheel%'
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      r.imza
    );
  end loop;
end $$;

-- ---------------------------------------------------------------
-- 4) Oyun Stüdyosu arka ucunu kapat
-- ---------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as imza
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname ~ '^creator_studio_'
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      r.imza
    );
  end loop;

  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename ~ '^(creator_studio_|studio_)'
  loop
    execute format(
      'revoke all on table public.%I from public, anon, authenticated',
      r.tablename
    );
    execute format(
      'comment on table public.%I is %L',
      r.tablename,
      'ARSIV: Oyun Stüdyosu kaldırıldı (2026-11-03). Veri silinmedi; yalnızca erişim kapatıldı.'
    );
  end loop;
end $$;

-- ---------------------------------------------------------------
-- 5) Kaldırılan oyun tablolarını arşiv olarak işaretle
-- ---------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename ~ '^(zeus|nox|nox_reels|kaskad|kozmik_kaskad|storm_king|fair_spin|astral_falls|sis_spin|dede|slot)_'
      and tablename not like 'fruit_wheel%'
  loop
    execute format(
      'revoke all on table public.%I from public, anon, authenticated',
      r.tablename
    );
    execute format(
      'comment on table public.%I is %L',
      r.tablename,
      'ARSIV: Oyun kaldırıldı (2026-11-03). Finansal/geçmiş kayıtlar korunur; yeni yazma kapalı.'
    );
  end loop;
end $$;

commit;

-- Geri alma (rollback) notu:
--   Bu migration veri silmez. Gerekirse yetkiler `grant` ile geri verilebilir.
--   Oyun Stüdyosu'nun yeniden açılması bilinçli bir ürün kararı olmalıdır;
--   aksi hâlde App Store 2.5.19 / 4.2.6 riski geri gelir.
