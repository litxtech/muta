-- Hesap görünürlüğü ekstra anahtarlar

alter table public.user_privacy_settings
  add column if not exists hide_online_status boolean not null default false,
  add column if not exists hide_followers boolean not null default false,
  add column if not exists hide_following boolean not null default false,
  add column if not exists hide_status_posts boolean not null default false,
  add column if not exists hide_game_stats boolean not null default false;

comment on column public.user_privacy_settings.hide_online_status is
  'Çevrimiçi / aktif durumunu başkalarından gizle';
comment on column public.user_privacy_settings.hide_followers is
  'Takipçi sayısını ve listesini gizle';
comment on column public.user_privacy_settings.hide_following is
  'Takip edilen sayısını ve listesini gizle';
comment on column public.user_privacy_settings.hide_status_posts is
  'Durum / gönderi ızgarasını profil ziyaretinde gizle';
comment on column public.user_privacy_settings.hide_game_stats is
  'Oyun kupa / galibiyet istatistiğini gizle';
