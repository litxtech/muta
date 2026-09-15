-- Tamuso Games platform: katalog, oturum, skor, ekonomi kontrol, istatistik, RLS, RPC
-- Coin stake → coin ödül: şeffaf admin politikası + ledger; gizli kullanıcı bazlı sonuç yok.

-- ---------------------------------------------------------------------------
-- Feature flags / kill switches
-- ---------------------------------------------------------------------------
insert into public.feature_flags (key, enabled, description) values
  ('games_enabled', true, 'Tamuso Games platformu'),
  ('match3_enabled', true, 'Kristal Savasi / Match-3')
on conflict (key) do nothing;

insert into public.kill_switches (key, active, reason) values
  ('kill_games', false, null),
  ('kill_game_coin', false, null)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table if not exists public.game_catalog (
  id uuid primary key default gen_random_uuid(),
  game_code text unique not null,
  name text not null,
  description text,
  min_players integer not null default 2,
  max_players integer not null default 8,
  default_duration_seconds integer not null default 90,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.game_catalog (game_code, name, description)
values ('match3', 'Kristal Savaşı', 'Tamuso Match-3 sesli oda oyunu')
on conflict (game_code) do nothing;

-- ---------------------------------------------------------------------------
-- Game Control Engine
-- ---------------------------------------------------------------------------
create table if not exists public.game_control_configs (
  id uuid primary key default gen_random_uuid(),
  game_code text not null unique references public.game_catalog(game_code),
  is_enabled boolean not null default true,
  mode text not null default 'NORMAL'
    check (mode in ('NORMAL','PROMOTION','LOW_REWARD','NO_REWARD','MAINTENANCE')),
  min_entry bigint not null default 0,
  max_entry bigint not null default 0,
  reward_multiplier numeric(8,4) not null default 1,
  xp_multiplier numeric(8,4) not null default 1,
  trophy_multiplier numeric(8,4) not null default 1,
  reward_factor numeric(8,4) not null default 1,
  new_player_games integer not null default 10,
  new_player_max_entry bigint not null default 500,
  daily_reward_cap bigint not null default 0,
  player_daily_reward_cap bigint not null default 0,
  min_players integer not null default 2,
  max_players integer not null default 8,
  default_duration_seconds integer not null default 90,
  coin_rewards_enabled boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.game_control_configs (game_code, is_enabled, mode, coin_rewards_enabled)
values ('match3', true, 'NORMAL', false)
on conflict (game_code) do nothing;

create table if not exists public.game_control_overrides (
  id uuid primary key default gen_random_uuid(),
  game_code text not null references public.game_catalog(game_code),
  mode text check (mode is null or mode in ('NORMAL','PROMOTION','LOW_REWARD','NO_REWARD','MAINTENANCE')),
  reward_multiplier numeric(8,4),
  xp_multiplier numeric(8,4),
  trophy_multiplier numeric(8,4),
  reward_factor numeric(8,4),
  min_entry bigint,
  max_entry bigint,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists game_control_overrides_active_idx
  on public.game_control_overrides (game_code, starts_at, ends_at);

create table if not exists public.game_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id),
  game_code text,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sessions / players / scores / moves
-- ---------------------------------------------------------------------------
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  game_code text not null references public.game_catalog(game_code),
  room_id uuid not null references public.rooms(id) on delete cascade,
  host_user_id uuid not null references public.profiles(id),
  seed bigint not null,
  status text not null default 'waiting'
    check (status in ('waiting','countdown','playing','finished','cancelled')),
  max_players integer not null default 8,
  duration_seconds integer not null default 90,
  entry_amount bigint not null default 0,
  game_version text not null default 'match3-v1.0.0',
  config_snapshot jsonb,
  started_at timestamptz,
  ends_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists game_sessions_room_status_idx
  on public.game_sessions (room_id, status, created_at desc);

create table if not exists public.game_session_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  status text not null default 'joined'
    check (status in ('joined','ready','playing','finished','disconnected','dnf','left')),
  entry_amount bigint not null default 0,
  joined_at timestamptz not null default now(),
  finished_at timestamptz,
  disconnected_at timestamptz,
  final_rank integer,
  xp_earned integer not null default 0,
  trophy_change integer not null default 0,
  coin_reward bigint not null default 0,
  is_suspicious boolean not null default false,
  unique (session_id, user_id)
);

create index if not exists game_session_players_user_idx
  on public.game_session_players (user_id, joined_at desc);

create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  score bigint not null default 0,
  move_count integer not null default 0,
  highest_combo integer not null default 0,
  special_tiles_used integer not null default 0,
  board_hash text,
  updated_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create table if not exists public.game_moves (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  move_number integer not null,
  from_row integer not null,
  from_col integer not null,
  to_row integer not null,
  to_col integer not null,
  score_after bigint,
  board_hash text,
  created_at timestamptz not null default now()
);

create index if not exists game_moves_session_idx
  on public.game_moves (session_id, user_id, move_number);

create table if not exists public.game_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id uuid references public.profiles(id),
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.game_player_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  total_games bigint not null default 0,
  wins bigint not null default 0,
  second_places bigint not null default 0,
  third_places bigint not null default 0,
  total_score bigint not null default 0,
  highest_score bigint not null default 0,
  highest_combo integer not null default 0,
  xp bigint not null default 0,
  trophies bigint not null default 0,
  level integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.game_weekly_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  games integer not null default 0,
  wins integer not null default 0,
  trophies bigint not null default 0,
  total_score bigint not null default 0,
  unique (user_id, week_start)
);

