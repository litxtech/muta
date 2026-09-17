-- ============================================================================
-- 083 — Realm of Storms admin operasyon merkezi
--   1) kaskad_game_settings: acil durdurma, bakım, bet limitleri,
--      autoplay/turbo, günlük kullanıcı limitleri (tek satır, audit'li)
--   2) kaskad_rtp_schedule: tarih/saat aralığına RTP (math profili) atama.
--      NOT: Kullanıcı bazlı gizli sonuç manipülasyonu YOKTUR — takvimdeki
--      profil o aralıkta TÜM oyunculara aynı şekilde uygulanır ve audit'lenir.
--   3) İki ek kalibre profil: storm-tight-v1 (~%89 RTP),
--      storm-generous-v1 (~%98 RTP). storm-v1 (%93.8) aktif kalır.
--   4) Geçerli math çözümleme (takvim > aktif) + aktif_config birleştirme
--   5) settle_spin: bakım/durdurma + günlük limit zorlaması
--   6) Admin RPC'leri: settings get/update, schedule list/create/cancel,
--      math_list'e son simülasyon RTP'si
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Oyun ayarları — tek satır
-- ---------------------------------------------------------------------------
create table if not exists public.kaskad_game_settings (
  id smallint primary key default 1 check (id = 1),
  -- Acil durdurma: yeni round başlamaz; başlamış bonus spinleri adil biter
  game_paused boolean not null default false,
  -- Bakım: oyun tamamen kapalı (admin test hariç)
  maintenance_mode boolean not null default false,
  maintenance_message text,
  -- Bet override'ları (null → aktif math profili değeri geçerli)
  min_bet bigint,
  max_bet bigint,
  bet_presets jsonb,
  autoplay_enabled boolean,
  turbo_enabled boolean,
  -- Kullanıcı başına günlük koruma limitleri (null → limitsiz, UTC günü)
  max_daily_wager bigint,
  max_daily_loss bigint,
  max_rounds_per_day integer,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.kaskad_game_settings (id) values (1)
on conflict (id) do nothing;

alter table public.kaskad_game_settings enable row level security;
-- Erişim yalnızca security definer RPC + service role üzerinden.

-- ---------------------------------------------------------------------------
-- 2) RTP takvimi
-- ---------------------------------------------------------------------------
create table if not exists public.kaskad_rtp_schedule (
  id uuid primary key default gen_random_uuid(),
  math_version text not null references public.kaskad_math_versions(math_version),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint kaskad_rtp_schedule_window check (ends_at > starts_at)
);

create index if not exists kaskad_rtp_schedule_aktif_idx
  on public.kaskad_rtp_schedule (status, starts_at, ends_at);

alter table public.kaskad_rtp_schedule enable row level security;

-- Günlük limit sorguları için indeks
create index if not exists kaskad_rounds_user_gun_idx
  on public.kaskad_rounds (user_id, created_at);

