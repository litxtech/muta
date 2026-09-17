-- 084: Şehir modern platform — duyuru, görev, katkı, yükselenler, savaş, sezon ödülü

create table if not exists public.city_announcements (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.geo_cities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists city_announcements_city_idx
  on public.city_announcements (city_id, created_at desc);

create table if not exists public.city_missions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  description text not null,
  goal_type text not null check (goal_type in ('gift_coins', 'support', 'battle_gift')),
  goal_target bigint not null default 100,
  reward_coins bigint not null default 0,
  reward_label text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.city_mission_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_id uuid not null references public.city_missions(id) on delete cascade,
  week_code text not null,
  progress bigint not null default 0,
  completed_at timestamptz,
  claimed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, mission_id, week_code)
);

create table if not exists public.city_user_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  city_id uuid not null references public.geo_cities(id) on delete cascade,
  day date not null,
  gift_coins bigint not null default 0,
  gift_count int not null default 0,
  last_delta bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, city_id, day)
);

create table if not exists public.city_season_rewards (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.city_league_seasons(id) on delete cascade,
  city_id uuid not null references public.geo_cities(id) on delete cascade,
  rank int not null,
  reward_coins bigint not null default 0,
  distributed_at timestamptz,
  unique (season_id, city_id)
);

alter table public.profiles
  add column if not exists primary_city_id uuid references public.geo_cities(id) on delete set null;

create index if not exists profiles_primary_city_idx on public.profiles (primary_city_id);

insert into public.city_missions (code, title, description, goal_type, goal_target, reward_coins, reward_label, sort_order)
values
  ('week_gift_500', 'Şehrine 500 güç', 'Bu hafta ana şehrine 500 coin hediye ile güç kat', 'gift_coins', 500, 50, '+50 coin', 1),
  ('week_gift_2000', 'Şehir şampiyonu', 'Bu hafta 2000 güç kat — ligde fark yarat', 'gift_coins', 2000, 200, '+200 coin', 2),
  ('week_support', 'Aidiyet', 'Bir şehri ana şehir olarak destekle', 'support', 1, 20, '+20 coin', 3)
on conflict (code) do nothing;

alter table public.city_announcements enable row level security;
alter table public.city_missions enable row level security;
alter table public.city_mission_progress enable row level security;
alter table public.city_user_daily enable row level security;
alter table public.city_season_rewards enable row level security;

drop policy if exists "city_announcements_read" on public.city_announcements;
create policy "city_announcements_read" on public.city_announcements
  for select to authenticated using (true);

drop policy if exists "city_missions_read" on public.city_missions;
create policy "city_missions_read" on public.city_missions
  for select to authenticated using (is_active);

drop policy if exists "city_mission_progress_own" on public.city_mission_progress;
create policy "city_mission_progress_own" on public.city_mission_progress
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "city_user_daily_own" on public.city_user_daily;
create policy "city_user_daily_own" on public.city_user_daily
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "city_season_rewards_read" on public.city_season_rewards;
create policy "city_season_rewards_read" on public.city_season_rewards
  for select to authenticated using (true);

grant select on public.city_announcements to authenticated;
grant select on public.city_missions to authenticated;
grant select on public.city_mission_progress to authenticated;
grant select on public.city_user_daily to authenticated;
grant select on public.city_season_rewards to authenticated;

create or replace function public.sehir_hafta_kodu()
returns text language sql stable as $$
  select to_char(now() at time zone 'Europe/Istanbul', 'IYYY-"W"IW');
$$;

create or replace function public.sehir_lider_mi(p_city_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.city_roles
    where city_id = p_city_id and user_id = p_user_id and is_active
      and role in ('leader', 'vice_leader')
  );
$$;
