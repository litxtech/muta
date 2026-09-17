-- FAZ: Gelismis takip / takipci / sosyal graph
-- Mevcut public.follows + user_profile_stats korunur; eksik parcalar eklenir.

-- ---------------------------------------------------------------------------
-- 1. Config (rate limit hard-code degil)
-- ---------------------------------------------------------------------------
create table if not exists public.follow_system_config (
  key text primary key,
  value_int bigint,
  value_text text,
  updated_at timestamptz not null default now()
);

alter table public.follow_system_config enable row level security;

drop policy if exists "Follow config readable" on public.follow_system_config;
create policy "Follow config readable"
  on public.follow_system_config for select to authenticated
  using (true);

grant select on public.follow_system_config to authenticated;

insert into public.follow_system_config (key, value_int) values
  ('follow_per_minute', 20),
  ('follow_per_hour', 180),
  ('unfollow_per_minute', 30),
  ('request_per_minute', 15),
  ('same_target_cooldown_seconds', 8),
  ('notification_repeat_hours', 24),
  ('request_repeat_cooldown_seconds', 3600),
  ('suggestion_limit', 20),
  ('list_page_size', 24)
on conflict (key) do nothing;

create or replace function public.follow_config_int(p_key text, p_default bigint)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select value_int from public.follow_system_config where key = p_key),
    p_default
  );
$$;

revoke all on function public.follow_config_int(text, bigint) from public, anon;
grant execute on function public.follow_config_int(text, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Privacy + denormalized counters
-- ---------------------------------------------------------------------------
alter table public.user_privacy_settings
  add column if not exists is_private boolean not null default false;

alter table public.user_profile_stats
  add column if not exists pending_follow_requests_count bigint not null default 0
    check (pending_follow_requests_count >= 0);

alter table public.user_profile_stats
  add column if not exists posts_count bigint not null default 0
    check (posts_count >= 0);

update public.user_profile_stats s
set posts_count = coalesce((
  select count(*)::bigint
  from public.status_posts p
  where p.user_id = s.user_id and p.deleted_at is null
), 0)
where coalesce(s.posts_count, 0) = 0;

-- ---------------------------------------------------------------------------
-- 3. Extra follows indexes (buyuk listeler / keyset)
-- ---------------------------------------------------------------------------
create index if not exists follows_follower_created_idx
  on public.follows (follower_id, created_at desc, following_id);
create index if not exists follows_following_created_idx
  on public.follows (following_id, created_at desc, follower_id);

-- ---------------------------------------------------------------------------
-- 4. Follow requests
-- ---------------------------------------------------------------------------
create table if not exists public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> target_id)
);

create unique index if not exists follow_requests_pending_uidx
  on public.follow_requests (requester_id, target_id)
  where status = 'pending';

create index if not exists follow_requests_target_pending_idx
  on public.follow_requests (target_id, created_at desc)
  where status = 'pending';

create index if not exists follow_requests_requester_idx
  on public.follow_requests (requester_id, created_at desc);

alter table public.follow_requests enable row level security;
alter table public.follow_requests replica identity full;

drop policy if exists "Follow requests own read" on public.follow_requests;
create policy "Follow requests own read"
  on public.follow_requests for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = target_id);

grant select on public.follow_requests to authenticated;

create or replace function public.takip_istek_sayacini_guncelle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      insert into public.user_profile_stats (user_id) values (new.target_id)
      on conflict (user_id) do nothing;
      update public.user_profile_stats
        set pending_follow_requests_count = pending_follow_requests_count + 1,
            updated_at = now()
        where user_id = new.target_id;
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.status = 'pending' and new.status is distinct from 'pending' then
      update public.user_profile_stats
        set pending_follow_requests_count = greatest(pending_follow_requests_count - 1, 0),
            updated_at = now()
        where user_id = old.target_id;
    elsif old.status is distinct from 'pending' and new.status = 'pending' then
      update public.user_profile_stats
        set pending_follow_requests_count = pending_follow_requests_count + 1,
            updated_at = now()
        where user_id = new.target_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.status = 'pending' then
      update public.user_profile_stats
        set pending_follow_requests_count = greatest(pending_follow_requests_count - 1, 0),
            updated_at = now()
        where user_id = old.target_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists follow_requests_stats_trg on public.follow_requests;
create trigger follow_requests_stats_trg
  after insert or update or delete on public.follow_requests
  for each row execute function public.takip_istek_sayacini_guncelle();

