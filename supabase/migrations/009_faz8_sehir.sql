-- FAZ 8: Sehir platformu — geo, resmi odalar, lig, savas, secim
-- Run after 001–008

-- ---------------------------------------------------------------------------
-- Geo (admin managed — uygulama hard-code ulke/sehir listesi tutmaz)
-- ---------------------------------------------------------------------------
create table if not exists public.geo_countries (
  code text primary key,
  name text not null,
  is_active boolean not null default true
);

create table if not exists public.geo_regions (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.geo_countries(code),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  unique (country_code, code)
);

create table if not exists public.geo_cities (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.geo_countries(code),
  region_id uuid references public.geo_regions(id) on delete set null,
  name text not null,
  slug text unique not null,
  timezone text,
  is_active boolean not null default true,
  supporter_count int not null default 0,
  power_score bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists geo_cities_country_idx on public.geo_cities (country_code, power_score desc);

insert into public.geo_countries (code, name) values
  ('TR','Turkey'),('DE','Germany'),('US','United States'),('GB','United Kingdom')
on conflict (code) do nothing;

insert into public.geo_cities (country_code, name, slug, timezone) values
  ('TR','Istanbul','istanbul','Europe/Istanbul'),
  ('TR','Ankara','ankara','Europe/Istanbul'),
  ('TR','Izmir','izmir','Europe/Istanbul'),
  ('DE','Berlin','berlin','Europe/Berlin'),
  ('US','New York','new-york','America/New_York'),
  ('GB','London','london','Europe/London')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Official city rooms + support
-- ---------------------------------------------------------------------------
create table if not exists public.official_city_rooms (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.geo_cities(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  title text not null,
  is_official boolean not null default true,
  is_live boolean not null default false,
  listener_count int not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (city_id, title)
);

create table if not exists public.user_supported_cities (
  user_id uuid not null references public.profiles(id) on delete cascade,
  city_id uuid not null references public.geo_cities(id) on delete cascade,
  is_primary boolean not null default false,
  supported_at timestamptz not null default now(),
  primary key (user_id, city_id)
);

create index if not exists user_supported_cities_city_idx
  on public.user_supported_cities (city_id);

-- Roles: leader / vice_leader
create table if not exists public.city_roles (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.geo_cities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('leader','vice_leader')),
  term_start timestamptz not null default now(),
  term_end timestamptz,
  is_active boolean not null default true
);

-- One active leader / vice per city
create unique index if not exists city_roles_active_unique
  on public.city_roles (city_id, role)
  where is_active;

-- ---------------------------------------------------------------------------
-- League
-- ---------------------------------------------------------------------------
create table if not exists public.city_league_seasons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','active','ended')),
  created_at timestamptz not null default now()
);

create table if not exists public.city_league_standings (
  season_id uuid not null references public.city_league_seasons(id) on delete cascade,
  city_id uuid not null references public.geo_cities(id) on delete cascade,
  points bigint not null default 0,
  gifts_score bigint not null default 0,
  battle_wins int not null default 0,
  rank int,
  updated_at timestamptz not null default now(),
  primary key (season_id, city_id)
);

