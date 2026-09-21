-- Ses odası: mic lock / koltuktan ayrıl / yetki hiyerarşisi / oda adı (host+cohost)
-- mic lock ≠ koltuk kilidi; kullanıcı her zaman koltuktan/odadan çıkabilir.

-- 0) rooms.updated_at (başlık rate limit)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name = 'updated_at'
  ) then
    alter table public.rooms add column updated_at timestamptz default now();
  end if;
end $$;

-- 1) Ayrı mic lock bayrağı (is_locked = koltuk join kilidi, dokunulmaz)
alter table public.room_seats
  add column if not exists is_mic_locked boolean not null default false;

comment on column public.room_seats.is_mic_locked is
  'Owner/admin: kullanıcı kendi kendine mikrofon açamaz. Koltuktan ayrılmayı engellemez.';

-- 2) Moderasyon aksiyon check genişlet
alter table public.room_moderation_actions
  drop constraint if exists room_moderation_actions_action_check;

alter table public.room_moderation_actions
  add constraint room_moderation_actions_action_check
  check (action = any (array[
    'mute'::text,
    'unmute'::text,
    'mic_lock'::text,
    'mic_unlock'::text,
    'unseat'::text,
    'kick'::text,
    'ban'::text,
    'unban'::text
  ]));

create or replace function public.oda_aktor_moderator_mu(p_room_id uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from public.rooms r where r.id = p_room_id and r.host_id = p_uid)
    or exists (
      select 1 from public.room_members m
      where m.room_id = p_room_id
        and m.user_id = p_uid
        and m.role in ('host', 'cohost')
    );
$$;

create or replace function public.oda_hedef_owner_mu(p_room_id uuid, p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rooms r where r.id = p_room_id and r.host_id = p_target
  );
$$;

create or replace function public.oda_hedef_cohost_mu(p_room_id uuid, p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id and m.user_id = p_target and m.role = 'cohost'
  );
$$;

-- 3) Moderasyon: mic_lock / unseat + OWNER koruması + cohost→cohost yasak
create or replace function public.oda_moderasyon_uygula(
  p_room_id uuid,
  p_target_user_id uuid,
  p_action text,
  p_reason text default null
)
returns public.room_moderation_actions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_actor_is_owner boolean := false;
  v_actor_is_cohost boolean := false;
  v_target_is_owner boolean := false;
  v_target_is_cohost boolean := false;
  v_row public.room_moderation_actions%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_moderation') then
    raise exception 'Moderation temporarily disabled';
  end if;
  if not public.ozellik_bayragi_aktif_mi('moderation_enabled') then
    raise exception 'Moderation disabled';
  end if;
  if p_action not in (
    'mute','unmute','mic_lock','mic_unlock','unseat','kick','ban','unban'
  ) then
    raise exception 'Invalid action';
  end if;
  if p_target_user_id = v_uid then
    raise exception 'Cannot moderate self';
  end if;

  v_actor_is_owner := exists (
    select 1 from public.rooms r where r.id = p_room_id and r.host_id = v_uid
  );
  v_actor_is_cohost := exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id and m.user_id = v_uid and m.role = 'cohost'
  );

  if not v_actor_is_owner and not v_actor_is_cohost then
    raise exception 'Not room moderator';
  end if;

  v_target_is_owner := public.oda_hedef_owner_mu(p_room_id, p_target_user_id);
  v_target_is_cohost := public.oda_hedef_cohost_mu(p_room_id, p_target_user_id);

  if v_target_is_owner then
    raise exception 'Cannot moderate room owner';
  end if;

  if v_target_is_cohost and not v_actor_is_owner then
    raise exception 'Cannot moderate another admin';
  end if;

  if p_action = 'mute' then
    update public.room_seats
    set is_muted = true
    where room_id = p_room_id and user_id = p_target_user_id;

  elsif p_action = 'unmute' then
    update public.room_seats
    set is_muted = case when coalesce(is_mic_locked, false) then true else false end
    where room_id = p_room_id and user_id = p_target_user_id;

  elsif p_action = 'mic_lock' then
    update public.room_seats
    set is_muted = true, is_mic_locked = true
    where room_id = p_room_id and user_id = p_target_user_id;

  elsif p_action = 'mic_unlock' then
    update public.room_seats
    set is_mic_locked = false
    where room_id = p_room_id and user_id = p_target_user_id;

  elsif p_action = 'unseat' then
    update public.room_seats
    set user_id = null, is_muted = false, is_mic_locked = false
    where room_id = p_room_id and user_id = p_target_user_id;

    if v_target_is_cohost then
      update public.room_members
      set role = 'cohost'
      where room_id = p_room_id and user_id = p_target_user_id;
    else
      update public.room_members
      set role = 'listener'
      where room_id = p_room_id
        and user_id = p_target_user_id
        and role is distinct from 'host';
    end if;

  elsif p_action = 'kick' then
    delete from public.room_members
    where room_id = p_room_id and user_id = p_target_user_id;
    update public.room_seats
    set user_id = null, is_muted = false, is_mic_locked = false
    where room_id = p_room_id and user_id = p_target_user_id;

  elsif p_action = 'ban' then
    insert into public.room_bans (room_id, user_id, banned_by, reason)
    values (p_room_id, p_target_user_id, v_uid, p_reason)
    on conflict do nothing;
    delete from public.room_members
    where room_id = p_room_id and user_id = p_target_user_id;
    update public.room_seats
    set user_id = null, is_muted = false, is_mic_locked = false
    where room_id = p_room_id and user_id = p_target_user_id;

  elsif p_action = 'unban' then
    delete from public.room_bans
    where room_id = p_room_id and user_id = p_target_user_id;
  end if;

  insert into public.room_moderation_actions (
    room_id, actor_id, target_user_id, action, reason
  ) values (
    p_room_id, v_uid, p_target_user_id, p_action, p_reason
  ) returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.oda_moderasyon_uygula(uuid, uuid, text, text) to authenticated;

