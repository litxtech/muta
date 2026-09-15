-- Durum paylasimi: resim/video feed, begeni, yorum, silme, bildirme

create table if not exists public.status_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  media_url text not null,
  caption text,
  like_count int not null default 0,
  comment_count int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists status_posts_feed_idx
  on public.status_posts (created_at desc)
  where deleted_at is null;

create index if not exists status_posts_user_idx
  on public.status_posts (user_id, created_at desc)
  where deleted_at is null;

create table if not exists public.status_likes (
  status_id uuid not null references public.status_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (status_id, user_id)
);

create index if not exists status_likes_user_idx
  on public.status_likes (user_id, created_at desc);

create table if not exists public.status_comments (
  id uuid primary key default gen_random_uuid(),
  status_id uuid not null references public.status_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists status_comments_status_idx
  on public.status_comments (status_id, created_at desc)
  where deleted_at is null;

alter table public.status_posts enable row level security;
alter table public.status_likes enable row level security;
alter table public.status_comments enable row level security;

drop policy if exists "Status posts read" on public.status_posts;
create policy "Status posts read"
  on public.status_posts for select to authenticated
  using (deleted_at is null or user_id = auth.uid());

drop policy if exists "Status likes read" on public.status_likes;
create policy "Status likes read"
  on public.status_likes for select to authenticated using (true);

drop policy if exists "Status comments read" on public.status_comments;
create policy "Status comments read"
  on public.status_comments for select to authenticated
  using (deleted_at is null or user_id = auth.uid());

grant select on public.status_posts to authenticated;
grant select on public.status_likes to authenticated;
grant select on public.status_comments to authenticated;

-- Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'status-media',
  'status-media',
  true,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Status media public read" on storage.objects;
create policy "Status media public read"
  on storage.objects for select to public
  using (bucket_id = 'status-media');

drop policy if exists "Status media own upload" on storage.objects;
create policy "Status media own upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'status-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Status media own update" on storage.objects;
create policy "Status media own update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'status-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Status media own delete" on storage.objects;
create policy "Status media own delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'status-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table public.status_posts;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.status_likes;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.status_comments;
  exception when duplicate_object then null;
  end;
end $$;

alter table public.status_posts replica identity full;
alter table public.status_likes replica identity full;
alter table public.status_comments replica identity full;

-- ---------------------------------------------------------------------------
-- Durum olustur
-- ---------------------------------------------------------------------------
create or replace function public.durum_olustur(
  p_media_type text,
  p_media_url text,
  p_caption text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_id uuid;
  v_type text := lower(trim(coalesce(p_media_type, '')));
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir durum paylasamaz'; end if;
  if v_type not in ('image', 'video') then raise exception 'Gecersiz medya turu'; end if;
  if p_media_url is null or length(trim(p_media_url)) < 8 then
    raise exception 'Medya gerekli';
  end if;

  insert into public.status_posts (user_id, media_type, media_url, caption)
  values (
    v_uid,
    v_type,
    left(trim(p_media_url), 2000),
    nullif(left(trim(coalesce(p_caption, '')), 500), '')
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.durum_olustur(text, text, text) to authenticated;

-- Soft delete durum
create or replace function public.durum_sil(p_status_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select user_id into v_owner from public.status_posts where id = p_status_id;
  if v_owner is null then raise exception 'Durum yok'; end if;
  if v_owner <> v_uid and not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;

  update public.status_posts
  set deleted_at = now(), updated_at = now()
  where id = p_status_id and deleted_at is null;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.durum_sil(uuid) to authenticated;

-- Feed
create or replace function public.durum_akisi(p_limit int default 40, p_before timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc)
    from (
      select
        s.id,
        s.user_id,
        s.media_type,
        s.media_url,
        s.caption,
        s.like_count,
        s.comment_count,
        s.created_at,
        coalesce(p.display_name, p.username, 'Kullanıcı') as display_name,
        p.username,
        p.avatar_url,
        p.public_user_id,
        exists(
          select 1 from public.status_likes l
          where l.status_id = s.id and l.user_id = v_uid
        ) as liked_by_me,
        (s.user_id = v_uid) as is_mine
      from public.status_posts s
      join public.profiles p on p.id = s.user_id
      where s.deleted_at is null
        and p.deleted_at is null
        and p.banned_at is null
        and not public.kullanicilar_engelli_mi(v_uid, s.user_id)
        and (p_before is null or s.created_at < p_before)
      order by s.created_at desc
      limit least(greatest(coalesce(p_limit, 40), 1), 80)
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.durum_akisi(int, timestamptz) to authenticated;

-- Detay
create or replace function public.durum_detay(p_status_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select jsonb_build_object(
    'id', s.id,
    'user_id', s.user_id,
    'media_type', s.media_type,
    'media_url', s.media_url,
    'caption', s.caption,
    'like_count', s.like_count,
    'comment_count', s.comment_count,
    'created_at', s.created_at,
    'display_name', coalesce(p.display_name, p.username, 'Kullanıcı'),
    'username', p.username,
    'avatar_url', p.avatar_url,
    'public_user_id', p.public_user_id,
    'liked_by_me', exists(
      select 1 from public.status_likes l
      where l.status_id = s.id and l.user_id = v_uid
    ),
    'is_mine', (s.user_id = v_uid)
  )
  into v_row
  from public.status_posts s
  join public.profiles p on p.id = s.user_id
  where s.id = p_status_id and s.deleted_at is null;

  if v_row is null then raise exception 'Durum yok'; end if;
  return v_row;
end;
$$;

grant execute on function public.durum_detay(uuid) to authenticated;

-- Begeni toggle
create or replace function public.durum_begeni_toggle(p_status_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_owner uuid;
  v_liked boolean;
  v_count int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir begeni yapamaz'; end if;

  select user_id into v_owner
  from public.status_posts
  where id = p_status_id and deleted_at is null;
  if v_owner is null then raise exception 'Durum yok'; end if;

  if exists(
    select 1 from public.status_likes
    where status_id = p_status_id and user_id = v_uid
  ) then
    delete from public.status_likes
    where status_id = p_status_id and user_id = v_uid;
    v_liked := false;
  else
    insert into public.status_likes (status_id, user_id)
    values (p_status_id, v_uid)
    on conflict do nothing;
    v_liked := true;

    if v_owner <> v_uid then
      perform public.bildirim_kuyruga_ekle(
        v_owner,
        'social',
        'Durumuna beğeni',
        coalesce(
          (select display_name from public.profiles where id = v_uid),
          'Birisi'
        ) || ' durumunu beğendi',
        '/durum/' || p_status_id::text,
        jsonb_build_object(
          'type', 'status_like',
          'status_id', p_status_id,
          'actor_id', v_uid
        )
      );
    end if;
  end if;

  update public.status_posts s
  set
    like_count = (select count(*)::int from public.status_likes l where l.status_id = s.id),
    updated_at = now()
  where s.id = p_status_id
  returning like_count into v_count;

  return jsonb_build_object('ok', true, 'liked', v_liked, 'like_count', v_count);
end;
$$;

grant execute on function public.durum_begeni_toggle(uuid) to authenticated;

-- Begenenler
create or replace function public.durum_begenenler(p_status_id uuid, p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc)
    from (
      select
        l.user_id,
        l.created_at,
        coalesce(p.display_name, p.username, 'Kullanıcı') as display_name,
        p.username,
        p.avatar_url,
        p.public_user_id
      from public.status_likes l
      join public.profiles p on p.id = l.user_id
      where l.status_id = p_status_id
      order by l.created_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 100)
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.durum_begenenler(uuid, int) to authenticated;

-- Yorum ekle
create or replace function public.durum_yorum_ekle(p_status_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_owner uuid;
  v_id uuid;
  v_body text := left(trim(coalesce(p_body, '')), 500);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir yorum yapamaz'; end if;
  if length(v_body) < 1 then raise exception 'Yorum bos olamaz'; end if;

  select user_id into v_owner
  from public.status_posts
  where id = p_status_id and deleted_at is null;
  if v_owner is null then raise exception 'Durum yok'; end if;

  insert into public.status_comments (status_id, user_id, body)
  values (p_status_id, v_uid, v_body)
  returning id into v_id;

  update public.status_posts
  set
    comment_count = (
      select count(*)::int from public.status_comments c
      where c.status_id = p_status_id and c.deleted_at is null
    ),
    updated_at = now()
  where id = p_status_id;

  if v_owner <> v_uid then
    perform public.bildirim_kuyruga_ekle(
      v_owner,
      'social',
      'Durumuna yorum',
      coalesce(
        (select display_name from public.profiles where id = v_uid),
        'Birisi'
      ) || ': ' || left(v_body, 80),
      '/durum/' || p_status_id::text,
      jsonb_build_object(
        'type', 'status_comment',
        'status_id', p_status_id,
        'comment_id', v_id,
        'actor_id', v_uid
      )
    );
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.durum_yorum_ekle(uuid, text) to authenticated;

-- Yorum sil
create or replace function public.durum_yorum_sil(p_comment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_c public.status_comments%rowtype;
  v_owner uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_c from public.status_comments where id = p_comment_id;
  if v_c.id is null then raise exception 'Yorum yok'; end if;

  select user_id into v_owner from public.status_posts where id = v_c.status_id;

  if v_c.user_id <> v_uid
     and v_owner <> v_uid
     and not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;

  update public.status_comments
  set deleted_at = now()
  where id = p_comment_id and deleted_at is null;

  update public.status_posts
  set
    comment_count = (
      select count(*)::int from public.status_comments c
      where c.status_id = v_c.status_id and c.deleted_at is null
    ),
    updated_at = now()
  where id = v_c.status_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.durum_yorum_sil(uuid) to authenticated;

-- Yorum listesi
create or replace function public.durum_yorumlari(p_status_id uuid, p_limit int default 60)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.created_at asc)
    from (
      select
        c.id,
        c.user_id,
        c.body,
        c.created_at,
        coalesce(p.display_name, p.username, 'Kullanıcı') as display_name,
        p.username,
        p.avatar_url,
        p.public_user_id,
        (c.user_id = v_uid) as is_mine
      from public.status_comments c
      join public.profiles p on p.id = c.user_id
      where c.status_id = p_status_id and c.deleted_at is null
      order by c.created_at asc
      limit least(greatest(coalesce(p_limit, 60), 1), 120)
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.durum_yorumlari(uuid, int) to authenticated;

-- Bildir: status content types
create or replace function public.kullanici_bildir(
  p_reason text,
  p_target_user_id uuid default null,
  p_room_id uuid default null,
  p_details text default null,
  p_content_type text default null,
  p_content_id uuid default null,
  p_context jsonb default '{}'::jsonb
)
returns public.user_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.user_reports%rowtype;
  v_ctype text := lower(nullif(trim(coalesce(p_content_type, '')), ''));
  v_ctx jsonb := coalesce(p_context, '{}'::jsonb);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Reason required';
  end if;
  if v_ctype is not null and v_ctype not in (
    'user', 'dm_message', 'room_chat', 'live_chat', 'room', 'profile',
    'status_post', 'status_comment', 'other'
  ) then
    v_ctype := 'other';
  end if;

  if v_ctype = 'dm_message' and p_content_id is not null then
    select coalesce(v_ctx, '{}'::jsonb) || jsonb_build_object(
      'body', m.body, 'message_type', m.message_type, 'media_url', m.media_url,
      'sender_id', m.sender_id, 'thread_id', m.thread_id, 'created_at', m.created_at
    ) into v_ctx from public.direct_messages m where m.id = p_content_id;
  elsif v_ctype = 'room_chat' and p_content_id is not null then
    select coalesce(v_ctx, '{}'::jsonb) || jsonb_build_object(
      'body', m.body, 'user_id', m.user_id, 'room_id', m.room_id, 'created_at', m.created_at
    ) into v_ctx from public.room_chat_messages m where m.id = p_content_id;
  elsif v_ctype = 'live_chat' and p_content_id is not null then
    select coalesce(v_ctx, '{}'::jsonb) || jsonb_build_object(
      'body', m.body, 'user_id', m.user_id, 'session_id', m.session_id, 'created_at', m.created_at
    ) into v_ctx from public.live_chat_messages m where m.id = p_content_id;
  elsif v_ctype = 'status_post' and p_content_id is not null then
    select coalesce(v_ctx, '{}'::jsonb) || jsonb_build_object(
      'media_type', s.media_type, 'media_url', s.media_url, 'caption', s.caption,
      'user_id', s.user_id, 'created_at', s.created_at
    ) into v_ctx from public.status_posts s where s.id = p_content_id;
  elsif v_ctype = 'status_comment' and p_content_id is not null then
    select coalesce(v_ctx, '{}'::jsonb) || jsonb_build_object(
      'body', c.body, 'user_id', c.user_id, 'status_id', c.status_id, 'created_at', c.created_at
    ) into v_ctx from public.status_comments c where c.id = p_content_id;
  end if;

  insert into public.user_reports (
    reporter_id, target_user_id, room_id, reason, details,
    content_type, content_id, context
  )
  values (
    v_uid, p_target_user_id, p_room_id, trim(p_reason),
    nullif(trim(coalesce(p_details, '')), ''),
    v_ctype, p_content_id, coalesce(v_ctx, '{}'::jsonb)
  )
  returning * into v_row;

  perform public.guvenlik_olayi_kaydet(
    'user_report',
    p_target_user_id,
    jsonb_build_object(
      'report_id', v_row.id,
      'reason', p_reason,
      'content_type', v_ctype,
      'content_id', p_content_id,
      'severity',
        case when lower(trim(p_reason)) in ('child_safety', 'sexual', 'violence')
          then 'critical' else 'medium' end
    )
  );

  return v_row;
end;
$$;

grant execute on function public.kullanici_bildir(text, uuid, uuid, text, text, uuid, jsonb)
  to authenticated;
