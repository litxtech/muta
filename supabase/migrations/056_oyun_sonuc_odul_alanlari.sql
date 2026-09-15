-- Countdown süresi maç süresinden düşmesin
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
    ends_at = now() + make_interval(secs => duration_seconds + 3)
  where id = p_session_id
  returning * into v_s;

  update public.game_session_players
    set status = 'playing'
  where session_id = p_session_id and status in ('joined','ready');

  return v_s;
end;
$$;

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
    select coalesce(jsonb_agg(x.obj order by x.rank), '[]'::jsonb) into v_rankings
    from (
      select jsonb_build_object(
        'userId', p.user_id,
        'displayName', coalesce(pr.display_name, 'Oyuncu'),
        'avatarUrl', pr.avatar_url,
        'score', coalesce(sc.score, 0),
        'comboMax', coalesce(sc.highest_combo, 0),
        'rank', p.final_rank,
        'xpEarned', coalesce(p.xp_earned, 0),
        'trophyChange', coalesce(p.trophy_change, 0),
        'coinReward', coalesce(p.coin_reward, 0)
      ) as obj, p.final_rank as rank
      from public.game_session_players p
      left join public.profiles pr on pr.id = p.user_id
      left join public.game_scores sc on sc.session_id = p.session_id and sc.user_id = p.user_id
      where p.session_id = p_session_id and p.final_rank is not null
    ) x;
    return jsonb_build_object('rankings', v_rankings);
  end if;

  if v_s.status <> 'playing' then raise exception 'Game not playing'; end if;

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
    select p.user_id, p.status, p.is_suspicious,
           coalesce(sc.score, 0) as score, coalesce(sc.highest_combo, 0) as combo
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
    v_xp := 10 + 20;
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
      'rank', v_rank,
      'xpEarned', v_xp,
      'trophyChange', v_trophy,
      'coinReward', v_reward
    ));
  end loop;

  update public.game_sessions set
    status = 'finished',
    finished_at = now()
  where id = p_session_id;

  return jsonb_build_object('rankings', v_rankings);
end;
$$;
