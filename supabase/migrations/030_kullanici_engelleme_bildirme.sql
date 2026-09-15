-- Kullanici engelleme + bildirme (Apple / Google: block & report)
-- Engellenen taraf engelleyeni (ve tersi kesif/iletisim) platformda bulusamaz.

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_id, created_at desc);
create index if not exists user_blocks_blocker_idx
  on public.user_blocks (blocker_id, created_at desc);

alter table public.user_blocks enable row level security;

drop policy if exists "Own blocks read" on public.user_blocks;
create policy "Own blocks read"
  on public.user_blocks for select to authenticated
  using (auth.uid() = blocker_id);

grant select on public.user_blocks to authenticated;

-- Her iki yon: A engelledi B VEYA B engelledi A
create or replace function public.kullanicilar_engelli_mi(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = p_a and blocked_id = p_b)
       or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

grant execute on function public.kullanicilar_engelli_mi(uuid, uuid) to authenticated;

create or replace function public.kullanici_engelle(p_blocked_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_blocked_id is null or p_blocked_id = v_uid then
    raise exception 'Gecersiz kullanici';
  end if;

  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir engelleyemez'; end if;

  if not exists (
    select 1 from public.profiles where id = p_blocked_id and deleted_at is null
  ) then
    raise exception 'Kullanici yok';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_uid, p_blocked_id)
  on conflict do nothing;

  -- Takip baglarini kopar
  delete from public.follows
  where (follower_id = v_uid and following_id = p_blocked_id)
     or (follower_id = p_blocked_id and following_id = v_uid);

  -- Acik cagrilari bitir
  update public.direct_calls set
    status = case when status = 'ringing' then 'cancelled' else 'ended' end,
    ended_at = now(),
    ended_by = v_uid,
    end_reason = 'blocked'
  where status in ('ringing', 'active')
    and (
      (caller_id = v_uid and callee_id = p_blocked_id)
      or (caller_id = p_blocked_id and callee_id = v_uid)
    );

  perform public.guvenlik_olayi_kaydet(
    'user_block',
    null,
    jsonb_build_object('blocked_id', p_blocked_id)
  );

  return jsonb_build_object('ok', true, 'blocked_id', p_blocked_id);
end;
$$;

create or replace function public.kullanici_engeli_kaldir(p_blocked_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  delete from public.user_blocks
  where blocker_id = v_uid and blocked_id = p_blocked_id;
  return jsonb_build_object('ok', true, 'blocked_id', p_blocked_id);
end;
$$;

create or replace function public.engellenen_kullanicilar_listesi(p_limit int default 100)
returns table (
  blocked_id uuid,
  created_at timestamptz,
  display_name text,
  username text,
  avatar_url text,
  public_user_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 100), 1), 200);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  return query
  select
    b.blocked_id,
    b.created_at,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Kullanıcı'),
    p.username,
    p.avatar_url,
    p.public_user_id
  from public.user_blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = v_uid
  order by b.created_at desc
  limit v_limit;
end;
$$;

-- Arama: engelli kullanicilari gosterme (Apple/Google kesif engeli)
create or replace function public.kullanici_ara(
  p_query text,
  p_limit int default 20
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  public_user_id text,
  is_verified boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_q text := left(trim(coalesce(p_query, '')), 40);
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 40);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if length(v_q) < 1 then return; end if;

  return query
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.public_user_id,
    coalesce(p.is_verified, false)
  from public.profiles p
  where p.deleted_at is null
    and p.id <> v_uid
    and not public.kullanicilar_engelli_mi(v_uid, p.id)
    and (
      p.username ilike v_q || '%'
      or p.display_name ilike v_q || '%'
      or p.public_user_id ilike v_q || '%'
    )
  order by p.display_name nulls last
  limit v_limit;
end;
$$;

-- DM thread listesi: engelli eslesmeleri gizle
create or replace function public.mesaj_konularini_getir(p_limit int default 50)
returns table (
  id uuid,
  updated_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text,
  peer_id uuid,
  peer_display_name text,
  peer_username text,
  peer_avatar_url text
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
    p.avatar_url
  from public.message_thread_members m_me
  join public.message_threads t on t.id = m_me.thread_id
  join public.message_thread_members m_peer
    on m_peer.thread_id = t.id and m_peer.user_id <> v_uid
  join public.profiles p on p.id = m_peer.user_id
  where m_me.user_id = v_uid
    and not public.kullanicilar_engelli_mi(v_uid, m_peer.user_id)
  order by t.last_message_at desc nulls last
  limit v_limit;
end;
$$;

grant execute on function public.kullanici_engelle(uuid) to authenticated;
grant execute on function public.kullanici_engeli_kaldir(uuid) to authenticated;
grant execute on function public.engellenen_kullanicilar_listesi(int) to authenticated;
grant execute on function public.kullanici_ara(text, int) to authenticated;
grant execute on function public.mesaj_konularini_getir(int) to authenticated;

-- Sohbet acma engeli
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
    return v_thread;
  end if;

  insert into public.message_threads default values returning id into v_thread;
  insert into public.message_thread_members (thread_id, user_id) values
    (v_thread, v_uid), (v_thread, p_other_user_id);

  return v_thread;
end;
$$;

-- Mesaj gonder engeli + push yok
create or replace function public.mesaj_gonder(
  p_thread_id uuid,
  p_body text,
  p_message_type text default 'text'
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
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_gift_send') and p_message_type = 'gift' then
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

  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'Empty message';
  end if;

  v_preview := left(trim(p_body), 120);

  insert into public.direct_messages (thread_id, sender_id, body, message_type)
  values (p_thread_id, v_uid, left(trim(p_body), 4000), coalesce(p_message_type, 'text'))
  returning * into v_msg;

  update public.message_threads set
    updated_at = now(),
    last_message_at = now(),
    last_message_preview = v_preview
  where id = p_thread_id;

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
          'type', 'dm'
        )
      );
    end if;
  end loop;

  return v_msg;
