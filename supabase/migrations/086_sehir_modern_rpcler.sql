-- 085: Şehir modern RPC'ler (084 tablolarına bağlı)

create or replace function public.sehir_destekle(p_city_id uuid, p_is_primary boolean default false)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_existed boolean;
  v_season_id uuid;
  v_new_power bigint;
  v_delta bigint := 10;
  v_mission uuid;
  v_week text := public.sehir_hafta_kodu();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ozellik_bayragi_aktif_mi('city_league_enabled') then
    raise exception 'City feature disabled';
  end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot support city'; end if;
  if not exists (select 1 from public.geo_cities where id = p_city_id and is_active) then
    raise exception 'City not found';
  end if;

  select exists (
    select 1 from public.user_supported_cities where user_id = v_uid and city_id = p_city_id
  ) into v_existed;

  if coalesce(p_is_primary, true) then
    update public.user_supported_cities set is_primary = false where user_id = v_uid;
  end if;

  insert into public.user_supported_cities (user_id, city_id, is_primary)
  values (v_uid, p_city_id, coalesce(p_is_primary, true))
  on conflict (user_id, city_id) do update set is_primary = excluded.is_primary;

  if coalesce(p_is_primary, true) then
    update public.profiles set primary_city_id = p_city_id where id = v_uid;
  end if;

  update public.geo_cities set supporter_count = (
    select count(*)::int from public.user_supported_cities where city_id = p_city_id
  ) where id = p_city_id;

  if not v_existed then
    update public.geo_cities set power_score = power_score + v_delta
    where id = p_city_id returning power_score into v_new_power;

    select id into v_season_id from public.city_league_seasons
    where status = 'active' order by starts_at desc limit 1;

    insert into public.city_power_events (city_id, season_id, event_type, delta, balance_after, ref_type)
    values (p_city_id, v_season_id, 'support', v_delta, coalesce(v_new_power, v_delta), 'support');

    if v_season_id is not null then
      insert into public.city_league_standings (season_id, city_id, points, gifts_score, battle_wins, updated_at)
      values (v_season_id, p_city_id, v_delta, 0, 0, now())
      on conflict (season_id, city_id) do update
        set points = public.city_league_standings.points + v_delta, updated_at = now();
    end if;
  end if;

  select id into v_mission from public.city_missions where code = 'week_support' and is_active;
  if v_mission is not null then
    insert into public.city_mission_progress (user_id, mission_id, week_code, progress, completed_at, updated_at)
    values (v_uid, v_mission, v_week, 1, now(), now())
    on conflict (user_id, mission_id, week_code) do update
      set progress = greatest(public.city_mission_progress.progress, 1),
          completed_at = coalesce(public.city_mission_progress.completed_at, now()),
          updated_at = now();
  end if;
end;
$$;

grant execute on function public.sehir_destekle(uuid, boolean) to authenticated;

