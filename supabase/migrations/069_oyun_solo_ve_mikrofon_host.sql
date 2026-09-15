-- Solo oyun (1 kisi) + host kendi kendine mikrofon istegi gonderemesin

do $$
begin
  if to_regclass('public.game_control_configs') is not null then
    update public.game_control_configs
    set min_players = 1, updated_at = now()
    where game_code = 'match3' and min_players > 1;
  end if;

  if to_regclass('public.game_catalog') is not null then
    update public.game_catalog
    set min_players = 1
    where game_code = 'match3' and min_players > 1;
  end if;
end $$;

create or replace function public.mikrofon_istegi_gonder(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_guest boolean;
  v_host uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select host_id into v_host from public.rooms where id = p_room_id;
  if v_host is null then raise exception 'Room not found'; end if;
  if v_host = auth.uid() then
    raise exception 'Host already has microphone';
  end if;

  select is_guest into v_guest from public.profiles where id = auth.uid();
  if coalesce(v_guest, false) then raise exception 'Guest cannot request mic'; end if;

  insert into public.room_mic_requests (room_id, user_id, status)
  values (p_room_id, auth.uid(), 'pending')
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.room_mic_requests
    where room_id = p_room_id and user_id = auth.uid() and status = 'pending'
    limit 1;
  end if;
  return v_id;
end;
$$;

grant execute on function public.mikrofon_istegi_gonder(uuid) to authenticated;

notify pgrst, 'reload schema';
