-- ZEUS — oturum / tur / atomik settle (coin otoritesi sunucuda)
-- Admin test (oda yok + adminTest) coin düşürmez.

update public.game_control_configs
set coin_rewards_enabled = true
where game_code = 'zeus';

create table if not exists public.zeus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  room_id uuid references public.rooms(id) on delete set null,
  status text not null default 'active'
    check (status in ('active','closed')),
  bonus_spins_remaining integer not null default 0,
  bonus_persistent_multiplier numeric(12,2) not null default 0,
  math_version text not null default 'olympus-v1',
  config_version text not null default 'zeus-cfg-v1',
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists zeus_sessions_user_idx
  on public.zeus_sessions (user_id, created_at desc);

create index if not exists zeus_sessions_active_user_idx
  on public.zeus_sessions (user_id, created_at desc)
  where status = 'active';

create table if not exists public.zeus_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.zeus_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  idempotency_key text not null,
  status text not null default 'pending_playback'
    check (status in ('pending_playback','played','settled','failed')),
  bet_amount bigint not null,
  win_amount numeric(18,2) not null default 0,
  total_multiplier numeric(12,2) not null default 1,
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

create index if not exists zeus_rounds_user_status_idx
  on public.zeus_rounds (user_id, status, created_at desc);

create index if not exists zeus_rounds_user_created_idx
  on public.zeus_rounds (user_id, created_at desc);

alter table public.zeus_sessions enable row level security;
alter table public.zeus_rounds enable row level security;

drop policy if exists zeus_sessions_select_own on public.zeus_sessions;
create policy zeus_sessions_select_own on public.zeus_sessions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists zeus_rounds_select_own on public.zeus_rounds;
create policy zeus_rounds_select_own on public.zeus_rounds
  for select to authenticated using (user_id = auth.uid());

grant select on public.zeus_sessions to authenticated;
grant select on public.zeus_rounds to authenticated;

-- ---------------------------------------------------------------------------
-- Spin öncesi tek round-trip
-- ---------------------------------------------------------------------------
create or replace function public.zeus_spin_context(p_user_id uuid)
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
  v_persistent numeric := 0;
  v_session uuid;
begin
  if p_user_id is null then
    return jsonb_build_object('error', 'user required');
  end if;

  select coalesce(is_admin, false) into v_admin
  from public.profiles where id = p_user_id;

  select coalesce(coins, 0) into v_coins
  from public.wallets where user_id = p_user_id;

  select id, bonus_spins_remaining, bonus_persistent_multiplier
    into v_session, v_bonus, v_persistent
  from public.zeus_sessions
  where user_id = p_user_id and status = 'active'
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'isAdmin', coalesce(v_admin, false),
    'coins', coalesce(v_coins, 0),
    'sessionId', v_session,
    'bonusSpinsRemaining', coalesce(v_bonus, 0),
    'persistentMultiplier', coalesce(v_persistent, 0)
  );
end;
$$;

