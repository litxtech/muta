-- Ses odası liderlik (host) devri: host_id + roller + taht koltuğu (seat 0)

create or replace function public.oda_liderligi_devret(
  p_room_id uuid,
  p_yeni_host_id uuid
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_eski_host uuid;
  v_yeni_seat int;
  v_eski_seat int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_yeni_host_id is null then
    raise exception 'Yeni host gerekli';
  end if;
  if p_yeni_host_id = v_uid then
    raise exception 'Kendine liderlik devredilemez';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    raise exception 'Oda bulunamadı';
  end if;
  if v_room.is_live is not true then
    raise exception 'Oda canlı değil';
  end if;
  if v_room.host_id is distinct from v_uid then
    raise exception 'Sadece oda sahibi liderliği devredebilir';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_yeni_host_id
  ) then
    raise exception 'Hedef kullanıcı odada değil';
  end if;

  v_eski_host := v_uid;

  update public.rooms
  set host_id = p_yeni_host_id
  where id = p_room_id
  returning * into v_room;

  -- Roller
  update public.room_members
  set role = 'cohost'
  where room_id = p_room_id and user_id = v_eski_host;

  insert into public.room_members (room_id, user_id, role)
  values (p_room_id, p_yeni_host_id, 'host')
  on conflict (room_id, user_id) do update set role = 'host';

  -- Taht (seat 0) yerleştirme: yeni host tahta, eski host onun eski koltuğuna
  select seat_index into v_yeni_seat
  from public.room_seats
  where room_id = p_room_id and user_id = p_yeni_host_id
  limit 1;

  select seat_index into v_eski_seat
  from public.room_seats
  where room_id = p_room_id and user_id = v_eski_host
  limit 1;

  -- Önce her iki koltuğu boşalt (çakışma önle)
  if v_yeni_seat is not null then
    update public.room_seats
    set user_id = null
    where room_id = p_room_id and seat_index = v_yeni_seat;
  end if;
  if v_eski_seat is not null then
    update public.room_seats
    set user_id = null
    where room_id = p_room_id and seat_index = v_eski_seat;
  end if;

  -- Yeni host → seat 0
  update public.room_seats
  set user_id = p_yeni_host_id, is_muted = false
  where room_id = p_room_id and seat_index = 0;

  -- Eski host → yeni host'un eski koltuğu (veya seat 0 değilse ilk boş)
  if v_yeni_seat is not null and v_yeni_seat <> 0 then
    update public.room_seats
    set user_id = v_eski_host
    where room_id = p_room_id and seat_index = v_yeni_seat;
  elsif v_eski_seat is not null and v_eski_seat <> 0 then
    update public.room_seats
    set user_id = v_eski_host
    where room_id = p_room_id and seat_index = v_eski_seat;
  else
    update public.room_seats
    set user_id = v_eski_host
    where id = (
      select id from public.room_seats
      where room_id = p_room_id and user_id is null and seat_index > 0
      order by seat_index
      limit 1
    );
  end if;

  return v_room;
end;
$$;

grant execute on function public.oda_liderligi_devret(uuid, uuid) to authenticated;
