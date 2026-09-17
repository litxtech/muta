-- Oyun kazancı durum kartı: post_kind + payload, doğrulanmış round paylaşımı

alter table public.status_posts
  add column if not exists post_kind text not null default 'media';

alter table public.status_posts
  add column if not exists payload jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'status_posts_post_kind_check'
  ) then
    alter table public.status_posts
      add constraint status_posts_post_kind_check
      check (post_kind in ('media', 'game_win'));
  end if;
end $$;

alter table public.status_posts
  drop constraint if exists status_posts_media_type_check;

alter table public.status_posts
  add constraint status_posts_media_type_check
  check (media_type in ('image', 'video', 'card'));

create unique index if not exists status_posts_game_round_uidx
  on public.status_posts ((payload->>'round_id'))
  where post_kind = 'game_win'
    and deleted_at is null
    and coalesce(payload->>'round_id', '') <> '';

-- ---------------------------------------------------------------------------
-- Oyun kazancını durum olarak paylaş (round sahipliği doğrulanır)
-- ---------------------------------------------------------------------------
create or replace function public.durum_oyun_kazanci_olustur(
  p_game_code text,
  p_round_id uuid,
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
  v_existing uuid;
  v_round public.kaskad_rounds%rowtype;
  v_code text := lower(trim(coalesce(p_game_code, '')));
  v_tier text;
  v_payload jsonb;
  v_caption text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir durum paylasamaz'; end if;

  if v_code <> 'kozmik_kaskad' then
    raise exception 'Desteklenmeyen oyun';
  end if;
  if p_round_id is null then raise exception 'Tur gerekli'; end if;

  select * into v_round
  from public.kaskad_rounds
  where id = p_round_id and user_id = v_uid;

  if not found then raise exception 'Tur bulunamadi'; end if;
  if coalesce(v_round.win_amount, 0) <= 0 then
    raise exception 'Paylasilacak kazanc yok';
  end if;

  select s.id into v_existing
  from public.status_posts s
  where s.user_id = v_uid
    and s.post_kind = 'game_win'
    and s.deleted_at is null
    and s.payload->>'round_id' = p_round_id::text
  limit 1;

  if v_existing is not null then
    return jsonb_build_object('ok', true, 'id', v_existing, 'already', true);
  end if;

  v_tier := upper(coalesce(nullif(trim(v_round.result_snapshot->>'winTier'), ''), 'STORM'));
  if v_tier not in ('STORM', 'THUNDER', 'COSMIC', 'DIVINE') then
    v_tier := 'STORM';
  end if;

  v_payload := jsonb_build_object(
    'game_code', 'kozmik_kaskad',
    'game_title', 'Realm of Storms',
    'round_id', v_round.id,
    'total_win', floor(v_round.win_amount)::bigint,
    'base_win', floor(coalesce((v_round.result_snapshot->>'baseWin')::numeric, v_round.win_amount))::bigint,
    'bet_amount', v_round.bet_amount,
    'total_multiplier', coalesce(v_round.total_multiplier, 1),
    'win_tier', v_tier
  );

  v_caption := nullif(left(trim(coalesce(p_caption, '')), 500), '');

  insert into public.status_posts (
    user_id, media_type, media_url, caption, post_kind, payload
  )
  values (
    v_uid,
    'card',
    'card://game_win',
    v_caption,
    'game_win',
    v_payload
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'already', false);
end;
$$;

grant execute on function public.durum_oyun_kazanci_olustur(text, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Feed / detay / profil: post_kind + payload
-- ---------------------------------------------------------------------------
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
        coalesce(s.gift_count, 0) as gift_count,
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
        and not public.kullanicilar_engelli_mi(v_uid, s.user_id)
        and (p_before is null or s.created_at < p_before)
      order by s.created_at desc
      limit least(greatest(coalesce(p_limit, 40), 1), 80)
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.durum_akisi(int, timestamptz) to authenticated;

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
    'gift_count', coalesce(s.gift_count, 0),
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

create or replace function public.durum_kullanicisi(
  p_user_id uuid,
  p_limit int default 40,
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

grant execute on function public.durum_kullanicisi(uuid, int, timestamptz) to authenticated;
