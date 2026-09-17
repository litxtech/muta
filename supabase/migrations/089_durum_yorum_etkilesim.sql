-- Durum yorumlari: begeni, yanit (parent), resim

alter table public.status_comments
  add column if not exists parent_id uuid references public.status_comments(id) on delete cascade,
  add column if not exists media_url text,
  add column if not exists like_count int not null default 0;

create index if not exists status_comments_parent_idx
  on public.status_comments (parent_id, created_at asc)
  where deleted_at is null and parent_id is not null;

create table if not exists public.status_comment_likes (
  comment_id uuid not null references public.status_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists status_comment_likes_user_idx
  on public.status_comment_likes (user_id, created_at desc);

alter table public.status_comment_likes enable row level security;

drop policy if exists "Status comment likes read" on public.status_comment_likes;
create policy "Status comment likes read"
  on public.status_comment_likes for select to authenticated using (true);

grant select on public.status_comment_likes to authenticated;

-- Yorum ekle (metin ve/veya resim, istege bagli yanit)
drop function if exists public.durum_yorum_ekle(uuid, text);
create or replace function public.durum_yorum_ekle(
  p_status_id uuid,
  p_body text default null,
  p_parent_id uuid default null,
  p_media_url text default null
)
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
  v_media text := nullif(trim(coalesce(p_media_url, '')), '');
  v_parent public.status_comments%rowtype;
  v_parent_id uuid := p_parent_id;
  v_notify uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir yorum yapamaz'; end if;
  if length(v_body) < 1 and v_media is null then
    raise exception 'Yorum bos olamaz';
  end if;
  if v_media is not null and length(v_media) < 8 then
    raise exception 'Gecersiz medya';
  end if;
  if v_media is not null then
    v_media := left(v_media, 2000);
  end if;

  select user_id into v_owner
  from public.status_posts
  where id = p_status_id and deleted_at is null;
  if v_owner is null then raise exception 'Durum yok'; end if;

  if v_parent_id is not null then
    select * into v_parent
    from public.status_comments
    where id = v_parent_id and status_id = p_status_id and deleted_at is null;
    if v_parent.id is null then raise exception 'Yanitlanacak yorum yok'; end if;
    -- Tek seviye yanit: ust yanitin parent'ina bagla
    if v_parent.parent_id is not null then
      v_parent_id := v_parent.parent_id;
      select * into v_parent
      from public.status_comments
      where id = v_parent_id;
    end if;
  end if;

  insert into public.status_comments (status_id, user_id, body, parent_id, media_url)
  values (p_status_id, v_uid, v_body, v_parent_id, v_media)
  returning id into v_id;

  update public.status_posts
  set
    comment_count = (
      select count(*)::int from public.status_comments c
      where c.status_id = p_status_id and c.deleted_at is null
    ),
    updated_at = now()
  where id = p_status_id;

  v_notify := case
    when v_parent_id is not null and v_parent.user_id <> v_uid then v_parent.user_id
    when v_owner <> v_uid then v_owner
    else null
  end;

  if v_notify is not null then
    perform public.bildirim_kuyruga_ekle(
      v_notify,
      'social',
      case when v_parent_id is not null then 'Yorumuna yanıt' else 'Durumuna yorum' end,
      coalesce(
        (select display_name from public.profiles where id = v_uid),
        'Birisi'
      ) || case
        when length(v_body) > 0 then ': ' || left(v_body, 80)
        when v_media is not null then ' bir fotoğraf gönderdi'
        else ''
      end,
      '/durum/' || p_status_id::text,
      jsonb_build_object(
        'type', 'status_comment',
        'status_id', p_status_id,
        'comment_id', v_id,
        'parent_id', v_parent_id,
        'actor_id', v_uid
      )
    );
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.durum_yorum_ekle(uuid, text, uuid, text) to authenticated;

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
        c.parent_id,
        c.media_url,
        c.like_count,
        c.created_at,
        coalesce(p.display_name, p.username, 'Kullanıcı') as display_name,
        p.username,
        p.avatar_url,
        p.public_user_id,
        (c.user_id = v_uid) as is_mine,
        exists (
          select 1 from public.status_comment_likes l
          where l.comment_id = c.id and l.user_id = v_uid
        ) as liked_by_me
      from public.status_comments c
      join public.profiles p on p.id = c.user_id
      where c.status_id = p_status_id and c.deleted_at is null
      order by c.created_at asc
      limit least(greatest(coalesce(p_limit, 60), 1), 200)
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.durum_yorumlari(uuid, int) to authenticated;

-- Yorum begeni toggle
create or replace function public.durum_yorum_begeni_toggle(p_comment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_c public.status_comments%rowtype;
  v_liked boolean;
  v_count int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir begeni yapamaz'; end if;

  select * into v_c
  from public.status_comments
  where id = p_comment_id and deleted_at is null;
  if v_c.id is null then raise exception 'Yorum yok'; end if;

  if exists (
    select 1 from public.status_comment_likes
    where comment_id = p_comment_id and user_id = v_uid
  ) then
    delete from public.status_comment_likes
    where comment_id = p_comment_id and user_id = v_uid;
    v_liked := false;
  else
    insert into public.status_comment_likes (comment_id, user_id)
    values (p_comment_id, v_uid);
    v_liked := true;
  end if;

  select count(*)::int into v_count
  from public.status_comment_likes
  where comment_id = p_comment_id;

  update public.status_comments
  set like_count = v_count
  where id = p_comment_id;

  return jsonb_build_object('ok', true, 'liked', v_liked, 'like_count', v_count);
end;
$$;

grant execute on function public.durum_yorum_begeni_toggle(uuid) to authenticated;
