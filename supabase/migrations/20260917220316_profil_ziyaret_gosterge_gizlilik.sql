-- Profil ziyaretinde gizlenebilir göstergeler + başkalarının hide bayraklarını okuma

alter table public.user_privacy_settings
  add column if not exists hide_level boolean not null default false,
  add column if not exists hide_topup_coin boolean not null default false,
  add column if not exists hide_prestige boolean not null default false;

comment on column public.user_privacy_settings.hide_level is 'Profil ziyaretinde seviye / XP gizle';
comment on column public.user_privacy_settings.hide_topup_coin is 'Profil ziyaretinde yüklenen coin gizle';
comment on column public.user_privacy_settings.hide_prestige is 'Profil ziyaretinde ünvan / VIP rozetlerini gizle';

-- Ziyaretçiler hide bayraklarını okuyabilsin (yalnızca select)
drop policy if exists "Privacy settings readable" on public.user_privacy_settings;
create policy "Privacy settings readable"
  on public.user_privacy_settings for select to authenticated
  using (true);