-- ---------------------------------------------------------------------------
-- 3) Ek kalibre RTP profilleri (immutable; simülasyonla doğrulandı)
--    storm-tight-v1: 300k round → RTP %89.18
--    storm-generous-v1: 300k round → RTP %97.82
-- ---------------------------------------------------------------------------
insert into public.kaskad_math_versions (math_version, config, is_active)
values (
  'storm-tight-v1',
  '{
    "mathVersion":"storm-tight-v1",
    "paytableVersion":"storm-pay-tight-v1",
    "configVersion":"storm-cfg-v1",
    "columns":6,
    "rows":5,
    "minMatchCount":8,
    "paytable":{
      "blueCrystal":{"8":0.2,"10":0.64,"12":1.6},
      "greenCrystal":{"8":0.2,"10":0.64,"12":1.6},
      "purpleCrystal":{"8":0.34,"10":0.71,"12":1.88},
      "redCrystal":{"8":0.34,"10":0.71,"12":1.88},
      "goldCrystal":{"8":0.43,"10":0.94,"12":2.35},
      "stormRing":{"8":0.8,"10":1.97,"12":4.7},
      "celestialCup":{"8":1.22,"10":3.2,"12":7.99},
      "timeCore":{"8":1.97,"10":4.7,"12":11.75},
      "energyCrown":{"8":3.29,"10":7.99,"12":19.74}
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

insert into public.kaskad_math_versions (math_version, config, is_active)
values (
  'storm-generous-v1',
  '{
    "mathVersion":"storm-generous-v1",
    "paytableVersion":"storm-pay-generous-v1",
    "configVersion":"storm-cfg-v1",
    "columns":6,
    "rows":5,
    "minMatchCount":8,
    "paytable":{
      "blueCrystal":{"8":0.22,"10":0.7,"12":1.76},
      "greenCrystal":{"8":0.22,"10":0.7,"12":1.76},
      "purpleCrystal":{"8":0.37,"10":0.78,"12":2.07},
      "redCrystal":{"8":0.37,"10":0.78,"12":2.07},
      "goldCrystal":{"8":0.48,"10":1.03,"12":2.59},
      "stormRing":{"8":0.88,"10":2.17,"12":5.18},
      "celestialCup":{"8":1.35,"10":3.52,"12":8.8},
      "timeCore":{"8":2.17,"10":5.18,"12":12.94},
      "energyCrown":{"8":3.62,"10":8.8,"12":21.74}
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

-- Doğrulanmış simülasyon özetleri — admin panelde profil RTP'si görünsün
insert into public.kaskad_simulation_runs (math_version, rounds, bet_amount, report)
select 'storm-v1', 1000000, 100,
  '{"observedRtp":0.93769645,"baseGameRtp":0.81277687,"bonusRtp":0.12491958,"hitRate":0.390666,"bonusFrequency":0.001094,"maxWinMultiple":2370.74,"source":"scripts/kaskad-simulator.ts"}'::jsonb
where not exists (
  select 1 from public.kaskad_simulation_runs where math_version = 'storm-v1'
);

insert into public.kaskad_simulation_runs (math_version, rounds, bet_amount, report)
select 'storm-tight-v1', 300000, 100,
  '{"observedRtp":0.8918,"bonusRtp":0.1343,"hitRate":0.3898,"maxWinMultiple":4529,"source":"scripts/kaskad-calibrate.ts scale=0.94"}'::jsonb
where not exists (
  select 1 from public.kaskad_simulation_runs where math_version = 'storm-tight-v1'
);

insert into public.kaskad_simulation_runs (math_version, rounds, bet_amount, report)
select 'storm-generous-v1', 300000, 100,
  '{"observedRtp":0.9782,"bonusRtp":0.1473,"hitRate":0.3898,"maxWinMultiple":4979,"source":"scripts/kaskad-calibrate.ts scale=1.035"}'::jsonb
where not exists (
  select 1 from public.kaskad_simulation_runs where math_version = 'storm-generous-v1'
);

-- ---------------------------------------------------------------------------
-- 4) Geçerli math çözümleme — takvim penceresi > aktif profil
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_gecerli_math()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version text;
  v_config jsonb;
  v_source text;
begin
  -- Şu an geçerli takvim penceresi (en son oluşturulan kazanır)
  select s.math_version, m.config
  into v_version, v_config
  from public.kaskad_rtp_schedule s
  join public.kaskad_math_versions m on m.math_version = s.math_version
  where s.status = 'active'
    and now() >= s.starts_at
    and now() < s.ends_at
  order by s.created_at desc
  limit 1;

  if v_version is not null then
    v_source := 'schedule';
  else
    select math_version, config
    into v_version, v_config
    from public.kaskad_math_versions
    where is_active
    order by created_at desc
    limit 1;
    v_source := 'active';
  end if;

  return jsonb_build_object(
    'mathVersion', v_version,
    'config', coalesce(v_config, '{}'::jsonb),
    'source', v_source
  );
end;
$$;

grant execute on function public.kozmik_kaskad_gecerli_math() to authenticated;
grant execute on function public.kozmik_kaskad_gecerli_math() to service_role;

-- ---------------------------------------------------------------------------
-- 5) aktif_config — geçerli math + ayar override'ları + durum
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_aktif_config()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_cfg jsonb;
  s public.kaskad_game_settings%rowtype;
begin
  v := public.kozmik_kaskad_gecerli_math();
  v_cfg := v->'config';

  select * into s from public.kaskad_game_settings where id = 1;
  if found then
    if s.min_bet is not null then
      v_cfg := v_cfg || jsonb_build_object('minBet', s.min_bet);
    end if;
    if s.max_bet is not null then
      v_cfg := v_cfg || jsonb_build_object('maxBet', s.max_bet);
    end if;
    if s.bet_presets is not null then
      v_cfg := v_cfg || jsonb_build_object('betPresets', s.bet_presets);
    end if;
    if s.autoplay_enabled is not null then
      v_cfg := v_cfg || jsonb_build_object('autoplayEnabled', s.autoplay_enabled);
    end if;
    if s.turbo_enabled is not null then
      v_cfg := v_cfg || jsonb_build_object('turboEnabled', s.turbo_enabled);
    end if;
  end if;

  return v_cfg || jsonb_build_object(
    'durum', jsonb_build_object(
      'gamePaused', coalesce(s.game_paused, false),
      'maintenance', coalesce(s.maintenance_mode, false),
      'maintenanceMessage', coalesce(s.maintenance_message, ''),
      'mathSource', v->>'source'
    )
  );
end;
$$;

grant execute on function public.kozmik_kaskad_aktif_config() to authenticated;
grant execute on function public.kozmik_kaskad_aktif_config() to service_role;

-- ---------------------------------------------------------------------------
-- 6) settle_spin — bakım/durdurma + günlük limitler eklendi
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

  if public.kill_switch_aktif_mi('kill_games') then raise exception 'Games temporarily disabled'; end if;
  if public.kill_switch_aktif_mi('kill_game_coin') and not v_is_admin then
    raise exception 'Game coin disabled';
  end if;
  if not public.ozellik_bayragi_aktif_mi('games_enabled') then raise exception 'Games feature disabled'; end if;
  if not public.ozellik_bayragi_aktif_mi('kozmik_kaskad_enabled') then
    raise exception 'Realm of Storms disabled';
  end if;

  -- Oyun ayarları zorlaması (admin test muaf)
  select * into v_settings from public.kaskad_game_settings where id = 1;
  if found and not v_is_admin then
    if v_settings.maintenance_mode then
      raise exception 'Oyun bakımda: %',
        coalesce(nullif(v_settings.maintenance_message, ''), 'kısa süre sonra tekrar deneyin');
    end if;
    -- Acil durdurma: yeni round yok; başlamış bonus adil şekilde biter
    if v_settings.game_paused and not p_is_bonus_spin then
      raise exception 'Oyun geçici olarak durduruldu';
    end if;

    -- Günlük kullanıcı limitleri (UTC günü, bonus spin bahis çekmediği için hariç)
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
-- 7) Admin RPC'leri — ayarlar
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_admin_settings_get()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.kaskad_game_settings%rowtype;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  select * into s from public.kaskad_game_settings where id = 1;
  return jsonb_build_object(
    'gamePaused', s.game_paused,
    'maintenanceMode', s.maintenance_mode,
    'maintenanceMessage', coalesce(s.maintenance_message, ''),
    'minBet', s.min_bet,
    'maxBet', s.max_bet,
    'betPresets', s.bet_presets,
    'autoplayEnabled', s.autoplay_enabled,
    'turboEnabled', s.turbo_enabled,
    'maxDailyWager', s.max_daily_wager,
    'maxDailyLoss', s.max_daily_loss,
    'maxRoundsPerDay', s.max_rounds_per_day,
    'updatedAt', s.updated_at
  );
