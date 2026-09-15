-- Sohbeti tam sil (kullanici icin): listeden kalkar, gecmis temizlenir
-- Yeni mesaj gelirse sohbet tekrar acilir

alter table public.message_thread_members
  add column if not exists deleted_at timestamptz,
  add column if not exists clear_before timestamptz;

create index if not exists message_thread_members_user_deleted_idx
  on public.message_thread_members (user_id, deleted_at)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Sohbeti sil (benden)
-- ---------------------------------------------------------------------------
create or replace function public.mesaj_sohbet_sil(p_thread_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.message_thread_members
    where thread_id = p_thread_id and user_id = v_uid
  ) then
    raise exception 'Not a thread member';
  end if;

  update public.message_thread_members set
    deleted_at = now(),
    clear_before = now(),
    archived_at = null,
    last_read_at = now()
  where thread_id = p_thread_id and user_id = v_uid;

  -- Mevcut mesajlari da benden gizle (clear_before ile birlikte)
  insert into public.direct_message_hidden (user_id, message_id)
  select v_uid, m.id
  from public.direct_messages m
  where m.thread_id = p_thread_id
    and m.deleted_at is null
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'thread_id', p_thread_id);
end;
$$;

grant execute on function public.mesaj_sohbet_sil(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Inbox: silinen sohbetleri gosterme
-- ---------------------------------------------------------------------------
create or replace function public.mesaj_konularini_getir(
  p_limit int default 50,
  p_arsiv boolean default false
)
returns table (
  id uuid,
  updated_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text,
  peer_id uuid,
  peer_display_name text,
  peer_username text,
  peer_avatar_url text,
  unread_count bigint,
  archived_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  return query
  select
    t.id,
    t.updated_at,
    t.last_message_at,
    t.last_message_preview,
    p.id,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Kullanıcı'),
    p.username,
    p.avatar_url,
    (
      select count(*)::bigint
      from public.direct_messages dm
      where dm.thread_id = t.id
        and dm.sender_id <> v_uid
        and dm.deleted_at is null
        and dm.created_at > coalesce(m_me.last_read_at, '1970-01-01'::timestamptz)
        and (m_me.clear_before is null or dm.created_at > m_me.clear_before)
        and not exists (
          select 1 from public.direct_message_hidden h
          where h.user_id = v_uid and h.message_id = dm.id
        )
    ) as unread_count,
    m_me.archived_at
  from public.message_thread_members m_me
  join public.message_threads t on t.id = m_me.thread_id
  join public.message_thread_members m_peer
    on m_peer.thread_id = t.id and m_peer.user_id <> v_uid
  join public.profiles p on p.id = m_peer.user_id
  where m_me.user_id = v_uid
    and m_me.deleted_at is null
    and not public.kullanicilar_engelli_mi(v_uid, m_peer.user_id)
    and (
      (coalesce(p_arsiv, false) = false and m_me.archived_at is null)
      or (p_arsiv = true and m_me.archived_at is not null)
    )
  order by t.last_message_at desc nulls last
  limit v_limit;
end;
$$;

grant execute on function public.mesaj_konularini_getir(int, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Mesaj listesi: clear_before oncesi gizle
-- ---------------------------------------------------------------------------
create or replace function public.mesajlari_getir(
  p_thread_id uuid,
  p_limit int default 50,
  p_before timestamptz default null
)
returns setof public.direct_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_clear timestamptz;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select clear_before into v_clear
  from public.message_thread_members
  where thread_id = p_thread_id and user_id = v_uid;

  if not found then raise exception 'Forbidden'; end if;

  return query
  select m.*
  from public.direct_messages m
  where m.thread_id = p_thread_id
    and m.deleted_at is null
    and (v_clear is null or m.created_at > v_clear)
    and not exists (
      select 1 from public.direct_message_hidden h
      where h.user_id = v_uid and h.message_id = m.id
    )
    and (p_before is null or m.created_at < p_before)
  order by m.created_at desc
  limit v_limit;
end;
$$;

grant execute on function public.mesajlari_getir(uuid, int, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Yeni mesaj: silinen / arsiv sohbeti geri ac
-- ---------------------------------------------------------------------------
create or replace function public.mesaj_gonder(
  p_thread_id uuid,
  p_body text default '',
  p_message_type text default 'text',
  p_media_url text default null,
  p_client_id uuid default null
)
returns public.direct_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_guest boolean;
  v_msg public.direct_messages%rowtype;
  v_peer uuid;
  v_sender_name text;
  v_preview text;
  v_type text := lower(coalesce(nullif(trim(p_message_type), ''), 'text'));
  v_body text := coalesce(p_body, '');
  v_media text := nullif(trim(coalesce(p_media_url, '')), '');
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_type not in ('text','image','video','voice','emoji','gift','system') then
    raise exception 'Invalid message type';
  end if;
  if public.kill_switch_aktif_mi('kill_gift_send') and v_type = 'gift' then
    raise exception 'Gift messages disabled';
  end if;
  if not public.ozellik_bayragi_aktif_mi('messages_enabled') then
    raise exception 'Messages feature disabled';
  end if;

  select is_guest into v_is_guest from public.profiles where id = v_uid;
  if coalesce(v_is_guest, false) then
    raise exception 'Guest cannot send messages';
  end if;

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

  if v_peer is not null and public.kullanicilar_engelli_mi(v_uid, v_peer) then
    raise exception 'Bu kullaniciyla iletisim engellenmis';
  end if;

  if p_client_id is not null then
    select * into v_msg from public.direct_messages
    where sender_id = v_uid and client_id = p_client_id
    limit 1;
    if found then return v_msg; end if;
  end if;

  if v_type in ('image','video','voice') then
    if v_media is null then raise exception 'Media required'; end if;
  elsif length(trim(v_body)) = 0 then
    raise exception 'Empty message';
  end if;

  v_preview := case
    when v_type = 'image' then '📷 Fotoğraf'
    when v_type = 'video' then '🎥 Video'
    when v_type = 'voice' then '🎤 Ses'
    else left(trim(v_body), 120)
  end;

  insert into public.direct_messages (
    thread_id, sender_id, body, message_type, media_url, client_id
  ) values (
    p_thread_id,
    v_uid,
    case when length(trim(v_body)) = 0 then null else left(trim(v_body), 4000) end,
    v_type,
    v_media,
    p_client_id
  )
  returning * into v_msg;

  update public.message_threads set
    updated_at = now(),
    last_message_at = now(),
    last_message_preview = v_preview
  where id = p_thread_id;

  -- Arsiv / silme: gonderen ve alicilar icin sohbeti geri getir
  update public.message_thread_members set
    archived_at = null,
    deleted_at = null
  where thread_id = p_thread_id
    and (archived_at is not null or deleted_at is not null);

  select coalesce(display_name, username, 'Birisi') into v_sender_name
  from public.profiles where id = v_uid;

  for v_peer in
    select user_id from public.message_thread_members
    where thread_id = p_thread_id and user_id <> v_uid
  loop
    if not public.kullanicilar_engelli_mi(v_uid, v_peer) then
      perform public.bildirim_kuyruga_ekle(
        v_peer,
        'messages',
        v_sender_name,
        v_preview,
        '/mesaj/' || p_thread_id::text,
        jsonb_build_object(
          'thread_id', p_thread_id,
          'sender_id', v_uid,
          'type', 'dm',
          'message_type', v_type
        )
      );
    end if;
  end loop;

  return v_msg;
end;
$$;

grant execute on function public.mesaj_gonder(uuid, text, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Sohbet ac: silinmisse geri getir
-- ---------------------------------------------------------------------------
create or replace function public.ozel_sohbet_ac_veya_getir(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_thread uuid;
  v_is_guest boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_uid = p_other_user_id then raise exception 'Invalid peer'; end if;

  select is_guest into v_is_guest from public.profiles where id = v_uid;
  if coalesce(v_is_guest, false) then
    raise exception 'Guest cannot start messages';
  end if;

  if public.kullanicilar_engelli_mi(v_uid, p_other_user_id) then
    raise exception 'Bu kullaniciyla iletisim engellenmis';
  end if;

  select m1.thread_id into v_thread
  from public.message_thread_members m1
  join public.message_thread_members m2 on m1.thread_id = m2.thread_id
  where m1.user_id = v_uid and m2.user_id = p_other_user_id
  limit 1;

  if v_thread is not null then
    update public.message_thread_members set
      deleted_at = null,
      archived_at = null
    where thread_id = v_thread and user_id = v_uid
      and (deleted_at is not null or archived_at is not null);
    return v_thread;
  end if;

  insert into public.message_threads default values returning id into v_thread;
  insert into public.message_thread_members (thread_id, user_id) values
    (v_thread, v_uid), (v_thread, p_other_user_id);

  return v_thread;
end;
$$;

grant execute on function public.ozel_sohbet_ac_veya_getir(uuid) to authenticated;