create or replace function public.sehir_gucu_hediyeden_uygula(
  p_user_id uuid, p_coins bigint, p_gift_tx_id uuid
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_city_id uuid;
  v_season_id uuid;
  v_delta bigint;
  v_new_power bigint;
  v_battle_id uuid;
  v_is_a boolean;
  v_day date := (now() at time zone 'Europe/Istanbul')::date;
  v_week text := public.sehir_hafta_kodu();
  v_m record;
begin
  if p_user_id is null or coalesce(p_coins, 0) <= 0 then return; end if;
  if not public.ozellik_bayragi_aktif_mi('city_league_enabled') then return; end if;

  select city_id into v_city_id from public.user_supported_cities
  where user_id = p_user_id order by is_primary desc, supported_at desc limit 1;
  if v_city_id is null then return; end if;

  v_delta := p_coins;
  update public.geo_cities set power_score = power_score + v_delta
  where id = v_city_id returning power_score into v_new_power;

  select id into v_season_id from public.city_league_seasons
  where status = 'active' order by starts_at desc limit 1;

  insert into public.city_power_events (city_id, season_id, event_type, delta, balance_after, ref_type, ref_id)
  values (v_city_id, v_season_id, 'gift', v_delta, coalesce(v_new_power, v_delta), 'gift_transaction', p_gift_tx_id);

  insert into public.city_user_daily (user_id, city_id, day, gift_coins, gift_count, last_delta, updated_at)
  values (p_user_id, v_city_id, v_day, v_delta, 1, v_delta, now())
  on conflict (user_id, city_id, day) do update
    set gift_coins = public.city_user_daily.gift_coins + v_delta,
        gift_count = public.city_user_daily.gift_count + 1,
        last_delta = v_delta, updated_at = now();

  if v_season_id is not null then
    insert into public.city_league_standings (season_id, city_id, points, gifts_score, battle_wins, updated_at)
    values (v_season_id, v_city_id, v_delta, v_delta, 0, now())
    on conflict (season_id, city_id) do update
      set points = public.city_league_standings.points + v_delta,
          gifts_score = public.city_league_standings.gifts_score + v_delta,
          updated_at = now();
    with ranked as (
      select city_id, row_number() over (order by points desc, gifts_score desc) as r
      from public.city_league_standings where season_id = v_season_id
    )
    update public.city_league_standings s set rank = ranked.r
    from ranked where s.season_id = v_season_id and s.city_id = ranked.city_id;
  end if;

  if public.ozellik_bayragi_aktif_mi('city_battles_enabled') then
    select b.id, (b.city_a_id = v_city_id) into v_battle_id, v_is_a
    from public.city_battles b
    where b.status = 'live' and (b.city_a_id = v_city_id or b.city_b_id = v_city_id)
      and (b.ends_at is null or b.ends_at > now())
    order by b.starts_at desc nulls last limit 1;
    if v_battle_id is not null then
      if v_is_a then update public.city_battles set score_a = score_a + v_delta where id = v_battle_id;
      else update public.city_battles set score_b = score_b + v_delta where id = v_battle_id;
      end if;
    end if;
  end if;

  for v_m in select id, goal_target from public.city_missions where is_active and goal_type = 'gift_coins'
  loop
    insert into public.city_mission_progress (user_id, mission_id, week_code, progress, updated_at)
    values (p_user_id, v_m.id, v_week, v_delta, now())
    on conflict (user_id, mission_id, week_code) do update
      set progress = public.city_mission_progress.progress + v_delta,
          updated_at = now(),
          completed_at = case
            when public.city_mission_progress.completed_at is not null then public.city_mission_progress.completed_at
            when public.city_mission_progress.progress + v_delta >= v_m.goal_target then now()
            else null end;
  end loop;
end;
$$;

create or replace function public.sehir_hediye_sonrasi_ozet()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_city_id uuid; v_name text;
  v_day date := (now() at time zone 'Europe/Istanbul')::date;
  v_row public.city_user_daily%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select usc.city_id, c.name into v_city_id, v_name
  from public.user_supported_cities usc
  join public.geo_cities c on c.id = usc.city_id
  where usc.user_id = v_uid order by usc.is_primary desc, usc.supported_at desc limit 1;
  if v_city_id is null then return jsonb_build_object('ok', true, 'has_city', false); end if;
  select * into v_row from public.city_user_daily
  where user_id = v_uid and city_id = v_city_id and day = v_day;
  return jsonb_build_object(
    'ok', true, 'has_city', true, 'city_id', v_city_id, 'city_name', v_name,
    'last_delta', coalesce(v_row.last_delta, 0),
    'today_power', coalesce(v_row.gift_coins, 0),
    'today_gifts', coalesce(v_row.gift_count, 0)
  );
end;
$$;
grant execute on function public.sehir_hediye_sonrasi_ozet() to authenticated;

create or replace function public.sehir_yukselenleri_getir(p_limit int default 5)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(t) order by t.delta_24h desc) from (
      select c.id, c.name, c.slug, c.power_score, c.supporter_count,
             coalesce(sum(e.delta), 0)::bigint as delta_24h
      from public.geo_cities c
      left join public.city_power_events e
        on e.city_id = c.id and e.created_at > now() - interval '24 hours'
      where c.is_active and c.country_code = 'TR'
      group by c.id order by delta_24h desc, c.power_score desc
      limit least(greatest(coalesce(p_limit, 5), 1), 20)
    ) t
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.sehir_yukselenleri_getir(int) to authenticated;

