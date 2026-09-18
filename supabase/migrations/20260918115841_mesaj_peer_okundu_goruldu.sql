-- Peer last_read_at: gonderenin "goruldu" tikleri icin (RLS kendi satirini gosteriyor)
create or replace function public.mesaj_peer_last_read_get(p_thread_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Oturum gerekli';
  end if;

  if not exists (
    select 1 from public.message_thread_members
    where thread_id = p_thread_id
      and user_id = v_uid
      and deleted_at is null
  ) then
    raise exception 'Bu sohbete erisimin yok';
  end if;

  select m.last_read_at into v_at
  from public.message_thread_members m
  where m.thread_id = p_thread_id
    and m.user_id <> v_uid
    and m.deleted_at is null
  order by m.joined_at asc
  limit 1;

  return v_at;
end;
$$;

grant execute on function public.mesaj_peer_last_read_get(uuid) to authenticated;
