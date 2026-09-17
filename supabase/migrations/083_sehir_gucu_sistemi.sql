-- 083: Şehir gücü sistemi — hediye → güç → lig → savaş
-- Gift send başarısız olmasın diye tetikleyici hataları yutar.

create or replace function public.sehir_gucu_hediyeden_uygula(
  p_user_id uuid,
  p_coins bigint,
  p_gift_tx_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_city_id uuid;
  v_season_id uuid;
  v_delta bigint;
  v_new_power bigint;
  v_battle_id uuid;
  v_is_a boolean;
begin
  if p_user_id is null or coalesce(p_coins, 0) <= 0 then
    return;
  end if;

  if not public.ozellik_bayragi_aktif_mi('city_league_enabled') then
    return;
  end if;

  select city_id into v_city_id
  from public.user_supported_cities
  where user_id = p_user_id
  order by is_primary desc, supported_at desc
  limit 1;

  if v_city_id is null then
    return;
  end if;

  v_delta := p_coins;

  update public.geo_cities
  set power_score = power_score + v_delta
  where id = v_city_id
  returning power_score into v_new_power;

  select id into v_season_id
  from public.city_league_seasons
  where status = 'active'
  order by starts_at desc
  limit 1;

  insert into public.city_power_events (
    city_id, season_id, event_type, delta, balance_after, ref_type, ref_id
  ) values (
    v_city_id, v_season_id, 'gift', v_delta, coalesce(v_new_power, v_delta),
    'gift_transaction', p_gift_tx_id
  );

  if v_season_id is not null then
    insert into public.city_league_standings (
      season_id, city_id, points, gifts_score, battle_wins, updated_at
    ) values (
      v_season_id, v_city_id, v_delta, v_delta, 0, now()
    )
    on conflict (season_id, city_id) do update
      set points = public.city_league_standings.points + v_delta,
          gifts_score = public.city_league_standings.gifts_score + v_delta,
          updated_at = now();

    with ranked as (
      select city_id,
             row_number() over (order by points desc, gifts_score desc) as r
      from public.city_league_standings
      where season_id = v_season_id
    )
    update public.city_league_standings s
    set rank = ranked.r
    from ranked
    where s.season_id = v_season_id and s.city_id = ranked.city_id;
  end if;

  if public.ozellik_bayragi_aktif_mi('city_battles_enabled') then
    select b.id, (b.city_a_id = v_city_id)
    into v_battle_id, v_is_a
    from public.city_battles b
    where b.status = 'live'
      and (b.city_a_id = v_city_id or b.city_b_id = v_city_id)
      and (b.ends_at is null or b.ends_at > now())
    order by b.starts_at desc nulls last
    limit 1;

    if v_battle_id is not null then
      if v_is_a then
        update public.city_battles set score_a = score_a + v_delta where id = v_battle_id;
      else
        update public.city_battles set score_b = score_b + v_delta where id = v_battle_id;
      end if;
    end if;
  end if;
end;
$$;

create or replace function public.trg_gift_sehir_gucu()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.sehir_gucu_hediyeden_uygula(
      NEW.sender_id,
      NEW.coins_spent,
      NEW.id
    );
  exception when others then
    null;
  end;
  return NEW;
end;
$$;

drop trigger if exists trg_gift_sehir_gucu on public.gift_transactions;
create trigger trg_gift_sehir_gucu
  after insert on public.gift_transactions
  for each row
  execute function public.trg_gift_sehir_gucu();

create or replace function public.sehir_destekle(p_city_id uuid, p_is_primary boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_existed boolean;
  v_season_id uuid;
  v_new_power bigint;
  v_delta bigint := 10;
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
    select 1 from public.user_supported_cities
    where user_id = v_uid and city_id = p_city_id
  ) into v_existed;

  if p_is_primary then
    update public.user_supported_cities set is_primary = false where user_id = v_uid;
  end if;

  insert into public.user_supported_cities (user_id, city_id, is_primary)
  values (v_uid, p_city_id, coalesce(p_is_primary, false))
  on conflict (user_id, city_id) do update
    set is_primary = excluded.is_primary;

  update public.geo_cities
  set supporter_count = (
    select count(*)::int from public.user_supported_cities where city_id = p_city_id
  )
  where id = p_city_id;

  if not v_existed then
    update public.geo_cities
    set power_score = power_score + v_delta
    where id = p_city_id
    returning power_score into v_new_power;

    select id into v_season_id
    from public.city_league_seasons
    where status = 'active'
    order by starts_at desc
    limit 1;

    insert into public.city_power_events (
      city_id, season_id, event_type, delta, balance_after, ref_type
    ) values (
      p_city_id, v_season_id, 'support', v_delta, coalesce(v_new_power, v_delta), 'support'
    );

    if v_season_id is not null then
      insert into public.city_league_standings (
        season_id, city_id, points, gifts_score, battle_wins, updated_at
      ) values (
        v_season_id, p_city_id, v_delta, 0, 0, now()
      )
      on conflict (season_id, city_id) do update
        set points = public.city_league_standings.points + v_delta,
            updated_at = now();
    end if;
  end if;
end;
$$;

grant execute on function public.sehir_destekle(uuid, boolean) to authenticated;

do $$
declare
  v_season uuid;
begin
  select id into v_season
  from public.city_league_seasons
  where status = 'active'
  order by starts_at desc
  limit 1;

  if v_season is null then
    insert into public.city_league_seasons (code, title, starts_at, ends_at, status)
    values (
      to_char(now() at time zone 'Europe/Istanbul', 'IYYY-"W"IW'),
      'Şehir Ligi · ' || to_char(now() at time zone 'Europe/Istanbul', 'IYYY "Hafta" IW'),
      date_trunc('week', now() at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul',
      (date_trunc('week', now() at time zone 'Europe/Istanbul') + interval '7 days')
        at time zone 'Europe/Istanbul',
      'active'
    )
    on conflict (code) do update set status = 'active'
    returning id into v_season;
  end if;

  if v_season is not null then
    insert into public.city_league_standings (season_id, city_id, points, gifts_score, rank)
    select v_season, c.id, 0, 0, null
    from public.geo_cities c
    where c.is_active and c.country_code = 'TR'
    on conflict do nothing;
  end if;
end $$;

create or replace function public.sehir_detay_ozeti(p_city_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_city jsonb;
  v_season_id uuid;
  v_standing jsonb;
  v_roles jsonb;
  v_rooms jsonb;
  v_battle jsonb;
  v_election jsonb;
  v_supported boolean := false;
  v_primary boolean := false;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select to_jsonb(c) into v_city
  from public.geo_cities c
  where c.id = p_city_id and c.is_active;
  if v_city is null then raise exception 'City not found'; end if;

  select exists (
    select 1 from public.user_supported_cities
    where user_id = v_uid and city_id = p_city_id
  ) into v_supported;

  select coalesce(is_primary, false) into v_primary
  from public.user_supported_cities
  where user_id = v_uid and city_id = p_city_id;

  select id into v_season_id
  from public.city_league_seasons
  where status = 'active'
  order by starts_at desc
  limit 1;

  if v_season_id is not null then
    select jsonb_build_object(
      'season_id', s.season_id,
      'points', s.points,
      'gifts_score', s.gifts_score,
      'battle_wins', s.battle_wins,
      'rank', s.rank
    ) into v_standing
    from public.city_league_standings s
    where s.season_id = v_season_id and s.city_id = p_city_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'role', r.role,
    'user_id', r.user_id,
    'display_name', p.display_name,
    'username', p.username,
    'avatar_url', p.avatar_url
  )), '[]'::jsonb)
  into v_roles
  from public.city_roles r
  left join public.profiles p on p.id = r.user_id
  where r.city_id = p_city_id and r.is_active;

  select coalesce(jsonb_agg(to_jsonb(o) order by o.sort_order, o.title), '[]'::jsonb)
  into v_rooms
  from public.official_city_rooms o
  where o.city_id = p_city_id;

  select jsonb_build_object(
    'id', b.id,
    'status', b.status,
    'score_a', b.score_a,
    'score_b', b.score_b,
    'city_a_id', b.city_a_id,
    'city_b_id', b.city_b_id,
    'city_a_name', ca.name,
    'city_b_name', cb.name,
    'starts_at', b.starts_at,
    'ends_at', b.ends_at
  ) into v_battle
  from public.city_battles b
  join public.geo_cities ca on ca.id = b.city_a_id
  join public.geo_cities cb on cb.id = b.city_b_id
  where b.status in ('live', 'scheduled')
    and (b.city_a_id = p_city_id or b.city_b_id = p_city_id)
  order by case when b.status = 'live' then 0 else 1 end, b.starts_at nulls last
  limit 1;

  select jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'status', e.status,
    'role_target', e.role_target,
    'ends_at', e.ends_at
  ) into v_election
  from public.city_elections e
  where e.city_id = p_city_id
    and e.status in ('nominating', 'voting')
  order by e.created_at desc
  limit 1;

  return jsonb_build_object(
    'city', v_city,
    'supported', v_supported,
    'is_primary', coalesce(v_primary, false),
    'standing', v_standing,
    'roles', coalesce(v_roles, '[]'::jsonb),
    'rooms', coalesce(v_rooms, '[]'::jsonb),
    'battle', v_battle,
    'election', v_election,
    'how_it_works', jsonb_build_array(
      'Şehrini destekle — ana şehrin olur',
      'Herhangi bir odada hediye gönder — gücün şehrine yazılır',
      'Canlı savaşta şehrin skoru yükselir',
      'Lig sıralamasında yüksel, seçimde lider ol'
    )
  );
end;
$$;

grant execute on function public.sehir_detay_ozeti(uuid) to authenticated;
grant execute on function public.sehir_gucu_hediyeden_uygula(uuid, bigint, uuid) to service_role;
