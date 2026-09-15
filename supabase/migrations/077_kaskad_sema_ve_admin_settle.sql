-- Kozmik Kaskad sema garantisi (065 eksikse) + admin ucretsiz settle

insert into public.feature_flags (key, enabled, description) values
  ('kozmik_kaskad_enabled', true, 'Kozmik Kaskad cascade oyunu')
on conflict (key) do nothing;

insert into public.game_catalog (game_code, name, description, min_players, max_players, default_duration_seconds, is_active)
values (
  'kozmik_kaskad',
  'Kozmik Kaskad',
  '6x5 kozmik cascade — scatter, carpan, bonus',
  1, 1, 0, true
)
on conflict (game_code) do nothing;

insert into public.game_control_configs (
  game_code, is_enabled, mode, min_entry, max_entry, coin_rewards_enabled, min_players, max_players
) values (
  'kozmik_kaskad', true, 'NORMAL', 10, 5000, true, 1, 1
)
on conflict (game_code) do nothing;
create table if not exists public.kaskad_math_versions (
  id uuid primary key default gen_random_uuid(),
  math_version text not null unique,
  config jsonb not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.kaskad_config_versions (
  id uuid primary key default gen_random_uuid(),
  config_version text not null unique,
  config jsonb not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.kaskad_math_versions (math_version, config, is_active)
values (
  'math-v1',
  '{
    "mathVersion":"math-v1",
    "paytableVersion":"pay-v1",
    "configVersion":"cfg-v1",
    "columns":6,
    "rows":5,
    "minMatchCount":8,
    "multiplierSpawnChance":0.08,
    "scatterSpawnChance":0.045,
    "maxCascades":32,
    "maxPayoutMult":5000,
    "minBet":10,
    "maxBet":5000,
    "betPresets":[10,20,50,100,250,500],
    "scatterBonus":{"4":10,"5":12,"6":15},
    "winTiers":{"energy":10,"cosmic":25,"galactic":50,"supernova":100}
  }'::jsonb,
  true
)
on conflict (math_version) do nothing;

-- ---------------------------------------------------------------------------
-- Sessions / rounds / events / transactions / audit
-- ---------------------------------------------------------------------------
create table if not exists public.kaskad_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  room_id uuid references public.rooms(id) on delete set null,
  status text not null default 'active'
    check (status in ('active','closed')),
  bonus_spins_remaining integer not null default 0,
  math_version text not null default 'math-v1',
  config_version text not null default 'cfg-v1',
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists kaskad_sessions_user_idx
  on public.kaskad_sessions (user_id, created_at desc);

create table if not exists public.kaskad_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.kaskad_sessions(id) on delete cascade,
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

create index if not exists kaskad_rounds_user_status_idx
  on public.kaskad_rounds (user_id, status, created_at desc);

create table if not exists public.kaskad_round_events (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.kaskad_rounds(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.kaskad_transactions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.kaskad_rounds(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  currency text not null default 'coins',
  delta bigint not null,
  balance_after bigint not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.kaskad_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  admin_user_id uuid,
  action text not null,
  round_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.kaskad_sessions enable row level security;
alter table public.kaskad_rounds enable row level security;
alter table public.kaskad_round_events enable row level security;
alter table public.kaskad_transactions enable row level security;
alter table public.kaskad_audit_logs enable row level security;
alter table public.kaskad_math_versions enable row level security;
alter table public.kaskad_config_versions enable row level security;

drop policy if exists kaskad_sessions_select_own on public.kaskad_sessions;
create policy kaskad_sessions_select_own on public.kaskad_sessions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists kaskad_rounds_select_own on public.kaskad_rounds;
create policy kaskad_rounds_select_own on public.kaskad_rounds
  for select to authenticated using (user_id = auth.uid());

drop policy if exists kaskad_math_select on public.kaskad_math_versions;
create policy kaskad_math_select on public.kaskad_math_versions
  for select to authenticated using (true);

drop policy if exists kaskad_config_select on public.kaskad_config_versions;
create policy kaskad_config_select on public.kaskad_config_versions
  for select to authenticated using (true);



-- Aktif config / unfinished / mark_played
create or replace function public.kozmik_kaskad_aktif_config()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select config into v
  from public.kaskad_math_versions
  where is_active
  order by created_at desc
  limit 1;
  return coalesce(v, '{}'::jsonb);
end;
$$;

grant execute on function public.kozmik_kaskad_aktif_config() to authenticated;

create or replace function public.kozmik_kaskad_unfinished_round()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.kaskad_rounds%rowtype;
begin
  if v_uid is null then return null; end if;
  select * into v_row
  from public.kaskad_rounds
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

grant execute on function public.kozmik_kaskad_unfinished_round() to authenticated;

create or replace function public.kozmik_kaskad_mark_played(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.kaskad_rounds
  set status = 'played', played_at = now()
  where id = p_round_id and user_id = auth.uid() and status = 'pending_playback';
end;
$$;

grant execute on function public.kozmik_kaskad_mark_played(uuid) to authenticated;

-- Admin-aware settle (bakiye sabit; coin şartı yok)
create or replace function public.kozmik_kaskad_settle_spin(
  p_user_id uuid,
  p_idempotency_key text,
  p_bet_amount bigint,
  p_room_id uuid,
  p_result jsonb,
  p_is_bonus_spin boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.kaskad_rounds%rowtype;
  v_session_id uuid;
  v_coins bigint;
  v_win numeric;
  v_balance_after bigint;
  v_round_id uuid;
  v_debit bigint;
  v_is_admin boolean := false;
begin
  if p_user_id is null then raise exception 'user required'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key required';
  end if;

  select coalesce(is_admin, false) into v_is_admin
  from public.profiles where id = p_user_id;

  if public.kill_switch_aktif_mi('kill_games') then raise exception 'Games temporarily disabled'; end if;
  if public.kill_switch_aktif_mi('kill_game_coin') and not v_is_admin then
    raise exception 'Game coin disabled';
  end if;
  if not public.ozellik_bayragi_aktif_mi('games_enabled') then raise exception 'Games feature disabled'; end if;
  if not public.ozellik_bayragi_aktif_mi('kozmik_kaskad_enabled') then
    raise exception 'Kozmik Kaskad disabled';
  end if;

  select * into v_existing
  from public.kaskad_rounds
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object(
      'duplicate', true,
      'result', v_existing.result_snapshot
    );
  end if;

  select id into v_session_id
  from public.kaskad_sessions
  where user_id = p_user_id and status = 'active'
  order by created_at desc
  limit 1;

  if v_session_id is null then
    insert into public.kaskad_sessions (user_id, room_id, status)
    values (p_user_id, p_room_id, 'active')
    returning id into v_session_id;
  end if;

  select coins into v_coins from public.wallets where user_id = p_user_id for update;
  if v_coins is null then raise exception 'Wallet not found'; end if;

  if v_is_admin then
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

  insert into public.kaskad_rounds (
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
    coalesce((p_result->>'totalMultiplier')::numeric, 1),
    coalesce(p_result->>'rngSeed', ''),
    coalesce(p_result->>'mathVersion', 'math-v1'),
    coalesce(p_result->>'configVersion', 'cfg-v1'),
    coalesce(p_result->>'paytableVersion', 'pay-v1'),
    p_result || jsonb_build_object(
      'roundId', null,
      'sessionId', v_session_id,
      'balanceAfter', v_balance_after,
      'adminTest', v_is_admin
    ),
    p_is_bonus_spin,
    v_coins,
    v_balance_after
  )
  returning id into v_round_id;

  update public.kaskad_rounds
  set result_snapshot = result_snapshot || jsonb_build_object('roundId', v_round_id, 'balanceAfter', v_balance_after)
  where id = v_round_id;

  if not v_is_admin then
    if v_debit > 0 then
      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user_id, 'coins', -v_debit, v_coins - v_debit, 'kaskad_bet', 'kaskad_round', v_round_id);
      insert into public.kaskad_transactions (round_id, user_id, delta, balance_after, reason)
      values (v_round_id, p_user_id, -v_debit, v_coins - v_debit, 'bet');
    end if;

    if floor(v_win)::bigint > 0 then
      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user_id, 'coins', floor(v_win)::bigint, v_balance_after, 'kaskad_win', 'kaskad_round', v_round_id);
      insert into public.kaskad_transactions (round_id, user_id, delta, balance_after, reason)
      values (v_round_id, p_user_id, floor(v_win)::bigint, v_balance_after, 'win');
    end if;
  end if;

  insert into public.kaskad_round_events (round_id, event_type, payload)
  values (
    v_round_id,
    'settled',
    jsonb_build_object('bet', p_bet_amount, 'win', v_win, 'adminTest', v_is_admin)
  );

  insert into public.kaskad_audit_logs (user_id, action, round_id, payload)
  values (
    p_user_id,
    case when v_is_admin then 'admin_spin_settled' else 'spin_settled' end,
    v_round_id,
    jsonb_build_object('idempotency', p_idempotency_key, 'adminTest', v_is_admin)
  );

  return jsonb_build_object(
    'duplicate', false,
    'roundId', v_round_id,
    'sessionId', v_session_id,
    'balanceAfter', v_balance_after,
    'result', (
      select result_snapshot from public.kaskad_rounds where id = v_round_id
    )
  );
end;
$$;

revoke all on function public.kozmik_kaskad_settle_spin(uuid, text, bigint, uuid, jsonb, boolean) from public;
revoke all on function public.kozmik_kaskad_settle_spin(uuid, text, bigint, uuid, jsonb, boolean) from anon;
revoke all on function public.kozmik_kaskad_settle_spin(uuid, text, bigint, uuid, jsonb, boolean) from authenticated;
grant execute on function public.kozmik_kaskad_settle_spin(uuid, text, bigint, uuid, jsonb, boolean) to service_role;

notify pgrst, 'reload schema';
