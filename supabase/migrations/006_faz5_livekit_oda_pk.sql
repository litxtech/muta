-- FAZ 5: LiveKit meta, Room Layout Engine, Lobby, Live, PK
-- Run after 001–005

-- Capacity tiers (admin managed — hard-code yok)
create table if not exists public.room_capacity_tiers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  audience_capacity int not null check (audience_capacity > 0),
  microphone_capacity int not null check (microphone_capacity between 2 and 32),
  sort_order int not null default 0,
  is_active boolean not null default true
);

insert into public.room_capacity_tiers (code, name, audience_capacity, microphone_capacity, sort_order) values
  ('mini', 'Mini', 50, 6, 1),
  ('social', 'Social', 250, 10, 2),
  ('community', 'Community', 1000, 12, 3),
  ('stage', 'Stage', 5000, 16, 4),
  ('event', 'Event', 10000, 20, 5)
on conflict (code) do nothing;

-- Room layout catalog
create table if not exists public.room_layouts (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  unlock_rule jsonb default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0
);

insert into public.room_layouts (code, name, description, sort_order) values
  ('floating_glass', 'Floating Glass', 'Cam efektli serbest yerlesim', 1),
  ('aurora_stage', 'Aurora Stage', 'Sahne odakli aurora', 2),
  ('orbit', 'Orbit', 'Yorunge mikrofon duzeni', 3),
  ('royal_lounge', 'Royal Lounge', 'VIP lounge yerlesimi', 4),
  ('cosmic', 'Cosmic', 'Uzay temali duzen', 5),
  ('minimal_stage', 'Minimal Stage', 'Sade sahne', 6)
on conflict (code) do nothing;

create table if not exists public.room_themes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  background_asset_url text,
  frame_asset_url text,
  unlock_rule jsonb default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order int default 0
);

insert into public.room_themes (code, name, sort_order) values
  ('midnight_plum', 'Midnight Plum', 1),
  ('neon_aurora', 'Neon Aurora', 2),
  ('royal_gold', 'Royal Gold', 3),
  ('cosmic_void', 'Cosmic Void', 4)
on conflict (code) do nothing;

-- Extend rooms
alter table public.rooms
  add column if not exists layout_code text default 'floating_glass',
  add column if not exists theme_code text default 'midnight_plum',
  add column if not exists capacity_tier_code text default 'social',
  add column if not exists audience_capacity int default 250,
  add column if not exists microphone_capacity int default 10,
  add column if not exists livekit_room_name text,
  add column if not exists chat_enabled boolean default true,
  add column if not exists slow_mode_seconds int default 0,
  add column if not exists category text;

-- Lobby presence (oda icine yazilmaz — ayri)
create table if not exists public.room_lobby_presence (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- Mic requests
create table if not exists public.room_mic_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (room_id, user_id, status)
);

-- Live sessions
create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  mode text not null default 'solo'
    check (mode in ('solo','multi_guest','1v1','2v2','multi_host')),
  livekit_room_name text,
  viewer_count int not null default 0,
  score bigint not null default 0,
  is_live boolean not null default true,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists live_sessions_live_idx
  on public.live_sessions (is_live, started_at desc);

-- PK (skor client belirlemez)
create table if not exists public.pk_matches (
  id uuid primary key default gen_random_uuid(),
  pk_type text not null
    check (pk_type in ('1v1','2v2','team','agency','country','city','tournament')),
  status text not null default 'scheduled'
    check (status in ('scheduled','live','finished','cancelled')),
  room_a_id uuid references public.rooms(id) on delete set null,
  room_b_id uuid references public.rooms(id) on delete set null,
  live_a_id uuid references public.live_sessions(id) on delete set null,
  live_b_id uuid references public.live_sessions(id) on delete set null,
  score_a bigint not null default 0,
  score_b bigint not null default 0,
  started_at timestamptz,
  ends_at timestamptz,
  finished_at timestamptz,
  winner_side text check (winner_side in ('a','b','draw')),
  created_at timestamptz not null default now()
);

create table if not exists public.pk_score_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.pk_matches(id) on delete cascade,
  side text not null check (side in ('a','b')),
  delta bigint not null,
  reason text not null default 'gift',
  ref_id uuid,
  created_at timestamptz not null default now()
);

-- LiveKit token audit (secret Edge Function'da)
create table if not exists public.livekit_token_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_name text not null,
  role text not null check (role in ('listener','speaker','host','publisher')),
  created_at timestamptz not null default now()
);

