-- FAZ 9: Platform operasyon — events, missions, badges, announcements,
-- policies, room moderation, reports, analytics enqueue
-- Run after 001–009

insert into public.feature_flags (key, enabled, description) values
  ('missions_enabled', false, 'Gorevler'),
  ('announcements_enabled', false, 'Duyurular'),
  ('policies_enabled', false, 'Politikalar / consent'),
  ('moderation_enabled', false, 'Oda moderasyonu'),
  ('analytics_enabled', false, 'Analytics enqueue')
on conflict (key) do nothing;

insert into public.kill_switches (key, active, reason) values
  ('kill_moderation', false, null)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Events / missions / badges
-- ---------------------------------------------------------------------------
create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  description text,
  cover_url text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','live','ended','cancelled')),
  deep_link text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  description text,
  goal_type text not null
    check (goal_type in ('login','gift_send','room_join','follow','custom')),
  goal_target int not null default 1 check (goal_target > 0),
  reward_coins bigint not null default 0 check (reward_coins >= 0),
  badge_code text,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.user_mission_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  progress int not null default 0,
  completed_at timestamptz,
  claimed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, mission_id)
);

create table if not exists public.badges (
  code text primary key,
  name text not null,
  description text,
  icon_url text,
  rarity text not null default 'common'
    check (rarity in ('common','rare','epic','legendary')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_code text not null references public.badges(code),
  awarded_at timestamptz not null default now(),
  source text,
  primary key (user_id, badge_code)
);

-- Seed
insert into public.platform_events (code, title, description, starts_at, ends_at, status, sort_order)
values (
  'welcome-week',
  'Welcome Week',
  'Platform launch event',
  now(),
  now() + interval '14 days',
  'live',
  1
)
on conflict (code) do nothing;

insert into public.missions (code, title, description, goal_type, goal_target, reward_coins, badge_code)
values
  ('daily_login', 'Daily Login', 'Uygulamaya gir', 'login', 1, 10, 'first_login'),
  ('first_gift', 'First Gift', 'Bir hediye gonder', 'gift_send', 1, 50, 'gifter_starter'),
  ('join_room', 'Join a Room', 'Bir ses odasina katil', 'room_join', 1, 20, null)
on conflict (code) do nothing;

insert into public.badges (code, name, description, rarity) values
  ('first_login', 'First Login', 'Ilk giris', 'common'),
  ('gifter_starter', 'Starter Gifter', 'Ilk hediye', 'rare'),
  ('city_supporter', 'City Supporter', 'Sehir destegi', 'rare')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Announcements vs Policies (ayri domain)
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  deep_link text,
  created_at timestamptz not null default now()
);

