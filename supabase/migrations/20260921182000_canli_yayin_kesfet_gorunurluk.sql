-- Canlı yayın keşif görünürlüğü
-- 1) baslat: is_live=true (bağlantı fail → client Bitir)
-- 2) RLS: anon+auth is_live okuyabilsin
-- 3) host kendi satırını güncelleyebilsin (aktif_et fallback)

create or replace function public.canli_yayin_baslat(
  p_title text,
  p_mode text default 'solo',
  p_category text default null,
  p_topic text default null
)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_row public.live_sessions%rowtype;
  v_room_name text;
  v_cat text := nullif(trim(coalesce(p_category, '')), '');
  v_topic text := nullif(trim(coalesce(p_topic, '')), '');
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_live') then
    raise exception 'Live temporarily disabled';
  end if;
  if not public.ozellik_bayragi_aktif_mi('live_enabled') then
    raise exception 'Live feature disabled';
  end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot go live'; end if;
  if length(trim(coalesce(p_title, ''))) < 2 then
    raise exception 'Title required';
  end if;

  update public.live_sessions
    set is_live = false, ended_at = coalesce(ended_at, now())
  where host_id = v_uid and is_live = true;

  v_room_name := 'live_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.live_sessions (
    host_id, title, mode, livekit_room_name, is_live, category, topic, started_at
  ) values (
    v_uid,
    left(trim(p_title), 80),
    coalesce(nullif(trim(p_mode), ''), 'solo'),
    v_room_name,
    true,
    left(v_cat, 32),
    left(v_topic, 80),
    now()
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.canli_yayin_baslat(text, text, text, text) to authenticated;

drop policy if exists "Live sessions readable" on public.live_sessions;
create policy "Live sessions readable"
  on public.live_sessions
  for select
  to authenticated, anon
  using (is_live = true or host_id = auth.uid());

grant select on public.live_sessions to anon;
grant select on public.live_sessions to authenticated;

drop policy if exists "Hosts update own live sessions" on public.live_sessions;
create policy "Hosts update own live sessions"
  on public.live_sessions
  for update
  to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());