revoke all on function public.zeus_spin_context(uuid) from public;
revoke all on function public.zeus_spin_context(uuid) from anon;
grant execute on function public.zeus_spin_context(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Idempotency kurtarma
-- ---------------------------------------------------------------------------
create or replace function public.zeus_round_by_idempotency(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.zeus_rounds%rowtype;
begin
  if v_uid is null or p_key is null or length(trim(p_key)) = 0 then
    return null;
  end if;

  select * into v_row
  from public.zeus_rounds
  where user_id = v_uid and idempotency_key = trim(p_key);

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'round_id', v_row.id,
    'status', v_row.status,
    'result_snapshot', v_row.result_snapshot
  );
end;
$$;

grant execute on function public.zeus_round_by_idempotency(text) to authenticated;
grant execute on function public.zeus_round_by_idempotency(text) to service_role;

create or replace function public.zeus_round_by_idempotency_admin(
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
  v_row public.zeus_rounds%rowtype;
begin
  if p_user_id is null or p_key is null or length(trim(p_key)) = 0 then
    return null;
  end if;

  select * into v_row
  from public.zeus_rounds
  where user_id = p_user_id and idempotency_key = trim(p_key);

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'roundId', v_row.id,
    'sessionId', v_row.session_id,
    'balanceAfter', v_row.balance_after,
    'result', v_row.result_snapshot,
    'duplicate', true
  );
end;
$$;

revoke all on function public.zeus_round_by_idempotency_admin(uuid, text) from public;
revoke all on function public.zeus_round_by_idempotency_admin(uuid, text) from anon;
grant execute on function public.zeus_round_by_idempotency_admin(uuid, text) to service_role;

create or replace function public.zeus_unfinished_round()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.zeus_rounds%rowtype;
begin
  if v_uid is null then return null; end if;
  select * into v_row
  from public.zeus_rounds
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

grant execute on function public.zeus_unfinished_round() to authenticated;

create or replace function public.zeus_mark_played(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.zeus_rounds
  set status = 'played', played_at = now()
  where id = p_round_id and user_id = auth.uid() and status = 'pending_playback';
end;
$$;

grant execute on function public.zeus_mark_played(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Atomik settle
-- ---------------------------------------------------------------------------
create or replace function public.zeus_settle_spin(
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
  v_existing public.zeus_rounds%rowtype;
  v_session_id uuid;
  v_coins bigint;
  v_win numeric;
  v_balance_after bigint;
  v_round_id uuid;
  v_debit bigint;
  v_is_admin boolean := false;
  v_admin_test boolean := false;
  v_bonus_left integer;
  v_persistent numeric;
  v_win_floor bigint;
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
  if not public.ozellik_bayragi_aktif_mi('zeus_enabled') then
    raise exception 'ZEUS disabled';
  end if;

  select * into v_existing
  from public.zeus_rounds
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'duplicate', true,
      'result', v_existing.result_snapshot
    );
  end if;

  select id into v_session_id
  from public.zeus_sessions
  where user_id = p_user_id and status = 'active'
  order by created_at desc
  limit 1;

  if v_session_id is null then
    insert into public.zeus_sessions (user_id, room_id, status)
    values (p_user_id, p_room_id, 'active')
    returning id into v_session_id;
  end if;

  select coins into v_coins from public.wallets where user_id = p_user_id for update;
  if v_coins is null then raise exception 'Wallet not found'; end if;

  if v_admin_test then
    v_debit := 0;
    v_win := coalesce((p_result->>'totalWin')::numeric, 0);
    v_balance_after := v_coins;
  else
    v_debit := case when p_is_bonus_spin then 0 else p_bet_amount end;
    if v_coins < v_debit then raise exception 'Insufficient coins'; end if;
    v_win := coalesce((p_result->>'totalWin')::numeric, 0);
    v_balance_after := v_coins - v_debit + floor(v_win)::bigint;

    update public.wallets
    set coins = v_balance_after, updated_at = now()
    where user_id = p_user_id;
  end if;

  insert into public.zeus_rounds (
    session_id, user_id, idempotency_key, status, bet_amount, win_amount,
    total_multiplier, rng_seed, math_version, config_version, paytable_version,
    result_snapshot, is_bonus_spin, balance_before, balance_after
  ) values (
    v_session_id,
    p_user_id,
    p_idempotency_key,
    'pending_playback',
    p_bet_amount,
    v_win,
    coalesce((p_result->>'appliedMultiplier')::numeric, 1),
    coalesce(p_result->>'rngSeed', ''),
    coalesce(p_result->>'mathVersion', 'olympus-v1'),
    coalesce(p_result->>'configVersion', 'zeus-cfg-v1'),
    coalesce(p_result->>'paytableVersion', 'zeus-pay-v1'),
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

  update public.zeus_rounds
  set result_snapshot = result_snapshot
    || jsonb_build_object('roundId', v_round_id, 'balanceAfter', v_balance_after)
  where id = v_round_id;

  v_bonus_left := coalesce((p_result->>'remainingFreeSpins')::integer, 0);
  v_persistent := case
    when v_bonus_left > 0
      then coalesce((p_result->>'persistentMultiplierAfter')::numeric, 0)
    else 0
  end;
  update public.zeus_sessions
  set bonus_spins_remaining = greatest(0, v_bonus_left),
      bonus_persistent_multiplier = v_persistent
  where id = v_session_id;

  if not v_admin_test then
    if v_debit > 0 then
      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user_id, 'coins', -v_debit, v_coins - v_debit, 'zeus_bet', 'zeus_round', v_round_id);
    end if;

    v_win_floor := floor(v_win)::bigint;
    if v_win_floor > 0 then
      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user_id, 'coins', v_win_floor, v_balance_after, 'zeus_win', 'zeus_round', v_round_id);
    end if;

    if p_room_id is not null then
      perform public.oda_oyun_coin_ekle(p_room_id, p_user_id, v_win_floor, v_debit);
    end if;
    if v_win_floor > 0 then
      perform public.oyun_kazanc_duyuru_yaz(
        p_user_id,
        p_room_id,
        'zeus',
        'ZEUS',
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
      select result_snapshot from public.zeus_rounds where id = v_round_id
    )
  );
end;
$$;

revoke all on function public.zeus_settle_spin(uuid, text, bigint, uuid, jsonb, boolean, boolean) from public;
revoke all on function public.zeus_settle_spin(uuid, text, bigint, uuid, jsonb, boolean, boolean) from anon;
revoke all on function public.zeus_settle_spin(uuid, text, bigint, uuid, jsonb, boolean, boolean) from authenticated;
grant execute on function public.zeus_settle_spin(uuid, text, bigint, uuid, jsonb, boolean, boolean) to service_role;