create or replace function public.sehir_gorevlerimi_getir()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_week text := public.sehir_hafta_kodu();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(t) order by t.sort_order) from (
      select m.id, m.code, m.title, m.description, m.goal_type, m.goal_target,
             m.reward_coins, m.reward_label, m.sort_order,
             coalesce(p.progress, 0)::bigint as progress, p.completed_at, p.claimed_at, v_week as week_code
      from public.city_missions m
      left join public.city_mission_progress p
        on p.mission_id = m.id and p.user_id = v_uid and p.week_code = v_week
      where m.is_active
    ) t
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.sehir_gorevlerimi_getir() to authenticated;

create or replace function public.sehir_gorev_odul_al(p_mission_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_week text := public.sehir_hafta_kodu();
  v_m public.city_missions%rowtype; v_p public.city_mission_progress%rowtype; v_coins bigint;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_m from public.city_missions where id = p_mission_id and is_active;
  if not found then raise exception 'Mission not found'; end if;
  select * into v_p from public.city_mission_progress
  where user_id = v_uid and mission_id = p_mission_id and week_code = v_week for update;
  if not found then raise exception 'Progress missing'; end if;
  if v_p.completed_at is null and v_p.progress < v_m.goal_target then raise exception 'Mission incomplete'; end if;
  if v_p.claimed_at is not null then raise exception 'Already claimed'; end if;
  v_coins := coalesce(v_m.reward_coins, 0);
  if v_coins > 0 then
    update public.wallets set coins = coins + v_coins, updated_at = now() where user_id = v_uid;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type)
    values (v_uid, 'coins', v_coins, (select coins from public.wallets where user_id = v_uid),
            'city_mission_reward', 'city_mission');
  end if;
  update public.city_mission_progress set claimed_at = now(),
    completed_at = coalesce(completed_at, now()), updated_at = now()
  where user_id = v_uid and mission_id = p_mission_id and week_code = v_week;
  return jsonb_build_object('ok', true, 'reward_coins', v_coins);
end;
$$;
grant execute on function public.sehir_gorev_odul_al(uuid) to authenticated;

create or replace function public.sehir_duyuru_yayinla(
  p_city_id uuid, p_title text, p_body text, p_pinned boolean default false
)
returns public.city_announcements language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_row public.city_announcements%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.sehir_lider_mi(p_city_id, v_uid) and not public.ben_admin_miyim() then
    raise exception 'Only city leader can announce';
  end if;
  if length(trim(coalesce(p_title, ''))) < 2 then raise exception 'Title required'; end if;
  if length(trim(coalesce(p_body, ''))) < 2 then raise exception 'Body required'; end if;
  if coalesce(p_pinned, false) then
    update public.city_announcements set is_pinned = false where city_id = p_city_id;
  end if;
  insert into public.city_announcements (city_id, author_id, title, body, is_pinned)
  values (p_city_id, v_uid, trim(p_title), trim(p_body), coalesce(p_pinned, false))
  returning * into v_row;
  return v_row;
end;
$$;
grant execute on function public.sehir_duyuru_yayinla(uuid, text, text, boolean) to authenticated;

