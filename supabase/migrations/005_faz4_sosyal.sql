-- FAZ 4: Profil stats, follow, mesajlasma, bildirim foundation
-- Run after 001–004

-- Denormalized profile stats (profil acilisinda SUM/COUNT yok)
create table if not exists public.user_profile_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  followers_count bigint not null default 0 check (followers_count >= 0),
  following_count bigint not null default 0 check (following_count >= 0),
  likes_count bigint not null default 0 check (likes_count >= 0),
  total_topup_coin bigint not null default 0,
  total_spent_coin bigint not null default 0,
  total_gifts_sent bigint not null default 0,
  total_gifts_received bigint not null default 0,
  recharge_rank int,
  gifter_rank int,
  charm_level int not null default 1,
  vip_level int not null default 0,
  agency_id uuid,
  host_status text not null default 'none'
    check (host_status in ('none','pending','independent','agency')),
  updated_at timestamptz default now()
);

insert into public.user_profile_stats (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

-- Privacy settings
create table if not exists public.user_privacy_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  hide_recharge_rank boolean not null default false,
  hide_gifter_rank boolean not null default false,
  hide_current_room boolean not null default false,
  hide_last_seen boolean not null default false,
  hide_agency boolean not null default false,
  hide_gift_collection boolean not null default false,
  hide_top_supporter boolean not null default false,
  updated_at timestamptz default now()
);

insert into public.user_privacy_settings (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

-- Follow
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows (following_id, created_at desc);
create index if not exists follows_follower_idx on public.follows (follower_id, created_at desc);

create or replace function public.takip_sayaclarini_guncelle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.user_profile_stats (user_id) values (new.following_id)
    on conflict (user_id) do nothing;
    insert into public.user_profile_stats (user_id) values (new.follower_id)
    on conflict (user_id) do nothing;

    update public.user_profile_stats
      set followers_count = followers_count + 1, updated_at = now()
      where user_id = new.following_id;
    update public.user_profile_stats
      set following_count = following_count + 1, updated_at = now()
      where user_id = new.follower_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.user_profile_stats
      set followers_count = greatest(followers_count - 1, 0), updated_at = now()
      where user_id = old.following_id;
    update public.user_profile_stats
      set following_count = greatest(following_count - 1, 0), updated_at = now()
      where user_id = old.follower_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists follows_stats_trg on public.follows;
create trigger follows_stats_trg
  after insert or delete on public.follows
  for each row execute function public.takip_sayaclarini_guncelle();

-- Ensure stats row on new profile
create or replace function public.profil_stats_olustur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profile_stats (user_id) values (new.id)
  on conflict (user_id) do nothing;
  insert into public.user_privacy_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_stats_trg on public.profiles;
create trigger profiles_stats_trg
  after insert on public.profiles
  for each row execute function public.profil_stats_olustur();

-- Gift stats denormalize (light)
create or replace function public.hediye_stats_guncelle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profile_stats (user_id) values (new.sender_id)
  on conflict (user_id) do nothing;
  insert into public.user_profile_stats (user_id) values (new.receiver_id)
  on conflict (user_id) do nothing;

  update public.user_profile_stats set
    total_gifts_sent = total_gifts_sent + new.quantity,
    total_spent_coin = total_spent_coin + new.coins_spent,
    updated_at = now()
  where user_id = new.sender_id;

  update public.user_profile_stats set
    total_gifts_received = total_gifts_received + new.quantity,
    updated_at = now()
  where user_id = new.receiver_id;

  return new;
end;
$$;

drop trigger if exists gift_tx_stats_trg on public.gift_transactions;
create trigger gift_tx_stats_trg
  after insert on public.gift_transactions
  for each row execute function public.hediye_stats_guncelle();

-- Messaging
create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_preview text
);

create table if not exists public.message_thread_members (
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (thread_id, user_id)
);

create index if not exists message_thread_members_user_idx
  on public.message_thread_members (user_id, joined_at desc);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  message_type text not null default 'text'
    check (message_type in ('text','image','video','voice','emoji','gift','system')),
  media_url text,
  reply_to_id uuid references public.direct_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists direct_messages_thread_idx
  on public.direct_messages (thread_id, created_at desc);

-- DM gonder (guest engelli, feature flag, rate-friendly)
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

  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'Empty message';
  end if;

  insert into public.direct_messages (thread_id, sender_id, body, message_type)
  values (p_thread_id, v_uid, left(trim(p_body), 4000), coalesce(p_message_type, 'text'))
  returning * into v_msg;

  update public.message_threads set
    updated_at = now(),
    last_message_at = now(),
    last_message_preview = left(trim(p_body), 120)
  where id = p_thread_id;

  return v_msg;
end;
$$;

-- DM veya thread ac (1:1)
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