create or replace function public.livekit_token_istegi_kaydet(
  p_room_name text,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_live') then
    raise exception 'Live/Voice temporarily disabled';
  end if;

  insert into public.livekit_token_requests (user_id, room_name, role)
  values (v_uid, p_room_name, p_role)
  returning id into v_id;
  return v_id;
end;
$$;

-- Lobby join / leave
create or replace function public.lobiye_katil(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.rooms where id = p_room_id and is_live) then
    raise exception 'Room not available';
  end if;
  insert into public.room_lobby_presence (room_id, user_id)
  values (p_room_id, auth.uid())
  on conflict do nothing;
end;
$$;

create or replace function public.lobiden_ayril(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.room_lobby_presence
  where room_id = p_room_id and user_id = auth.uid();
end;
$$;

-- Mic request
create or replace function public.mikrofon_istegi_gonder(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_guest boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = auth.uid();
  if coalesce(v_guest, false) then raise exception 'Guest cannot request mic'; end if;

  insert into public.room_mic_requests (room_id, user_id, status)
  values (p_room_id, auth.uid(), 'pending')
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.room_mic_requests
    where room_id = p_room_id and user_id = auth.uid() and status = 'pending'
    limit 1;
  end if;
  return v_id;
end;
$$;

-- PK score (server only — gift settlement can call later)
create or replace function public.pk_skor_ekle(
  p_match_id uuid,
  p_side text,
  p_delta bigint,
  p_reason text default 'gift',
  p_ref_id uuid default null
)
returns public.pk_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.pk_matches%rowtype;
begin
  if auth.role() <> 'service_role' and auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  -- Client dogrudan yuksek delta gonderemesin diye ileride sadece service_role;
  -- FAZ 5: authenticated gift pipeline baglanana kadar host/owner RPC sinirli
  if p_delta <= 0 then raise exception 'Invalid delta'; end if;
  if public.kill_switch_aktif_mi('kill_pk') then
    raise exception 'PK temporarily disabled';
  end if;

  select * into v_match from public.pk_matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status <> 'live' then raise exception 'Match not live'; end if;

  insert into public.pk_score_events (match_id, side, delta, reason, ref_id)
  values (p_match_id, p_side, p_delta, p_reason, p_ref_id);

  if p_side = 'a' then
    update public.pk_matches set score_a = score_a + p_delta where id = p_match_id;
  else
    update public.pk_matches set score_b = score_b + p_delta where id = p_match_id;
  end if;

  select * into v_match from public.pk_matches where id = p_match_id;
  return v_match;
end;
$$;

create or replace function public.canli_yayin_baslat(
  p_title text,
  p_mode text default 'solo'
)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_row public.live_sessions%rowtype;
  v_room_name text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_live') then
    raise exception 'Live temporarily disabled';
  end if;
  if not public.ozellik_bayragi_aktif_mi('live_enabled') then
    raise exception 'Live feature disabled';
  end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot go live'; end if;

  v_room_name := 'live_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.live_sessions (host_id, title, mode, livekit_room_name, is_live)
  values (v_uid, left(trim(p_title), 80), coalesce(p_mode, 'solo'), v_room_name, true)
  returning * into v_row;

  return v_row;
end;
$$;

-- RLS
alter table public.room_capacity_tiers enable row level security;
alter table public.room_layouts enable row level security;
alter table public.room_themes enable row level security;
alter table public.room_lobby_presence enable row level security;
alter table public.room_mic_requests enable row level security;
alter table public.live_sessions enable row level security;
alter table public.pk_matches enable row level security;
alter table public.pk_score_events enable row level security;
alter table public.livekit_token_requests enable row level security;

drop policy if exists "Capacity tiers readable" on public.room_capacity_tiers;
create policy "Capacity tiers readable" on public.room_capacity_tiers
  for select to authenticated using (is_active);
drop policy if exists "Layouts readable" on public.room_layouts;
create policy "Layouts readable" on public.room_layouts
  for select to authenticated using (is_active);
drop policy if exists "Themes readable" on public.room_themes;
create policy "Themes readable" on public.room_themes
  for select to authenticated using (is_active);
drop policy if exists "Lobby presence readable" on public.room_lobby_presence;
create policy "Lobby presence readable" on public.room_lobby_presence
  for select to authenticated using (true);
drop policy if exists "Mic requests readable members" on public.room_mic_requests;
create policy "Mic requests readable members" on public.room_mic_requests
  for select to authenticated using (true);
drop policy if exists "Live sessions readable" on public.live_sessions;
create policy "Live sessions readable" on public.live_sessions
  for select to authenticated using (true);
drop policy if exists "PK matches readable" on public.pk_matches;
create policy "PK matches readable" on public.pk_matches
  for select to authenticated using (true);
drop policy if exists "PK score events readable" on public.pk_score_events;
create policy "PK score events readable" on public.pk_score_events
  for select to authenticated using (true);
drop policy if exists "Own livekit token requests" on public.livekit_token_requests;
create policy "Own livekit token requests" on public.livekit_token_requests
  for select to authenticated using (auth.uid() = user_id);

grant select on public.room_capacity_tiers to authenticated;
grant select on public.room_layouts to authenticated;
grant select on public.room_themes to authenticated;
grant select on public.room_lobby_presence to authenticated;
grant select on public.room_mic_requests to authenticated;
grant select on public.live_sessions to authenticated;
grant select on public.pk_matches to authenticated;
grant select on public.pk_score_events to authenticated;
grant select on public.livekit_token_requests to authenticated;
grant execute on function public.livekit_token_istegi_kaydet(text, text) to authenticated;
grant execute on function public.lobiye_katil(uuid) to authenticated;
grant execute on function public.lobiden_ayril(uuid) to authenticated;
grant execute on function public.mikrofon_istegi_gonder(uuid) to authenticated;
grant execute on function public.canli_yayin_baslat(text, text) to authenticated;
-- pk_skor_ekle: ileride service_role; FAZ5 test icin authenticated
grant execute on function public.pk_skor_ekle(uuid, text, bigint, text, uuid) to authenticated;
