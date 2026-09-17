-- Oda sıralaması: bu hafta odada harcanan hediye + oyun coin.
-- period_key ISO hafta (Pazartesi) değişince tablo sıfırlanmış görünür.

create index if not exists kaskad_sessions_room_idx
  on public.kaskad_sessions (room_id)
  where room_id is not null;

create index if not exists gift_tx_room_period_idx
  on public.gift_transactions (created_at)
  where room_id is not null;

create index if not exists kaskad_tx_bet_created_idx
  on public.kaskad_transactions (created_at)
  where reason = 'bet' and delta < 0;

create index if not exists wallet_ledger_game_entry_period_idx
  on public.wallet_ledger (created_at)
  where reason = 'game_entry' and currency = 'coins';

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'leaderboard_snapshots'
      and c.contype = 'u'
  loop
    execute format(
      'alter table public.leaderboard_snapshots drop constraint if exists %I',
      r.conname
    );
  end loop;
end $$;

drop index if exists public.leaderboard_snapshots_user_entity_uniq;
create unique index leaderboard_snapshots_user_entity_uniq
  on public.leaderboard_snapshots (board_type, period, period_key, user_id)
  where user_id is not null and room_id is null;

drop index if exists public.leaderboard_snapshots_room_entity_uniq;
create unique index leaderboard_snapshots_room_entity_uniq
  on public.leaderboard_snapshots (board_type, period, period_key, room_id)
  where room_id is not null;

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
      select h.room_id, sum(h.coin)::bigint as skor
      from (
        select g.room_id, g.coins_spent as coin
        from public.gift_transactions g
        where g.room_id is not null
          and g.created_at >= v_start

        union all

        select s.room_id, abs(kt.delta)
        from public.kaskad_transactions kt
        join public.kaskad_rounds kr on kr.id = kt.round_id
        join public.kaskad_sessions s on s.id = kr.session_id
        where s.room_id is not null
          and kt.reason = 'bet'
          and kt.delta < 0
          and coalesce((kr.result_snapshot->>'adminTest')::boolean, false) = false
          and kt.created_at >= v_start

        union all

        select gs.room_id, abs(wl.delta)
        from public.wallet_ledger wl
        join public.game_sessions gs on gs.id = wl.ref_id
        where wl.reason = 'game_entry'
          and wl.currency = 'coins'
          and wl.delta < 0
          and wl.ref_type = 'game_session'
          and wl.created_at >= v_start
      ) h
      group by h.room_id
      having sum(h.coin) > 0
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

drop function if exists public.liderlik_siralamasi_listele(text, text, int);

create function public.liderlik_siralamasi_listele(
  p_board_type text,
  p_period text default 'weekly',
  p_limit int default 50
)
returns table (
  id uuid,
  user_id uuid,
  score bigint,
  rank int,
  board_type text,
  period text,
  period_key text,
  display_name text,
  username text,
  avatar_url text,
  room_id uuid,
  room_title text,
  room_cover_url text,
  room_is_live boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := lower(coalesce(nullif(trim(p_period), ''), 'weekly'));
  v_key text := public.liderlik_period_key(v_period);
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  return query
  select
    s.id,
    s.user_id,
    s.score,
    s.rank,
    s.board_type,
    s.period,
    s.period_key,
    case
      when p_board_type = 'room' then
        coalesce(nullif(trim(r.title), ''), nullif(trim(p.display_name), ''), 'Oda')
      else
        coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Kullanıcı')
    end,
    case
      when p_board_type = 'room' then
        coalesce(nullif(trim(p.display_name), ''), p.username)
      else
        p.username
    end,
    case
      when p_board_type = 'room' then coalesce(r.cover_url, p.avatar_url)
      else p.avatar_url
    end,
    s.room_id,
    r.title,
    r.cover_url,
    coalesce(r.is_live, false)
  from public.leaderboard_snapshots s
  left join public.profiles p on p.id = s.user_id
  left join public.rooms r on r.id = s.room_id
  left join public.user_privacy_settings pr on pr.user_id = s.user_id
  where s.board_type = p_board_type
    and s.period = v_period
    and s.period_key = v_key
    and (
      (p_board_type = 'top_recharge' and coalesce(pr.hide_recharge_rank, false) = false)
      or (p_board_type = 'gifter' and coalesce(pr.hide_gifter_rank, false) = false)
      or p_board_type not in ('top_recharge', 'gifter')
    )
  order by s.rank asc nulls last
  limit v_limit;
end;
$$;

grant execute on function public.liderlik_siralamasi_listele(text, text, int) to authenticated;