create table if not exists public.announcement_receipts (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create table if not exists public.policies (
  code text primary key,
  title text not null,
  description text,
  is_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_code text not null references public.policies(code) on delete cascade,
  version int not null,
  body_md text not null,
  published_at timestamptz not null default now(),
  unique (policy_code, version)
);

create table if not exists public.policy_acceptances (
  user_id uuid not null references public.profiles(id) on delete cascade,
  policy_version_id uuid not null references public.policy_versions(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  primary key (user_id, policy_version_id)
);

insert into public.policies (code, title, description, is_required) values
  ('tos', 'Terms of Service', 'Kullanim kosullari', true),
  ('privacy', 'Privacy Policy', 'Gizlilik', true)
on conflict (code) do nothing;

insert into public.policy_versions (policy_code, version, body_md)
select p.code, 1, '# ' || p.title || E'\n\nPlaceholder policy body v1.'
from public.policies p
where not exists (
  select 1 from public.policy_versions v where v.policy_code = p.code and v.version = 1
);

insert into public.announcements (title, body, priority)
select 'Hos geldin', 'Muta platformuna hos geldin. Sehir, ajans ve odalar seni bekliyor.', 'normal'
where not exists (select 1 from public.announcements limit 1);

-- ---------------------------------------------------------------------------
-- Room moderation + reports
-- ---------------------------------------------------------------------------
create table if not exists public.room_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  target_user_id uuid not null references public.profiles(id),
  action text not null check (action in ('mute','unmute','kick','ban','unban')),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.room_bans (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  banned_by uuid references public.profiles(id),
  reason text,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open'
    check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Analytics enqueue (fault-isolated)
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_idx
  on public.analytics_events (event_name, created_at desc);

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.gorev_ilerlet(
  p_mission_code text,
  p_delta int default 1
)
returns public.user_mission_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_m public.missions%rowtype;
  v_row public.user_mission_progress%rowtype;
  v_prog int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ozellik_bayragi_aktif_mi('missions_enabled') then
    raise exception 'Missions disabled';
  end if;
  if p_delta is null or p_delta <= 0 then raise exception 'Invalid delta'; end if;

  select * into v_m from public.missions where code = p_mission_code and is_active;
  if not found then raise exception 'Mission not found'; end if;

  insert into public.user_mission_progress (user_id, mission_id, progress)
  values (v_uid, v_m.id, least(p_delta, v_m.goal_target))
  on conflict (user_id, mission_id) do update
    set progress = least(
      public.user_mission_progress.progress + excluded.progress,
      v_m.goal_target
    ),
    updated_at = now()
  returning * into v_row;

  if v_row.progress >= v_m.goal_target and v_row.completed_at is null then
    update public.user_mission_progress
      set completed_at = now(), updated_at = now()
    where user_id = v_uid and mission_id = v_m.id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

create or replace function public.gorev_odul_al(p_mission_code text)
returns public.user_mission_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_m public.missions%rowtype;
  v_row public.user_mission_progress%rowtype;
  v_bal bigint;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ozellik_bayragi_aktif_mi('missions_enabled') then
    raise exception 'Missions disabled';
  end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot claim'; end if;

  select * into v_m from public.missions where code = p_mission_code and is_active;
  if not found then raise exception 'Mission not found'; end if;

  select * into v_row from public.user_mission_progress
  where user_id = v_uid and mission_id = v_m.id for update;
  if not found or v_row.completed_at is null then
    raise exception 'Mission not completed';
  end if;
  if v_row.claimed_at is not null then return v_row; end if;

  if v_m.reward_coins > 0 then
    update public.wallets set coins = coins + v_m.reward_coins, updated_at = now()
    where user_id = v_uid
    returning coins into v_bal;

    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type)
    values (v_uid, 'coins', v_m.reward_coins, v_bal, 'mission_reward', 'mission');
  end if;

  if v_m.badge_code is not null then
    insert into public.user_badges (user_id, badge_code, source)
    values (v_uid, v_m.badge_code, 'mission:' || v_m.code)
    on conflict do nothing;
  end if;

  update public.user_mission_progress
    set claimed_at = now(), updated_at = now()
  where user_id = v_uid and mission_id = v_m.id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.duyuru_okundu_isaretle(p_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ozellik_bayragi_aktif_mi('announcements_enabled') then
    raise exception 'Announcements disabled';
  end if;
  insert into public.announcement_receipts (announcement_id, user_id)
  values (p_announcement_id, v_uid)
  on conflict do nothing;
end;
$$;

create or replace function public.politika_kabul_et(p_policy_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ozellik_bayragi_aktif_mi('policies_enabled') then
    raise exception 'Policies disabled';
  end if;
  if not exists (select 1 from public.policy_versions where id = p_policy_version_id) then
    raise exception 'Policy version not found';
  end if;
  insert into public.policy_acceptances (user_id, policy_version_id)
  values (v_uid, p_policy_version_id)
  on conflict do nothing;
end;
$$;

create or replace function public.oda_moderasyon_uygula(
  p_room_id uuid,
  p_target_user_id uuid,
  p_action text,
  p_reason text default null
)
returns public.room_moderation_actions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_row public.room_moderation_actions%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_moderation') then
    raise exception 'Moderation temporarily disabled';
  end if;
  if not public.ozellik_bayragi_aktif_mi('moderation_enabled') then
    raise exception 'Moderation disabled';
  end if;
  if p_action not in ('mute','unmute','kick','ban','unban') then
    raise exception 'Invalid action';
  end if;
  if p_target_user_id = v_uid then raise exception 'Cannot moderate self'; end if;

  select role into v_role from public.room_members
  where room_id = p_room_id and user_id = v_uid;
  if v_role is null or v_role not in ('host','cohost') then
    -- also allow room host_id
    if not exists (select 1 from public.rooms where id = p_room_id and host_id = v_uid) then
      raise exception 'Not room moderator';
    end if;
  end if;

  if p_action = 'mute' then
    update public.room_members set role = role where room_id = p_room_id and user_id = p_target_user_id;
    update public.room_seats set is_muted = true
    where room_id = p_room_id and user_id = p_target_user_id;
  elsif p_action = 'unmute' then
    update public.room_seats set is_muted = false
    where room_id = p_room_id and user_id = p_target_user_id;
  elsif p_action = 'kick' then
    delete from public.room_members where room_id = p_room_id and user_id = p_target_user_id;
    update public.room_seats set user_id = null
    where room_id = p_room_id and user_id = p_target_user_id;
  elsif p_action = 'ban' then
    insert into public.room_bans (room_id, user_id, banned_by, reason)
    values (p_room_id, p_target_user_id, v_uid, p_reason)
    on conflict do nothing;
    delete from public.room_members where room_id = p_room_id and user_id = p_target_user_id;
  elsif p_action = 'unban' then
    delete from public.room_bans where room_id = p_room_id and user_id = p_target_user_id;
  end if;

  insert into public.room_moderation_actions (
    room_id, actor_id, target_user_id, action, reason
  ) values (
    p_room_id, v_uid, p_target_user_id, p_action, p_reason
  ) returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.kullanici_bildir(
  p_reason text,
  p_target_user_id uuid default null,
  p_room_id uuid default null,
  p_details text default null
)
returns public.user_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.user_reports%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Reason required';
  end if;

  insert into public.user_reports (reporter_id, target_user_id, room_id, reason, details)
  values (v_uid, p_target_user_id, p_room_id, trim(p_reason), p_details)
  returning * into v_row;

  perform public.guvenlik_olayi_kaydet(
    'user_report',
    null,
    jsonb_build_object('report_id', v_row.id, 'reason', p_reason)
  );

  return v_row;
end;
$$;

create or replace function public.analytics_olay_ekle(
  p_event_name text,
  p_props jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ozellik_bayragi_aktif_mi('analytics_enabled') then
    return; -- soft no-op: analytics hatasi kullaniciyi bozmaz
  end if;
  if p_event_name is null or length(trim(p_event_name)) = 0 then return; end if;
  insert into public.analytics_events (user_id, event_name, props)
  values (auth.uid(), trim(p_event_name), coalesce(p_props, '{}'::jsonb));
exception
  when others then
    return; -- fault isolation
end;
$$;

-- Push center thin: enqueue to outbox for self (dev) / service later
create or replace function public.bildirim_kuyruga_ekle_dev(
  p_title text,
  p_body text default null,
  p_category text default 'system'
)
returns public.notification_outbox
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.notification_outbox%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  insert into public.notification_outbox (user_id, category, title, body)
  values (v_uid, coalesce(nullif(trim(p_category), ''), 'system'), p_title, p_body)
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.platform_events enable row level security;
alter table public.missions enable row level security;
alter table public.user_mission_progress enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_receipts enable row level security;
alter table public.policies enable row level security;
alter table public.policy_versions enable row level security;
alter table public.policy_acceptances enable row level security;
alter table public.room_moderation_actions enable row level security;
alter table public.room_bans enable row level security;
alter table public.user_reports enable row level security;
alter table public.analytics_events enable row level security;

create policy "Events readable" on public.platform_events
  for select to authenticated using (status in ('scheduled','live','ended'));
create policy "Missions readable" on public.missions
  for select to authenticated using (is_active);
create policy "Own mission progress" on public.user_mission_progress
  for select to authenticated using (auth.uid() = user_id);
create policy "Badges readable" on public.badges
  for select to authenticated using (is_active);
create policy "User badges readable" on public.user_badges
  for select to authenticated using (true);
create policy "Announcements readable" on public.announcements
  for select to authenticated using (is_active);
create policy "Own announcement receipts" on public.announcement_receipts
  for select to authenticated using (auth.uid() = user_id);
create policy "Policies readable" on public.policies
  for select to authenticated using (is_active);
create policy "Policy versions readable" on public.policy_versions
  for select to authenticated using (true);
create policy "Own policy acceptances" on public.policy_acceptances
  for select to authenticated using (auth.uid() = user_id);
create policy "Own moderation actions as actor" on public.room_moderation_actions
  for select to authenticated using (auth.uid() = actor_id or auth.uid() = target_user_id);
create policy "Room bans readable host" on public.room_bans
  for select to authenticated using (
    exists (select 1 from public.rooms r where r.id = room_id and r.host_id = auth.uid())
    or auth.uid() = user_id
  );
create policy "Own reports" on public.user_reports
  for select to authenticated using (auth.uid() = reporter_id);
create policy "Own analytics" on public.analytics_events
  for select to authenticated using (auth.uid() = user_id);

grant select on public.platform_events to authenticated;
grant select on public.missions to authenticated;
grant select on public.user_mission_progress to authenticated;
grant select on public.badges to authenticated;
grant select on public.user_badges to authenticated;
grant select on public.announcements to authenticated;
grant select on public.announcement_receipts to authenticated;
grant select on public.policies to authenticated;
grant select on public.policy_versions to authenticated;
grant select on public.policy_acceptances to authenticated;
grant select on public.room_moderation_actions to authenticated;
grant select on public.room_bans to authenticated;
grant select on public.user_reports to authenticated;
grant select on public.analytics_events to authenticated;

grant execute on function public.gorev_ilerlet to authenticated;
grant execute on function public.gorev_odul_al to authenticated;
grant execute on function public.duyuru_okundu_isaretle to authenticated;
grant execute on function public.politika_kabul_et to authenticated;
grant execute on function public.oda_moderasyon_uygula to authenticated;
grant execute on function public.kullanici_bildir to authenticated;
grant execute on function public.analytics_olay_ekle to authenticated;
grant execute on function public.bildirim_kuyruga_ekle_dev to authenticated;
