-- Koltuk-spesifik mikrofon talebi + kabulde hedef koltuk.
-- Görünürlük: seat 0 (taht) mic kabulünde verilmez; kullanıcı tek koltukta kalır;
-- oda sahibi tahtta değilse seat 0'a oturtulur.

alter table public.room_mic_requests
  add column if not exists requested_seat_index int
  check (requested_seat_index is null or requested_seat_index >= 0);

comment on column public.room_mic_requests.requested_seat_index is
  'İstenen koltuk (null = ilk boş mikrofon; 0 taht genelde host içindir)';

-- ---------------------------------------------------------------------------
-- Host tahta otur (seat 0)
-- ---------------------------------------------------------------------------
create or replace function public.host_tahta_otur(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
  v_on_throne boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select host_id into v_host from public.rooms where id = p_room_id;
  if v_host is null then raise exception 'Room not found'; end if;
  if v_host <> v_uid then raise exception 'Not host'; end if;

  select exists (
    select 1 from public.room_seats
    where room_id = p_room_id and seat_index = 0 and user_id = v_uid
  ) into v_on_throne;

  if v_on_throne then
    return;
  end if;

  -- Host başka koltuktaysa boşalt
  update public.room_seats
  set user_id = null, is_muted = false
  where room_id = p_room_id and user_id = v_uid;

  -- Seat 0 doluysa (yanlışlıkla konuşmacı) boşalt
  update public.room_seats
  set user_id = null, is_muted = false
  where room_id = p_room_id and seat_index = 0 and user_id is distinct from v_uid;

  update public.room_seats
  set user_id = v_uid, is_muted = false
  where room_id = p_room_id and seat_index = 0;

  insert into public.room_members (room_id, user_id, role)
  values (p_room_id, v_uid, 'host')
  on conflict (room_id, user_id) do update
  set role = 'host';
end;
$$;

grant execute on function public.host_tahta_otur(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Mikrofon isteği gönder (opsiyonel hedef koltuk)
-- Eski tek-argüman imzayı kaldır — default ile çağrı belirsiz olmasın.
-- ---------------------------------------------------------------------------
drop function if exists public.mikrofon_istegi_gonder(uuid);

create or replace function public.mikrofon_istegi_gonder(
  p_room_id uuid,
  p_seat_index int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_guest boolean;
  v_host uuid;
  v_seat_user uuid;
  v_locked boolean;
  v_max int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select host_id, max_seats into v_host, v_max
  from public.rooms where id = p_room_id;
  if v_host is null then raise exception 'Room not found'; end if;
  if v_host = auth.uid() then
    raise exception 'Host already has microphone';
  end if;

  select is_guest into v_guest from public.profiles where id = auth.uid();
  if coalesce(v_guest, false) then raise exception 'Guest cannot request mic'; end if;

  -- Zaten koltuktaysa yeni istek yok
  if exists (
    select 1 from public.room_seats
    where room_id = p_room_id and user_id = auth.uid()
  ) then
    raise exception 'Already seated';
  end if;

  if p_seat_index is not null then
    if p_seat_index < 0 or (v_max is not null and p_seat_index >= v_max) then
      raise exception 'Invalid seat';
    end if;
    if p_seat_index = 0 then
      raise exception 'Throne seat is for host';
    end if;

    select user_id, coalesce(is_locked, false)
      into v_seat_user, v_locked
    from public.room_seats
    where room_id = p_room_id and seat_index = p_seat_index;

    if not found then raise exception 'Seat not found'; end if;
    if v_locked then raise exception 'Seat locked'; end if;
    if v_seat_user is not null then raise exception 'Seat occupied'; end if;
  end if;

  insert into public.room_mic_requests (room_id, user_id, status, requested_seat_index)
  values (p_room_id, auth.uid(), 'pending', p_seat_index)
  on conflict (room_id, user_id, status) do update
  set requested_seat_index = coalesce(excluded.requested_seat_index, public.room_mic_requests.requested_seat_index),
      created_at = now()
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.room_mic_requests
    where room_id = p_room_id and user_id = auth.uid() and status = 'pending'
    limit 1;
  end if;
  return v_id;
end;
$$;

grant execute on function public.mikrofon_istegi_gonder(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Mikrofon isteği yanıtla — hedef koltuk / seat 0 koruması / tek koltuk
-- ---------------------------------------------------------------------------
create or replace function public.mikrofon_istegi_yanitla(
  p_request_id uuid,
  p_kabul boolean
)
returns public.room_mic_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.room_mic_requests%rowtype;
  v_role text;
  v_seat_id uuid;
  v_seat_index int;
  v_wanted int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_req
  from public.room_mic_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'Request not found'; end if;
  if v_req.status <> 'pending' then raise exception 'Request already resolved'; end if;

  select role into v_role
  from public.room_members
  where room_id = v_req.room_id and user_id = v_uid;
  if v_role is null or v_role not in ('host', 'cohost') then
    if not exists (
      select 1 from public.rooms r
      where r.id = v_req.room_id and r.host_id = v_uid
    ) then
      raise exception 'Not authorized';
    end if;
  end if;

  if not p_kabul then
    update public.room_mic_requests
    set status = 'rejected', resolved_at = now()
    where id = p_request_id
    returning * into v_req;
    return v_req;
  end if;

  v_wanted := v_req.requested_seat_index;

  -- Hedef koltuk (taht hariç) boşsa onu ver
  if v_wanted is not null and v_wanted > 0 then
    select id, seat_index into v_seat_id, v_seat_index
    from public.room_seats
    where room_id = v_req.room_id
      and seat_index = v_wanted
      and user_id is null
      and coalesce(is_locked, false) = false
    for update;
  end if;

  -- Yoksa ilk boş mikrofon (seat_index > 0)
  if v_seat_id is null then
    select id, seat_index into v_seat_id, v_seat_index
    from public.room_seats
    where room_id = v_req.room_id
      and user_id is null
      and seat_index > 0
      and coalesce(is_locked, false) = false
    order by seat_index
    limit 1
    for update;
  end if;

  if v_seat_id is null then
    raise exception 'No free mic seat';
  end if;

  -- Kullanıcının eski koltuklarını temizle (çift görünüm / hayalet koltuk)
  update public.room_seats
  set user_id = null, is_muted = false
  where room_id = v_req.room_id
    and user_id = v_req.user_id
    and id is distinct from v_seat_id;

  update public.room_seats
  set user_id = v_req.user_id, is_muted = false
  where id = v_seat_id;

  insert into public.room_members (room_id, user_id, role)
  values (v_req.room_id, v_req.user_id, 'speaker')
  on conflict (room_id, user_id) do update
  set role = case
    when public.room_members.role = 'host' then 'host'
    when public.room_members.role = 'cohost' then 'cohost'
    else 'speaker'
  end;

  update public.room_mic_requests
  set status = 'accepted', resolved_at = now()
  where id = p_request_id
  returning * into v_req;

  return v_req;
end;
$$;

grant execute on function public.mikrofon_istegi_yanitla(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