-- 4) Kullanıcı kendi koltuğundan ayrılır (mic lock engellemez)
create or replace function public.koltuktan_ayril(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
  v_was_cohost boolean := false;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_room_id is null then raise exception 'room_id required'; end if;

  select host_id into v_host from public.rooms where id = p_room_id;
  if v_host is null then raise exception 'Oda bulunamadı'; end if;

  v_was_cohost := public.oda_hedef_cohost_mu(p_room_id, v_uid);

  update public.room_seats
  set user_id = null, is_muted = false, is_mic_locked = false
  where room_id = p_room_id and user_id = v_uid;

  if v_uid = v_host then
    update public.room_members
    set role = 'host'
    where room_id = p_room_id and user_id = v_uid;
  elsif v_was_cohost then
    update public.room_members
    set role = 'cohost'
    where room_id = p_room_id and user_id = v_uid;
  else
    update public.room_members
    set role = 'listener'
    where room_id = p_room_id and user_id = v_uid;
  end if;
end;
$$;

grant execute on function public.koltuktan_ayril(uuid) to authenticated;

-- 5) Odadan ayrılırken mic lock temizle
create or replace function public.odadan_ayril(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_room_id is null then raise exception 'room_id required'; end if;

  update public.room_seats
  set user_id = null, is_muted = false, is_mic_locked = false
  where room_id = p_room_id and user_id = v_uid;

  delete from public.room_members
  where room_id = p_room_id and user_id = v_uid;
end;
$$;

grant execute on function public.odadan_ayril(uuid) to authenticated;

-- 6) Oda adı: OWNER veya ADMIN (cohost)
create or replace function public.oda_basligini_guncelle(
  p_room_id uuid,
  p_title text
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_title text;
  v_row public.rooms%rowtype;
  v_prev_at timestamptz;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_room_id is null then raise exception 'room_id required'; end if;

  v_title := trim(coalesce(p_title, ''));
  if length(v_title) = 0 then
    raise exception 'Başlık boş olamaz';
  end if;
  if length(v_title) > 40 then
    raise exception 'Başlık en fazla 40 karakter';
  end if;

  if not public.oda_aktor_moderator_mu(p_room_id, v_uid) then
    raise exception 'Not room moderator';
  end if;

  select updated_at into v_prev_at from public.rooms where id = p_room_id;
  if v_prev_at is not null and v_prev_at > now() - interval '2 seconds' then
    raise exception 'Çok hızlı deneme; biraz bekleyin';
  end if;

  update public.rooms
  set title = v_title,
      updated_at = now()
  where id = p_room_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Oda bulunamadı';
  end if;

  return v_row;
end;
$$;

grant execute on function public.oda_basligini_guncelle(uuid, text) to authenticated;

-- Yeni konuşmacı oturunca eski mic lock kalmasın
create or replace function public.room_seats_reset_flags_on_assign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null
     and (old.user_id is distinct from new.user_id) then
    new.is_muted := false;
    new.is_mic_locked := false;
  end if;
  if new.user_id is null then
    new.is_muted := false;
    new.is_mic_locked := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_room_seats_reset_flags on public.room_seats;
create trigger trg_room_seats_reset_flags
  before update on public.room_seats
  for each row
  execute function public.room_seats_reset_flags_on_assign();
