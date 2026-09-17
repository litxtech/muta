-- NOX REELS — 5×3 slot: katalog + oturum/round + atomik settle
-- Coin otoritesi sunucuda; client INSERT yok.

insert into public.feature_flags (key, enabled, description) values
  ('nox_reels_enabled', true, 'NOX REELS 5x3 premium slot')
on conflict (key) do nothing;

insert into public.game_catalog (
  game_code, name, description, min_players, max_players, default_duration_seconds, is_active
) values (
  'nox_reels',
  'NOX REELS',
  '5x3 premium payline slot — wild, scatter, bonus',
  1,
  1,
  0,
  true
)
on conflict (game_code) do nothing;

insert into public.game_control_configs (
  game_code, is_enabled, mode, min_entry, max_entry, coin_rewards_enabled, min_players, max_players
) values (
  'nox_reels', true, 'NORMAL', 10, 500, true, 1, 1
)
on conflict (game_code) do nothing;

create table if not exists public.nox_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  room_id uuid references public.rooms(id) on delete set null,
  status text not null default 'active'
    check (status in ('active','closed')),
  bonus_spins_remaining integer not null default 0,
  math_version text not null default 'nox-math-v1',
  config_version text not null default 'nox-cfg-v1',
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  last_activity_at timestamptz not null default now()
);

create index if not exists nox_sessions_user_idx
  on public.nox_sessions (user_id, created_at desc);

create index if not exists nox_sessions_active_user_idx
  on public.nox_sessions (user_id, created_at desc)
  where status = 'active';

create table if not exists public.nox_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.nox_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  idempotency_key text not null,
  status text not null default 'pending_playback'
    check (status in ('pending_playback','played','settled','failed')),
  bet_amount bigint not null,
  win_amount numeric(18,2) not null default 0,
  rng_seed text not null,
  math_version text not null,
  config_version text not null,
  paytable_version text not null,
  result_snapshot jsonb not null,
  is_bonus_spin boolean not null default false,
  balance_before bigint not null,
  balance_after bigint not null,
  created_at timestamptz not null default now(),
  played_at timestamptz,
  unique (user_id, idempotency_key)
);

create index if not exists nox_rounds_user_status_idx
  on public.nox_rounds (user_id, status, created_at desc);

create index if not exists nox_rounds_user_created_idx
  on public.nox_rounds (user_id, created_at desc);

alter table public.nox_sessions enable row level security;
alter table public.nox_rounds enable row level security;

drop policy if exists nox_sessions_select_own on public.nox_sessions;
create policy nox_sessions_select_own on public.nox_sessions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists nox_rounds_select_own on public.nox_rounds;
create policy nox_rounds_select_own on public.nox_rounds
  for select to authenticated using (user_id = auth.uid());

grant select on public.nox_sessions to authenticated;
grant select on public.nox_rounds to authenticated;

-- ---------------------------------------------------------------------------
create or replace function public.nox_spin_context(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin boolean := false;
  v_coins bigint := 0;
  v_bonus integer := 0;
  v_session uuid;
begin
  if p_user_id is null then
    return jsonb_build_object('error', 'user required');
  end if;

  select coalesce(is_admin, false) into v_admin
  from public.profiles where id = p_user_id;

  select coalesce(coins, 0) into v_coins
  from public.wallets where user_id = p_user_id;

  select id, bonus_spins_remaining
    into v_session, v_bonus
  from public.nox_sessions
  where user_id = p_user_id and status = 'active'
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'isAdmin', coalesce(v_admin, false),
    'coins', coalesce(v_coins, 0),
    'sessionId', v_session,
    'bonusSpinsRemaining', coalesce(v_bonus, 0)
  );
end;
$$;

revoke all on function public.nox_spin_context(uuid) from public;
revoke all on function public.nox_spin_context(uuid) from anon;
grant execute on function public.nox_spin_context(uuid) to service_role;