create table if not exists public.game_achievements (
  id uuid primary key default gen_random_uuid(),
  achievement_code text unique not null,
  title text not null,
  description text,
  icon text,
  xp_reward integer not null default 0
);

insert into public.game_achievements (achievement_code, title, description, xp_reward) values
  ('first_win', 'İlk Zafer', 'İlk maç galibiyeti', 50),
  ('wins_10', '10 Galibiyet', '10 maç kazan', 100),
  ('wins_100', '100 Galibiyet', '100 maç kazan', 500),
  ('combo_10', 'x10 Combo', 'Tek maçta x10 combo', 40),
  ('combo_20', 'x20 Combo', 'Tek maçta x20 combo', 120),
  ('score_50k', '50.000 Skor', 'Tek maçta 50.000 puan', 80),
  ('games_100', '100 Oyun', '100 maç oyna', 100),
  ('games_500', '500 Oyun', '500 maç oyna', 300)
on conflict (achievement_code) do nothing;

create table if not exists public.game_player_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.game_achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (user_id, achievement_id)
);

create table if not exists public.game_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  session_id uuid references public.game_sessions(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.game_catalog enable row level security;
alter table public.game_control_configs enable row level security;
alter table public.game_control_overrides enable row level security;
alter table public.game_admin_audit_logs enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_session_players enable row level security;
alter table public.game_scores enable row level security;
alter table public.game_moves enable row level security;
alter table public.game_events enable row level security;
alter table public.game_player_stats enable row level security;
alter table public.game_weekly_stats enable row level security;
alter table public.game_achievements enable row level security;
alter table public.game_player_achievements enable row level security;
alter table public.game_security_events enable row level security;

drop policy if exists "game_catalog_read" on public.game_catalog;
create policy "game_catalog_read" on public.game_catalog
  for select to authenticated using (true);

drop policy if exists "game_control_configs_read" on public.game_control_configs;
create policy "game_control_configs_read" on public.game_control_configs
  for select to authenticated using (true);

drop policy if exists "game_control_overrides_read" on public.game_control_overrides;
create policy "game_control_overrides_read" on public.game_control_overrides
  for select to authenticated using (true);

drop policy if exists "game_sessions_read_room" on public.game_sessions;
create policy "game_sessions_read_room" on public.game_sessions
  for select to authenticated using (
    exists (
      select 1 from public.room_members rm
      where rm.room_id = game_sessions.room_id and rm.user_id = auth.uid()
    )
    or host_user_id = auth.uid()
    or public.ben_admin_miyim()
  );

drop policy if exists "game_session_players_read" on public.game_session_players;
create policy "game_session_players_read" on public.game_session_players
  for select to authenticated using (
    exists (
      select 1 from public.game_sessions gs
      join public.room_members rm on rm.room_id = gs.room_id
      where gs.id = game_session_players.session_id and rm.user_id = auth.uid()
    )
    or user_id = auth.uid()
    or public.ben_admin_miyim()
  );

drop policy if exists "game_scores_read" on public.game_scores;
create policy "game_scores_read" on public.game_scores
  for select to authenticated using (
    exists (
      select 1 from public.game_sessions gs
      join public.room_members rm on rm.room_id = gs.room_id
      where gs.id = game_scores.session_id and rm.user_id = auth.uid()
    )
    or user_id = auth.uid()
    or public.ben_admin_miyim()
  );

drop policy if exists "game_moves_own_read" on public.game_moves;
create policy "game_moves_own_read" on public.game_moves
  for select to authenticated using (user_id = auth.uid() or public.ben_admin_miyim());

drop policy if exists "game_events_read" on public.game_events;
create policy "game_events_read" on public.game_events
  for select to authenticated using (
    exists (
      select 1 from public.game_sessions gs
      join public.room_members rm on rm.room_id = gs.room_id
      where gs.id = game_events.session_id and rm.user_id = auth.uid()
    )
    or public.ben_admin_miyim()
  );

drop policy if exists "game_player_stats_read" on public.game_player_stats;
create policy "game_player_stats_read" on public.game_player_stats
  for select to authenticated using (true);

drop policy if exists "game_weekly_stats_read" on public.game_weekly_stats;
create policy "game_weekly_stats_read" on public.game_weekly_stats
  for select to authenticated using (true);

drop policy if exists "game_achievements_read" on public.game_achievements;
create policy "game_achievements_read" on public.game_achievements
  for select to authenticated using (true);

drop policy if exists "game_player_achievements_read" on public.game_player_achievements;
create policy "game_player_achievements_read" on public.game_player_achievements
  for select to authenticated using (true);

drop policy if exists "game_security_admin_read" on public.game_security_events;
create policy "game_security_admin_read" on public.game_security_events
  for select to authenticated using (public.ben_admin_miyim());

drop policy if exists "game_admin_audit_admin_read" on public.game_admin_audit_logs;
create policy "game_admin_audit_admin_read" on public.game_admin_audit_logs
  for select to authenticated using (public.ben_admin_miyim());

grant select on public.game_catalog to authenticated;
grant select on public.game_control_configs to authenticated;
grant select on public.game_control_overrides to authenticated;
grant select on public.game_sessions to authenticated;
grant select on public.game_session_players to authenticated;
grant select on public.game_scores to authenticated;
grant select on public.game_moves to authenticated;
grant select on public.game_events to authenticated;
grant select on public.game_player_stats to authenticated;
grant select on public.game_weekly_stats to authenticated;
grant select on public.game_achievements to authenticated;
grant select on public.game_player_achievements to authenticated;
grant select on public.game_security_events to authenticated;
grant select on public.game_admin_audit_logs to authenticated;

-- Realtime (idempotent)
do $$ begin
  begin alter publication supabase_realtime add table public.game_sessions;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.game_session_players;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.game_scores;
  exception when duplicate_object then null; end;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.oyun_hafta_baslangici(p_ts timestamptz default now())
returns date
language sql
immutable
as $$
  select (date_trunc('week', p_ts at time zone 'Europe/Istanbul')::date);
$$;

create or replace function public.oyun_aktif_politika(p_game_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cfg public.game_control_configs%rowtype;
  v_ov public.game_control_overrides%rowtype;
  v_mode text;
  v_reward numeric;
  v_xp numeric;
  v_trophy numeric;
  v_factor numeric;
  v_min bigint;
  v_max bigint;
begin
  select * into v_cfg from public.game_control_configs where game_code = p_game_code;
  if not found then
    raise exception 'Game control missing';
  end if;

  select * into v_ov
  from public.game_control_overrides
  where game_code = p_game_code
    and starts_at <= now()
    and ends_at > now()
  order by created_at desc
  limit 1;

  v_mode := coalesce(v_ov.mode, v_cfg.mode);
  v_reward := coalesce(v_ov.reward_multiplier, v_cfg.reward_multiplier);
  v_xp := coalesce(v_ov.xp_multiplier, v_cfg.xp_multiplier);
  v_trophy := coalesce(v_ov.trophy_multiplier, v_cfg.trophy_multiplier);
  v_factor := coalesce(v_ov.reward_factor, v_cfg.reward_factor);
  v_min := coalesce(v_ov.min_entry, v_cfg.min_entry);
  v_max := coalesce(v_ov.max_entry, v_cfg.max_entry);

  return jsonb_build_object(
    'is_enabled', v_cfg.is_enabled and v_mode <> 'MAINTENANCE',
    'mode', v_mode,
    'min_entry', v_min,
    'max_entry', v_max,
    'reward_multiplier', v_reward,
    'xp_multiplier', v_xp,
    'trophy_multiplier', v_trophy,
    'reward_factor', v_factor,
    'new_player_games', v_cfg.new_player_games,
    'new_player_max_entry', v_cfg.new_player_max_entry,
    'daily_reward_cap', v_cfg.daily_reward_cap,
    'player_daily_reward_cap', v_cfg.player_daily_reward_cap,
    'min_players', v_cfg.min_players,
    'max_players', v_cfg.max_players,
    'default_duration_seconds', v_cfg.default_duration_seconds,
    'coin_rewards_enabled', v_cfg.coin_rewards_enabled
  );
end;
$$;

create or replace function public.oyun_odada_mi(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_user_id
  );
$$;

create or replace function public.oyun_host_mu(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room_id
      and (
        r.host_id = p_user_id
        or exists (
          select 1 from public.room_members rm
          where rm.room_id = p_room_id
            and rm.user_id = p_user_id
            and rm.role in ('host','cohost')
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- create_game_session
-- ---------------------------------------------------------------------------
create or replace function public.create_game_session(
  p_room_id uuid,
  p_game_code text,
  p_duration_seconds integer default null,
  p_max_players integer default null,
  p_entry_amount bigint default 0
)
returns public.game_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pol jsonb;
  v_session public.game_sessions%rowtype;
  v_seed bigint;
  v_entry bigint := coalesce(p_entry_amount, 0);
  v_games bigint;
  v_max_entry bigint;
  v_coins bigint;
  v_snapshot jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_games') then raise exception 'Games temporarily disabled'; end if;
  if not public.ozellik_bayragi_aktif_mi('games_enabled') then raise exception 'Games feature disabled'; end if;
  if p_game_code = 'match3' and not public.ozellik_bayragi_aktif_mi('match3_enabled') then
    raise exception 'Match3 disabled';
  end if;

  if not public.oyun_odada_mi(p_room_id, v_uid) then raise exception 'Not in room'; end if;
  if not public.oyun_host_mu(p_room_id, v_uid) then raise exception 'Only host can start game'; end if;

  if exists (
    select 1 from public.game_sessions
    where room_id = p_room_id and status in ('waiting','countdown','playing')
  ) then
    raise exception 'Active game already exists';
  end if;

  v_pol := public.oyun_aktif_politika(p_game_code);
  if not coalesce((v_pol->>'is_enabled')::boolean, false) then
    raise exception 'Game in maintenance or disabled';
  end if;

  v_max_entry := coalesce((v_pol->>'max_entry')::bigint, 0);
  select coalesce(total_games, 0) into v_games from public.game_player_stats where user_id = v_uid;
  if coalesce(v_games, 0) < coalesce((v_pol->>'new_player_games')::int, 10) then
    v_max_entry := least(v_max_entry, coalesce((v_pol->>'new_player_max_entry')::bigint, 500));
  end if;

  if v_entry < coalesce((v_pol->>'min_entry')::bigint, 0) then raise exception 'Entry too low'; end if;
  if v_max_entry > 0 and v_entry > v_max_entry then raise exception 'Entry too high'; end if;

  if v_entry > 0 then
    if public.kill_switch_aktif_mi('kill_game_coin') then raise exception 'Game coin disabled'; end if;
    select coins into v_coins from public.wallets where user_id = v_uid for update;
    if v_coins is null or v_coins < v_entry then raise exception 'Insufficient coins'; end if;
    update public.wallets set coins = coins - v_entry, updated_at = now() where user_id = v_uid;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
    values (v_uid, 'coins', -v_entry, v_coins - v_entry, 'game_entry', 'game_session', null);
  end if;

  -- gen_random_bytes pgcrypto'da (extensions); search_path=public altında yok.
  -- pg_catalog md5 + uuid ile seed (extensions gerekmez).
  v_seed := (
    'x' || substr(
      md5(pg_catalog.gen_random_uuid()::text || clock_timestamp()::text),
      1, 16
    )
  )::bit(64)::bigint;

  v_snapshot := jsonb_build_object(
    'mode', v_pol->>'mode',
    'entry', v_entry,
    'rewardMultiplier', (v_pol->>'reward_multiplier')::numeric,
    'xpMultiplier', (v_pol->>'xp_multiplier')::numeric,
    'trophyMultiplier', (v_pol->>'trophy_multiplier')::numeric,
    'rewardFactor', (v_pol->>'reward_factor')::numeric,
    'newPlayerProtection', coalesce(v_games, 0) < coalesce((v_pol->>'new_player_games')::int, 10),
    'dailyRewardCap', coalesce((v_pol->>'daily_reward_cap')::bigint, 0),
    'playerDailyRewardCap', coalesce((v_pol->>'player_daily_reward_cap')::bigint, 0),
    'coinRewardsEnabled', coalesce((v_pol->>'coin_rewards_enabled')::boolean, false),
    'version', to_char(now() at time zone 'UTC', 'YYYY.MM.DD.HH24MI'),
    'capturedAt', now()
  );

  insert into public.game_sessions (
    game_code, room_id, host_user_id, seed, status, max_players, duration_seconds,
    entry_amount, config_snapshot
  ) values (
    p_game_code,
    p_room_id,
    v_uid,
    v_seed,
    'waiting',
    coalesce(p_max_players, (v_pol->>'max_players')::int, 8),
    coalesce(p_duration_seconds, (v_pol->>'default_duration_seconds')::int, 90),
    v_entry,
    v_snapshot
  ) returning * into v_session;

  if v_entry > 0 then
    update public.wallet_ledger
      set ref_id = v_session.id
    where user_id = v_uid and reason = 'game_entry' and ref_id is null
      and created_at > now() - interval '5 seconds';
  end if;

  insert into public.game_session_players (session_id, user_id, status, entry_amount)
  values (v_session.id, v_uid, 'joined', v_entry);

  insert into public.game_scores (session_id, user_id)
  values (v_session.id, v_uid);

  return v_session;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_game_session
-- ---------------------------------------------------------------------------
create or replace function public.join_game_session(
  p_session_id uuid,
  p_entry_amount bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_s public.game_sessions%rowtype;
  v_count int;
  v_entry bigint := coalesce(p_entry_amount, 0);
  v_coins bigint;
  v_player public.game_session_players%rowtype;
  v_prof public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_games') then raise exception 'Games temporarily disabled'; end if;

  select * into v_s from public.game_sessions where id = p_session_id for update;
  if not found then raise exception 'Session not found'; end if;
  if v_s.status <> 'waiting' then raise exception 'Session not joinable'; end if;
  if not public.oyun_odada_mi(v_s.room_id, v_uid) then raise exception 'Not in room'; end if;

  select count(*) into v_count from public.game_session_players where session_id = p_session_id;
  if v_count >= v_s.max_players then raise exception 'Session full'; end if;

  if exists (select 1 from public.game_session_players where session_id = p_session_id and user_id = v_uid) then
    select * into v_player from public.game_session_players where session_id = p_session_id and user_id = v_uid;
  else
    if v_entry <= 0 then v_entry := v_s.entry_amount; end if;
    if v_s.entry_amount > 0 and v_entry <> v_s.entry_amount then
      raise exception 'Entry must match session';
    end if;

    if v_entry > 0 then
      if public.kill_switch_aktif_mi('kill_game_coin') then raise exception 'Game coin disabled'; end if;
      select coins into v_coins from public.wallets where user_id = v_uid for update;
      if v_coins is null or v_coins < v_entry then raise exception 'Insufficient coins'; end if;
      update public.wallets set coins = coins - v_entry, updated_at = now() where user_id = v_uid;
      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (v_uid, 'coins', -v_entry, v_coins - v_entry, 'game_entry', 'game_session', p_session_id);
    end if;

    insert into public.game_session_players (session_id, user_id, status, entry_amount)
    values (p_session_id, v_uid, 'joined', v_entry)
    returning * into v_player;

    insert into public.game_scores (session_id, user_id)
    values (p_session_id, v_uid)
    on conflict (session_id, user_id) do nothing;
  end if;

  select * into v_prof from public.profiles where id = v_uid;

  return jsonb_build_object(
    'id', v_player.id,
    'session_id', v_player.session_id,
    'user_id', v_player.user_id,
    'display_name', v_prof.display_name,
    'avatar_url', v_prof.avatar_url,
    'status', v_player.status,
    'score', 0,
    'combo_max', 0,
    'move_count', 0,
    'final_rank', v_player.final_rank,
    'joined_at', v_player.joined_at,
    'finished_at', v_player.finished_at,
    'disconnected_at', v_player.disconnected_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- start_game_session
-- ---------------------------------------------------------------------------
create or replace function public.start_game_session(p_session_id uuid)
returns public.game_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_s public.game_sessions%rowtype;
  v_count int;
  v_min int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_s from public.game_sessions where id = p_session_id for update;
  if not found then raise exception 'Session not found'; end if;
  if v_s.host_user_id <> v_uid and not public.ben_admin_miyim() then
    raise exception 'Only host can start';
  end if;
  if v_s.status not in ('waiting','countdown') then raise exception 'Invalid status'; end if;

  select count(*) into v_count from public.game_session_players where session_id = p_session_id;
  select coalesce((config->>'min_players')::int, 2)
    into v_min
  from (select public.oyun_aktif_politika(v_s.game_code) as config) x;

  if v_count < greatest(v_min, 1) then raise exception 'Not enough players'; end if;

  update public.game_sessions set
    status = 'playing',
    started_at = now(),
    -- 3 sn geri sayım süresi maç süresinden düşmesin
    ends_at = now() + make_interval(secs => duration_seconds + 3)
  where id = p_session_id
  returning * into v_s;

  update public.game_session_players
    set status = 'playing'
  where session_id = p_session_id and status in ('joined','ready');

  return v_s;
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_game_score
-- ---------------------------------------------------------------------------
create or replace function public.submit_game_score(
  p_session_id uuid,
  p_score bigint,
  p_move_count integer,
  p_highest_combo integer,
  p_special_tiles_used integer default 0,
  p_board_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_s public.game_sessions%rowtype;
  v_elapsed numeric;
  v_max_plausible bigint;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_s from public.game_sessions where id = p_session_id;
  if not found then raise exception 'Session not found'; end if;
  if v_s.status <> 'playing' then raise exception 'Game not playing'; end if;
  if v_s.ends_at is not null and now() > v_s.ends_at + interval '5 seconds' then
    raise exception 'Session expired';
  end if;

  if not exists (
    select 1 from public.game_session_players
    where session_id = p_session_id and user_id = v_uid
      and status in ('joined','ready','playing','disconnected')
  ) then
    raise exception 'Not a player';
  end if;

  if p_score < 0 or p_move_count < 0 or p_highest_combo < 0 then
    raise exception 'Invalid score payload';
  end if;

  v_elapsed := greatest(1, extract(epoch from (now() - coalesce(v_s.started_at, now()))));
  -- Kabaca üst sınır: saniyede ~5k puan / 8 hamle (anti-cheat soft)
  v_max_plausible := (v_elapsed * 8000)::bigint + 5000;
  if p_score > v_max_plausible or p_move_count > (v_elapsed * 12)::int + 20 then
    insert into public.game_security_events (user_id, session_id, event_type, details)
    values (v_uid, p_session_id, 'impossible_score', jsonb_build_object(
      'score', p_score, 'moves', p_move_count, 'elapsed', v_elapsed
    ));
    update public.game_session_players
      set is_suspicious = true
    where session_id = p_session_id and user_id = v_uid;
  end if;

  insert into public.game_scores as gs (
    session_id, user_id, score, move_count, highest_combo, special_tiles_used, board_hash, updated_at
  ) values (
    p_session_id, v_uid, p_score, p_move_count, p_highest_combo,
    coalesce(p_special_tiles_used, 0), p_board_hash, now()
  )
  on conflict (session_id, user_id) do update set
    score = excluded.score,
    move_count = excluded.move_count,
    highest_combo = excluded.highest_combo,
    special_tiles_used = excluded.special_tiles_used,
    board_hash = coalesce(excluded.board_hash, gs.board_hash),
    updated_at = now();

  return jsonb_build_object('updated', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- finish_game_session — rank, XP, kupa (coin ödül sadece coin_rewards_enabled + şeffaf)
-- ---------------------------------------------------------------------------
create or replace function public.finish_game_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_s public.game_sessions%rowtype;
  v_snap jsonb;
  r record;
  v_rank int := 0;
  v_xp int;
  v_trophy int;
  v_xp_mul numeric;
  v_trophy_mul numeric;
  v_factor numeric;
  v_mode text;
  v_week date := public.oyun_hafta_baslangici(now());
  v_rankings jsonb := '[]'::jsonb;
  v_prof public.profiles%rowtype;
  v_coins bigint;
  v_pool bigint := 0;
  v_coin_on boolean := false;
  v_share numeric;
  v_reward bigint;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_s from public.game_sessions where id = p_session_id for update;
  if not found then raise exception 'Session not found'; end if;

  if v_s.status = 'finished' then
    -- idempotent: mevcut sıralamayı döndür
    select coalesce(jsonb_agg(x.obj order by x.rank), '[]'::jsonb) into v_rankings
    from (
      select jsonb_build_object(
        'userId', p.user_id,
        'displayName', coalesce(pr.display_name, 'Oyuncu'),
        'avatarUrl', pr.avatar_url,
        'score', coalesce(sc.score, 0),
        'comboMax', coalesce(sc.highest_combo, 0),
        'rank', p.final_rank
      ) as obj, p.final_rank as rank
      from public.game_session_players p
      left join public.profiles pr on pr.id = p.user_id
      left join public.game_scores sc on sc.session_id = p.session_id and sc.user_id = p.user_id
      where p.session_id = p_session_id and p.final_rank is not null
    ) x;
    return jsonb_build_object('rankings', v_rankings);
  end if;

  if v_s.status <> 'playing' then raise exception 'Game not playing'; end if;

  -- Host, oyuncu veya süre dolmuşsa bitirilebilir
  if v_s.host_user_id <> v_uid
     and not exists (select 1 from public.game_session_players where session_id = p_session_id and user_id = v_uid)
     and not public.ben_admin_miyim()
  then
    raise exception 'Forbidden';
  end if;

  v_snap := coalesce(v_s.config_snapshot, '{}'::jsonb);
  v_xp_mul := coalesce((v_snap->>'xpMultiplier')::numeric, 1);
  v_trophy_mul := coalesce((v_snap->>'trophyMultiplier')::numeric, 1);
  v_factor := coalesce((v_snap->>'rewardFactor')::numeric, 1);
  v_mode := coalesce(v_snap->>'mode', 'NORMAL');
  v_coin_on := coalesce((v_snap->>'coinRewardsEnabled')::boolean, false)
               and v_mode <> 'NO_REWARD';

  if v_coin_on then
    select coalesce(sum(entry_amount), 0) into v_pool
    from public.game_session_players where session_id = p_session_id;
  end if;

  for r in
    select p.user_id, p.status, coalesce(sc.score, 0) as score, coalesce(sc.highest_combo, 0) as combo
    from public.game_session_players p
    left join public.game_scores sc on sc.session_id = p.session_id and sc.user_id = p.user_id
    where p.session_id = p_session_id
      and p.status not in ('left')
    order by
      case when p.is_suspicious then 1 else 0 end,
      case when p.status in ('dnf','left') then 1 else 0 end,
      coalesce(sc.score, 0) desc,
      coalesce(sc.highest_combo, 0) desc,
      p.joined_at asc
  loop
    v_rank := v_rank + 1;
    v_xp := 10 + 20; -- join + complete
    if v_rank = 1 then v_xp := v_xp + 80; v_trophy := 25;
    elsif v_rank = 2 then v_xp := v_xp + 50; v_trophy := 15;
    elsif v_rank = 3 then v_xp := v_xp + 30; v_trophy := 10;
    else v_trophy := 3;
    end if;

    if r.status in ('dnf','left') then
      v_xp := 10; v_trophy := 0;
    end if;

    if v_mode = 'NO_REWARD' then
      v_xp := 10; v_trophy := 0;
    end if;

    v_xp := greatest(0, round(v_xp * v_xp_mul * v_factor)::int);
    v_trophy := greatest(0, round(v_trophy * v_trophy_mul * v_factor)::int);

    v_reward := 0;
    if v_coin_on and v_pool > 0 and r.status not in ('dnf','left') then
      -- Şeffaf pay: 1.=50%, 2.=30%, 3.=20% (oyuncu sayısına göre kırp)
      v_share := case
        when v_rank = 1 then 0.50
        when v_rank = 2 then 0.30
        when v_rank = 3 then 0.20
        else 0
      end;
      v_reward := floor(v_pool * v_share * v_factor)::bigint;
      if v_reward > 0 then
        select coins into v_coins from public.wallets where user_id = r.user_id for update;
        if v_coins is null then
          insert into public.wallets (user_id, coins) values (r.user_id, 0)
          on conflict (user_id) do nothing;
          select coins into v_coins from public.wallets where user_id = r.user_id for update;
        end if;
        update public.wallets set coins = coins + v_reward, updated_at = now() where user_id = r.user_id;
        insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
        values (r.user_id, 'coins', v_reward, coalesce(v_coins,0) + v_reward, 'game_reward', 'game_session', p_session_id);
      end if;
    end if;

    update public.game_session_players set
      status = case when r.status in ('dnf','left') then r.status else 'finished' end,
      finished_at = now(),
      final_rank = v_rank,
      xp_earned = v_xp,
      trophy_change = v_trophy,
      coin_reward = v_reward
    where session_id = p_session_id and user_id = r.user_id;

    insert into public.game_player_stats (user_id)
    values (r.user_id)
    on conflict (user_id) do nothing;

    update public.game_player_stats set
      total_games = total_games + 1,
      wins = wins + case when v_rank = 1 and r.status not in ('dnf','left') then 1 else 0 end,
      second_places = second_places + case when v_rank = 2 then 1 else 0 end,
      third_places = third_places + case when v_rank = 3 then 1 else 0 end,
      total_score = total_score + r.score,
      highest_score = greatest(highest_score, r.score),
      highest_combo = greatest(highest_combo, r.combo),
      xp = xp + v_xp,
      trophies = trophies + v_trophy,
      level = greatest(1, (1 + ((xp + v_xp) / 500))::int),
      updated_at = now()
    where user_id = r.user_id;

    insert into public.game_weekly_stats (user_id, week_start, games, wins, trophies, total_score)
    values (
      r.user_id, v_week, 1,
      case when v_rank = 1 and r.status not in ('dnf','left') then 1 else 0 end,
      v_trophy, r.score
    )
    on conflict (user_id, week_start) do update set
      games = game_weekly_stats.games + 1,
      wins = game_weekly_stats.wins + excluded.wins,
      trophies = game_weekly_stats.trophies + excluded.trophies,
      total_score = game_weekly_stats.total_score + excluded.total_score;

    select * into v_prof from public.profiles where id = r.user_id;
    v_rankings := v_rankings || jsonb_build_array(jsonb_build_object(
      'userId', r.user_id,
      'displayName', coalesce(v_prof.display_name, 'Oyuncu'),
      'avatarUrl', v_prof.avatar_url,
      'score', r.score,
      'comboMax', r.combo,
      'rank', v_rank
    ));
  end loop;

  update public.game_sessions set
    status = 'finished',
    finished_at = now()
  where id = p_session_id;

  return jsonb_build_object('rankings', v_rankings);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: game control update + audit
-- ---------------------------------------------------------------------------
create or replace function public.admin_oyun_kontrol_guncelle(
  p_game_code text,
  p_patch jsonb,
  p_reason text default null
)
returns public.game_control_configs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old public.game_control_configs%rowtype;
  v_new public.game_control_configs%rowtype;
begin
  if v_uid is null or not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;

  select * into v_old from public.game_control_configs where game_code = p_game_code for update;
  if not found then raise exception 'Config not found'; end if;

  update public.game_control_configs set
    is_enabled = coalesce((p_patch->>'is_enabled')::boolean, is_enabled),
    mode = coalesce(p_patch->>'mode', mode),
    min_entry = coalesce((p_patch->>'min_entry')::bigint, min_entry),
    max_entry = coalesce((p_patch->>'max_entry')::bigint, max_entry),
    reward_multiplier = coalesce((p_patch->>'reward_multiplier')::numeric, reward_multiplier),
    xp_multiplier = coalesce((p_patch->>'xp_multiplier')::numeric, xp_multiplier),
    trophy_multiplier = coalesce((p_patch->>'trophy_multiplier')::numeric, trophy_multiplier),
    reward_factor = coalesce((p_patch->>'reward_factor')::numeric, reward_factor),
    new_player_games = coalesce((p_patch->>'new_player_games')::int, new_player_games),
    new_player_max_entry = coalesce((p_patch->>'new_player_max_entry')::bigint, new_player_max_entry),
    daily_reward_cap = coalesce((p_patch->>'daily_reward_cap')::bigint, daily_reward_cap),
    player_daily_reward_cap = coalesce((p_patch->>'player_daily_reward_cap')::bigint, player_daily_reward_cap),
    min_players = coalesce((p_patch->>'min_players')::int, min_players),
    max_players = coalesce((p_patch->>'max_players')::int, max_players),
    default_duration_seconds = coalesce((p_patch->>'default_duration_seconds')::int, default_duration_seconds),
    coin_rewards_enabled = coalesce((p_patch->>'coin_rewards_enabled')::boolean, coin_rewards_enabled),
    updated_by = v_uid,
    updated_at = now()
  where game_code = p_game_code
  returning * into v_new;

  insert into public.game_admin_audit_logs (admin_user_id, game_code, action, old_value, new_value, reason)
  values (
    v_uid, p_game_code, 'update_control',
    to_jsonb(v_old), to_jsonb(v_new), p_reason
  );

  return v_new;
end;
$$;

grant execute on function public.oyun_aktif_politika(text) to authenticated;
grant execute on function public.create_game_session(uuid, text, integer, integer, bigint) to authenticated;
grant execute on function public.join_game_session(uuid, bigint) to authenticated;
grant execute on function public.start_game_session(uuid) to authenticated;
grant execute on function public.submit_game_score(uuid, bigint, integer, integer, integer, text) to authenticated;
grant execute on function public.finish_game_session(uuid) to authenticated;
grant execute on function public.admin_oyun_kontrol_guncelle(text, jsonb, text) to authenticated;
