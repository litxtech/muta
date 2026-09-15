-- create_game_session seed: pgcrypto/search_path'ten bağımsız, cast'sız sağlam üretim
-- Önceki: gen_random_bytes(integer) does not exist (extensions search_path dışı)
-- Şimdi: pg_catalog.gen_random_uuid + md5 → bigint (extensions gerekmez)

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

  -- pg_catalog only — extensions / pgcrypto gerekmez
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

grant execute on function public.create_game_session(uuid, text, integer, integer, bigint) to authenticated;

notify pgrst, 'reload schema';
