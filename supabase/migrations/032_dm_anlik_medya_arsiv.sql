-- Anlik DM: realtime, medya, arsiv, silme (Telegram tarzi)

-- Schema
alter table public.message_thread_members
  add column if not exists archived_at timestamptz;

alter table public.direct_messages
  add column if not exists client_id uuid,
  add column if not exists media_mime text,
  add column if not exists media_width int,
  add column if not exists media_height int;

create unique index if not exists direct_messages_client_id_uq
  on public.direct_messages (sender_id, client_id)
  where client_id is not null;

create table if not exists public.direct_message_hidden (
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.direct_messages(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, message_id)
);

alter table public.direct_message_hidden enable row level security;

drop policy if exists "Own hidden dm" on public.direct_message_hidden;
create policy "Own hidden dm"
  on public.direct_message_hidden for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, delete on public.direct_message_hidden to authenticated;

-- Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table public.direct_messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.message_threads;
  exception when duplicate_object then null;
  end;
end $$;

-- Eski overload'lari dusur
drop function if exists public.mesaj_gonder(uuid, text, text);
drop function if exists public.mesaj_gonder(uuid, text);

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

  -- Idempotent optimistic retry
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

  -- Arsivden cikar (yeni mesaj)
  update public.message_thread_members
    set archived_at = null
  where thread_id = p_thread_id and archived_at is not null;

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

create or replace function public.mesaj_thread_okundu(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.message_thread_members
    set last_read_at = now()
  where thread_id = p_thread_id and user_id = auth.uid();
end;
$$;

grant execute on function public.mesaj_thread_okundu(uuid) to authenticated;

create or replace function public.mesaj_thread_arsivle(
  p_thread_id uuid,
  p_arsiv boolean default true
)
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
    archived_at = case when p_arsiv then now() else null end
  where thread_id = p_thread_id and user_id = v_uid;

  return jsonb_build_object('ok', true, 'archived', p_arsiv);
end;
$$;

grant execute on function public.mesaj_thread_arsivle(uuid, boolean) to authenticated;

create or replace function public.mesaj_sil(
  p_message_id uuid,
  p_kapsam text default 'me'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_msg public.direct_messages%rowtype;
  v_kapsam text := lower(coalesce(nullif(trim(p_kapsam), ''), 'me'));
  v_preview text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_msg from public.direct_messages where id = p_message_id;
  if not found then raise exception 'Mesaj yok'; end if;

  if not exists (
    select 1 from public.message_thread_members
    where thread_id = v_msg.thread_id and user_id = v_uid
  ) then
    raise exception 'Forbidden';
  end if;

  if v_kapsam = 'everyone' then
    if v_msg.sender_id <> v_uid then
      raise exception 'Sadece kendi mesajini herkesten silebilirsin';
    end if;
    update public.direct_messages set
      deleted_at = now(),
      body = null,
      media_url = null
    where id = p_message_id;

    select case
      when m.message_type = 'image' then '📷 Fotoğraf'
      when m.message_type = 'video' then '🎥 Video'
      when m.deleted_at is not null then null
      else left(coalesce(m.body, ''), 120)
    end into v_preview
    from public.direct_messages m
    where m.thread_id = v_msg.thread_id
      and m.deleted_at is null
    order by m.created_at desc
    limit 1;

    update public.message_threads set
      last_message_preview = coalesce(v_preview, 'Mesaj silindi'),
      updated_at = now()
    where id = v_msg.thread_id;

    return jsonb_build_object('ok', true, 'kapsam', 'everyone');
  end if;

  insert into public.direct_message_hidden (user_id, message_id)
  values (v_uid, p_message_id)
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'kapsam', 'me');
end;
$$;

grant execute on function public.mesaj_sil(uuid, text) to authenticated;

-- Inbox: arsivlenmeyen + okunmamis sayisi
drop function if exists public.mesaj_konularini_getir(int);

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

-- Mesaj listesi (gizli + silinen filtresi)
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
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.message_thread_members
    where thread_id = p_thread_id and user_id = v_uid
  ) then
    raise exception 'Forbidden';
  end if;

  return query
  select m.*
  from public.direct_messages m
  where m.thread_id = p_thread_id
    and m.deleted_at is null
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

-- Storage: dm-media (public URL, uye yukler)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dm-media',
  'dm-media',
  true,
  104857600,
  array[
    'image/jpeg','image/png','image/webp','image/heic',
    'video/mp4','video/quicktime','video/webm'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "DM media read" on storage.objects;
create policy "DM media read"
  on storage.objects for select to authenticated
  using (bucket_id = 'dm-media');

drop policy if exists "DM media insert" on storage.objects;
create policy "DM media insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'dm-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "DM media update own" on storage.objects;
create policy "DM media update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'dm-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "DM media delete own" on storage.objects;
create policy "DM media delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'dm-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
