-- canli_yayin_aktif_et: bildirim hatası is_live aktivasyonunu geri almasın

create or replace function public.canli_yayin_aktif_et(p_session_id uuid)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.live_sessions%rowtype;
  v_host_name text;
  v_follower uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_session_id is null then raise exception 'session required'; end if;

  select * into v_row
  from public.live_sessions
  where id = p_session_id and host_id = v_uid
  for update;

  if not found then
    raise exception 'Live session not found';
  end if;

  if coalesce(v_row.is_live, false) then
    return v_row;
  end if;

  update public.live_sessions
    set is_live = false, ended_at = coalesce(ended_at, now())
  where host_id = v_uid and is_live = true and id <> p_session_id;

  update public.live_sessions
    set is_live = true,
        ended_at = null,
        started_at = coalesce(started_at, now())
  where id = p_session_id
  returning * into v_row;

  begin
    select coalesce(display_name, username, 'Biri') into v_host_name
    from public.profiles where id = v_uid;

    for v_follower in
      select follower_id from public.follows
      where following_id = v_uid
      limit 200
    loop
      begin
        perform public.bildirim_kuyruga_ekle(
          v_follower,
          'live',
          v_host_name || ' canlıda',
          coalesce(nullif(trim(v_row.title), ''), 'Canlı yayın başladı'),
          '/canli/' || v_row.id::text,
          jsonb_build_object(
            'live_id', v_row.id,
            'host_id', v_uid,
            'type', 'live_start'
          )
        );
      exception when others then
        null;
      end;
    end loop;
  exception when others then
    null;
  end;

  return v_row;
end;
$$;

grant execute on function public.canli_yayin_aktif_et(uuid) to authenticated;
