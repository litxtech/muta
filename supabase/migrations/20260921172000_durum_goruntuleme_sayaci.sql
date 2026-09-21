-- Durum görüntülenme: her hesap en fazla 1 kez sayılır

alter table public.status_posts
  add column if not exists view_count integer not null default 0;

create table if not exists public.status_post_views (
  status_id uuid not null
    references public.status_posts (id) on delete cascade,
  viewer_id uuid not null
    references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (status_id, viewer_id)
);

create index if not exists status_post_views_viewer_idx
  on public.status_post_views (viewer_id, created_at desc);

alter table public.status_post_views enable row level security;

drop policy if exists "status_post_views_select_own" on public.status_post_views;
create policy "status_post_views_select_own"
  on public.status_post_views for select to authenticated
  using (viewer_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Görüntülenme kaydı (idempotent, unique per account)
-- ---------------------------------------------------------------------------
create or replace function public.durum_goruntuleme_kaydet(p_status_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_deleted timestamptz;
  v_count int;
  v_yeni boolean := false;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_status_id is null then raise exception 'Durum gerekli'; end if;

  select user_id, deleted_at into v_owner, v_deleted
  from public.status_posts
  where id = p_status_id;

  if v_owner is null or v_deleted is not null then
    raise exception 'Durum yok';
  end if;

  -- Kendi gönderisini sayma
  if v_owner = v_uid then
    select view_count into v_count
    from public.status_posts where id = p_status_id;
    return jsonb_build_object(
      'ok', true,
      'counted', false,
      'view_count', coalesce(v_count, 0)
    );
  end if;

  if not public.takip_icerik_gorunur_mu(v_uid, v_owner) then
    raise exception 'Durum yok';
  end if;

  if public.kullanicilar_engelli_mi(v_uid, v_owner) then
    raise exception 'Durum yok';
  end if;

  insert into public.status_post_views (status_id, viewer_id)
  values (p_status_id, v_uid)
  on conflict (status_id, viewer_id) do nothing;

  if found then
    v_yeni := true;
    update public.status_posts
    set view_count = view_count + 1, updated_at = now()
    where id = p_status_id
    returning view_count into v_count;
  else
    select view_count into v_count
    from public.status_posts where id = p_status_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'counted', v_yeni,
    'view_count', coalesce(v_count, 0)
  );
end;
$$;

grant execute on function public.durum_goruntuleme_kaydet(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Feed / detay: view_count alanını ekle
-- ---------------------------------------------------------------------------
create or replace function public.durum_detay(p_status_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
  v_owner uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select s.user_id into v_owner
  from public.status_posts s
  where s.id = p_status_id and s.deleted_at is null;
  if v_owner is null then raise exception 'Durum yok'; end if;
  if not public.takip_icerik_gorunur_mu(v_uid, v_owner) then
    raise exception 'Durum yok';
  end if;

  select jsonb_build_object(
    'id', s.id,
    'user_id', s.user_id,
    'media_type', s.media_type,
    'media_url', s.media_url,
    'caption', s.caption,
    'like_count', s.like_count,
    'comment_count', s.comment_count,
    'gift_count', coalesce(s.gift_count, 0),
    'view_count', coalesce(s.view_count, 0),
    'share_count', coalesce(s.share_count, 0),
    'post_kind', coalesce(s.post_kind, 'media'),
    'payload', coalesce(s.payload, '{}'::jsonb),
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

create or replace function public.durum_akisi(
  p_limit integer default 40,
  p_before timestamptz default null
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
        coalesce(s.gift_count, 0) as gift_count,
        coalesce(s.view_count, 0) as view_count,
        coalesce(s.share_count, 0) as share_count,
        coalesce(s.post_kind, 'media') as post_kind,
        coalesce(s.payload, '{}'::jsonb) as payload,
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
        and public.takip_icerik_gorunur_mu(v_uid, s.user_id)
        and (p_before is null or s.created_at < p_before)
      order by s.created_at desc
      limit least(greatest(coalesce(p_limit, 40), 1), 80)
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.durum_akisi(integer, timestamptz) to authenticated;

create or replace function public.durum_akisi_takip(
  p_limit integer default 40,
  p_before timestamptz default null
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
        coalesce(s.gift_count, 0) as gift_count,
        coalesce(s.view_count, 0) as view_count,
        coalesce(s.share_count, 0) as share_count,
        coalesce(s.post_kind, 'media') as post_kind,
        coalesce(s.payload, '{}'::jsonb) as payload,
        s.created_at,
        coalesce(p.display_name, p.username, 'Kullanıcı') as display_name,
        p.username,
        p.avatar_url,
        p.public_user_id,
        exists(
          select 1 from public.status_likes l
          where l.status_id = s.id and l.user_id = v_uid
        ) as liked_by_me,
        false as is_mine
      from public.follows f
      join public.status_posts s
        on s.user_id = f.following_id
       and s.deleted_at is null
       and (p_before is null or s.created_at < p_before)
      join public.profiles p on p.id = s.user_id
      where f.follower_id = v_uid
        and p.deleted_at is null
        and p.banned_at is null
        and not public.kullanicilar_engelli_mi(v_uid, s.user_id)
      order by s.created_at desc
      limit least(greatest(coalesce(p_limit, 40), 1), 80)
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.durum_akisi_takip(integer, timestamptz) to authenticated;

create or replace function public.durum_kullanicisi(
  p_user_id uuid,
  p_limit integer default 40,
  p_before timestamptz default null
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
  if p_user_id is null then raise exception 'Kullanıcı gerekli'; end if;
  if public.kullanicilar_engelli_mi(v_uid, p_user_id) then
    return '[]'::jsonb;
  end if;
  if not public.takip_icerik_gorunur_mu(v_uid, p_user_id) then
    return '[]'::jsonb;
  end if;

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
        coalesce(s.gift_count, 0) as gift_count,
        coalesce(s.view_count, 0) as view_count,
        coalesce(s.share_count, 0) as share_count,
        coalesce(s.post_kind, 'media') as post_kind,
        coalesce(s.payload, '{}'::jsonb) as payload,
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
      where s.user_id = p_user_id
        and s.deleted_at is null
        and p.deleted_at is null
        and p.banned_at is null
        and (p_before is null or s.created_at < p_before)
      order by s.created_at desc
      limit least(greatest(coalesce(p_limit, 40), 1), 80)
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.durum_kullanicisi(uuid, integer, timestamptz) to authenticated;