create or replace function public.admin_sehir_savas_olustur(
  p_city_a uuid, p_city_b uuid, p_hours int default 24, p_live boolean default true
)
returns public.city_battles language plpgsql security definer set search_path = public as $$
declare v_row public.city_battles%rowtype; v_season uuid;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_city_a is null or p_city_b is null or p_city_a = p_city_b then raise exception 'Invalid cities'; end if;
  select id into v_season from public.city_league_seasons where status = 'active' order by starts_at desc limit 1;
  insert into public.city_battles (season_id, city_a_id, city_b_id, status, starts_at, ends_at)
  values (v_season, p_city_a, p_city_b,
    case when coalesce(p_live, true) then 'live' else 'scheduled' end,
    now(), now() + make_interval(hours => greatest(coalesce(p_hours, 24), 1)))
  returning * into v_row;
  return v_row;
end;
$$;
grant execute on function public.admin_sehir_savas_olustur(uuid, uuid, int, boolean) to authenticated;

create or replace function public.admin_sehir_haftalik_eslestir(p_hours int default 48)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ids uuid[]; v_i int; v_created int := 0;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  select array_agg(id order by power_score desc, supporter_count desc) into v_ids from (
    select id, power_score, supporter_count from public.geo_cities
    where is_active and country_code = 'TR'
    order by power_score desc, supporter_count desc limit 20
  ) t;
  if v_ids is null or array_length(v_ids, 1) < 2 then
    return jsonb_build_object('ok', false, 'created', 0, 'hata', 'Not enough cities');
  end if;
  v_i := 1;
  while v_i < array_length(v_ids, 1) loop
    perform public.admin_sehir_savas_olustur(v_ids[v_i], v_ids[v_i + 1], coalesce(p_hours, 48), true);
    v_created := v_created + 1; v_i := v_i + 2;
  end loop;
  return jsonb_build_object('ok', true, 'created', v_created);
end;
$$;
grant execute on function public.admin_sehir_haftalik_eslestir(int) to authenticated;

create or replace function public.admin_sehir_sezon_odul_dagit(p_top int default 3)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_season uuid; v_r record; v_rank int := 0; v_coins bigint; v_user uuid; v_distributed int := 0;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  select id into v_season from public.city_league_seasons where status = 'active' order by starts_at desc limit 1;
  if v_season is null then raise exception 'No active season'; end if;
  for v_r in
    select s.city_id, s.points, s.rank from public.city_league_standings s
    where s.season_id = v_season order by coalesce(s.rank, 999), s.points desc
    limit least(greatest(coalesce(p_top, 3), 1), 10)
  loop
    v_rank := v_rank + 1;
    v_coins := case v_rank when 1 then 1000 when 2 then 500 when 3 then 250 else 100 end;
    insert into public.city_season_rewards (season_id, city_id, rank, reward_coins, distributed_at)
    values (v_season, v_r.city_id, v_rank, v_coins, now())
    on conflict (season_id, city_id) do update
      set rank = excluded.rank, reward_coins = excluded.reward_coins, distributed_at = now();
    select user_id into v_user from public.city_roles
    where city_id = v_r.city_id and role = 'leader' and is_active limit 1;
    if v_user is not null and v_coins > 0 then
      update public.wallets set coins = coins + v_coins, updated_at = now() where user_id = v_user;
      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type)
      values (v_user, 'coins', v_coins, (select coins from public.wallets where user_id = v_user),
              'city_season_reward', 'city_season');
      v_distributed := v_distributed + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'distributed_to_leaders', v_distributed, 'season_id', v_season);
end;
$$;
grant execute on function public.admin_sehir_sezon_odul_dagit(int) to authenticated;

