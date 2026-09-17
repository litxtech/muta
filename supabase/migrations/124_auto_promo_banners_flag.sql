-- Otomatik promo bannerlar (oda / canlı / oyun) admin ile kapatılabilir
insert into public.feature_flags (key, enabled, description) values
  (
    'auto_promo_banners_enabled',
    true,
    'Otomatik oda, canli ve oyun tanitim bannerlari'
  )
on conflict (key) do nothing;
