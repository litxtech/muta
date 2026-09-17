-- Canlı odada koltuk (mikrofon) sayısını artır / azalt.
-- Azaltırken yeni kapasiteyi aşan konuşmacılar: odaya en son girenler
-- koltuktan düşülür (dinleyici kalır); host asla düşmez.

create or replace function public.oda_koltuk_sayisini_ayarla(
  p_room_id uuid,
  p_max_seats int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
  v_old int;
  v_new int;
  v_kicked int := 0;
  v_tier text;
  v_keep uuid[];
  v_user uuid;
  v_idx int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_room_id is null then
    raise exception 'room_id required';
  end if;

  v_new := least(greatest(coalesce(p_max_seats, 8), 2), 20);

  select host_id, max_seats
    into v_host, v_old
  from public.rooms
  where id = p_room_id
  for update;

  if v_host is null then
    raise exception 'Room not found';
  end if;
  if v_host <> v_uid then
    raise exception 'Not host';
  end if;
  if v_old = v_new then
    return jsonb_build_object(
      'ok', true,
      'max_seats', v_new,
      'kicked', 0
    );
  end if;

  -- Artırma: yeni boş koltuk satırları
  if v_new > v_old then
    insert into public.room_seats (room_id, seat_index, user_id)
    select p_room_id, g.idx, null
    from generate_series(v_old, v_new - 1) as g(idx)
    on conflict (room_id, seat_index) do nothing;
  end if;

  -- Azaltma
  if v_new < v_old then
    -- Kalacaklar: host + en erken girenler (yeni kapasiteye sığacak kadar)
    select coalesce(array_agg(x.user_id order by x.ord), '{}')
      into v_keep
    from (
      select
        s.user_id,
        case when s.user_id = v_host then 0 else 1 end as host_ord,
        coalesce(m.joined_at, now()) as joined_at,
        row_number() over (
          order by
            case when s.user_id = v_host then 0 else 1 end,
            coalesce(m.joined_at, now()) asc,
            s.seat_index asc
        ) as ord
      from public.room_seats s
      left join public.room_members m
        on m.room_id = s.room_id and m.user_id = s.user_id
      where s.room_id = p_room_id
        and s.user_id is not null
    ) x
    where x.ord <= v_new;

    -- Fazla konuşmacıları koltuktan düşür (en son girenler listede yok)
    for v_user in
      select s.user_id
      from public.room_seats s
      where s.room_id = p_room_id
        and s.user_id is not null
        and not (s.user_id = any (v_keep))
    loop
      update public.room_seats
      set user_id = null, is_muted = false
      where room_id = p_room_id
        and user_id = v_user;

      update public.room_members
      set role = case
        when role = 'host' then 'host'
        when role = 'cohost' then 'cohost'
        else 'listener'
      end
      where room_id = p_room_id
        and user_id = v_user;

      v_kicked := v_kicked + 1;
    end loop;

    -- Kalanları geçici boşalt (yeniden yerleştirmek için)
    update public.room_seats
    set user_id = null, is_muted = false
    where room_id = p_room_id
      and user_id = any (v_keep);

    -- Host tahta (0), diğerleri 1.. sırayla (joined_at ASC)
    v_idx := 0;
    if v_host = any (v_keep) then
      update public.room_seats
      set user_id = v_host, is_muted = false
      where room_id = p_room_id
        and seat_index = 0;
      v_idx := 1;
    end if;

    for v_user in
      select u
      from unnest(v_keep) as u
      where u is distinct from v_host
      order by (
        select coalesce(m.joined_at, now())
        from public.room_members m
        where m.room_id = p_room_id and m.user_id = u
      ) asc
    loop
      if v_idx >= v_new then
        exit;
      end if;
      update public.room_seats
      set user_id = v_user, is_muted = false
      where room_id = p_room_id
        and seat_index = v_idx;
      v_idx := v_idx + 1;
    end loop;

    -- Yüksek indekste kalan varsa temizle, sonra sil
    update public.room_seats
    set user_id = null, is_muted = false
    where room_id = p_room_id
      and seat_index >= v_new;

    delete from public.room_seats
    where room_id = p_room_id
      and seat_index >= v_new;
  end if;

  -- Kapasite katmanı eşlemesi (mikrofon sayısına en yakın)
  begin
    select code into v_tier
    from public.room_capacity_tiers
    where coalesce(is_active, true) = true
    order by abs(microphone_capacity - v_new), sort_order
    limit 1;
  exception
    when undefined_table then
      v_tier := null;
  end;

  update public.rooms
  set
    max_seats = v_new,
    microphone_capacity = v_new,
    capacity_tier_code = coalesce(v_tier, capacity_tier_code)
  where id = p_room_id;

  return jsonb_build_object(
    'ok', true,
    'max_seats', v_new,
    'kicked', v_kicked,
    'capacity_tier_code', v_tier
  );
end;
$$;

grant execute on function public.oda_koltuk_sayisini_ayarla(uuid, int) to authenticated;

comment on function public.oda_koltuk_sayisini_ayarla(uuid, int) is
  'Host: canlı odada koltuk sayısını 2–20 arası ayarlar; azaltırken fazla konuşmacıları (en son giren) koltuktan düşürür.';
