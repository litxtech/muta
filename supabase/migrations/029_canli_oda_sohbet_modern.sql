-- Canli yayin sohbeti + room chat realtime (Twitch benzeri, bagimsiz urun)

create table if not exists public.live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists live_chat_messages_session_created_idx
  on public.live_chat_messages (session_id, created_at desc);

alter table public.live_chat_messages enable row level security;

drop policy if exists "Live chat readable" on public.live_chat_messages;
create policy "Live chat readable"
  on public.live_chat_messages for select to authenticated using (true);

grant select on public.live_chat_messages to authenticated;

create or replace function public.canli_sohbet_mesaji_gonder(
  p_session_id uuid,
  p_body text
)
returns public.live_chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_row public.live_chat_messages%rowtype;
  v_text text := trim(coalesce(p_body, ''));
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir canli sohbete yazamaz'; end if;
  if char_length(v_text) < 1 or char_length(v_text) > 500 then
    raise exception 'Gecersiz mesaj';
  end if;
  if not exists (
    select 1 from public.live_sessions where id = p_session_id and is_live = true
  ) then
    raise exception 'Yayin aktif degil';
  end if;

  insert into public.live_chat_messages (session_id, user_id, body)
  values (p_session_id, v_uid, v_text)
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function public.canli_sohbet_mesaji_gonder(uuid, text) to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.room_chat_messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.live_chat_messages;
  exception when duplicate_object then null;
  end;
end $$;
