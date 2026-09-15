-- =============================================================================
-- TAMUSO: REALM OF STORMS — Kozmik Kaskad'ın fırtına kimliğine tam dönüşümü.
-- Yeni math profili (storm-v1), bonus persistent multiplier + retrigger,
-- atomik bonus sayaçları, admin analytics / refund / math-version RPC'leri,
-- simülasyon kayıtları. SERVER = sonuç, CLIENT = presentation.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Oyun kimliği rebrand
-- ---------------------------------------------------------------------------
update public.game_catalog
set
  name = 'Realm of Storms',
  description = '6x5 firtina cascade — pay anywhere, carpan, portal bonus'
where game_code = 'kozmik_kaskad';

-- ---------------------------------------------------------------------------
-- 2) Session: bonus persistent multiplier
-- ---------------------------------------------------------------------------
alter table public.kaskad_sessions
  add column if not exists bonus_persistent_multiplier numeric(12,2) not null default 0;

-- ---------------------------------------------------------------------------
-- 3) STORM_V1 math profili (simülasyonla kalibre edildi) — immutable version.
--    Eski math-v1 pasife çekilir; geçmiş roundlar snapshot'larıyla korunur.
-- ---------------------------------------------------------------------------
insert into public.kaskad_math_versions (math_version, config, is_active)
values (
  'storm-v1',
  '{
    "mathVersion":"storm-v1",
    "paytableVersion":"storm-pay-v1",
    "configVersion":"storm-cfg-v1",
    "columns":6,
    "rows":5,
    "minMatchCount":8,
    "paytable":{
      "blueCrystal":{"8":0.25,"10":0.75,"12":2.0},
      "greenCrystal":{"8":0.25,"10":0.75,"12":2.0},
      "purpleCrystal":{"8":0.4,"10":0.9,"12":2.4},
      "redCrystal":{"8":0.4,"10":0.9,"12":2.4},
      "goldCrystal":{"8":0.5,"10":1.2,"12":3.0},
      "stormRing":{"8":1.0,"10":2.5,"12":6.0},
      "celestialCup":{"8":1.5,"10":4.0,"12":10},
      "timeCore":{"8":2.5,"10":6.0,"12":15},
      "energyCrown":{"8":4.0,"10":10,"12":25}
    },
    "symbolWeights":{
      "blueCrystal":20,
      "greenCrystal":20,
      "purpleCrystal":17,
      "redCrystal":17,
      "goldCrystal":14,
      "stormRing":8,
      "celestialCup":6.5,
      "timeCore":5,
      "energyCrown":3.5
    },
    "multiplierWeights":[
      {"value":2,"weight":40},
      {"value":3,"weight":24},
      {"value":4,"weight":12},
      {"value":5,"weight":10},
      {"value":6,"weight":5},
      {"value":8,"weight":4},
      {"value":10,"weight":2.4},
      {"value":15,"weight":1.2},
      {"value":25,"weight":0.7},
      {"value":50,"weight":0.4},
      {"value":100,"weight":0.2},
      {"value":250,"weight":0.06},
      {"value":500,"weight":0.02}
    ],
    "multiplierSpawnChance":0.03,
    "scatterSpawnChance":0.012,
    "scatterBonus":{"4":15,"5":20,"6":25},
    "bonus":{
      "persistentMultiplier":true,
      "multiplierSpawnChance":0.055,
      "retrigger":{"minScatters":3,"extraSpins":5}
    },
    "maxCascades":32,
    "maxEvents":256,
    "maxPayoutMult":5000,
    "winTiers":{"storm":10,"thunder":25,"cosmic":50,"divine":100},
    "betPresets":[10,20,50,100,250,500],
    "minBet":10,
    "maxBet":5000,
    "autoplayEnabled":true,
    "turboEnabled":true
  }'::jsonb,
  false
)
on conflict (math_version) do nothing;

update public.kaskad_math_versions set is_active = false where math_version <> 'storm-v1';
update public.kaskad_math_versions set is_active = true where math_version = 'storm-v1';