end;
$$;

-- Takip engeli
create or replace function public.takip_et(p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_guest boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_uid = p_target_id then raise exception 'Cannot follow self'; end if;
  select is_guest into v_is_guest from public.profiles where id = v_uid;
  if coalesce(v_is_guest, false) then raise exception 'Guest cannot follow'; end if;

  if public.kullanicilar_engelli_mi(v_uid, p_target_id) then
    raise exception 'Bu kullaniciyla iletisim engellenmis';
  end if;

  insert into public.follows (follower_id, following_id)
  values (v_uid, p_target_id)
  on conflict do nothing;

  -- Push (022 ile ayni davranis, varsa)
  begin
    perform public.bildirim_kuyruga_ekle(
      p_target_id,
      'social',
      coalesce((select display_name from public.profiles where id = v_uid), 'Birisi'),
      'Seni takip etmeye başladı',
      '/(tabs)/profile',
      jsonb_build_object('follower_id', v_uid, 'type', 'follow')
    );
  exception when others then
    null;
  end;
end;
$$;

-- Cagri engeli
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

  return v_row;
end;
$$;

create or replace function public.gorusme_cevapla(p_call_id uuid)
returns public.direct_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.direct_calls%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_row from public.direct_calls where id = p_call_id;
  if not found then raise exception 'Cagri yok'; end if;

  if public.kullanicilar_engelli_mi(v_uid, v_row.caller_id) then
    update public.direct_calls set
      status = 'rejected',
      ended_at = now(),
      ended_by = v_uid,
      end_reason = 'blocked'
    where id = p_call_id
    returning * into v_row;
    raise exception 'Bu kullaniciyla iletisim engellenmis';
  end if;

  update public.direct_calls set
    status = 'active',
    answered_at = now()
  where id = p_call_id
    and callee_id = v_uid
    and status = 'ringing'
  returning * into v_row;

  if not found then raise exception 'Cagri cevaplanamadi'; end if;
  return v_row;
end;
$$;

-- Bildir: hedef zorunlu degil ama varsa kayit; engelle opsiyonel degil — ayri RPC
-- kullanici_bildir ayni kalir; client engelle+bildir sirayla cagirir

-- Canli / oda sohbet: engelli gondericiyi reddet (alici host veya peer)
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
  v_host uuid;
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

  select host_id into v_host from public.rooms where id = p_room_id;
  if v_host is not null and public.kullanicilar_engelli_mi(v_uid, v_host) then
    raise exception 'Bu kullaniciyla iletisim engellenmis';
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
  v_host uuid;
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

  select host_id into v_host from public.live_sessions where id = p_session_id;
  if v_host is not null and public.kullanicilar_engelli_mi(v_uid, v_host) then
    raise exception 'Bu kullaniciyla iletisim engellenmis';
  end if;

  insert into public.live_chat_messages (session_id, user_id, body)
  values (p_session_id, v_uid, v_text)
  returning * into v_row;
  return v_row;
end;
$$;

-- Sohbet listelerinde engelli kullanici mesajlarini filtrele (okuma RPC)
create or replace function public.oda_sohbet_mesajlarini_getir(
  p_room_id uuid,
  p_limit int default 50
)
returns table (
  id uuid,
  room_id uuid,
  user_id uuid,
  body text,
  created_at timestamptz,
  display_name text,
  username text,
  avatar_url text
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
    m.id, m.room_id, m.user_id, m.body, m.created_at,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Kullanıcı'),
    p.username,
    p.avatar_url
  from public.room_chat_messages m
  left join public.profiles p on p.id = m.user_id
  where m.room_id = p_room_id
    and not public.kullanicilar_engelli_mi(v_uid, m.user_id)
  order by m.created_at desc
  limit v_limit;
end;
$$;

create or replace function public.canli_sohbet_mesajlarini_getir(
  p_session_id uuid,
  p_limit int default 50
)
returns table (
  id uuid,
  session_id uuid,
  user_id uuid,
  body text,
  created_at timestamptz,
  display_name text,
  username text,
  avatar_url text
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
    m.id, m.session_id, m.user_id, m.body, m.created_at,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Kullanıcı'),
    p.username,
    p.avatar_url
  from public.live_chat_messages m
  left join public.profiles p on p.id = m.user_id
  where m.session_id = p_session_id
    and not public.kullanicilar_engelli_mi(v_uid, m.user_id)
  order by m.created_at desc
  limit v_limit;
end;
$$;

grant execute on function public.oda_sohbet_mesajlarini_getir(uuid, int) to authenticated;
grant execute on function public.canli_sohbet_mesajlarini_getir(uuid, int) to authenticated;
grant execute on function public.oda_sohbet_mesaji_gonder(uuid, text) to authenticated;
grant execute on function public.canli_sohbet_mesaji_gonder(uuid, text) to authenticated;
grant execute on function public.ozel_sohbet_ac_veya_getir(uuid) to authenticated;
grant execute on function public.mesaj_gonder(uuid, text, text) to authenticated;
grant execute on function public.takip_et(uuid) to authenticated;
grant execute on function public.gorusme_baslat(uuid, text) to authenticated;
grant execute on function public.gorusme_cevapla(uuid) to authenticated;
