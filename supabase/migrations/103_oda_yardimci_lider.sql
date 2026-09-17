-- Ses odası yardımcı lider (cohost) ata / kaldır — sadece rooms.host_id

create or replace function public.oda_yardimci_lider_ata(
  p_room_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_user_id is null then
    raise exception 'Hedef kullanıcı gerekli';
  end if;
  if p_user_id = v_uid then
    raise exception 'Kendini yardımcı lider yapamazsın';
  end if;

  select host_id into v_host from public.rooms where id = p_room_id for update;
  if v_host is null then
    raise exception 'Oda bulunamadı';
  end if;
  if v_host is distinct from v_uid then
    raise exception 'Sadece oda sahibi yardımcı lider atayabilir';
  end if;
  if p_user_id = v_host then
    raise exception 'Oda sahibi zaten lider';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_user_id
  ) then
    raise exception 'Hedef kullanıcı odada değil';
  end if;

  update public.room_members
  set role = 'cohost'
  where room_id = p_room_id and user_id = p_user_id;
end;
$$;

create or replace function public.oda_yardimci_lider_kaldir(
  p_room_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
  v_on_seat boolean;
  v_yeni_role text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_user_id is null then
    raise exception 'Hedef kullanıcı gerekli';
  end if;

  select host_id into v_host from public.rooms where id = p_room_id for update;
  if v_host is null then
    raise exception 'Oda bulunamadı';
  end if;
  if v_host is distinct from v_uid then
    raise exception 'Sadece oda sahibi yardımcı lideri kaldırabilir';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_user_id and role = 'cohost'
  ) then
    raise exception 'Kullanıcı yardımcı lider değil';
  end if;

  select exists (
    select 1 from public.room_seats
    where room_id = p_room_id and user_id = p_user_id
  ) into v_on_seat;

  v_yeni_role := case when v_on_seat then 'speaker' else 'listener' end;

  update public.room_members
  set role = v_yeni_role
  where room_id = p_room_id and user_id = p_user_id;
end;
$$;

grant execute on function public.oda_yardimci_lider_ata(uuid, uuid) to authenticated;
grant execute on function public.oda_yardimci_lider_kaldir(uuid, uuid) to authenticated;


-- Yardımcı lider rol değişiklikleri istemcilere gelsin
do $$
begin
  alter publication supabase_realtime add table public.room_members;
exception
  when duplicate_object then null;
  when others then null;
end $$;

alter table public.room_members replica identity full;
