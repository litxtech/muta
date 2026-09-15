-- Haftalik yukleme siralamasi: gercek coin_purchases penceresi + gizlilik + profil alanlari

create or replace function public.liderlik_period_key(p_period text)
returns text
language plpgsql
immutable
as $$
begin
  if p_period = 'weekly' then
    return to_char((now() at time zone 'utc'), 'IYYY-"W"IW');
  elsif p_period = 'monthly' then
    return to_char((now() at time zone 'utc'), 'YYYY-MM');
  elsif p_period = 'all_time' then
    return 'all';
  else
    -- daily (varsayilan)
    return to_char((now() at time zone 'utc'), 'YYYY-MM-DD');
  end if;
end;
$$;

create or replace function public.liderlik_period_baslangic(p_period text)
returns timestamptz
language plpgsql
stable
as $$
declare
  v_utc timestamptz := timezone('utc', now());
begin
  if p_period = 'weekly' then
    return date_trunc('week', v_utc);
  elsif p_period = 'monthly' then
    return date_trunc('month', v_utc);
  elsif p_period = 'all_time' then
    return '1970-01-01'::timestamptz;
  else
    return date_trunc('day', v_utc);
  end if;
end;
$$;

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
  end if;

  return v_count;
end;
$$;

-- Liste: avatar + isim (display_name) + kullanici adi
create or replace function public.liderlik_siralamasi_listele(
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
  avatar_url text
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
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Kullanıcı'),
    p.username,
    p.avatar_url
  from public.leaderboard_snapshots s
  left join public.profiles p on p.id = s.user_id
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

grant execute on function public.liderlik_period_key(text) to authenticated;
grant execute on function public.liderlik_period_baslangic(text) to authenticated;
grant execute on function public.liderlik_siralamasi_yenile(text, text) to authenticated;
grant execute on function public.liderlik_siralamasi_listele(text, text, int) to authenticated;
