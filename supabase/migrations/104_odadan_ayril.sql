-- Odadan çıkış: dinleyici/konuşmacı kendi koltuğunu boşaltabilsin.
-- room_seats RLS yalnızca host'a update veriyordu → leaveRoom koltuğu temizleyemiyordu.

create or replace function public.odadan_ayril(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_room_id is null then
    raise exception 'room_id required';
  end if;

  update public.room_seats
  set user_id = null, is_muted = false
  where room_id = p_room_id
    and user_id = v_uid;

  delete from public.room_members
  where room_id = p_room_id
    and user_id = v_uid;
end;
$$;

grant execute on function public.odadan_ayril(uuid) to authenticated;

-- Ek güvenlik: kullanıcı kendi oturduğu koltuğu boşaltabilsin (RPC dışı yollar)
do $$
begin
  create policy "Users clear own seat"
    on public.room_seats for update to authenticated
    using (user_id = auth.uid())
    with check (user_id is null);
exception
  when duplicate_object then null;
end $$;
