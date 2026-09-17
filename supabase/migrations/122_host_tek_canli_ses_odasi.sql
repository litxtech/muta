/**
 * Host başına tek canlı ses odası.
 * Mevcut canlı oda varsa yeni INSERT engellenir (partial unique index).
 */

-- Mükerrer canlı odaları kapat (host başına en yeni kalsın)
with sakla as (
  select distinct on (host_id) id
  from public.rooms
  where coalesce(is_live, false) = true
  order by host_id, created_at desc nulls last
)
update public.rooms r
set
  is_live = false,
  ended_at = coalesce(r.ended_at, now())
where coalesce(r.is_live, false) = true
  and r.id not in (select id from sakla);

create unique index if not exists rooms_host_tek_canli_idx
  on public.rooms (host_id)
  where coalesce(is_live, false) = true;

comment on index public.rooms_host_tek_canli_idx is
  'Host aynı anda yalnızca bir canlı ses odası açabilir.';

-- Ajans üye oda kur: mevcut canlı oda varsa yenisini açma
create or replace function public.ajans_uye_oda_kur(
  p_agency_id uuid,
  p_user_id uuid,
  p_title text,
  p_mode text default 'party',
  p_max_seats int default 8
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_agency public.agencies%rowtype;
  v_host public.host_profiles%rowtype;
  v_title text;
  v_mode text;
  v_seats int;
  v_room public.rooms%rowtype;
  v_mevcut_id uuid;
  i int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_agency from public.agencies where id = p_agency_id for update;
  if not found then raise exception 'Ajans bulunamadi'; end if;
  if v_agency.owner_id <> v_uid and not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;
  if v_agency.status <> 'active' then raise exception 'Ajans aktif degil'; end if;

  select * into v_host
  from public.host_profiles
  where user_id = p_user_id and agency_id = p_agency_id and status = 'agency';
  if not found then raise exception 'Kullanici ajansa kayitli degil'; end if;

  if public.kullanici_yaptirim_aktif_mi(p_user_id, 'room_create_ban') then
    raise exception 'Uyenin oda acma yasagi var';
  end if;

  select id into v_mevcut_id
  from public.rooms
  where host_id = p_user_id and coalesce(is_live, false) = true
  order by created_at desc
  limit 1;

  if v_mevcut_id is not null then
    return jsonb_build_object(
      'ok', false,
      'hata', 'Uyenin zaten acik bir ses odasi var',
      'room_id', v_mevcut_id,
      'mevcut_oda', true
    );
  end if;

  v_title := trim(coalesce(p_title, ''));
  if char_length(v_title) < 2 then raise exception 'Baslik en az 2 karakter'; end if;
  if char_length(v_title) > 80 then raise exception 'Baslik cok uzun'; end if;

  v_mode := coalesce(nullif(trim(p_mode), ''), 'party');
  if v_mode not in ('party', 'dating', 'karaoke', 'game', 'private') then
    v_mode := 'party';
  end if;

  v_seats := least(greatest(coalesce(p_max_seats, 8), 2), 20);

  insert into public.rooms (
    host_id, title, mode, max_seats, is_live,
    layout_code, theme_code, capacity_tier_code,
    audience_capacity, microphone_capacity
  ) values (
    p_user_id, v_title, v_mode, v_seats, true,
    'floating_glass', 'midnight_plum', 'social',
    250, v_seats
  ) returning * into v_room;

  for i in 0..(v_seats - 1) loop
    insert into public.room_seats (room_id, seat_index, user_id)
    values (v_room.id, i, case when i = 0 then p_user_id else null end);
  end loop;

  insert into public.room_members (room_id, user_id, role)
  values (v_room.id, p_user_id, 'host')
  on conflict (room_id, user_id) do update set role = 'host';

  return jsonb_build_object(
    'ok', true,
    'room_id', v_room.id,
    'host_id', p_user_id,
    'title', v_room.title
  );
end;
$$;

grant execute on function public.ajans_uye_oda_kur(uuid, uuid, text, text, int) to authenticated;