end;
$$;

grant execute on function public.kozmik_kaskad_admin_settings_get() to authenticated;

create or replace function public.kozmik_kaskad_admin_settings_update(
  p_patch jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'Gerekçe zorunlu (audit)';
  end if;

  select to_jsonb(s) into v_old from public.kaskad_game_settings s where id = 1;

  update public.kaskad_game_settings set
    game_paused = coalesce((p_patch->>'gamePaused')::boolean, game_paused),
    maintenance_mode = coalesce((p_patch->>'maintenanceMode')::boolean, maintenance_mode),
    maintenance_message = case
      when p_patch ? 'maintenanceMessage' then p_patch->>'maintenanceMessage'
      else maintenance_message
    end,
    min_bet = case when p_patch ? 'minBet'
      then nullif(p_patch->>'minBet', '')::bigint else min_bet end,
    max_bet = case when p_patch ? 'maxBet'
      then nullif(p_patch->>'maxBet', '')::bigint else max_bet end,
    bet_presets = case when p_patch ? 'betPresets'
      then p_patch->'betPresets' else bet_presets end,
    autoplay_enabled = case when p_patch ? 'autoplayEnabled'
      then (p_patch->>'autoplayEnabled')::boolean else autoplay_enabled end,
    turbo_enabled = case when p_patch ? 'turboEnabled'
      then (p_patch->>'turboEnabled')::boolean else turbo_enabled end,
    max_daily_wager = case when p_patch ? 'maxDailyWager'
      then nullif(p_patch->>'maxDailyWager', '')::bigint else max_daily_wager end,
    max_daily_loss = case when p_patch ? 'maxDailyLoss'
      then nullif(p_patch->>'maxDailyLoss', '')::bigint else max_daily_loss end,
    max_rounds_per_day = case when p_patch ? 'maxRoundsPerDay'
      then nullif(p_patch->>'maxRoundsPerDay', '')::integer else max_rounds_per_day end,
    updated_by = auth.uid(),
    updated_at = now()
  where id = 1;

  insert into public.kaskad_audit_logs (admin_user_id, action, payload)
  values (
    auth.uid(),
    'admin_settings_update',
    jsonb_build_object('patch', p_patch, 'old', v_old, 'reason', p_reason)
  );

  return public.kozmik_kaskad_admin_settings_get();
end;
$$;

grant execute on function public.kozmik_kaskad_admin_settings_update(jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) Admin RPC'leri — RTP takvimi
-- ---------------------------------------------------------------------------
create or replace function public.kozmik_kaskad_admin_schedule_list(
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
          'id', t.id,
          'mathVersion', t.math_version,
          'startsAt', t.starts_at,
          'endsAt', t.ends_at,
          'reason', t.reason,
          'status', t.status,
          'isLive', (t.status = 'active' and now() >= t.starts_at and now() < t.ends_at),
          'createdAt', t.created_at
        )
        order by t.starts_at desc
      )
      from (
        select * from public.kaskad_rtp_schedule
        order by starts_at desc
        limit greatest(1, least(100, p_limit))
      ) t
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.kozmik_kaskad_admin_schedule_list(integer) to authenticated;