-- Eski sembol setiyle üretilmiş oynanmamış roundlar yeni client'ta
-- oynatılamaz; settlement zaten yapıldı → played'e çek (bakiye etkilenmez).
update public.kaskad_rounds
set status = 'played', played_at = now()
where status = 'pending_playback' and math_version <> 'storm-v1';

-- ---------------------------------------------------------------------------
-- 4) Simülasyon koşu kayıtları
-- ---------------------------------------------------------------------------
create table if not exists public.kaskad_simulation_runs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.profiles(id),
  math_version text not null,
  rounds integer not null,
  bet_amount bigint not null,
  report jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.kaskad_simulation_runs enable row level security;
-- Erişim yalnızca RPC üzerinden (security definer + admin check).

-- ---------------------------------------------------------------------------
-- 5) Settle RPC — atomik: debit + round + ledger + BONUS SAYAÇLARI.
--    Admin muafiyeti (072/077) korunur.
-- ---------------------------------------------------------------------------
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
  v_bonus_left integer;
  v_persistent numeric;
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
    raise exception 'Realm of Storms disabled';
  end if;

  -- Idempotency: aynı istek ikinci kez gelirse yeni bahis/ödeme OLUŞMAZ.
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
    -- Admin preview/demo: gerçek cüzdan etkilenmez, analytics'e adminTest yazılır.
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
    coalesce(p_result->>'mathVersion', 'storm-v1'),
    coalesce(p_result->>'configVersion', 'storm-cfg-v1'),
    coalesce(p_result->>'paytableVersion', 'storm-pay-v1'),
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
  set result_snapshot = result_snapshot
    || jsonb_build_object('roundId', v_round_id, 'balanceAfter', v_balance_after)
  where id = v_round_id;

  -- Bonus sayaçları — spin ile AYNI transaction içinde (kayıp/çift sayım yok)
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
    jsonb_build_object(
      'bet', p_bet_amount,
      'win', v_win,
      'adminTest', v_is_admin,
      'isBonusSpin', p_is_bonus_spin,
      'bonusLeft', v_bonus_left,
      'persistentMultiplier', v_persistent
    )
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

