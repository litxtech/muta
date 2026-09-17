-- Tamuso Match (match3 / Kristal Savaşı) kaldırıldı: katalog ve bayrak kapatılır.

update public.game_catalog
set
  is_active = false,
  name = case
    when name like '%(kaldırıldı)%' then name
    else name || ' (kaldırıldı)'
  end,
  description = 'Kaldırıldı — istemci artık sunmaz'
where game_code = 'match3';

update public.game_control_configs
set
  is_enabled = false,
  mode = 'MAINTENANCE',
  updated_at = now()
where game_code = 'match3';

update public.feature_flags
set
  enabled = false
where key = 'match3_enabled';

-- Aktif match3 oturumlarını bitir (istemci artık oynamıyor).
update public.game_sessions
set
  status = 'finished',
  finished_at = coalesce(finished_at, now())
where game_code = 'match3'
  and status in ('waiting', 'countdown', 'playing');