-- ---------------------------------------------------------------------------
-- 5. Audit log (ana follow sorgularinda kullanilmaz)
-- ---------------------------------------------------------------------------
create table if not exists public.follow_action_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_id uuid references public.profiles(id) on delete set null,
  action text not null
    check (action in (
      'follow', 'unfollow', 'request', 'accept', 'reject',
      'cancel', 'remove_follower', 'rate_limited', 'blocked_attempt'
    )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists follow_action_logs_actor_idx
  on public.follow_action_logs (actor_id, created_at desc);
create index if not exists follow_action_logs_actor_action_idx
  on public.follow_action_logs (actor_id, action, created_at desc);
create index if not exists follow_action_logs_pair_idx
  on public.follow_action_logs (actor_id, target_id, action, created_at desc);

alter table public.follow_action_logs enable row level security;
-- authenticated: dogrudan erisim yok (admin RPC)

-- ---------------------------------------------------------------------------
-- 6. Posts count trigger
-- ---------------------------------------------------------------------------
create or replace function public.durum_gonderi_sayacini_guncelle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is null then
      insert into public.user_profile_stats (user_id) values (new.user_id)
      on conflict (user_id) do nothing;
      update public.user_profile_stats
        set posts_count = posts_count + 1, updated_at = now()
        where user_id = new.user_id;
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      update public.user_profile_stats
        set posts_count = greatest(posts_count - 1, 0), updated_at = now()
        where user_id = new.user_id;
    elsif old.deleted_at is not null and new.deleted_at is null then
      update public.user_profile_stats
        set posts_count = posts_count + 1, updated_at = now()
        where user_id = new.user_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.deleted_at is null then
      update public.user_profile_stats
        set posts_count = greatest(posts_count - 1, 0), updated_at = now()
        where user_id = old.user_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists status_posts_count_trg on public.status_posts;
create trigger status_posts_count_trg
  after insert or update or delete on public.status_posts
  for each row execute function public.durum_gonderi_sayacini_guncelle();

-- ---------------------------------------------------------------------------
-- 7. Helpers
-- ---------------------------------------------------------------------------
create or replace function public.takip_aksiyon_logla(
  p_actor uuid,
  p_target uuid,
  p_action text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.follow_action_logs (actor_id, target_id, action, metadata)
  values (p_actor, p_target, p_action, coalesce(p_metadata, '{}'::jsonb));
exception when others then
  null;
end;
$$;

create or replace function public.gizli_hesap_mi(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_private from public.user_privacy_settings where user_id = p_user_id),
    false
  );
$$;

grant execute on function public.gizli_hesap_mi(uuid) to authenticated;

create or replace function public.takip_ediyor_mu(p_follower uuid, p_following uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.follows
    where follower_id = p_follower and following_id = p_following
  );
$$;

grant execute on function public.takip_ediyor_mu(uuid, uuid) to authenticated;

create or replace function public.takip_icerik_gorunur_mu(p_viewer uuid, p_owner uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_owner is null then return false; end if;
  if p_viewer is not null and p_viewer = p_owner then return true; end if;
  if p_viewer is not null and public.kullanicilar_engelli_mi(p_viewer, p_owner) then
    return false;
  end if;
  if not public.gizli_hesap_mi(p_owner) then return true; end if;
  if p_viewer is null then return false; end if;
  return public.takip_ediyor_mu(p_viewer, p_owner);
end;
$$;

grant execute on function public.takip_icerik_gorunur_mu(uuid, uuid) to authenticated;

create or replace function public.takip_profil_aktif_mi(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id
      and deleted_at is null
      and banned_at is null
  );
$$;

create or replace function public.takip_iliski_durumu(p_viewer uuid, p_target uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_i_follow boolean := false;
  v_they_follow boolean := false;
  v_pending boolean := false;
  v_incoming boolean := false;
  v_i_block boolean := false;
  v_they_block boolean := false;
begin
  if p_viewer is null or p_target is null then
    return 'NOT_FOLLOWING';
  end if;
  if p_viewer = p_target then
    return 'SELF';
  end if;

  select exists (
    select 1 from public.user_blocks
    where blocker_id = p_viewer and blocked_id = p_target
  ) into v_i_block;
  if v_i_block then return 'BLOCKED'; end if;

  select exists (
    select 1 from public.user_blocks
    where blocker_id = p_target and blocked_id = p_viewer
  ) into v_they_block;
  if v_they_block then return 'BLOCKED_BY_USER'; end if;

  v_i_follow := public.takip_ediyor_mu(p_viewer, p_target);
  v_they_follow := public.takip_ediyor_mu(p_target, p_viewer);

  select exists (
    select 1 from public.follow_requests
    where requester_id = p_viewer and target_id = p_target and status = 'pending'
  ) into v_pending;

  select exists (
    select 1 from public.follow_requests
    where requester_id = p_target and target_id = p_viewer and status = 'pending'
  ) into v_incoming;

  if v_i_follow and v_they_follow then return 'MUTUAL'; end if;
  if v_i_follow then return 'FOLLOWING'; end if;
  if v_pending then return 'REQUEST_PENDING'; end if;
  if v_incoming then return 'INCOMING_REQUEST'; end if;
  if v_they_follow then return 'FOLLOWS_YOU'; end if;
  return 'NOT_FOLLOWING';
end;
$$;

grant execute on function public.takip_iliski_durumu(uuid, uuid) to authenticated;

create or replace function public.takip_rate_limit_ok(
  p_actor uuid,
  p_action text,
  p_target uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_per_min bigint;
  v_per_hour bigint;
  v_cooldown bigint;
  v_cnt bigint;
begin
  if p_action in ('follow', 'request') then
    v_per_min := public.follow_config_int('follow_per_minute', 20);
    v_per_hour := public.follow_config_int('follow_per_hour', 180);
    select count(*) into v_cnt
    from public.follow_action_logs
    where actor_id = p_actor
      and action in ('follow', 'request')
      and created_at > now() - interval '1 minute';
    if v_cnt >= v_per_min then return false; end if;
    select count(*) into v_cnt
    from public.follow_action_logs
    where actor_id = p_actor
      and action in ('follow', 'request')
      and created_at > now() - interval '1 hour';
    if v_cnt >= v_per_hour then return false; end if;
  elsif p_action = 'unfollow' then
    v_per_min := public.follow_config_int('unfollow_per_minute', 30);
    select count(*) into v_cnt
    from public.follow_action_logs
    where actor_id = p_actor
      and action = 'unfollow'
      and created_at > now() - interval '1 minute';
    if v_cnt >= v_per_min then return false; end if;
  end if;

  v_cooldown := public.follow_config_int('same_target_cooldown_seconds', 8);
  if p_target is not null and v_cooldown > 0 then
    select count(*) into v_cnt
    from public.follow_action_logs
    where actor_id = p_actor
      and target_id = p_target
      and action in ('follow', 'unfollow', 'request', 'cancel')
      and created_at > now() - make_interval(secs => v_cooldown);
    if v_cnt > 0 then return false; end if;
  end if;

  return true;
end;
$$;

create or replace function public.takip_bildirim_gonder_mi(
  p_actor uuid,
  p_target uuid,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hours bigint;
begin
  v_hours := public.follow_config_int('notification_repeat_hours', 24);
  if v_hours <= 0 then return true; end if;
  return not exists (
    select 1 from public.follow_action_logs
    where actor_id = p_actor
      and target_id = p_target
      and action = p_action
      and coalesce(metadata->>'notified', 'false') = 'true'
      and created_at > now() - make_interval(hours => v_hours::int)
  );
end;
$$;

create or replace function public.takip_sayaclari_json(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'followers_count', coalesce(followers_count, 0),
    'following_count', coalesce(following_count, 0),
    'posts_count', coalesce(posts_count, 0),
    'pending_follow_requests_count', coalesce(pending_follow_requests_count, 0)
  )
  from public.user_profile_stats
  where user_id = p_user_id;
$$;

create or replace function public.takip_kart_json(
  p_viewer uuid,
  p_user_id uuid,
  p_followed_at timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_p public.profiles%rowtype;
  v_i_follow boolean;
  v_they_follow boolean;
  v_state text;
begin
  select * into v_p from public.profiles where id = p_user_id;
  if not found then return null; end if;

  v_i_follow := case
    when p_viewer is null or p_viewer = p_user_id then false
    else public.takip_ediyor_mu(p_viewer, p_user_id)
  end;
  v_they_follow := case
    when p_viewer is null or p_viewer = p_user_id then false
    else public.takip_ediyor_mu(p_user_id, p_viewer)
  end;
  v_state := public.takip_iliski_durumu(p_viewer, p_user_id);

  return jsonb_build_object(
    'user_id', v_p.id,
    'display_name', coalesce(v_p.display_name, v_p.username, 'Kullanici'),
    'username', v_p.username,
    'avatar_url', v_p.avatar_url,
    'is_verified', coalesce(v_p.is_verified, false),
    'level', coalesce(v_p.level, 1),
    'is_private', public.gizli_hesap_mi(v_p.id),
    'followed_at', p_followed_at,
    'i_follow', v_i_follow,
    'they_follow_me', v_they_follow,
    'is_mutual', (v_i_follow and v_they_follow),
    'follows_you', (v_they_follow and not v_i_follow),
    'state', v_state
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Private content: status posts RLS + feed RPCs
-- ---------------------------------------------------------------------------
drop policy if exists "Status posts read" on public.status_posts;
create policy "Status posts read"
  on public.status_posts for select to authenticated
  using (
    (deleted_at is null or user_id = auth.uid())
    and public.takip_icerik_gorunur_mu(auth.uid(), user_id)
  );

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
        and public.takip_icerik_gorunur_mu(v_uid, s.user_id)
        and (p_before is null or s.created_at < p_before)
      order by s.created_at desc
      limit least(greatest(coalesce(p_limit, 40), 1), 80)
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.durum_akisi(int, timestamptz) to authenticated;

create or replace function public.durum_akisi_takip(
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
  -- Join follows; IN(...) listesi yok.
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

grant execute on function public.durum_akisi_takip(int, timestamptz) to authenticated;

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

-- ---------------------------------------------------------------------------
-- 9. Tightened follows SELECT
-- ---------------------------------------------------------------------------
drop policy if exists "Follows readable" on public.follows;
create policy "Follows readable"
  on public.follows for select to authenticated
  using (
    follower_id = auth.uid()
    or following_id = auth.uid()
    or public.ben_admin_miyim()
    or (
      not public.gizli_hesap_mi(follower_id)
      and not public.gizli_hesap_mi(following_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 10. Core mutations
-- ---------------------------------------------------------------------------
drop function if exists public.takip_et(uuid);
create function public.takip_et(p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_name text;
  v_private boolean;
  v_request_id uuid;
  v_state text;
  v_notified boolean := false;
  v_inserted_n int := 0;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;
  if p_target_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_uid = p_target_id then
    return jsonb_build_object('ok', false, 'code', 'self', 'state', 'SELF');
  end if;

  select is_guest, coalesce(display_name, username, 'Birisi')
    into v_guest, v_name
  from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then
    return jsonb_build_object('ok', false, 'code', 'guest');
  end if;

  if not public.takip_profil_aktif_mi(p_target_id) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if public.kullanicilar_engelli_mi(v_uid, p_target_id) then
    perform public.takip_aksiyon_logla(v_uid, p_target_id, 'blocked_attempt', '{}'::jsonb);
    return jsonb_build_object('ok', false, 'code', 'blocked', 'state', public.takip_iliski_durumu(v_uid, p_target_id));
  end if;

  if public.takip_ediyor_mu(v_uid, p_target_id) then
    return jsonb_build_object(
      'ok', true,
      'code', 'already_following',
      'state', public.takip_iliski_durumu(v_uid, p_target_id)
    ) || coalesce(public.takip_sayaclari_json(p_target_id), '{}'::jsonb);
  end if;

  if exists (
    select 1 from public.follow_requests
    where requester_id = v_uid and target_id = p_target_id and status = 'pending'
  ) then
    select id into v_request_id
    from public.follow_requests
    where requester_id = v_uid and target_id = p_target_id and status = 'pending'
    limit 1;
    return jsonb_build_object(
      'ok', true,
      'code', 'already_requested',
      'state', 'REQUEST_PENDING',
      'request_id', v_request_id
    ) || coalesce(public.takip_sayaclari_json(p_target_id), '{}'::jsonb);
  end if;

  if not public.takip_rate_limit_ok(v_uid, 'follow', p_target_id) then
    perform public.takip_aksiyon_logla(v_uid, p_target_id, 'rate_limited', jsonb_build_object('op', 'follow'));
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  v_private := public.gizli_hesap_mi(p_target_id);

  if v_private then
    insert into public.follow_requests (requester_id, target_id, status)
    values (v_uid, p_target_id, 'pending')
    on conflict (requester_id, target_id) where status = 'pending' do nothing
    returning id into v_request_id;

    if v_request_id is null then
      select id into v_request_id
      from public.follow_requests
      where requester_id = v_uid and target_id = p_target_id and status = 'pending'
      limit 1;
    end if;

    v_notified := public.takip_bildirim_gonder_mi(v_uid, p_target_id, 'request');
    if v_notified then
      begin
        perform public.bildirim_kuyruga_ekle(
          p_target_id,
          'social',
          'Takip isteği',
          v_name || ' sana takip isteği gönderdi.',
          '/takip/istekler',
          jsonb_build_object(
            'actor_id', v_uid,
            'follower_id', v_uid,
            'type', 'follow_request',
            'request_id', v_request_id
          )
        );
      exception when others then
        null;
      end;
    end if;

    perform public.takip_aksiyon_logla(
      v_uid, p_target_id, 'request',
      jsonb_build_object('request_id', v_request_id, 'notified', v_notified)
    );

    return jsonb_build_object(
      'ok', true,
      'code', 'requested',
      'state', 'REQUEST_PENDING',
      'request_id', v_request_id
    ) || coalesce(public.takip_sayaclari_json(p_target_id), '{}'::jsonb);
  end if;

  insert into public.follows (follower_id, following_id)
  values (v_uid, p_target_id)
  on conflict do nothing;
  get diagnostics v_inserted_n = row_count;

  -- Karsi tarafin bize attigi pending istegi otomatik kapat
  update public.follow_requests
    set status = 'accepted', responded_at = now()
    where requester_id = p_target_id and target_id = v_uid and status = 'pending';

  v_state := public.takip_iliski_durumu(v_uid, p_target_id);
  v_notified := (v_inserted_n > 0) and public.takip_bildirim_gonder_mi(v_uid, p_target_id, 'follow');
  if v_notified then
    begin
      perform public.bildirim_kuyruga_ekle(
        p_target_id,
        'social',
        'Yeni takipçi',
        v_name || ' seni takip etmeye başladı.',
        '/kullanici/' || v_uid::text,
        jsonb_build_object(
          'actor_id', v_uid,
          'follower_id', v_uid,
          'type', 'new_follower'
        )
      );
    exception when others then
      null;
    end;
  end if;

  perform public.takip_aksiyon_logla(
    v_uid, p_target_id, 'follow',
    jsonb_build_object('notified', v_notified, 'inserted', v_inserted_n > 0)
  );

  return jsonb_build_object(
    'ok', true,
    'code', case when v_inserted_n > 0 then 'followed' else 'already_following' end,
    'state', v_state
  ) || coalesce(public.takip_sayaclari_json(p_target_id), '{}'::jsonb);
end;
$$;

grant execute on function public.takip_et(uuid) to authenticated;

drop function if exists public.takibi_birak(uuid);
create function public.takibi_birak(p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_deleted int := 0;
  v_cancelled int := 0;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;
  if p_target_id is null or v_uid = p_target_id then
    return jsonb_build_object('ok', true, 'code', 'noop', 'state', 'SELF');
  end if;

  if not public.takip_rate_limit_ok(v_uid, 'unfollow', p_target_id) then
    perform public.takip_aksiyon_logla(v_uid, p_target_id, 'rate_limited', jsonb_build_object('op', 'unfollow'));
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  delete from public.follows
  where follower_id = v_uid and following_id = p_target_id;
  get diagnostics v_deleted = row_count;

  update public.follow_requests
    set status = 'cancelled', responded_at = now()
    where requester_id = v_uid and target_id = p_target_id and status = 'pending';
  get diagnostics v_cancelled = row_count;

  if v_deleted > 0 then
    perform public.takip_aksiyon_logla(v_uid, p_target_id, 'unfollow', '{}'::jsonb);
  elsif v_cancelled > 0 then
    perform public.takip_aksiyon_logla(v_uid, p_target_id, 'cancel', '{}'::jsonb);
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', case
      when v_deleted > 0 then 'unfollowed'
      when v_cancelled > 0 then 'cancelled'
      else 'noop'
    end,
    'state', public.takip_iliski_durumu(v_uid, p_target_id)
  ) || coalesce(public.takip_sayaclari_json(p_target_id), '{}'::jsonb);
end;
$$;

grant execute on function public.takibi_birak(uuid) to authenticated;

create or replace function public.takip_istegini_iptal_et(p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.takibi_birak(p_target_id);
end;
$$;

grant execute on function public.takip_istegini_iptal_et(uuid) to authenticated;

create or replace function public.takip_istegini_kabul_et(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.follow_requests%rowtype;
  v_name text;
  v_notified boolean := false;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  select * into v_req from public.follow_requests where id = p_request_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_req.target_id <> v_uid then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if v_req.status <> 'pending' then
    return jsonb_build_object('ok', true, 'code', 'noop', 'state', public.takip_iliski_durumu(v_uid, v_req.requester_id));
  end if;
  if public.kullanicilar_engelli_mi(v_uid, v_req.requester_id) then
    update public.follow_requests
      set status = 'cancelled', responded_at = now()
      where id = v_req.id and status = 'pending';
    return jsonb_build_object('ok', false, 'code', 'blocked');
  end if;
  if not public.takip_profil_aktif_mi(v_req.requester_id) then
    update public.follow_requests
      set status = 'cancelled', responded_at = now()
      where id = v_req.id and status = 'pending';
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  insert into public.follows (follower_id, following_id)
  values (v_req.requester_id, v_uid)
  on conflict do nothing;

  update public.follow_requests
    set status = 'accepted', responded_at = now()
    where id = v_req.id and status = 'pending';

  select coalesce(display_name, username, 'Birisi') into v_name
  from public.profiles where id = v_uid;

  v_notified := public.takip_bildirim_gonder_mi(v_uid, v_req.requester_id, 'accept');
  if v_notified then
    begin
      perform public.bildirim_kuyruga_ekle(
        v_req.requester_id,
        'social',
        'Takip isteği kabul edildi',
        v_name || ' takip isteğini kabul etti.',
        '/kullanici/' || v_uid::text,
        jsonb_build_object(
          'actor_id', v_uid,
          'type', 'follow_request_accepted',
          'request_id', v_req.id
        )
      );
    exception when others then
      null;
    end;
  end if;

  perform public.takip_aksiyon_logla(
    v_uid, v_req.requester_id, 'accept',
    jsonb_build_object('request_id', v_req.id, 'notified', v_notified)
  );

  return jsonb_build_object(
    'ok', true,
    'code', 'accepted',
    'state', public.takip_iliski_durumu(v_uid, v_req.requester_id)
  ) || coalesce(public.takip_sayaclari_json(v_uid), '{}'::jsonb);
end;
$$;

grant execute on function public.takip_istegini_kabul_et(uuid) to authenticated;

create or replace function public.takip_istegini_reddet(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.follow_requests%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;
  select * into v_req from public.follow_requests where id = p_request_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_req.target_id <> v_uid then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if v_req.status <> 'pending' then
    return jsonb_build_object('ok', true, 'code', 'noop');
  end if;

  update public.follow_requests
    set status = 'rejected', responded_at = now()
    where id = v_req.id and status = 'pending';

  perform public.takip_aksiyon_logla(
    v_uid, v_req.requester_id, 'reject',
    jsonb_build_object('request_id', v_req.id)
  );

  return jsonb_build_object('ok', true, 'code', 'rejected');
end;
$$;

grant execute on function public.takip_istegini_reddet(uuid) to authenticated;

create or replace function public.takipci_kaldir(p_follower_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_deleted int := 0;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;
  if p_follower_id is null or p_follower_id = v_uid then
    return jsonb_build_object('ok', false, 'code', 'self');
  end if;

  delete from public.follows
  where follower_id = p_follower_id and following_id = v_uid;
  get diagnostics v_deleted = row_count;

  -- Push YOK (urun karari)
  if v_deleted > 0 then
    perform public.takip_aksiyon_logla(v_uid, p_follower_id, 'remove_follower', '{}'::jsonb);
  end if;

  return jsonb_build_object(
    'ok', true,
    'code', case when v_deleted > 0 then 'removed' else 'noop' end,
    'state', public.takip_iliski_durumu(v_uid, p_follower_id)
  ) || coalesce(public.takip_sayaclari_json(v_uid), '{}'::jsonb);
end;
$$;

grant execute on function public.takipci_kaldir(uuid) to authenticated;

create or replace function public.gizli_hesap_ayarla(p_is_private boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_prev boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;

  insert into public.user_privacy_settings (user_id, is_private)
  values (v_uid, coalesce(p_is_private, false))
  on conflict (user_id) do update
    set is_private = excluded.is_private, updated_at = now()
  returning is_private into v_prev;

  -- Private -> public: pending istekler OTOMATIK KABUL EDILMEZ.
  -- Sahip istekler ekranindan tek tek kabul/red eder. Ongorulebilir.
  return jsonb_build_object(
    'ok', true,
    'is_private', coalesce(p_is_private, false)
  );
end;
$$;

grant execute on function public.gizli_hesap_ayarla(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Reads
-- ---------------------------------------------------------------------------
create or replace function public.takip_durumu_getir(p_target_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_stats jsonb;
  v_pending uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'unauthenticated');
  end if;
  if p_target_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  v_stats := coalesce(public.takip_sayaclari_json(p_target_id), jsonb_build_object(
    'followers_count', 0, 'following_count', 0, 'posts_count', 0,
    'pending_follow_requests_count', 0
  ));

  select id into v_pending
  from public.follow_requests
  where requester_id = v_uid and target_id = p_target_id and status = 'pending'
  limit 1;

  return jsonb_build_object(
    'ok', true,
    'target_id', p_target_id,
    'state', public.takip_iliski_durumu(v_uid, p_target_id),
    'is_private', public.gizli_hesap_mi(p_target_id),
    'request_id', v_pending
  ) || v_stats;
end;
$$;

grant execute on function public.takip_durumu_getir(uuid) to authenticated;

create or replace function public.takip_listesi_gorunur_mu(p_viewer uuid, p_owner uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_owner is null then return false; end if;
  if p_viewer is not null and p_viewer = p_owner then return true; end if;
  if p_viewer is not null and public.kullanicilar_engelli_mi(p_viewer, p_owner) then
    return false;
  end if;
  if not public.gizli_hesap_mi(p_owner) then return true; end if;
  if p_viewer is null then return false; end if;
  return public.takip_ediyor_mu(p_viewer, p_owner);
end;
$$;

create or replace function public.takipcileri_listele(
  p_user_id uuid,
  p_limit int default 24,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_q text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lim int := least(greatest(coalesce(p_limit, 24), 1), 50);
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_items jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_user_id is null then raise exception 'Kullanıcı gerekli'; end if;
  if not public.takip_listesi_gorunur_mu(v_uid, p_user_id) then
    return jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null);
  end if;

  select coalesce(jsonb_agg(public.takip_kart_json(v_uid, t.follower_id, t.created_at) order by t.created_at desc, t.follower_id desc), '[]'::jsonb)
  into v_items
  from (
    select f.follower_id, f.created_at
    from public.follows f
    join public.profiles p on p.id = f.follower_id
    where f.following_id = p_user_id
      and p.deleted_at is null
      and p.banned_at is null
      and not public.kullanicilar_engelli_mi(v_uid, f.follower_id)
      and (
        p_cursor_created_at is null
        or (f.created_at, f.follower_id) < (p_cursor_created_at, p_cursor_id)
      )
      and (
        v_q is null
        or p.username ilike '%' || v_q || '%'
        or p.display_name ilike '%' || v_q || '%'
      )
    order by f.created_at desc, f.follower_id desc
    limit v_lim
  ) t;

  return jsonb_build_object(
    'items', v_items,
    'next_cursor', case
      when jsonb_array_length(v_items) < v_lim then null
      else jsonb_build_object(
        'created_at', v_items -> (jsonb_array_length(v_items) - 1) ->> 'followed_at',
        'id', v_items -> (jsonb_array_length(v_items) - 1) ->> 'user_id'
      )
    end
  );
end;
$$;

grant execute on function public.takipcileri_listele(uuid, int, timestamptz, uuid, text) to authenticated;

create or replace function public.takip_edilenleri_listele(
  p_user_id uuid,
  p_limit int default 24,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_q text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lim int := least(greatest(coalesce(p_limit, 24), 1), 50);
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_items jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_user_id is null then raise exception 'Kullanıcı gerekli'; end if;
  if not public.takip_listesi_gorunur_mu(v_uid, p_user_id) then
    return jsonb_build_object('items', '[]'::jsonb, 'next_cursor', null);
  end if;

  select coalesce(jsonb_agg(public.takip_kart_json(v_uid, t.following_id, t.created_at) order by t.created_at desc, t.following_id desc), '[]'::jsonb)
  into v_items
  from (
    select f.following_id, f.created_at
    from public.follows f
    join public.profiles p on p.id = f.following_id
    where f.follower_id = p_user_id
      and p.deleted_at is null
      and p.banned_at is null
      and not public.kullanicilar_engelli_mi(v_uid, f.following_id)
      and (
        p_cursor_created_at is null
        or (f.created_at, f.following_id) < (p_cursor_created_at, p_cursor_id)
      )
      and (
        v_q is null
        or p.username ilike '%' || v_q || '%'
        or p.display_name ilike '%' || v_q || '%'
      )
    order by f.created_at desc, f.following_id desc
    limit v_lim
  ) t;

  return jsonb_build_object(
    'items', v_items,
    'next_cursor', case
      when jsonb_array_length(v_items) < v_lim then null
      else jsonb_build_object(
        'created_at', v_items -> (jsonb_array_length(v_items) - 1) ->> 'followed_at',
        'id', v_items -> (jsonb_array_length(v_items) - 1) ->> 'user_id'
      )
    end
  );
end;
$$;

grant execute on function public.takip_edilenleri_listele(uuid, int, timestamptz, uuid, text) to authenticated;

create or replace function public.takip_isteklerini_listele(
  p_limit int default 24,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lim int := least(greatest(coalesce(p_limit, 24), 1), 50);
  v_items jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select coalesce(jsonb_agg(
    public.takip_kart_json(v_uid, t.requester_id, t.created_at)
      || jsonb_build_object('request_id', t.id)
    order by t.created_at desc
  ), '[]'::jsonb)
  into v_items
  from (
    select r.id, r.requester_id, r.created_at
    from public.follow_requests r
    join public.profiles p on p.id = r.requester_id
    where r.target_id = v_uid
      and r.status = 'pending'
      and p.deleted_at is null
      and not public.kullanicilar_engelli_mi(v_uid, r.requester_id)
      and (
        p_cursor_created_at is null
        or (r.created_at, r.id) < (p_cursor_created_at, p_cursor_id)
      )
    order by r.created_at desc, r.id desc
    limit v_lim
  ) t;

  return jsonb_build_object('items', v_items);
end;
$$;

grant execute on function public.takip_isteklerini_listele(int, timestamptz, uuid) to authenticated;

create or replace function public.ortak_takipcileri_ozet(p_target_id uuid, p_limit int default 3)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lim int := least(greatest(coalesce(p_limit, 3), 1), 6);
  v_previews jsonb;
  v_count bigint := 0;
begin
  if v_uid is null or p_target_id is null or v_uid = p_target_id then
    return jsonb_build_object('count', 0, 'previews', '[]'::jsonb);
  end if;
  if public.kullanicilar_engelli_mi(v_uid, p_target_id) then
    return jsonb_build_object('count', 0, 'previews', '[]'::jsonb);
  end if;

  -- Benim takip ettigim ve hedefi takip eden hesaplar (hash join, IN listesi yok)
  select count(*) into v_count
  from public.follows mine
  join public.follows theirs
    on theirs.follower_id = mine.following_id
   and theirs.following_id = p_target_id
  join public.profiles p on p.id = mine.following_id
  where mine.follower_id = v_uid
    and p.deleted_at is null
    and p.banned_at is null
    and not public.kullanicilar_engelli_mi(v_uid, mine.following_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', t.user_id,
    'display_name', t.display_name,
    'username', t.username,
    'avatar_url', t.avatar_url
  )), '[]'::jsonb)
  into v_previews
  from (
    select
      p.id as user_id,
      coalesce(p.display_name, p.username, 'Kullanici') as display_name,
      p.username,
      p.avatar_url
    from public.follows mine
    join public.follows theirs
      on theirs.follower_id = mine.following_id
     and theirs.following_id = p_target_id
    join public.profiles p on p.id = mine.following_id
    where mine.follower_id = v_uid
      and p.deleted_at is null
    order by theirs.created_at desc
    limit v_lim
  ) t;

  return jsonb_build_object('count', v_count, 'previews', v_previews);
end;
$$;

grant execute on function public.ortak_takipcileri_ozet(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. Suggestions (izole scoring)
-- ---------------------------------------------------------------------------
create or replace function public.takip_onerileri_getir(p_limit int default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lim int := least(greatest(coalesce(p_limit, public.follow_config_int('suggestion_limit', 20)::int), 1), 40);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  -- Aday havuzu: ortak takip + beni takip edenler + yeni hesaplar.
  -- Tum profiles taranmaz.
  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.score desc)
    from (
      with candidates as (
        select theirs.following_id as user_id, count(*)::int * 5 as score
        from public.follows mine
        join public.follows theirs
          on theirs.follower_id = mine.following_id
        where mine.follower_id = v_uid
          and theirs.following_id <> v_uid
        group by theirs.following_id
        union all
        select f.follower_id, 8
        from public.follows f
        where f.following_id = v_uid
          and f.follower_id <> v_uid
        union all
        select p.id, 4
        from public.profiles p
        where p.created_at > now() - interval '14 days'
          and p.id <> v_uid
          and coalesce(p.is_guest, false) = false
          and p.deleted_at is null
          and p.banned_at is null
        order by 2 desc
        limit 400
      ),
      scored as (
        select user_id, sum(score)::int as score
        from candidates
        group by user_id
      )
      select
        p.id as user_id,
        coalesce(p.display_name, p.username, 'Kullanici') as display_name,
        p.username,
        p.avatar_url,
        coalesce(p.is_verified, false) as is_verified,
        coalesce(p.level, 1) as level,
        public.gizli_hesap_mi(p.id) as is_private,
        (
          s.score
          + case when coalesce(p.is_verified, false) then 3 else 0 end
          + least(coalesce(p.level, 1), 20)
          + case when exists (
              select 1 from public.status_posts sp
              where sp.user_id = p.id and sp.deleted_at is null
                and sp.created_at > now() - interval '7 days'
            ) then 4 else 0 end
        )::int as score,
        public.takip_iliski_durumu(v_uid, p.id) as state
      from scored s
      join public.profiles p on p.id = s.user_id
      where p.deleted_at is null
        and p.banned_at is null
        and coalesce(p.is_guest, false) = false
        and not public.kullanicilar_engelli_mi(v_uid, p.id)
        and not exists (
          select 1 from public.follows f
          where f.follower_id = v_uid and f.following_id = p.id
        )
        and not exists (
          select 1 from public.follow_requests r
          where r.requester_id = v_uid and r.target_id = p.id and r.status = 'pending'
        )
      order by score desc, p.created_at desc
      limit v_lim
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.takip_onerileri_getir(int) to authenticated;

create or replace function public.takip_canli_yayinlari(p_limit int default 40)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lim int := least(greatest(coalesce(p_limit, 40), 1), 80);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(t.ls) || jsonb_build_object('host', t.host) order by t.started_at desc)
    from (
      select
        ls,
        ls.started_at,
        jsonb_build_object(
          'id', p.id,
          'display_name', p.display_name,
          'username', p.username,
          'public_user_id', p.public_user_id,
          'level', p.level,
          'avatar_url', p.avatar_url
        ) as host
      from public.follows f
      join public.live_sessions ls
        on ls.host_id = f.following_id
       and ls.is_live = true
      join public.profiles p on p.id = ls.host_id
      where f.follower_id = v_uid
        and p.deleted_at is null
        and p.banned_at is null
        and not public.kullanicilar_engelli_mi(v_uid, f.following_id)
      order by ls.started_at desc
      limit v_lim
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.takip_canli_yayinlari(int) to authenticated;

-- ---------------------------------------------------------------------------
-- 13. Admin
-- ---------------------------------------------------------------------------
create or replace function public.admin_takip_istatistikleri(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_follows bigint;
  v_following bigint;
  v_pending bigint;
  v_follow_1h bigint;
  v_unfollow_1h bigint;
  v_request_1h bigint;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  select coalesce(followers_count, 0), coalesce(following_count, 0),
         coalesce(pending_follow_requests_count, 0)
    into v_follows, v_following, v_pending
  from public.user_profile_stats
  where user_id = p_user_id;

  select count(*) into v_follow_1h
  from public.follow_action_logs
  where actor_id = p_user_id and action in ('follow', 'request')
    and created_at > now() - interval '1 hour';

  select count(*) into v_unfollow_1h
  from public.follow_action_logs
  where actor_id = p_user_id and action = 'unfollow'
    and created_at > now() - interval '1 hour';

  select count(*) into v_request_1h
  from public.follow_action_logs
  where actor_id = p_user_id and action = 'request'
    and created_at > now() - interval '1 hour';

  return jsonb_build_object(
    'ok', true,
    'followers_count', coalesce(v_follows, 0),
    'following_count', coalesce(v_following, 0),
    'pending_requests', coalesce(v_pending, 0),
    'is_private', public.gizli_hesap_mi(p_user_id),
    'follow_last_hour', v_follow_1h,
    'unfollow_last_hour', v_unfollow_1h,
    'request_last_hour', v_request_1h,
    'suspicious', (v_follow_1h >= 80 or v_unfollow_1h >= 80 or v_request_1h >= 40)
  );
end;
$$;

grant execute on function public.admin_takip_istatistikleri(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 14. Block cleanup: pending requests + follows (mevcut follows silme korunur)
-- ---------------------------------------------------------------------------
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

  delete from public.follows
  where (follower_id = v_uid and following_id = p_blocked_id)
     or (follower_id = p_blocked_id and following_id = v_uid);

  update public.follow_requests
    set status = 'cancelled', responded_at = now()
    where status = 'pending'
      and (
        (requester_id = v_uid and target_id = p_blocked_id)
        or (requester_id = p_blocked_id and target_id = v_uid)
      );

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

grant execute on function public.kullanici_engelle(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 15. Realtime (yalnizca ilgili kullanici filtreler; global degil)
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.follows;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.follow_requests;
  exception when duplicate_object then null;
  end;
end;
$$;

alter table public.follows replica identity full;

-- ---------------------------------------------------------------------------
-- 16. Bildirim hedef: follow_request
-- ---------------------------------------------------------------------------
create or replace function public.bildirim_hedef_link(
  p_category text,
  p_deep_link text,
  p_payload jsonb
)
returns text
language plpgsql
immutable
as $$
declare
  v_type text := lower(coalesce(p_payload->>'type', ''));
  v_link text := nullif(trim(coalesce(p_deep_link, '')), '');
  v_thread text := nullif(trim(coalesce(p_payload->>'thread_id', '')), '');
  v_room text := nullif(trim(coalesce(p_payload->>'room_id', '')), '');
  v_live text := nullif(trim(coalesce(p_payload->>'live_id', '')), '');
  v_actor text := nullif(trim(coalesce(
    p_payload->>'follower_id',
    p_payload->>'sender_id',
    p_payload->>'host_id',
    p_payload->>'actor_id',
    ''
  )), '');
begin
  if v_link is not null
     and v_link not in ('/(tabs)/profile', '/profile', '/bildirimler') then
    return v_link;
  end if;

  if v_thread is not null then
    return '/mesaj/' || v_thread;
  end if;
  if v_live is not null then
    return '/canli/' || v_live;
  end if;
  if v_room is not null then
    return '/lobi/' || v_room;
  end if;
  if v_type = 'follow_request' then
    return '/takip/istekler';
  end if;
  if v_type in ('follow', 'new_follower', 'follow_request_accepted') and v_actor is not null then
    return '/kullanici/' || v_actor;
  end if;
  if v_type in ('gift_received', 'dm') and v_actor is not null and v_room is null then
    return '/kullanici/' || v_actor;
  end if;
  if lower(coalesce(p_category, '')) = 'wallet' then
    return '/(tabs)/wallet';
  end if;
  if v_link is not null then
    return v_link;
  end if;
  if v_actor is not null then
    return '/kullanici/' || v_actor;
  end if;
  return null;
end;
$$;
