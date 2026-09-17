-- Admin: yalnızca oyun-test (p_admin_test + oda yok) ücretsiz.
-- Ses odası / solo: admin de gerçek coin settle.

-- ---------------------------------------------------------------------------
-- 1) Realm of Storms settle — adminTest bayrağı
-- ---------------------------------------------------------------------------
drop function if exists public.kozmik_kaskad_settle_spin(uuid, text, bigint, uuid, jsonb, boolean);

create or replace function public.kozmik_kaskad_settle_spin(
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
  v_existing public.kaskad_rounds%rowtype;
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
  v_settings public.kaskad_game_settings%rowtype;
  v_gun_round integer;
  v_gun_wager bigint;
  v_gun_kayip bigint;
begin
  if p_user_id is null then raise exception 'user required'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key required';
  end if;

  select coalesce(is_admin, false) into v_is_admin
  from public.profiles where id = p_user_id;

  -- Yalnızca admin + test bayrağı + oda yok → ücretsiz (admin/oyun-test)
  v_admin_test := v_is_admin and coalesce(p_admin_test, false) and p_room_id is null;

  if public.kill_switch_aktif_mi('kill_games') then raise exception 'Games temporarily disabled'; end if;
  if public.kill_switch_aktif_mi('kill_game_coin') and not v_admin_test then
    raise exception 'Game coin disabled';
  end if;
  if not public.ozellik_bayragi_aktif_mi('games_enabled') then raise exception 'Games feature disabled'; end if;
  if not public.ozellik_bayragi_aktif_mi('kozmik_kaskad_enabled') then
    raise exception 'Realm of Storms disabled';
  end if;

  -- Bakım / günlük limit: admin test muaf; ses odası admin normal kurallara tabi
  select * into v_settings from public.kaskad_game_settings where id = 1;
  if found and not v_admin_test then
    if v_settings.maintenance_mode and not v_is_admin then
      raise exception 'Oyun bakımda: %',
        coalesce(nullif(v_settings.maintenance_message, ''), 'kısa süre sonra tekrar deneyin');
    end if;
    if v_settings.game_paused and not p_is_bonus_spin and not v_is_admin then
      raise exception 'Oyun geçici olarak durduruldu';
    end if;

    if not p_is_bonus_spin and (
      v_settings.max_daily_wager is not null
      or v_settings.max_daily_loss is not null
      or v_settings.max_rounds_per_day is not null
    ) then
      select
        count(*)::integer,
        coalesce(sum(bet_amount), 0)::bigint,
        coalesce(sum(bet_amount) - sum(win_amount), 0)::bigint
      into v_gun_round, v_gun_wager, v_gun_kayip
      from public.kaskad_rounds
      where user_id = p_user_id
        and not is_bonus_spin
        and created_at >= date_trunc('day', now())
        and coalesce((result_snapshot->>'adminTest')::boolean, false) = false;

      if v_settings.max_rounds_per_day is not null
         and v_gun_round >= v_settings.max_rounds_per_day then
        raise exception 'Günlük oyun limiti doldu — yarın tekrar deneyin';
      end if;
      if v_settings.max_daily_wager is not null
         and v_gun_wager + p_bet_amount > v_settings.max_daily_wager then
        raise exception 'Günlük bahis limiti aşıldı';
      end if;
      if v_settings.max_daily_loss is not null
         and v_gun_kayip >= v_settings.max_daily_loss then
        raise exception 'Günlük kayıp limitine ulaşıldı — yarın tekrar deneyin';
      end if;
    end if;
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

  if v_admin_test then
    -- Admin oyun testi: cüzdan etkilenmez
    v_debit := 0;
    v_win := coalesce((p_result->>'totalWin')::numeric, 0);
    v_balance_after := v_coins;
  else
    -- Ses odası (admin dahil): bahis düşer, kazanç yüklenir
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
    coalesce(p_result->>'mathVersion', 'storm-v1'),
    coalesce(p_result->>'configVersion', 'storm-cfg-v1'),
    coalesce(p_result->>'paytableVersion', 'storm-pay-v1'),
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

  update public.kaskad_rounds
  set result_snapshot = result_snapshot
    || jsonb_build_object('roundId', v_round_id, 'balanceAfter', v_balance_after)
  where id = v_round_id;

  v_bonus_left := coalesce((p_result->>'remainingBonusSpins')::integer, 0);
  v_persistent := case
    when v_bonus_left > 0
      then coalesce((p_result->>'persistentMultiplierAfter')::numeric, 0)
    else 0
  end;
  update public.kaskad_sessions
  set bonus_spins_remaining = greatest(0, v_bonus_left),
      bonus_persistent_multiplier = v_persistent
  where id = v_session_id;

  if not v_admin_test then
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
    jsonb_build_object(
      'bet', p_bet_amount,
      'win', v_win,
      'adminTest', v_admin_test,
      'isBonusSpin', p_is_bonus_spin,
      'bonusLeft', v_bonus_left,
      'persistentMultiplier', v_persistent
    )
  );

  insert into public.kaskad_audit_logs (user_id, action, round_id, payload)
  values (
    p_user_id,
    case when v_admin_test then 'admin_spin_settled' else 'spin_settled' end,
    v_round_id,
    jsonb_build_object('idempotency', p_idempotency_key, 'adminTest', v_admin_test)
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

revoke all on function public.kozmik_kaskad_settle_spin(uuid, text, bigint, uuid, jsonb, boolean, boolean) from public;
revoke all on function public.kozmik_kaskad_settle_spin(uuid, text, bigint, uuid, jsonb, boolean, boolean) from anon;
revoke all on function public.kozmik_kaskad_settle_spin(uuid, text, bigint, uuid, jsonb, boolean, boolean) from authenticated;
grant execute on function public.kozmik_kaskad_settle_spin(uuid, text, bigint, uuid, jsonb, boolean, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- 2) Match-3 oda girişi: admin de gerçek entry öder (ses odası)
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
set search_path = public, pg_catalog
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
  v_is_admin boolean := false;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_games') then raise exception 'Games temporarily disabled'; end if;
  if not public.ozellik_bayragi_aktif_mi('games_enabled') then raise exception 'Games feature disabled'; end if;
  if p_game_code = 'match3' and not public.ozellik_bayragi_aktif_mi('match3_enabled') then
    raise exception 'Match3 disabled';
  end if;

  select coalesce(is_admin, false) into v_is_admin from public.profiles where id = v_uid;

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

  if v_entry < coalesce((v_pol->>'min_entry')::bigint, 0) then
    raise exception 'Entry too low';
  end if;
  if v_max_entry > 0 and v_entry > v_max_entry and not v_is_admin then
    raise exception 'Entry too high';
  end if;

  if v_entry > 0 then
    if public.kill_switch_aktif_mi('kill_game_coin') then raise exception 'Game coin disabled'; end if;
    select coins into v_coins from public.wallets where user_id = v_uid for update;
    if v_coins is null or v_coins < v_entry then raise exception 'Insufficient coins'; end if;
    update public.wallets set coins = coins - v_entry, updated_at = now() where user_id = v_uid;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
    values (v_uid, 'coins', -v_entry, v_coins - v_entry, 'game_entry', 'game_session', null);
  end if;

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
    'adminTest', false,
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

grant execute on function public.create_game_session(uuid, text, integer, integer, bigint) to authenticated;

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

grant execute on function public.join_game_session(uuid, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Casino limitleri — bahis aralığı yükselt
-- ---------------------------------------------------------------------------
update public.kaskad_game_settings
set
  min_bet = 20,
  max_bet = 50000,
  bet_presets = '[20,50,100,250,500,1000,2500,5000,10000]'::jsonb,
  updated_at = now()
where id = 1;

-- Aktif math profillerinde de preset/max yükselt (ayar override yoksa)
update public.kaskad_math_versions
set config = config
  || jsonb_build_object(
    'betPresets', '[20,50,100,250,500,1000,2500,5000,10000]'::jsonb,
    'minBet', 20,
    'maxBet', 50000
  )
where math_version in ('storm-v1', 'storm-generous-v1', 'storm-tight-v1');

notify pgrst, 'reload schema';