-- Follow RPC (guest engelli)
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

  insert into public.follows (follower_id, following_id)
  values (v_uid, p_target_id)
  on conflict do nothing;
end;
$$;

create or replace function public.takibi_birak(p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from public.follows
  where follower_id = auth.uid() and following_id = p_target_id;
end;
$$;

-- Push device registry (Notification Gateway)
create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  device_id text not null,
  platform text not null check (platform in ('ios','android','web')),
  push_provider text not null check (push_provider in ('apns','fcm','expo','none')),
  push_token text,
  app_version text,
  device_model text,
  locale text,
  timezone text,
  notification_enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (device_id, push_provider)
);

create index if not exists device_push_tokens_user_idx
  on public.device_push_tokens (user_id, active);

create or replace function public.cihaz_push_token_kaydet(
  p_device_id text,
  p_platform text,
  p_push_provider text,
  p_push_token text default null,
  p_app_version text default null,
  p_locale text default null,
  p_timezone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.device_push_tokens (
    user_id, device_id, platform, push_provider, push_token,
    app_version, locale, timezone, last_seen_at, active
  ) values (
    auth.uid(), p_device_id, p_platform, p_push_provider, p_push_token,
    p_app_version, p_locale, p_timezone, now(), true
  )
  on conflict (device_id, push_provider) do update set
    user_id = coalesce(auth.uid(), device_push_tokens.user_id),
    push_token = coalesce(excluded.push_token, device_push_tokens.push_token),
    app_version = coalesce(excluded.app_version, device_push_tokens.app_version),
    locale = coalesce(excluded.locale, device_push_tokens.locale),
    timezone = coalesce(excluded.timezone, device_push_tokens.timezone),
    last_seen_at = now(),
    active = true
  returning id into v_id;
  return v_id;
end;
$$;

-- Explore categories (dynamic)
create table if not exists public.explore_categories (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

insert into public.explore_categories (code, name, sort_order) values
  ('music','Music',1),
  ('gaming','Gaming',2),
  ('chat','Chat',3),
  ('lifestyle','Lifestyle',4),
  ('entertainment','Entertainment',5),
  ('comedy','Comedy',6),
  ('travel','Travel',7),
  ('language','Language',8),
  ('night_talk','Night Talk',9),
  ('community','Community',10)
on conflict (code) do nothing;

-- Notification outbox (gateway queue; push ana islemi bekletmez)
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  category text not null,
  title text not null,
  body text,
  deep_link text,
  payload jsonb default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','sent','failed','cancelled')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists notification_outbox_pending_idx
  on public.notification_outbox (status, created_at)
  where status = 'pending';

-- RLS
alter table public.user_profile_stats enable row level security;
alter table public.user_privacy_settings enable row level security;
alter table public.follows enable row level security;
alter table public.message_threads enable row level security;
alter table public.message_thread_members enable row level security;
alter table public.direct_messages enable row level security;
alter table public.device_push_tokens enable row level security;
alter table public.explore_categories enable row level security;
alter table public.notification_outbox enable row level security;

create policy "Profile stats readable"
  on public.user_profile_stats for select to authenticated using (true);

create policy "Own privacy settings"
  on public.user_privacy_settings for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Follows readable"
  on public.follows for select to authenticated using (true);

create policy "Thread members read own threads"
  on public.message_thread_members for select to authenticated
  using (auth.uid() = user_id);

create policy "Messages readable by members"
  on public.direct_messages for select to authenticated
  using (
    exists (
      select 1 from public.message_thread_members m
      where m.thread_id = direct_messages.thread_id and m.user_id = auth.uid()
    )
  );

create policy "Threads readable by members"
  on public.message_threads for select to authenticated
  using (
    exists (
      select 1 from public.message_thread_members m
      where m.thread_id = message_threads.id and m.user_id = auth.uid()
    )
  );

create policy "Own push tokens"
  on public.device_push_tokens for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Explore categories readable"
  on public.explore_categories for select to authenticated
  using (is_active);

create policy "Own notification outbox read"
  on public.notification_outbox for select to authenticated
  using (auth.uid() = user_id);

grant select on public.user_profile_stats to authenticated;
grant select, update on public.user_privacy_settings to authenticated;
grant select on public.follows to authenticated;
grant select on public.message_threads to authenticated;
grant select on public.message_thread_members to authenticated;
grant select on public.direct_messages to authenticated;
grant select, insert, update on public.device_push_tokens to authenticated;
grant select on public.explore_categories to authenticated;
grant select on public.notification_outbox to authenticated;
grant execute on function public.takip_et to authenticated;
grant execute on function public.takibi_birak to authenticated;
grant execute on function public.mesaj_gonder to authenticated;
grant execute on function public.ozel_sohbet_ac_veya_getir to authenticated;
grant execute on function public.cihaz_push_token_kaydet to authenticated;
