-- FAZ 9.1: Oda sohbeti (room chat ≠ DM)
-- Run after 010

create table if not exists public.room_chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists room_chat_messages_room_created_idx
  on public.room_chat_messages (room_id, created_at desc);

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

  if to_regclass('public.room_bans') is not null then
    select exists (
      select 1 from public.room_bans
      where room_id = p_room_id and user_id = v_uid
        and (expires_at is null or expires_at > now())
    ) into v_banned;
    if coalesce(v_banned, false) then raise exception 'Banned from room'; end if;
  end if;

  insert into public.room_chat_messages (room_id, user_id, body)
  values (p_room_id, v_uid, v_text)
  returning * into v_row;
  return v_row;
end;
$$;

alter table public.room_chat_messages enable row level security;

drop policy if exists "Room chat readable by authenticated" on public.room_chat_messages;
create policy "Room chat readable by authenticated"
  on public.room_chat_messages for select to authenticated using (true);

grant select on public.room_chat_messages to authenticated;
grant execute on function public.oda_sohbet_mesaji_gonder(uuid, text) to authenticated;
