-- FAZ 1: Feature flags + kill switches (remote config)
create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  updated_at timestamptz default now()
);

create table if not exists public.kill_switches (
  key text primary key,
  active boolean not null default false,
  reason text,
  updated_at timestamptz default now()
);

insert into public.feature_flags (key, enabled, description) values
  ('voice_rooms_enabled', true, 'Ses odalari'),
  ('live_enabled', false, 'Canli yayin'),
  ('video_enabled', false, 'Video'),
  ('gifts_enabled', true, 'Hediye'),
  ('pk_enabled', false, 'PK'),
  ('agency_enabled', false, 'Ajans'),
  ('withdrawals_enabled', false, 'Cekim'),
  ('city_league_enabled', false, 'Sehir ligi'),
  ('city_battles_enabled', false, 'Sehir savaslari'),
  ('city_elections_enabled', false, 'Sehir secimleri'),
  ('messages_enabled', true, 'Mesajlasma'),
  ('events_enabled', false, 'Etkinlikler')
on conflict (key) do nothing;

insert into public.kill_switches (key, active, reason) values
  ('kill_coin_purchase', false, null),
  ('kill_gift_send', false, null),
  ('kill_withdrawal', false, null),
  ('kill_agency_coin_transfer', false, null),
  ('kill_live', false, null),
  ('kill_pk', false, null)
on conflict (key) do nothing;

alter table public.feature_flags enable row level security;
alter table public.kill_switches enable row level security;

create policy "Feature flags readable by authenticated"
  on public.feature_flags for select to authenticated using (true);

create policy "Kill switches readable by authenticated"
  on public.kill_switches for select to authenticated using (true);

-- Yazma sadece service_role / admin (policy yok = authenticated yazamaz)
