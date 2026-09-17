-- Silinmiş / banlı profilleri odadan temizle (hayalet dinleyici).
create or replace function public.oda_hayalet_uyeleri_temizle(p_room_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  silinen integer;
begin
  if p_room_id is null then
    return 0;
  end if;

  -- Pasif hesapları koltuktan da düşür
  update public.room_seats rs
  set user_id = null,
      is_muted = false
  from public.profiles p
  where rs.room_id = p_room_id
    and rs.user_id = p.id
    and (p.deleted_at is not null or p.banned_at is not null);

  delete from public.room_members rm
  using public.profiles p
  where rm.room_id = p_room_id
    and rm.user_id = p.id
    and (p.deleted_at is not null or p.banned_at is not null);

  get diagnostics silinen = row_count;
  return coalesce(silinen, 0);
end;
$$;

revoke all on function public.oda_hayalet_uyeleri_temizle(uuid) from public;
grant execute on function public.oda_hayalet_uyeleri_temizle(uuid) to authenticated;

comment on function public.oda_hayalet_uyeleri_temizle(uuid) is
  'Odadaki silinmiş/banlı üyelik satırlarını temizler; dinleyici listesi hayaletlerini önler.';
