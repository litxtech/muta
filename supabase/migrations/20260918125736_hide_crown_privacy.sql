-- Seviye tacı gizleme (profil / oda avatar çerçevesi)
alter table public.user_privacy_settings
  add column if not exists hide_crown boolean not null default false;

comment on column public.user_privacy_settings.hide_crown is
  'Avatar seviye taç çerçevesini gizle';