create table if not exists public.city_power_events (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.geo_cities(id) on delete cascade,
  season_id uuid references public.city_league_seasons(id) on delete set null,
  event_type text not null
    check (event_type in ('gift','battle','election','support','manual')),
  delta bigint not null,
  balance_after bigint not null,
  ref_type text,
  ref_id uuid,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Battles
-- ---------------------------------------------------------------------------
create table if not exists public.city_battles (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.city_league_seasons(id) on delete set null,
  city_a_id uuid not null references public.geo_cities(id),
  city_b_id uuid not null references public.geo_cities(id),
  score_a bigint not null default 0,
  score_b bigint not null default 0,
  status text not null default 'scheduled'
    check (status in ('scheduled','live','finished','cancelled')),
  winner_city_id uuid references public.geo_cities(id),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (city_a_id <> city_b_id)
);

-- ---------------------------------------------------------------------------
-- Elections
-- ---------------------------------------------------------------------------
create table if not exists public.city_elections (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.geo_cities(id) on delete cascade,
  title text not null,
  role_target text not null default 'leader'
    check (role_target in ('leader','vice_leader')),
  status text not null default 'nominating'
    check (status in ('nominating','voting','tallied','cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.city_candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.city_elections(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  manifesto text,
  vote_count int not null default 0,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  unique (election_id, user_id)
);

create table if not exists public.city_votes (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.city_elections(id) on delete cascade,
  candidate_id uuid not null references public.city_candidates(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (election_id, user_id)
);

-- Seed active league season (dev)
insert into public.city_league_seasons (code, title, starts_at, ends_at, status)
values (
  '2026-W37',
  'City League Week 37',
  date_trunc('week', now()),
  date_trunc('week', now()) + interval '7 days',
  'active'
)
on conflict (code) do nothing;

insert into public.city_league_standings (season_id, city_id, points, gifts_score, rank)
select s.id, c.id, 0, 0, row_number() over (order by c.name)
from public.city_league_seasons s
cross join public.geo_cities c
where s.code = '2026-W37'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.sehir_destekle(p_city_id uuid, p_is_primary boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ozellik_bayragi_aktif_mi('city_league_enabled') then
    raise exception 'City feature disabled';
  end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot support city'; end if;
  if not exists (select 1 from public.geo_cities where id = p_city_id and is_active) then
    raise exception 'City not found';
  end if;

  if p_is_primary then
    update public.user_supported_cities set is_primary = false where user_id = v_uid;
  end if;

  insert into public.user_supported_cities (user_id, city_id, is_primary)
  values (v_uid, p_city_id, coalesce(p_is_primary, false))
  on conflict (user_id, city_id) do update
    set is_primary = excluded.is_primary;

  update public.geo_cities
  set supporter_count = (
    select count(*)::int from public.user_supported_cities where city_id = p_city_id
  )
  where id = p_city_id;

  insert into public.city_power_events (city_id, event_type, delta, balance_after, ref_type)
  select p_city_id, 'support', 1, power_score + 1, 'support'
  from public.geo_cities where id = p_city_id;

  update public.geo_cities set power_score = power_score + 1 where id = p_city_id;
end;
$$;

create or replace function public.sehir_aday_basvurusu(
  p_election_id uuid,
  p_manifesto text default null
)
returns public.city_candidates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_el public.city_elections%rowtype;
  v_row public.city_candidates%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ozellik_bayragi_aktif_mi('city_elections_enabled') then
    raise exception 'Elections disabled';
  end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot run'; end if;

  select * into v_el from public.city_elections where id = p_election_id for update;
  if not found then raise exception 'Election not found'; end if;
  if v_el.status <> 'nominating' then raise exception 'Not accepting candidates'; end if;

  insert into public.city_candidates (election_id, user_id, manifesto, status)
  values (p_election_id, v_uid, p_manifesto, 'approved')
  on conflict (election_id, user_id) do update
    set manifesto = excluded.manifesto
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.sehir_oyu_kullan(
  p_election_id uuid,
  p_candidate_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_el public.city_elections%rowtype;
  v_cand public.city_candidates%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ozellik_bayragi_aktif_mi('city_elections_enabled') then
    raise exception 'Elections disabled';
  end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot vote'; end if;

  select * into v_el from public.city_elections where id = p_election_id for update;
  if not found then raise exception 'Election not found'; end if;
  if v_el.status <> 'voting' then raise exception 'Voting closed'; end if;
  if now() < v_el.starts_at or now() > v_el.ends_at then
    raise exception 'Outside voting window';
  end if;

  select * into v_cand from public.city_candidates
  where id = p_candidate_id and election_id = p_election_id;
  if not found or v_cand.status <> 'approved' then
    raise exception 'Invalid candidate';
  end if;

  insert into public.city_votes (election_id, candidate_id, user_id)
  values (p_election_id, p_candidate_id, v_uid);

  update public.city_candidates
  set vote_count = vote_count + 1
  where id = p_candidate_id;
exception
  when unique_violation then
    raise exception 'Already voted in this election';
end;
$$;

-- Dev helper: open nominating election for a city
create or replace function public.sehir_secim_olustur_dev(
  p_city_id uuid,
  p_title text default 'City Leader Election',
  p_role text default 'leader'
)
returns public.city_elections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.city_elections%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  insert into public.city_elections (
    city_id, title, role_target, status, starts_at, ends_at
  ) values (
    p_city_id,
    coalesce(nullif(trim(p_title), ''), 'City Leader Election'),
    coalesce(p_role, 'leader'),
    'nominating',
    now(),
    now() + interval '7 days'
  ) returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.sehir_secimi_oylamaya_ac_dev(p_election_id uuid)
returns public.city_elections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.city_elections%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.city_elections
  set status = 'voting'
  where id = p_election_id and status = 'nominating'
  returning * into v_row;
  if not found then raise exception 'Cannot open voting'; end if;
  return v_row;
end;
$$;

-- Battle score bump (gift/power later); authenticated for FAZ8 sandbox
create or replace function public.sehir_savas_skor_ekle(
  p_battle_id uuid,
  p_city_id uuid,
  p_delta bigint
)
returns public.city_battles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.city_battles%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ozellik_bayragi_aktif_mi('city_battles_enabled') then
    raise exception 'Battles disabled';
  end if;
  if p_delta is null or p_delta <= 0 then raise exception 'Invalid delta'; end if;

  select * into v_row from public.city_battles where id = p_battle_id for update;
  if not found then raise exception 'Battle not found'; end if;
  if v_row.status <> 'live' then raise exception 'Battle not live'; end if;

  if p_city_id = v_row.city_a_id then
    update public.city_battles set score_a = score_a + p_delta where id = p_battle_id
    returning * into v_row;
  elsif p_city_id = v_row.city_b_id then
    update public.city_battles set score_b = score_b + p_delta where id = p_battle_id
    returning * into v_row;
  else
    raise exception 'City not in battle';
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.geo_countries enable row level security;
alter table public.geo_regions enable row level security;
alter table public.geo_cities enable row level security;
alter table public.official_city_rooms enable row level security;
alter table public.user_supported_cities enable row level security;
alter table public.city_roles enable row level security;
alter table public.city_league_seasons enable row level security;
alter table public.city_league_standings enable row level security;
alter table public.city_power_events enable row level security;
alter table public.city_battles enable row level security;
alter table public.city_elections enable row level security;
alter table public.city_candidates enable row level security;
alter table public.city_votes enable row level security;

drop policy if exists "Geo countries readable" on public.geo_countries;
create policy "Geo countries readable" on public.geo_countries for select to authenticated using (is_active);
drop policy if exists "Geo regions readable" on public.geo_regions;
create policy "Geo regions readable" on public.geo_regions for select to authenticated using (is_active);
drop policy if exists "Geo cities readable" on public.geo_cities;
create policy "Geo cities readable" on public.geo_cities for select to authenticated using (is_active);
drop policy if exists "Official city rooms readable" on public.official_city_rooms;
create policy "Official city rooms readable" on public.official_city_rooms for select to authenticated using (true);
drop policy if exists "Own supported cities" on public.user_supported_cities;
create policy "Own supported cities" on public.user_supported_cities for select to authenticated using (auth.uid() = user_id);
drop policy if exists "City roles readable" on public.city_roles;
create policy "City roles readable" on public.city_roles for select to authenticated using (true);
drop policy if exists "League seasons readable" on public.city_league_seasons;
create policy "League seasons readable" on public.city_league_seasons for select to authenticated using (true);
drop policy if exists "League standings readable" on public.city_league_standings;
create policy "League standings readable" on public.city_league_standings for select to authenticated using (true);
drop policy if exists "Power events readable" on public.city_power_events;
create policy "Power events readable" on public.city_power_events for select to authenticated using (true);
drop policy if exists "Battles readable" on public.city_battles;
create policy "Battles readable" on public.city_battles for select to authenticated using (true);
drop policy if exists "Elections readable" on public.city_elections;
create policy "Elections readable" on public.city_elections for select to authenticated using (true);
drop policy if exists "Candidates readable" on public.city_candidates;
create policy "Candidates readable" on public.city_candidates for select to authenticated using (true);
drop policy if exists "Own votes readable" on public.city_votes;
create policy "Own votes readable" on public.city_votes for select to authenticated using (auth.uid() = user_id);

grant select on public.geo_countries to authenticated;
grant select on public.geo_regions to authenticated;
grant select on public.geo_cities to authenticated;
grant select on public.official_city_rooms to authenticated;
grant select on public.user_supported_cities to authenticated;
grant select on public.city_roles to authenticated;
grant select on public.city_league_seasons to authenticated;
grant select on public.city_league_standings to authenticated;
grant select on public.city_power_events to authenticated;
grant select on public.city_battles to authenticated;
grant select on public.city_elections to authenticated;
grant select on public.city_candidates to authenticated;
grant select on public.city_votes to authenticated;

grant execute on function public.sehir_destekle(uuid, boolean) to authenticated;
grant execute on function public.sehir_aday_basvurusu(uuid, text) to authenticated;
grant execute on function public.sehir_oyu_kullan(uuid, uuid) to authenticated;
grant execute on function public.sehir_secim_olustur_dev(uuid, text, text) to authenticated;
grant execute on function public.sehir_secimi_oylamaya_ac_dev(uuid) to authenticated;
grant execute on function public.sehir_savas_skor_ekle(uuid, uuid, bigint) to authenticated;
