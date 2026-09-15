-- oda_sohbet_mesaji_gonder: room_bans.expires_at yok → her yorum "column does not exist"
-- Şema (010): room_id, user_id, banned_by, reason, created_at

create or replace function public.oda_sohbet_mesaji_gonder(
  p_room_id uuid,
  p_body text
)
returns public.room_chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_banned boolean;
  v_host uuid;
  v_row public.room_chat_messages%rowtype;
  v_text text := trim(coalesce(p_body, ''));
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot chat in room'; end if;
  if char_length(v_text) < 1 or char_length(v_text) > 500 then
    raise exception 'Invalid message';
  end if;
  if not exists (select 1 from public.rooms where id = p_room_id and is_live) then
    raise exception 'Room not available';
  end if;

  select host_id into v_host from public.rooms where id = p_room_id;
  if v_host is not null and public.kullanicilar_engelli_mi(v_uid, v_host) then
    raise exception 'Bu kullaniciyla iletisim engellenmis';
  end if;

  if to_regclass('public.room_bans') is not null then
    select exists (
      select 1 from public.room_bans
      where room_id = p_room_id and user_id = v_uid
    ) into v_banned;
    if coalesce(v_banned, false) then raise exception 'Banned from room'; end if;
  end if;

  insert into public.room_chat_messages (room_id, user_id, body)
  values (p_room_id, v_uid, v_text)
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function public.oda_sohbet_mesaji_gonder(uuid, text) to authenticated;