create or replace function public.kozmik_kaskad_admin_schedule_create(
  p_math_version text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text
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
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'Gerekçe zorunlu (audit)';
  end if;
  if not exists (
    select 1 from public.kaskad_math_versions where math_version = p_math_version
  ) then
    raise exception 'math_version bulunamadı';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'Bitiş başlangıçtan sonra olmalı';
  end if;
  if p_ends_at <= now() then
    raise exception 'Geçmişe takvim eklenemez';
  end if;

  insert into public.kaskad_rtp_schedule
    (math_version, starts_at, ends_at, reason, created_by)
  values (p_math_version, p_starts_at, p_ends_at, p_reason, auth.uid())
  returning id into v_id;

  insert into public.kaskad_audit_logs (admin_user_id, action, payload)
  values (
    auth.uid(),
    'admin_rtp_schedule_create',
    jsonb_build_object(
      'scheduleId', v_id,
      'mathVersion', p_math_version,
      'startsAt', p_starts_at,
      'endsAt', p_ends_at,
      'reason', p_reason
    )
  );

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.kozmik_kaskad_admin_schedule_create(text, timestamptz, timestamptz, text) to authenticated;

create or replace function public.kozmik_kaskad_admin_schedule_cancel(
  p_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.kaskad_rtp_schedule%rowtype;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'Gerekçe zorunlu (audit)';
  end if;

  select * into v_row from public.kaskad_rtp_schedule where id = p_id for update;
  if not found then raise exception 'Takvim kaydı bulunamadı'; end if;
  if v_row.status = 'cancelled' then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  update public.kaskad_rtp_schedule set status = 'cancelled' where id = p_id;

  insert into public.kaskad_audit_logs (admin_user_id, action, payload)
  values (
    auth.uid(),
    'admin_rtp_schedule_cancel',
    jsonb_build_object('scheduleId', p_id, 'reason', p_reason)
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.kozmik_kaskad_admin_schedule_cancel(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9) math_list — son simülasyon RTP'si eklendi
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
          'mathVersion', m.math_version,
          'isActive', m.is_active,
          'createdAt', m.created_at,
          'config', m.config,
          'lastSimRtp', (
            select (r.report->>'observedRtp')::numeric
            from public.kaskad_simulation_runs r
            where r.math_version = m.math_version
            order by r.created_at desc
            limit 1
          )
        )
        order by m.created_at desc
      )
      from public.kaskad_math_versions m
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.kozmik_kaskad_admin_math_list() to authenticated;

notify pgrst, 'reload schema';
