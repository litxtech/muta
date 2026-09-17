-- Oyun kazançları: push değil — uygulama içi balon + oda sıralaması + ajans win/loss

create table if not exists public.oyun_kazanc_duyurulari (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  game_code text not null,
  game_title text not null,
  win_amount bigint not null check (win_amount > 0),
  bet_amount bigint not null default 0,
  round_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists oyun_kazanc_duyurulari_created_idx
  on public.oyun_kazanc_duyurulari (created_at desc);

alter table public.oyun_kazanc_duyurulari enable row level security;

drop policy if exists "Oyun kazanc duyuru okuma" on public.oyun_kazanc_duyurulari;
create policy "Oyun kazanc duyuru okuma" on public.oyun_kazanc_duyurulari
  for select to authenticated using (true);

grant select on public.oyun_kazanc_duyurulari to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.oyun_kazanc_duyurulari;
exception when duplicate_object then null;
end $$;

create table if not exists public.oda_oyun_coin_istatistik (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  won_coin bigint not null default 0,
  spent_coin bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists oda_oyun_coin_istatistik_room_won_idx
  on public.oda_oyun_coin_istatistik (room_id, won_coin desc);

create index if not exists oda_oyun_coin_istatistik_room_spent_idx
  on public.oda_oyun_coin_istatistik (room_id, spent_coin desc);

alter table public.oda_oyun_coin_istatistik enable row level security;

drop policy if exists "Oda oyun coin okuma" on public.oda_oyun_coin_istatistik;
create policy "Oda oyun coin okuma" on public.oda_oyun_coin_istatistik
  for select to authenticated using (true);

grant select on public.oda_oyun_coin_istatistik to authenticated;

create or replace function public.oda_oyun_coin_ekle(
  p_room_id uuid,
  p_user_id uuid,
  p_won bigint default 0,
  p_spent bigint default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_room_id is null or p_user_id is null then return; end if;
  if coalesce(p_won, 0) <= 0 and coalesce(p_spent, 0) <= 0 then return; end if;

  insert into public.oda_oyun_coin_istatistik (room_id, user_id, won_coin, spent_coin)
  values (p_room_id, p_user_id, greatest(coalesce(p_won, 0), 0), greatest(coalesce(p_spent, 0), 0))
  on conflict (room_id, user_id) do update set
    won_coin = oda_oyun_coin_istatistik.won_coin + excluded.won_coin,
    spent_coin = oda_oyun_coin_istatistik.spent_coin + excluded.spent_coin,
    updated_at = now();
end;
$$;

revoke all on function public.oda_oyun_coin_ekle(uuid, uuid, bigint, bigint) from public;
grant execute on function public.oda_oyun_coin_ekle(uuid, uuid, bigint, bigint) to service_role;

create or replace function public.oyun_kazanc_duyuru_yaz(
  p_user_id uuid,
  p_room_id uuid,
  p_game_code text,
  p_game_title text,
  p_win bigint,
  p_bet bigint default 0,
  p_round_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_win bigint := floor(coalesce(p_win, 0))::bigint;
begin
  if v_win < 100 then return; end if;

  insert into public.oyun_kazanc_duyurulari (
    user_id, room_id, game_code, game_title, win_amount, bet_amount, round_id
  ) values (
    p_user_id,
    p_room_id,
    coalesce(nullif(trim(p_game_code), ''), 'oyun'),
    coalesce(nullif(trim(p_game_title), ''), 'Oyun'),
    v_win,
    greatest(coalesce(p_bet, 0), 0),
    p_round_id
  );
end;
$$;

revoke all on function public.oyun_kazanc_duyuru_yaz(uuid, uuid, text, text, bigint, bigint, uuid) from public;
grant execute on function public.oyun_kazanc_duyuru_yaz(uuid, uuid, text, text, bigint, bigint, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3) Settle spin — istatistik + duyuru
-- ---------------------------------------------------------------------------
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
  if not public.ozellik_bayragi_aktif_mi('kozmik_kaskad_enabled') then
    raise exception 'Realm of Storms disabled';
  end if;

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

    v_win_floor := floor(v_win)::bigint;
    if v_win_floor > 0 then
      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user_id, 'coins', v_win_floor, v_balance_after, 'kaskad_win', 'kaskad_round', v_round_id);
      insert into public.kaskad_transactions (round_id, user_id, delta, balance_after, reason)
      values (v_round_id, p_user_id, v_win_floor, v_balance_after, 'win');
    end if;

    if p_room_id is not null then
      perform public.oda_oyun_coin_ekle(p_room_id, p_user_id, v_win_floor, v_debit);
    end if;
    if v_win_floor > 0 then
      perform public.oyun_kazanc_duyuru_yaz(
        p_user_id,
        p_room_id,
        'kozmik_kaskad',
        'Realm of Storms',
        v_win_floor,
        p_bet_amount,
        v_round_id
      );
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
-- 4) Match-3 giriş / ödül → oda istatistik + balon
-- ---------------------------------------------------------------------------
create or replace function public.oda_oyun_coin_ledger_tetik()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room uuid;
  v_title text;
  v_code text;
begin
  if new.currency is distinct from 'coins' then
    return new;
  end if;

  if new.reason = 'game_entry' and new.delta < 0 and new.ref_type = 'game_session' then
    select gs.room_id, gs.game_code,
      case gs.game_code
        when 'match3' then 'Kristal Savaşı'
        when 'kozmik_kaskad' then 'Realm of Storms'
        else coalesce(gs.game_code, 'Oyun')
      end
    into v_room, v_code, v_title
    from public.game_sessions gs
    where gs.id = new.ref_id;
    if v_room is not null then
      perform public.oda_oyun_coin_ekle(v_room, new.user_id, 0, abs(new.delta));
    end if;
  elsif new.reason = 'game_reward' and new.delta > 0 and new.ref_type = 'game_session' then
    select gs.room_id, gs.game_code,
      case gs.game_code
        when 'match3' then 'Kristal Savaşı'
        when 'kozmik_kaskad' then 'Realm of Storms'
        else coalesce(gs.game_code, 'Oyun')
      end
    into v_room, v_code, v_title
    from public.game_sessions gs
    where gs.id = new.ref_id;
    if v_room is not null then
      perform public.oda_oyun_coin_ekle(v_room, new.user_id, new.delta, 0);
      perform public.oyun_kazanc_duyuru_yaz(
        new.user_id, v_room, coalesce(v_code, 'match3'), coalesce(v_title, 'Oyun'),
        new.delta, 0, new.ref_id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists oda_oyun_coin_ledger_trg on public.wallet_ledger;
create trigger oda_oyun_coin_ledger_trg
  after insert on public.wallet_ledger
  for each row
  when (new.reason in ('game_entry', 'game_reward'))
  execute function public.oda_oyun_coin_ledger_tetik();

create or replace function public.oda_oyun_siralamasi(
  p_room_id uuid,
  p_limit int default 20
)
returns table (
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  won_coin bigint,
  spent_coin bigint,
  net_coin bigint,
  rank int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_room_id is null then raise exception 'room required'; end if;

  return query
  select
    s.user_id,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Oyuncu')::text,
    p.username,
    p.avatar_url,
    s.won_coin,
    s.spent_coin,
    (s.won_coin - s.spent_coin)::bigint as net_coin,
    row_number() over (
      order by s.won_coin desc, s.spent_coin desc, s.updated_at desc
    )::int as rank
  from public.oda_oyun_coin_istatistik s
  join public.profiles p on p.id = s.user_id
  where s.room_id = p_room_id
    and (s.won_coin > 0 or s.spent_coin > 0)
  order by s.won_coin desc, s.spent_coin desc
  limit v_limit;
end;
$$;

grant execute on function public.oda_oyun_siralamasi(uuid, int) to authenticated;

create or replace function public.benim_host_odam()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r public.rooms%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into r
  from public.rooms
  where host_id = v_uid and coalesce(is_live, false) = true
  order by created_at desc
  limit 1;

  if not found then
    select * into r
    from public.rooms
    where host_id = v_uid
    order by created_at desc
    limit 1;
  end if;

  if not found then
    return jsonb_build_object('ok', false, 'hata', 'Kendi odan yok — önce bir ses odası aç.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'room_id', r.id,
    'title', r.title,
    'is_live', coalesce(r.is_live, false)
  );
end;
$$;

grant execute on function public.benim_host_odam() to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Odalar board — oyun coin hacmi (liderlik yenile içine ek)
-- ---------------------------------------------------------------------------
create or replace function public.liderlik_siralamasi_yenile(
  p_board_type text,
  p_period text default 'daily'
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := lower(coalesce(nullif(trim(p_period), ''), 'daily'));
  v_key text := public.liderlik_period_key(v_period);
  v_start timestamptz := public.liderlik_period_baslangic(v_period);
  v_count int := 0;
begin
  if v_period not in ('daily', 'weekly', 'monthly', 'all_time') then
    raise exception 'Gecersiz period';
  end if;

  if p_board_type = 'gifter' then
    delete from public.leaderboard_snapshots
    where board_type = 'gifter' and period = v_period and period_key = v_key;

    if v_period = 'all_time' then
      insert into public.leaderboard_snapshots (board_type, period, period_key, user_id, score, rank)
      select 'gifter', v_period, v_key, s.user_id, s.total_spent_coin,
        row_number() over (order by s.total_spent_coin desc)
      from public.user_profile_stats s
      left join public.user_privacy_settings pr on pr.user_id = s.user_id
      where s.total_spent_coin > 0
        and coalesce(pr.hide_gifter_rank, false) = false
      order by s.total_spent_coin desc
      limit 100;
    else
      insert into public.leaderboard_snapshots (board_type, period, period_key, user_id, score, rank)
      select 'gifter', v_period, v_key, g.sender_id, sum(g.coins_spent)::bigint,
        row_number() over (order by sum(g.coins_spent) desc)
      from public.gift_transactions g
      left join public.user_privacy_settings pr on pr.user_id = g.sender_id
      where g.created_at >= v_start
        and coalesce(pr.hide_gifter_rank, false) = false
      group by g.sender_id
      having sum(g.coins_spent) > 0
      order by sum(g.coins_spent) desc
      limit 100;
    end if;
    get diagnostics v_count = row_count;

  elsif p_board_type = 'top_recharge' then
    delete from public.leaderboard_snapshots
    where board_type = 'top_recharge' and period = v_period and period_key = v_key;

    if v_period = 'all_time' then
      insert into public.leaderboard_snapshots (board_type, period, period_key, user_id, score, rank)
      select 'top_recharge', v_period, v_key, s.user_id, s.total_topup_coin,
        row_number() over (order by s.total_topup_coin desc)
      from public.user_profile_stats s
      left join public.user_privacy_settings pr on pr.user_id = s.user_id
      where s.total_topup_coin > 0
        and coalesce(pr.hide_recharge_rank, false) = false
      order by s.total_topup_coin desc
      limit 100;
    else
      insert into public.leaderboard_snapshots (board_type, period, period_key, user_id, score, rank)
      select 'top_recharge', v_period, v_key, c.user_id, sum(c.coins_added)::bigint,
        row_number() over (order by sum(c.coins_added) desc)
      from public.coin_purchases c
      left join public.user_privacy_settings pr on pr.user_id = c.user_id
      where c.status = 'completed'
        and c.created_at >= v_start
        and coalesce(pr.hide_recharge_rank, false) = false
      group by c.user_id
      having sum(c.coins_added) > 0
      order by sum(c.coins_added) desc
      limit 100;
    end if;
    get diagnostics v_count = row_count;

  elsif p_board_type = 'host' then
    delete from public.leaderboard_snapshots
    where board_type = 'host' and period = v_period and period_key = v_key;

    insert into public.leaderboard_snapshots (board_type, period, period_key, user_id, score, rank)
    select 'host', v_period, v_key, s.user_id, s.total_gifts_received,
      row_number() over (order by s.total_gifts_received desc)
    from public.user_profile_stats s
    where s.total_gifts_received > 0
    order by s.total_gifts_received desc
    limit 100;
    get diagnostics v_count = row_count;

  elsif p_board_type = 'room' then
    delete from public.leaderboard_snapshots
    where board_type = 'room' and period = v_period and period_key = v_key;

    insert into public.leaderboard_snapshots (
      board_type, period, period_key, user_id, room_id, score, rank
    )
    select
      'room', v_period, v_key, r.host_id, x.room_id, x.skor,
      row_number() over (order by x.skor desc)
    from (
      select s.room_id, sum(s.won_coin + s.spent_coin)::bigint as skor
      from public.oda_oyun_coin_istatistik s
      group by s.room_id
      having sum(s.won_coin + s.spent_coin) > 0
    ) x
    join public.rooms r on r.id = x.room_id
    where r.host_id is not null
    order by x.skor desc
    limit 100;
    get diagnostics v_count = row_count;
  end if;

  return v_count;
end;
$$;

grant execute on function public.liderlik_siralamasi_yenile(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Ajans sahibi: üye oyun kazanç / kayıp (₺ client'ta)
-- ---------------------------------------------------------------------------
create or replace function public.ajans_uye_oyun_ozeti(p_agency_id uuid)
returns table (
  user_id uuid,
  oyun_kazanc_coin bigint,
  oyun_kayip_coin bigint,
  oyun_kazanc_coin_ay bigint,
  oyun_kayip_coin_ay bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.agencies%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into a from public.agencies where id = p_agency_id;
  if not found then raise exception 'Ajans bulunamadi'; end if;
  if a.owner_id <> v_uid and not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;

  return query
  select
    hp.user_id,
    coalesce((
      select sum(wl.delta)::bigint
      from public.wallet_ledger wl
      where wl.user_id = hp.user_id and wl.currency = 'coins' and wl.delta > 0
        and wl.reason in ('kaskad_win', 'game_reward')
    ), 0),
    coalesce((
      select sum(abs(wl.delta))::bigint
      from public.wallet_ledger wl
      where wl.user_id = hp.user_id and wl.currency = 'coins' and wl.delta < 0
        and wl.reason in ('kaskad_bet', 'game_entry')
    ), 0),
    coalesce((
      select sum(wl.delta)::bigint
      from public.wallet_ledger wl
      where wl.user_id = hp.user_id and wl.currency = 'coins' and wl.delta > 0
        and wl.reason in ('kaskad_win', 'game_reward')
        and wl.created_at >= date_trunc('month', now())
    ), 0),
    coalesce((
      select sum(abs(wl.delta))::bigint
      from public.wallet_ledger wl
      where wl.user_id = hp.user_id and wl.currency = 'coins' and wl.delta < 0
        and wl.reason in ('kaskad_bet', 'game_entry')
        and wl.created_at >= date_trunc('month', now())
    ), 0)
  from public.host_profiles hp
  where hp.agency_id = p_agency_id and hp.status = 'agency';
end;
$$;

grant execute on function public.ajans_uye_oyun_ozeti(uuid) to authenticated;