create or replace function public.nox_round_by_idempotency(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.nox_rounds%rowtype;
begin
  if v_uid is null or p_key is null or length(trim(p_key)) = 0 then
    return null;
  end if;

  select * into v_row
  from public.nox_rounds
  where user_id = v_uid and idempotency_key = trim(p_key);

  if not found then return null; end if;

  return jsonb_build_object(
    'round_id', v_row.id,
    'status', v_row.status,
    'result_snapshot', v_row.result_snapshot
  );
end;
$$;

grant execute on function public.nox_round_by_idempotency(text) to authenticated;
grant execute on function public.nox_round_by_idempotency(text) to service_role;

create or replace function public.nox_round_by_idempotency_admin(
  p_user_id uuid,
  p_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.nox_rounds%rowtype;
begin
  if p_user_id is null or p_key is null or length(trim(p_key)) = 0 then
    return null;
  end if;

  select * into v_row
  from public.nox_rounds
  where user_id = p_user_id and idempotency_key = trim(p_key);

  if not found then return null; end if;

  return jsonb_build_object(
    'roundId', v_row.id,
    'sessionId', v_row.session_id,
    'balanceAfter', v_row.balance_after,
    'result', v_row.result_snapshot,
    'duplicate', true
  );
end;
$$;

revoke all on function public.nox_round_by_idempotency_admin(uuid, text) from public;
revoke all on function public.nox_round_by_idempotency_admin(uuid, text) from anon;
grant execute on function public.nox_round_by_idempotency_admin(uuid, text) to service_role;

create or replace function public.nox_unfinished_round()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.nox_rounds%rowtype;
begin
  if v_uid is null then return null; end if;
  select * into v_row
  from public.nox_rounds
  where user_id = v_uid and status = 'pending_playback'
  order by created_at desc
  limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'round_id', v_row.id,
    'status', v_row.status,
    'result_snapshot', v_row.result_snapshot
  );
end;
$$;

grant execute on function public.nox_unfinished_round() to authenticated;

create or replace function public.nox_mark_played(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.nox_rounds
  set status = 'played', played_at = now()
  where id = p_round_id and user_id = auth.uid() and status = 'pending_playback';
end;
$$;

grant execute on function public.nox_mark_played(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Atomik settle
-- ---------------------------------------------------------------------------
create or replace function public.nox_settle_spin(
  p_user_id uuid,
  p_idempotency_key text,
  p_bet_amount bigint,
  p_room_id uuid,
  p_result jsonb,
  p_is_bonus_spin boolean default false,
  p_admin_test boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.nox_rounds%rowtype;
  v_session_id uuid;
  v_coins bigint;
  v_win numeric;
  v_balance_after bigint;
  v_round_id uuid;
  v_debit bigint;
  v_is_admin boolean := false;
  v_admin_test boolean := false;
  v_bonus_left integer;
  v_win_floor bigint;
  v_pending integer;
begin
  if p_user_id is null then raise exception 'user required'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key required';
  end if;

  select coalesce(is_admin, false) into v_is_admin
  from public.profiles where id = p_user_id;

  v_admin_test := v_is_admin and coalesce(p_admin_test, false) and p_room_id is null;

  if public.kill_switch_aktif_mi('kill_games') then raise exception 'Games temporarily disabled'; end if;
  if public.kill_switch_aktif_mi('kill_game_coin') and not v_admin_test then
    raise exception 'Game coin disabled';
  end if;
  if not public.ozellik_bayragi_aktif_mi('games_enabled') then raise exception 'Games feature disabled'; end if;
  if not public.ozellik_bayragi_aktif_mi('nox_reels_enabled') then
    raise exception 'NOX REELS disabled';
  end if;

  select * into v_existing
  from public.nox_rounds
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'duplicate', true,
      'result', v_existing.result_snapshot
    );
  end if;

  -- Rate limit: unfinished pending playback
  select count(*) into v_pending
  from public.nox_rounds
  where user_id = p_user_id and status = 'pending_playback';
  if v_pending > 2 then
    raise exception 'Spin in progress';
  end if;

  select id into v_session_id
  from public.nox_sessions
  where user_id = p_user_id and status = 'active'
  order by created_at desc
  limit 1;

  if v_session_id is null then
    insert into public.nox_sessions (user_id, room_id, status)
    values (p_user_id, p_room_id, 'active')
    returning id into v_session_id;
  end if;

  select coins into v_coins from public.wallets where user_id = p_user_id for update;
  if v_coins is null then raise exception 'Wallet not found'; end if;

  if v_admin_test then
    v_debit := 0;
    v_win := coalesce((p_result->>'winAmount')::numeric, 0);
    v_balance_after := v_coins;
  else
    v_debit := case when p_is_bonus_spin then 0 else p_bet_amount end;
    if v_coins < v_debit then raise exception 'Insufficient coins'; end if;
    v_win := coalesce((p_result->>'winAmount')::numeric, 0);
    v_balance_after := v_coins - v_debit + floor(v_win)::bigint;

    update public.wallets
    set coins = v_balance_after, updated_at = now()
    where user_id = p_user_id;
  end if;

  insert into public.nox_rounds (
    session_id, user_id, idempotency_key, status, bet_amount, win_amount,
    rng_seed, math_version, config_version, paytable_version,
    result_snapshot, is_bonus_spin, balance_before, balance_after
  ) values (
    v_session_id,
    p_user_id,
    p_idempotency_key,
    'pending_playback',
    p_bet_amount,
    v_win,
    coalesce(p_result->>'rngSeed', ''),
    coalesce(p_result->>'mathVersion', 'nox-math-v1'),
    coalesce(p_result->>'configVersion', 'nox-cfg-v1'),
    coalesce(p_result->>'paytableVersion', 'nox-pay-v1'),
    p_result || jsonb_build_object(
      'roundId', null,
      'sessionId', v_session_id,
      'balanceAfter', v_balance_after,
      'adminTest', v_admin_test
    ),
    p_is_bonus_spin,
    v_coins,
    v_balance_after
  )
  returning id into v_round_id;

  update public.nox_rounds
  set result_snapshot = result_snapshot
    || jsonb_build_object('roundId', v_round_id, 'balanceAfter', v_balance_after)
  where id = v_round_id;

  v_bonus_left := coalesce((p_result->>'remainingBonusSpins')::integer, 0);
  update public.nox_sessions
  set bonus_spins_remaining = greatest(0, v_bonus_left),
      last_activity_at = now()
  where id = v_session_id;

  if not v_admin_test then
    if v_debit > 0 then
      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user_id, 'coins', -v_debit, v_coins - v_debit, 'slot_bet', 'nox_round', v_round_id);
    end if;

    v_win_floor := floor(v_win)::bigint;
    if v_win_floor > 0 then
      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user_id, 'coins', v_win_floor, v_balance_after, 'slot_win', 'nox_round', v_round_id);
    end if;

    if p_room_id is not null then
      perform public.oda_oyun_coin_ekle(p_room_id, p_user_id, v_win_floor, v_debit);
    end if;

    -- Broadcast eşiği: win/bet >= 8 veya win >= 100 (mevcut duyuru min 100)
    if v_win_floor > 0
       and p_bet_amount > 0
       and (v_win_floor::numeric / p_bet_amount::numeric) >= 8 then
      perform public.oyun_kazanc_duyuru_yaz(
        p_user_id,
        p_room_id,
        'nox_reels',
        'NOX REELS',
        v_win_floor,
        p_bet_amount,
        v_round_id
      );
    end if;
  end if;

  return jsonb_build_object(
    'duplicate', false,
    'roundId', v_round_id,
    'sessionId', v_session_id,
    'balanceAfter', v_balance_after,
    'result', (
      select result_snapshot from public.nox_rounds where id = v_round_id
    )
  );
end;
$$;

revoke all on function public.nox_settle_spin(uuid, text, bigint, uuid, jsonb, boolean, boolean) from public;
revoke all on function public.nox_settle_spin(uuid, text, bigint, uuid, jsonb, boolean, boolean) from anon;
revoke all on function public.nox_settle_spin(uuid, text, bigint, uuid, jsonb, boolean, boolean) from authenticated;
grant execute on function public.nox_settle_spin(uuid, text, bigint, uuid, jsonb, boolean, boolean) to service_role;