create or replace function public.sehir_detay_ozeti(p_city_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_city jsonb; v_season_id uuid; v_standing jsonb; v_roles jsonb; v_rooms jsonb;
  v_battle jsonb; v_election jsonb; v_ann jsonb;
  v_supported boolean := false; v_primary boolean := false; v_is_leader boolean := false; v_today bigint := 0;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select to_jsonb(c) into v_city from public.geo_cities c where c.id = p_city_id and c.is_active;
  if v_city is null then raise exception 'City not found'; end if;
  select exists (select 1 from public.user_supported_cities where user_id = v_uid and city_id = p_city_id) into v_supported;
  select coalesce(is_primary, false) into v_primary from public.user_supported_cities where user_id = v_uid and city_id = p_city_id;
  v_is_leader := public.sehir_lider_mi(p_city_id, v_uid);
  select id into v_season_id from public.city_league_seasons where status = 'active' order by starts_at desc limit 1;
  if v_season_id is not null then
    select jsonb_build_object('season_id', s.season_id, 'points', s.points, 'gifts_score', s.gifts_score,
      'battle_wins', s.battle_wins, 'rank', s.rank) into v_standing
    from public.city_league_standings s where s.season_id = v_season_id and s.city_id = p_city_id;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('role', r.role, 'user_id', r.user_id,
    'display_name', p.display_name, 'username', p.username, 'avatar_url', p.avatar_url)), '[]'::jsonb)
  into v_roles from public.city_roles r left join public.profiles p on p.id = r.user_id
  where r.city_id = p_city_id and r.is_active;
  select coalesce(jsonb_agg(to_jsonb(o) order by o.sort_order, o.title), '[]'::jsonb)
  into v_rooms from public.official_city_rooms o where o.city_id = p_city_id;
  select jsonb_build_object('id', b.id, 'status', b.status, 'score_a', b.score_a, 'score_b', b.score_b,
    'city_a_id', b.city_a_id, 'city_b_id', b.city_b_id, 'city_a_name', ca.name, 'city_b_name', cb.name,
    'starts_at', b.starts_at, 'ends_at', b.ends_at) into v_battle
  from public.city_battles b
  join public.geo_cities ca on ca.id = b.city_a_id join public.geo_cities cb on cb.id = b.city_b_id
  where b.status in ('live', 'scheduled') and (b.city_a_id = p_city_id or b.city_b_id = p_city_id)
  order by case when b.status = 'live' then 0 else 1 end, b.starts_at nulls last limit 1;
  select jsonb_build_object('id', e.id, 'title', e.title, 'status', e.status, 'role_target', e.role_target, 'ends_at', e.ends_at)
  into v_election from public.city_elections e
  where e.city_id = p_city_id and e.status in ('nominating', 'voting') order by e.created_at desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'title', a.title, 'body', a.body, 'is_pinned', a.is_pinned,
    'created_at', a.created_at, 'author_name', p.display_name
  ) order by a.is_pinned desc, a.created_at desc), '[]'::jsonb) into v_ann
  from (select * from public.city_announcements where city_id = p_city_id
        order by is_pinned desc, created_at desc limit 10) a
  left join public.profiles p on p.id = a.author_id;
  select coalesce(gift_coins, 0) into v_today from public.city_user_daily
  where user_id = v_uid and city_id = p_city_id and day = (now() at time zone 'Europe/Istanbul')::date;
  return jsonb_build_object(
    'city', v_city, 'supported', v_supported, 'is_primary', coalesce(v_primary, false),
    'is_leader', v_is_leader, 'today_power', coalesce(v_today, 0), 'standing', v_standing,
    'roles', coalesce(v_roles, '[]'::jsonb), 'rooms', coalesce(v_rooms, '[]'::jsonb),
    'battle', v_battle, 'election', v_election, 'announcements', coalesce(v_ann, '[]'::jsonb),
    'how_it_works', jsonb_build_array(
      'Şehrini destekle — ana şehrin ve profil rozetin olur',
      'Odada hediye gönder — güç + lig + savaş skoru',
      'Haftalık görevleri tamamla, ödül al',
      'Lider ol, şehrine duyuru yayınla'
    )
  );
end;
$$;
grant execute on function public.sehir_detay_ozeti(uuid) to authenticated;
