-- 054: Gelen arama aninda push + hizli sinyal
-- gorusme_baslat: callee icin notification_outbox (arama push)

create or replace function public.gorusme_baslat(
  p_thread_id uuid,
  p_call_type text
)
returns public.direct_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_peer uuid;
  v_guest boolean;
  v_type text := lower(trim(p_call_type));
  v_row public.direct_calls%rowtype;
  v_channel text;
  v_caller_name text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_type not in ('audio', 'video') then raise exception 'Gecersiz cagri turu'; end if;

  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir arama yapamaz'; end if;

  if not exists (
    select 1 from public.message_thread_members
    where thread_id = p_thread_id and user_id = v_uid
  ) then
    raise exception 'Not a thread member';
  end if;

  select user_id into v_peer
  from public.message_thread_members
  where thread_id = p_thread_id and user_id <> v_uid
  limit 1;
  if v_peer is null then raise exception 'Karsi taraf yok'; end if;

  if public.kullanicilar_engelli_mi(v_uid, v_peer) then
    raise exception 'Bu kullaniciyla iletisim engellenmis';
  end if;

  if exists (
    select 1 from public.direct_calls
    where status in ('ringing', 'active')
      and (
        (caller_id = v_uid and callee_id = v_peer)
        or (caller_id = v_peer and callee_id = v_uid)
      )
  ) then
    raise exception 'Zaten aktif bir gorusme var';
  end if;

  v_channel := 'dm_call_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.direct_calls (
    thread_id, caller_id, callee_id, call_type, status, channel_name
  ) values (
    p_thread_id, v_uid, v_peer, v_type, 'ringing', v_channel
  ) returning * into v_row;

  insert into public.direct_messages (thread_id, sender_id, body, message_type)
  values (
    p_thread_id,
    v_uid,
    case when v_type = 'video' then '📹 Görüntülü arama' else '📞 Sesli arama' end,
    'system'
  );

  update public.message_threads set
    updated_at = now(),
    last_message_at = now(),
    last_message_preview = case when v_type = 'video' then 'Görüntülü arama' else 'Sesli arama' end
  where id = p_thread_id;

  -- Gelen arama push (arka planda / kapali app)
  begin
    select coalesce(
      nullif(trim(display_name), ''),
      nullif(trim(username), ''),
      'Birisi'
    ) into v_caller_name
    from public.profiles where id = v_uid;

    perform public.bildirim_kuyruga_ekle(
      v_peer,
      'messages',
      v_caller_name || ' arıyor',
      case when v_type = 'video' then 'Görüntülü arama' else 'Sesli arama' end,
      '/gorusme/' || v_row.id::text,
      jsonb_build_object(
        'type', 'incoming_call',
        'call_id', v_row.id,
        'call_type', v_type,
        'caller_id', v_uid,
        'thread_id', p_thread_id,
        'channel_name', v_channel
      )
    );
  exception when others then
    null;
  end;

  return v_row;
end;
$$;

grant execute on function public.gorusme_baslat(uuid, text) to authenticated;