-- ---------------------------------------------------------------------------
-- 6) Admin analytics — theoretical RTP (simülasyon) ile karıştırılmaz;
--    bu RPC yalnızca OBSERVED değerleri döner. Admin test roundları hariç.
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_admin_stats(
  p_days integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_out jsonb;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  v_start := now() - make_interval(days => greatest(1, p_days));

  with rounds as (
    select *
    from public.kaskad_rounds
    where created_at >= v_start
      and coalesce((result_snapshot->>'adminTest')::boolean, false) = false
  ),
  base as (
    select
      count(*)::bigint as round_count,
      count(distinct user_id)::bigint as active_players,
      coalesce(sum(case when is_bonus_spin then 0 else bet_amount end), 0)::numeric as total_wager,
      coalesce(sum(win_amount), 0)::numeric as total_payout,
      coalesce(avg(bet_amount), 0)::numeric as avg_bet,
      coalesce(avg(win_amount) filter (where win_amount > 0), 0)::numeric as avg_win,
      coalesce(max(win_amount), 0)::numeric as max_win,
      count(*) filter (where win_amount > 0)::bigint as hit_count,
      count(*) filter (where (result_snapshot->>'bonusTriggered')::boolean)::bigint as bonus_count,
      coalesce(avg(jsonb_array_length(result_snapshot->'cascades')), 0)::numeric as avg_cascades
    from rounds
  ),
  mult_dist as (
    select coalesce(jsonb_object_agg(bucket, cnt), '{}'::jsonb) as dist
    from (
      select
        case
          when total_multiplier <= 1 then '1'
          when total_multiplier < 5 then '2-4'
          when total_multiplier < 10 then '5-9'
          when total_multiplier < 25 then '10-24'
          when total_multiplier < 100 then '25-99'
          else '100+'
        end as bucket,
        count(*) as cnt
      from rounds
      group by 1
    ) t
  )
  select jsonb_build_object(
    'periodDays', greatest(1, p_days),
    'activePlayers', base.active_players,
    'roundCount', base.round_count,
    'totalWager', base.total_wager,
    'totalPayout', base.total_payout,
    'observedRtp', case when base.total_wager > 0
      then round(base.total_payout / base.total_wager, 4) else 0 end,
    'hitRate', case when base.round_count > 0
      then round(base.hit_count::numeric / base.round_count, 4) else 0 end,
    'bonusRate', case when base.round_count > 0
      then round(base.bonus_count::numeric / base.round_count, 6) else 0 end,
    'averageBet', round(base.avg_bet, 2),
    'averageWin', round(base.avg_win, 2),
    'averageCascades', round(base.avg_cascades, 2),
    'maxWin', base.max_win,
    'multiplierDistribution', mult_dist.dist
  )
  into v_out
  from base, mult_dist;

  return coalesce(v_out, '{}'::jsonb);
end;
$$;

grant execute on function public.kozmik_kaskad_admin_stats(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Admin refund — reason zorunlu, audit log'lu, idempotent.
--    Yalnızca kullanıcı bahsini iade eder (kazanç geri alınmaz;
--    hatalı roundlarda operasyon kararı admin'dedir).
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_admin_refund(
  p_round_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round public.kaskad_rounds%rowtype;
  v_coins bigint;
  v_refund bigint;
  v_after bigint;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'Refund reason required';
  end if;

  select * into v_round from public.kaskad_rounds where id = p_round_id for update;
  if not found then raise exception 'Round not found'; end if;
  if v_round.status = 'failed' then
    return jsonb_build_object('ok', false, 'error', 'already_refunded');
  end if;
  if v_round.is_bonus_spin then
    return jsonb_build_object('ok', false, 'error', 'bonus_spin_has_no_bet');
  end if;

  v_refund := v_round.bet_amount;

  select coins into v_coins from public.wallets
  where user_id = v_round.user_id for update;
  if v_coins is null then raise exception 'Wallet not found'; end if;

  v_after := v_coins + v_refund;

  update public.wallets
  set coins = v_after, updated_at = now()
  where user_id = v_round.user_id;

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
  values (v_round.user_id, 'coins', v_refund, v_after, 'kaskad_refund', 'kaskad_round', v_round.id);

  insert into public.kaskad_transactions (round_id, user_id, delta, balance_after, reason)
  values (v_round.id, v_round.user_id, v_refund, v_after, 'refund');

  update public.kaskad_rounds set status = 'failed' where id = v_round.id;

  insert into public.kaskad_round_events (round_id, event_type, payload)
  values (v_round.id, 'refunded', jsonb_build_object('amount', v_refund, 'reason', p_reason));

  insert into public.kaskad_audit_logs (user_id, admin_user_id, action, round_id, payload)
  values (
    v_round.user_id,
    auth.uid(),
    'admin_refund',
    v_round.id,
    jsonb_build_object(
      'reason', p_reason,
      'amount', v_refund,
      'old_state', v_round.status,
      'new_state', 'failed'
    )
  );

  return jsonb_build_object('ok', true, 'refund', v_refund, 'balanceAfter', v_after);
end;
$$;

grant execute on function public.kozmik_kaskad_admin_refund(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) Admin math profil yönetimi — immutable version akışı.
--    Var olan versiyon DEĞİŞTİRİLMEZ; yeni versiyon oluşturulur + aktive edilir.
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_admin_math_list()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'mathVersion', math_version,
          'isActive', is_active,
          'createdAt', created_at,
          'config', config
        )
        order by created_at desc
      )
      from public.kaskad_math_versions
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.kozmik_kaskad_admin_math_list() to authenticated;

create or replace function public.kozmik_kaskad_admin_math_create(
  p_math_version text,
  p_config jsonb,
  p_activate boolean default false,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_math_version is null or length(trim(p_math_version)) < 3 then
    raise exception 'math_version required';
  end if;
  if p_config is null then raise exception 'config required'; end if;
  if exists (
    select 1 from public.kaskad_math_versions where math_version = p_math_version
  ) then
    raise exception 'math_version already exists (immutable — create new version)';
  end if;

  insert into public.kaskad_math_versions (math_version, config, is_active)
  values (p_math_version, p_config, false);

  if p_activate then
    update public.kaskad_math_versions set is_active = false where math_version <> p_math_version;
    update public.kaskad_math_versions set is_active = true where math_version = p_math_version;
  end if;

  insert into public.kaskad_audit_logs (admin_user_id, action, payload)
  values (
    auth.uid(),
    'admin_math_create',
    jsonb_build_object(
      'mathVersion', p_math_version,
      'activated', p_activate,
      'reason', coalesce(p_reason, '')
    )
  );

  return jsonb_build_object('ok', true, 'mathVersion', p_math_version, 'active', p_activate);
end;
$$;

grant execute on function public.kozmik_kaskad_admin_math_create(text, jsonb, boolean, text) to authenticated;

create or replace function public.kozmik_kaskad_admin_math_activate(
  p_math_version text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if not exists (
    select 1 from public.kaskad_math_versions where math_version = p_math_version
  ) then
    raise exception 'math_version not found';
  end if;

  update public.kaskad_math_versions set is_active = false where math_version <> p_math_version;
  update public.kaskad_math_versions set is_active = true where math_version = p_math_version;

  insert into public.kaskad_audit_logs (admin_user_id, action, payload)
  values (
    auth.uid(),
    'admin_math_activate',
    jsonb_build_object('mathVersion', p_math_version, 'reason', coalesce(p_reason, ''))
  );

  return jsonb_build_object('ok', true, 'mathVersion', p_math_version);
end;
$$;

grant execute on function public.kozmik_kaskad_admin_math_activate(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9) Simülasyon raporu kaydet / listele (admin)
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_admin_sim_kaydet(
  p_math_version text,
  p_rounds integer,
  p_bet_amount bigint,
  p_report jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  insert into public.kaskad_simulation_runs (admin_user_id, math_version, rounds, bet_amount, report)
  values (auth.uid(), p_math_version, p_rounds, p_bet_amount, p_report)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.kozmik_kaskad_admin_sim_kaydet(text, integer, bigint, jsonb) to authenticated;

create or replace function public.kozmik_kaskad_admin_sim_listesi(
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'mathVersion', math_version,
          'rounds', rounds,
          'betAmount', bet_amount,
          'report', report,
          'createdAt', created_at
        )
        order by created_at desc
      )
      from (
        select * from public.kaskad_simulation_runs
        order by created_at desc
        limit greatest(1, least(100, p_limit))
      ) t
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.kozmik_kaskad_admin_sim_listesi(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 10) Admin audit listesi + round arama (refund için)
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_admin_audit_listesi(
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'userId', user_id,
          'adminUserId', admin_user_id,
          'action', action,
          'roundId', round_id,
          'payload', payload,
          'createdAt', created_at
        )
        order by created_at desc
      )
      from (
        select * from public.kaskad_audit_logs
        order by created_at desc
        limit greatest(1, least(200, p_limit))
      ) t
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.kozmik_kaskad_admin_audit_listesi(integer) to authenticated;

create or replace function public.kozmik_kaskad_admin_round_listesi(
  p_limit integer default 30,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'userId', user_id,
          'status', status,
          'betAmount', bet_amount,
          'winAmount', win_amount,
          'totalMultiplier', total_multiplier,
          'mathVersion', math_version,
          'isBonusSpin', is_bonus_spin,
          'createdAt', created_at
        )
        order by created_at desc
      )
      from (
        select * from public.kaskad_rounds
        where p_user_id is null or user_id = p_user_id
        order by created_at desc
        limit greatest(1, least(100, p_limit))
      ) t
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.kozmik_kaskad_admin_round_listesi(integer, uuid) to authenticated;

notify pgrst, 'reload schema';
