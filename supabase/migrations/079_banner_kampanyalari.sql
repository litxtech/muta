-- Banner / tanıtım / kampanya yönetim sistemi
-- Merkezi engine: placement + targeting + analytics + RLS

-- ---------------------------------------------------------------------------
-- Enum-like check helpers (text + check for flexibility)
-- ---------------------------------------------------------------------------

create table if not exists public.banner_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  internal_name text,
  title text,
  subtitle text,
  description text,
  badge text,
  label text,
  media_type text not null default 'IMAGE'
    check (media_type in (
      'IMAGE', 'VIDEO', 'GRADIENT', 'IMAGE_TEXT', 'VIDEO_TEXT'
    )),
  media_url text,
  thumbnail_url text,
  media_alt text,
  gradient_json jsonb,
  size_type text not null default 'MEDIUM'
    check (size_type in ('SMALL', 'MEDIUM', 'LARGE', 'HERO', 'CUSTOM')),
  aspect_ratio text not null default '16:6',
  priority integer not null default 50,
  status text not null default 'DRAFT'
    check (status in (
      'DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED'
    )),
  start_at timestamptz,
  end_at timestamptz,
  daily_start_time time,
  daily_end_time time,
  dismissible boolean not null default false,
  frequency_type text not null default 'unlimited'
    check (frequency_type in (
      'unlimited', '1_per_session', '1_per_day', '3_per_day',
      '5_per_week', 'custom'
    )),
  max_daily_impressions integer,
  max_weekly_impressions integer,
  max_session_impressions integer,
  shimmer_enabled boolean not null default false,
  autoplay_video boolean not null default true,
  loop_video boolean not null default true,
  carousel_auto_slide_ms integer,
  tags text[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists banner_campaigns_status_idx
  on public.banner_campaigns (status, priority desc);
create index if not exists banner_campaigns_schedule_idx
  on public.banner_campaigns (start_at, end_at)
  where status in ('ACTIVE', 'SCHEDULED');

create table if not exists public.banner_media (
  id uuid primary key default gen_random_uuid(),
  banner_id uuid not null references public.banner_campaigns(id) on delete cascade,
  kind text not null check (kind in ('IMAGE', 'VIDEO', 'THUMBNAIL')),
  storage_path text not null,
  public_url text,
  mime_type text,
  width integer,
  height integer,
  bytes integer,
  created_at timestamptz not null default now()
);

create index if not exists banner_media_banner_idx
  on public.banner_media (banner_id);

create table if not exists public.banner_placements (
  id uuid primary key default gen_random_uuid(),
  banner_id uuid not null references public.banner_campaigns(id) on delete cascade,
  screen_key text not null,
  placement_key text not null,
  sort_order integer not null default 0,
  unique (banner_id, screen_key, placement_key)
);

create index if not exists banner_placements_lookup_idx
  on public.banner_placements (placement_key, screen_key);

create table if not exists public.banner_targets (
  id uuid primary key default gen_random_uuid(),
  banner_id uuid not null references public.banner_campaigns(id) on delete cascade,
  target_mode text not null default 'ALL'
    check (target_mode in ('ALL', 'COUNTRY', 'CITY', 'REGION', 'CUSTOM')),
  country text,
  country_code text,
  region text,
  region_id text,
  city text,
  platform text not null default 'ALL'
    check (platform in ('ALL', 'IOS', 'ANDROID')),
  language text,
  user_segment text not null default 'ALL_USERS'
    check (user_segment in (
      'ALL_USERS', 'GUEST', 'REGISTERED', 'NEW_USER', 'ACTIVE_USER',
      'VIP', 'CREATOR', 'ROOM_HOST', 'CUSTOM_SEGMENT'
    )),
  custom_segment text,
  min_level integer,
  max_level integer,
  min_account_age_days integer,
  max_account_age_days integer,
  created_at timestamptz not null default now()
);

create index if not exists banner_targets_banner_idx
  on public.banner_targets (banner_id);

create table if not exists public.banner_actions (
  id uuid primary key default gen_random_uuid(),
  banner_id uuid not null references public.banner_campaigns(id) on delete cascade,
  slot integer not null default 0 check (slot in (0, 1)),
  action_type text not null default 'NONE'
    check (action_type in (
      'NONE', 'INTERNAL_SCREEN', 'INTERNAL_PROFILE', 'INTERNAL_ROOM',
      'INTERNAL_GAME', 'INTERNAL_POST', 'INTERNAL_LIVE', 'WEB_URL',
      'IN_APP_WEBVIEW', 'WHATSAPP', 'INSTAGRAM', 'EXTERNAL_APP',
      'CUSTOM_DEEP_LINK'
    )),
  button_text text,
  icon text,
  target text,
  url text,
  payload_json jsonb not null default '{}'::jsonb,
  unique (banner_id, slot)
);

create table if not exists public.banner_impressions (
  id uuid primary key default gen_random_uuid(),
  banner_id uuid not null references public.banner_campaigns(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  session_id text,
  screen text,
  placement text,
  created_at timestamptz not null default now()
);

create index if not exists banner_impressions_banner_day_idx
  on public.banner_impressions (banner_id, created_at desc);
create index if not exists banner_impressions_user_day_idx
  on public.banner_impressions (user_id, banner_id, created_at desc);

create table if not exists public.banner_clicks (
  id uuid primary key default gen_random_uuid(),
  banner_id uuid not null references public.banner_campaigns(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action_type text,
  action_id uuid,
  placement text,
  screen text,
  created_at timestamptz not null default now()
);

create index if not exists banner_clicks_banner_idx
  on public.banner_clicks (banner_id, created_at desc);

create table if not exists public.banner_user_state (
  id uuid primary key default gen_random_uuid(),
  banner_id uuid not null references public.banner_campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  dismissed_at timestamptz,
  last_impression_at timestamptz,
  impression_count_today integer not null default 0,
  impression_count_week integer not null default 0,
  impression_day date,
  impression_week_start date,
  session_impressions integer not null default 0,
  last_session_id text,
  updated_at timestamptz not null default now(),
  unique (banner_id, user_id)
);

create table if not exists public.banner_events (
  id uuid primary key default gen_random_uuid(),
  banner_id uuid not null references public.banner_campaigns(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null
    check (event_type in (
      'impression', 'view', 'click', 'cta_click', 'dismiss',
      'video_start', 'video_complete', 'webview_open', 'conversion'
    )),
  placement text,
  screen text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists banner_events_banner_idx
  on public.banner_events (banner_id, event_type, created_at desc);

create table if not exists public.banner_audit_log (
  id uuid primary key default gen_random_uuid(),
  banner_id uuid references public.banner_campaigns(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.banner_campaigns_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists banner_campaigns_touch_trg on public.banner_campaigns;
create trigger banner_campaigns_touch_trg
  before update on public.banner_campaigns
  for each row execute function public.banner_campaigns_touch();

-- Auto-expire / schedule status maintenance
create or replace function public.banner_status_otomatik_guncelle()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.banner_campaigns
  set status = 'EXPIRED'
  where status in ('ACTIVE', 'SCHEDULED', 'PAUSED')
    and end_at is not null
    and end_at < now();

  update public.banner_campaigns
  set status = 'ACTIVE'
  where status = 'SCHEDULED'
    and (start_at is null or start_at <= now())
    and (end_at is null or end_at >= now());
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'banner-media',
  'banner-media',
  true,
  52428800,
  array[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Banner media public read" on storage.objects;
create policy "Banner media public read"
  on storage.objects for select to public
  using (bucket_id = 'banner-media');

drop policy if exists "Banner media admin upload" on storage.objects;
create policy "Banner media admin upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'banner-media'
    and public.ben_admin_miyim()
  );

drop policy if exists "Banner media admin update" on storage.objects;
create policy "Banner media admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'banner-media' and public.ben_admin_miyim())
  with check (bucket_id = 'banner-media' and public.ben_admin_miyim());

drop policy if exists "Banner media admin delete" on storage.objects;
create policy "Banner media admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'banner-media' and public.ben_admin_miyim());

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.banner_campaigns enable row level security;
alter table public.banner_media enable row level security;
alter table public.banner_placements enable row level security;
alter table public.banner_targets enable row level security;
alter table public.banner_actions enable row level security;
alter table public.banner_impressions enable row level security;
alter table public.banner_clicks enable row level security;
alter table public.banner_user_state enable row level security;
alter table public.banner_events enable row level security;
alter table public.banner_audit_log enable row level security;

-- Campaigns: authenticated can read ACTIVE/SCHEDULED (client still filters eligibility)
drop policy if exists "Banner campaigns public active read" on public.banner_campaigns;
create policy "Banner campaigns public active read"
  on public.banner_campaigns for select to authenticated
  using (
    status in ('ACTIVE', 'SCHEDULED')
    or public.ben_admin_miyim()
  );

drop policy if exists "Banner campaigns admin write" on public.banner_campaigns;
create policy "Banner campaigns admin write"
  on public.banner_campaigns for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

drop policy if exists "Banner media read" on public.banner_media;
create policy "Banner media read"
  on public.banner_media for select to authenticated
  using (
    exists (
      select 1 from public.banner_campaigns c
      where c.id = banner_id
        and (c.status in ('ACTIVE', 'SCHEDULED') or public.ben_admin_miyim())
    )
  );

drop policy if exists "Banner media admin write" on public.banner_media;
create policy "Banner media admin write"
  on public.banner_media for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

drop policy if exists "Banner placements read" on public.banner_placements;
create policy "Banner placements read"
  on public.banner_placements for select to authenticated
  using (
    exists (
      select 1 from public.banner_campaigns c
      where c.id = banner_id
        and (c.status in ('ACTIVE', 'SCHEDULED') or public.ben_admin_miyim())
    )
  );

drop policy if exists "Banner placements admin write" on public.banner_placements;
create policy "Banner placements admin write"
  on public.banner_placements for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

drop policy if exists "Banner targets read" on public.banner_targets;
create policy "Banner targets read"
  on public.banner_targets for select to authenticated
  using (
    exists (
      select 1 from public.banner_campaigns c
      where c.id = banner_id
        and (c.status in ('ACTIVE', 'SCHEDULED') or public.ben_admin_miyim())
    )
  );

drop policy if exists "Banner targets admin write" on public.banner_targets;
create policy "Banner targets admin write"
  on public.banner_targets for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

drop policy if exists "Banner actions read" on public.banner_actions;
create policy "Banner actions read"
  on public.banner_actions for select to authenticated
  using (
    exists (
      select 1 from public.banner_campaigns c
      where c.id = banner_id
        and (c.status in ('ACTIVE', 'SCHEDULED') or public.ben_admin_miyim())
    )
  );

drop policy if exists "Banner actions admin write" on public.banner_actions;
create policy "Banner actions admin write"
  on public.banner_actions for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

-- Impressions / clicks / events: users insert own; admin read all
drop policy if exists "Banner impressions insert own" on public.banner_impressions;
create policy "Banner impressions insert own"
  on public.banner_impressions for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

drop policy if exists "Banner impressions admin read" on public.banner_impressions;
create policy "Banner impressions admin read"
  on public.banner_impressions for select to authenticated
  using (public.ben_admin_miyim() or user_id = auth.uid());

drop policy if exists "Banner clicks insert own" on public.banner_clicks;
create policy "Banner clicks insert own"
  on public.banner_clicks for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

drop policy if exists "Banner clicks admin read" on public.banner_clicks;
create policy "Banner clicks admin read"
  on public.banner_clicks for select to authenticated
  using (public.ben_admin_miyim() or user_id = auth.uid());

drop policy if exists "Banner events insert own" on public.banner_events;
create policy "Banner events insert own"
  on public.banner_events for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

drop policy if exists "Banner events admin read" on public.banner_events;
create policy "Banner events admin read"
  on public.banner_events for select to authenticated
  using (public.ben_admin_miyim() or user_id = auth.uid());

drop policy if exists "Banner user state own" on public.banner_user_state;
create policy "Banner user state own"
  on public.banner_user_state for all to authenticated
  using (user_id = auth.uid() or public.ben_admin_miyim())
  with check (user_id = auth.uid() or public.ben_admin_miyim());

drop policy if exists "Banner audit admin" on public.banner_audit_log;
create policy "Banner audit admin"
  on public.banner_audit_log for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

grant select on public.banner_campaigns to authenticated;
grant select, insert, update, delete on public.banner_campaigns to authenticated;
grant select, insert, update, delete on public.banner_media to authenticated;
grant select, insert, update, delete on public.banner_placements to authenticated;
grant select, insert, update, delete on public.banner_targets to authenticated;
grant select, insert, update, delete on public.banner_actions to authenticated;
grant select, insert on public.banner_impressions to authenticated;
grant select, insert on public.banner_clicks to authenticated;
grant select, insert on public.banner_events to authenticated;
grant select, insert, update, delete on public.banner_user_state to authenticated;
grant select, insert on public.banner_audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- Client: aktif bannerları placement ile getir (eligibility client + RPC soft filter)
-- ---------------------------------------------------------------------------
create or replace function public.banner_aktif_listele(p_placement text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  perform public.banner_status_otomatik_guncelle();

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.priority desc, x.created_at desc), '[]'::jsonb)
  into v
  from (
    select
      c.*,
      (
        select coalesce(jsonb_agg(to_jsonb(p) order by p.sort_order), '[]'::jsonb)
        from public.banner_placements p
        where p.banner_id = c.id
          and (p_placement is null or p.placement_key = p_placement)
      ) as placements,
      (
        select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
        from public.banner_targets t
        where t.banner_id = c.id
      ) as targets,
      (
        select coalesce(jsonb_agg(to_jsonb(a) order by a.slot), '[]'::jsonb)
        from public.banner_actions a
        where a.banner_id = c.id
      ) as actions
    from public.banner_campaigns c
    where c.status = 'ACTIVE'
      and (c.start_at is null or c.start_at <= now())
      and (c.end_at is null or c.end_at >= now())
      and (
        p_placement is null
        or exists (
          select 1 from public.banner_placements bp
          where bp.banner_id = c.id and bp.placement_key = p_placement
        )
      )
  ) x;

  return v;
end;
$$;

grant execute on function public.banner_aktif_listele(text) to authenticated;
grant execute on function public.banner_aktif_listele(text) to anon;

-- Track impression (visibility-gated on client; this persists)
create or replace function public.banner_impression_kaydet(
  p_banner_id uuid,
  p_session_id text,
  p_screen text default null,
  p_placement text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (timezone('utc', now()))::date;
  week_start date := date_trunc('week', timezone('utc', now()))::date;
  st public.banner_user_state%rowtype;
begin
  if p_banner_id is null then
    return jsonb_build_object('ok', false, 'error', 'banner_id required');
  end if;

  insert into public.banner_impressions (banner_id, user_id, session_id, screen, placement)
  values (p_banner_id, uid, p_session_id, p_screen, p_placement);

  insert into public.banner_events (banner_id, user_id, event_type, placement, screen)
  values (p_banner_id, uid, 'impression', p_placement, p_screen);

  if uid is not null then
    select * into st
    from public.banner_user_state
    where banner_id = p_banner_id and user_id = uid;

    if not found then
      insert into public.banner_user_state (
        banner_id, user_id, last_impression_at,
        impression_count_today, impression_count_week,
        impression_day, impression_week_start,
        session_impressions, last_session_id
      ) values (
        p_banner_id, uid, now(),
        1, 1, today, week_start,
        1, p_session_id
      );
    else
      update public.banner_user_state set
        last_impression_at = now(),
        impression_day = today,
        impression_week_start = week_start,
        impression_count_today = case
          when st.impression_day = today then st.impression_count_today + 1
          else 1
        end,
        impression_count_week = case
          when st.impression_week_start = week_start then st.impression_count_week + 1
          else 1
        end,
        session_impressions = case
          when st.last_session_id = p_session_id then st.session_impressions + 1
          else 1
        end,
        last_session_id = p_session_id,
        updated_at = now()
      where banner_id = p_banner_id and user_id = uid;
    end if;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.banner_impression_kaydet(uuid, text, text, text) to authenticated;
grant execute on function public.banner_impression_kaydet(uuid, text, text, text) to anon;

create or replace function public.banner_click_kaydet(
  p_banner_id uuid,
  p_action_type text default null,
  p_action_id uuid default null,
  p_placement text default null,
  p_screen text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  insert into public.banner_clicks (
    banner_id, user_id, action_type, action_id, placement, screen
  ) values (
    p_banner_id, uid, p_action_type, p_action_id, p_placement, p_screen
  );

  insert into public.banner_events (
    banner_id, user_id, event_type, placement, screen, meta
  ) values (
    p_banner_id, uid,
    case when p_action_type is null then 'click' else 'cta_click' end,
    p_placement, p_screen,
    jsonb_build_object('action_type', p_action_type, 'action_id', p_action_id)
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.banner_click_kaydet(uuid, text, uuid, text, text) to authenticated;
grant execute on function public.banner_click_kaydet(uuid, text, uuid, text, text) to anon;

create or replace function public.banner_event_kaydet(
  p_banner_id uuid,
  p_event_type text,
  p_placement text default null,
  p_screen text default null,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_type not in (
    'impression', 'view', 'click', 'cta_click', 'dismiss',
    'video_start', 'video_complete', 'webview_open', 'conversion'
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid event');
  end if;

  insert into public.banner_events (
    banner_id, user_id, event_type, placement, screen, meta
  ) values (
    p_banner_id, auth.uid(), p_event_type, p_placement, p_screen, coalesce(p_meta, '{}'::jsonb)
  );

  if p_event_type = 'dismiss' and auth.uid() is not null then
    insert into public.banner_user_state (banner_id, user_id, dismissed_at)
    values (p_banner_id, auth.uid(), now())
    on conflict (banner_id, user_id) do update
      set dismissed_at = now(), updated_at = now();
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.banner_event_kaydet(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.banner_event_kaydet(uuid, text, text, text, jsonb) to anon;

create or replace function public.banner_user_state_getir(p_banner_ids uuid[] default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v jsonb;
begin
  if uid is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
  into v
  from public.banner_user_state s
  where s.user_id = uid
    and (p_banner_ids is null or s.banner_id = any(p_banner_ids));

  return v;
end;
$$;

grant execute on function public.banner_user_state_getir(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin CRUD helpers
-- ---------------------------------------------------------------------------
create or replace function public.admin_banner_kaydet(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bid uuid;
  actor uuid := auth.uid();
  before_row jsonb;
  placements jsonb;
  targets jsonb;
  actions jsonb;
  i jsonb;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  bid := nullif(p_payload->>'id', '')::uuid;

  if bid is not null then
    select to_jsonb(c) into before_row from public.banner_campaigns c where c.id = bid;
  end if;

  if bid is null then
    insert into public.banner_campaigns (
      name, internal_name, title, subtitle, description, badge, label,
      media_type, media_url, thumbnail_url, media_alt, gradient_json,
      size_type, aspect_ratio, priority, status,
      start_at, end_at, daily_start_time, daily_end_time,
      dismissible, frequency_type, max_daily_impressions,
      max_weekly_impressions, max_session_impressions,
      shimmer_enabled, autoplay_video, loop_video, carousel_auto_slide_ms,
      tags, created_by
    ) values (
      coalesce(p_payload->>'name', 'Untitled'),
      p_payload->>'internal_name',
      p_payload->>'title',
      p_payload->>'subtitle',
      p_payload->>'description',
      p_payload->>'badge',
      p_payload->>'label',
      coalesce(p_payload->>'media_type', 'IMAGE'),
      p_payload->>'media_url',
      p_payload->>'thumbnail_url',
      p_payload->>'media_alt',
      coalesce(p_payload->'gradient_json', null),
      coalesce(p_payload->>'size_type', 'MEDIUM'),
      coalesce(p_payload->>'aspect_ratio', '16:6'),
      coalesce((p_payload->>'priority')::int, 50),
      coalesce(p_payload->>'status', 'DRAFT'),
      nullif(p_payload->>'start_at', '')::timestamptz,
      nullif(p_payload->>'end_at', '')::timestamptz,
      nullif(p_payload->>'daily_start_time', '')::time,
      nullif(p_payload->>'daily_end_time', '')::time,
      coalesce((p_payload->>'dismissible')::boolean, false),
      coalesce(p_payload->>'frequency_type', 'unlimited'),
      nullif(p_payload->>'max_daily_impressions', '')::int,
      nullif(p_payload->>'max_weekly_impressions', '')::int,
      nullif(p_payload->>'max_session_impressions', '')::int,
      coalesce((p_payload->>'shimmer_enabled')::boolean, false),
      coalesce((p_payload->>'autoplay_video')::boolean, true),
      coalesce((p_payload->>'loop_video')::boolean, true),
      nullif(p_payload->>'carousel_auto_slide_ms', '')::int,
      coalesce(
        (select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'tags', '[]'::jsonb)) t(x)),
        '{}'::text[]
      ),
      actor
    )
    returning id into bid;
  else
    update public.banner_campaigns set
      name = coalesce(p_payload->>'name', name),
      internal_name = coalesce(p_payload->>'internal_name', internal_name),
      title = coalesce(p_payload->>'title', title),
      subtitle = coalesce(p_payload->>'subtitle', subtitle),
      description = coalesce(p_payload->>'description', description),
      badge = coalesce(p_payload->>'badge', badge),
      label = coalesce(p_payload->>'label', label),
      media_type = coalesce(p_payload->>'media_type', media_type),
      media_url = coalesce(p_payload->>'media_url', media_url),
      thumbnail_url = coalesce(p_payload->>'thumbnail_url', thumbnail_url),
      media_alt = coalesce(p_payload->>'media_alt', media_alt),
      gradient_json = case when p_payload ? 'gradient_json' then p_payload->'gradient_json' else gradient_json end,
      size_type = coalesce(p_payload->>'size_type', size_type),
      aspect_ratio = coalesce(p_payload->>'aspect_ratio', aspect_ratio),
      priority = coalesce((p_payload->>'priority')::int, priority),
      status = coalesce(p_payload->>'status', status),
      start_at = case when p_payload ? 'start_at' then nullif(p_payload->>'start_at', '')::timestamptz else start_at end,
      end_at = case when p_payload ? 'end_at' then nullif(p_payload->>'end_at', '')::timestamptz else end_at end,
      daily_start_time = case when p_payload ? 'daily_start_time' then nullif(p_payload->>'daily_start_time', '')::time else daily_start_time end,
      daily_end_time = case when p_payload ? 'daily_end_time' then nullif(p_payload->>'daily_end_time', '')::time else daily_end_time end,
      dismissible = coalesce((p_payload->>'dismissible')::boolean, dismissible),
      frequency_type = coalesce(p_payload->>'frequency_type', frequency_type),
      max_daily_impressions = case when p_payload ? 'max_daily_impressions' then nullif(p_payload->>'max_daily_impressions', '')::int else max_daily_impressions end,
      max_weekly_impressions = case when p_payload ? 'max_weekly_impressions' then nullif(p_payload->>'max_weekly_impressions', '')::int else max_weekly_impressions end,
      max_session_impressions = case when p_payload ? 'max_session_impressions' then nullif(p_payload->>'max_session_impressions', '')::int else max_session_impressions end,
      shimmer_enabled = coalesce((p_payload->>'shimmer_enabled')::boolean, shimmer_enabled),
      autoplay_video = coalesce((p_payload->>'autoplay_video')::boolean, autoplay_video),
      loop_video = coalesce((p_payload->>'loop_video')::boolean, loop_video),
      carousel_auto_slide_ms = case when p_payload ? 'carousel_auto_slide_ms' then nullif(p_payload->>'carousel_auto_slide_ms', '')::int else carousel_auto_slide_ms end,
      tags = case
        when p_payload ? 'tags' then coalesce(
          (select array_agg(x) from jsonb_array_elements_text(coalesce(p_payload->'tags', '[]'::jsonb)) t(x)),
          '{}'::text[]
        )
        else tags
      end
    where id = bid;
  end if;

  -- placements replace
  if p_payload ? 'placements' then
    delete from public.banner_placements where banner_id = bid;
    placements := coalesce(p_payload->'placements', '[]'::jsonb);
    for i in select * from jsonb_array_elements(placements)
    loop
      insert into public.banner_placements (banner_id, screen_key, placement_key, sort_order)
      values (
        bid,
        coalesce(i->>'screen_key', 'HOME'),
        coalesce(i->>'placement_key', 'HOME_TOP'),
        coalesce((i->>'sort_order')::int, 0)
      );
    end loop;
  end if;

  if p_payload ? 'targets' then
    delete from public.banner_targets where banner_id = bid;
    targets := coalesce(p_payload->'targets', '[]'::jsonb);
    for i in select * from jsonb_array_elements(targets)
    loop
      insert into public.banner_targets (
        banner_id, target_mode, country, country_code, region, region_id, city,
        platform, language, user_segment, custom_segment,
        min_level, max_level, min_account_age_days, max_account_age_days
      ) values (
        bid,
        coalesce(i->>'target_mode', 'ALL'),
        i->>'country',
        i->>'country_code',
        i->>'region',
        i->>'region_id',
        i->>'city',
        coalesce(i->>'platform', 'ALL'),
        i->>'language',
        coalesce(i->>'user_segment', 'ALL_USERS'),
        i->>'custom_segment',
        nullif(i->>'min_level', '')::int,
        nullif(i->>'max_level', '')::int,
        nullif(i->>'min_account_age_days', '')::int,
        nullif(i->>'max_account_age_days', '')::int
      );
    end loop;
  end if;

  if p_payload ? 'actions' then
    delete from public.banner_actions where banner_id = bid;
    actions := coalesce(p_payload->'actions', '[]'::jsonb);
    for i in select * from jsonb_array_elements(actions)
    loop
      insert into public.banner_actions (
        banner_id, slot, action_type, button_text, icon, target, url, payload_json
      ) values (
        bid,
        coalesce((i->>'slot')::int, 0),
        coalesce(i->>'action_type', 'NONE'),
        i->>'button_text',
        i->>'icon',
        i->>'target',
        i->>'url',
        coalesce(i->'payload_json', '{}'::jsonb)
      );
    end loop;
  end if;

  insert into public.banner_audit_log (banner_id, actor_id, action, before_json, after_json)
  values (
    bid, actor,
    case when before_row is null then 'create' else 'update' end,
    before_row,
    p_payload
  );

  return jsonb_build_object('ok', true, 'id', bid);
end;
$$;

grant execute on function public.admin_banner_kaydet(jsonb) to authenticated;

create or replace function public.admin_banner_durum_degistir(
  p_banner_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  before_status text;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  if p_status not in ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED') then
    raise exception 'Invalid status';
  end if;

  select status into before_status from public.banner_campaigns where id = p_banner_id;
  if before_status is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  update public.banner_campaigns set status = p_status where id = p_banner_id;

  insert into public.banner_audit_log (banner_id, actor_id, action, before_json, after_json)
  values (
    p_banner_id, auth.uid(), 'status_change',
    jsonb_build_object('status', before_status),
    jsonb_build_object('status', p_status)
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.admin_banner_durum_degistir(uuid, text) to authenticated;

create or replace function public.admin_banner_kopyala(p_banner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  src public.banner_campaigns%rowtype;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  select * into src from public.banner_campaigns where id = p_banner_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  insert into public.banner_campaigns (
    name, internal_name, title, subtitle, description, badge, label,
    media_type, media_url, thumbnail_url, media_alt, gradient_json,
    size_type, aspect_ratio, priority, status,
    start_at, end_at, daily_start_time, daily_end_time,
    dismissible, frequency_type, max_daily_impressions,
    max_weekly_impressions, max_session_impressions,
    shimmer_enabled, autoplay_video, loop_video, carousel_auto_slide_ms,
    tags, created_by
  ) values (
    src.name || ' (kopya)', src.internal_name, src.title, src.subtitle, src.description,
    src.badge, src.label, src.media_type, src.media_url, src.thumbnail_url, src.media_alt,
    src.gradient_json, src.size_type, src.aspect_ratio, src.priority, 'DRAFT',
    src.start_at, src.end_at, src.daily_start_time, src.daily_end_time,
    src.dismissible, src.frequency_type, src.max_daily_impressions,
    src.max_weekly_impressions, src.max_session_impressions,
    src.shimmer_enabled, src.autoplay_video, src.loop_video, src.carousel_auto_slide_ms,
    src.tags, auth.uid()
  )
  returning id into new_id;

  insert into public.banner_placements (banner_id, screen_key, placement_key, sort_order)
  select new_id, screen_key, placement_key, sort_order
  from public.banner_placements where banner_id = p_banner_id;

  insert into public.banner_targets (
    banner_id, target_mode, country, country_code, region, region_id, city,
    platform, language, user_segment, custom_segment,
    min_level, max_level, min_account_age_days, max_account_age_days
  )
  select new_id, target_mode, country, country_code, region, region_id, city,
    platform, language, user_segment, custom_segment,
    min_level, max_level, min_account_age_days, max_account_age_days
  from public.banner_targets where banner_id = p_banner_id;

  insert into public.banner_actions (
    banner_id, slot, action_type, button_text, icon, target, url, payload_json
  )
  select new_id, slot, action_type, button_text, icon, target, url, payload_json
  from public.banner_actions where banner_id = p_banner_id;

  insert into public.banner_audit_log (banner_id, actor_id, action, after_json)
  values (new_id, auth.uid(), 'duplicate', jsonb_build_object('from', p_banner_id));

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

grant execute on function public.admin_banner_kopyala(uuid) to authenticated;

create or replace function public.admin_banner_analitik(p_banner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  select jsonb_build_object(
    'impressions', (select count(*) from public.banner_impressions where banner_id = p_banner_id),
    'unique_viewers', (select count(distinct user_id) from public.banner_impressions where banner_id = p_banner_id and user_id is not null),
    'clicks', (select count(*) from public.banner_clicks where banner_id = p_banner_id),
    'unique_clicks', (select count(distinct user_id) from public.banner_clicks where banner_id = p_banner_id and user_id is not null),
    'ctr', case
      when (select count(*) from public.banner_impressions where banner_id = p_banner_id) = 0 then 0
      else round(
        (select count(*)::numeric from public.banner_clicks where banner_id = p_banner_id)
        / (select count(*)::numeric from public.banner_impressions where banner_id = p_banner_id)
        * 100, 2
      )
    end,
    'dismiss_count', (select count(*) from public.banner_events where banner_id = p_banner_id and event_type = 'dismiss'),
    'video_views', (select count(*) from public.banner_events where banner_id = p_banner_id and event_type = 'video_start'),
    'video_completion', (select count(*) from public.banner_events where banner_id = p_banner_id and event_type = 'video_complete'),
    'webview_open', (select count(*) from public.banner_events where banner_id = p_banner_id and event_type = 'webview_open'),
    'cta_breakdown', (
      select coalesce(jsonb_object_agg(coalesce(action_type, 'unknown'), cnt), '{}'::jsonb)
      from (
        select action_type, count(*) as cnt
        from public.banner_clicks
        where banner_id = p_banner_id
        group by action_type
      ) t
    )
  ) into v;

  return v;
end;
$$;

grant execute on function public.admin_banner_analitik(uuid) to authenticated;

create or replace function public.admin_banner_listele()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  perform public.banner_status_otomatik_guncelle();

  select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x.updated_at desc), '[]'::jsonb)
  into v
  from (
    select
      c.*,
      (
        select coalesce(jsonb_agg(to_jsonb(p) order by p.sort_order), '[]'::jsonb)
        from public.banner_placements p where p.banner_id = c.id
      ) as placements,
      (
        select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
        from public.banner_targets t where t.banner_id = c.id
      ) as targets,
      (
        select coalesce(jsonb_agg(to_jsonb(a) order by a.slot), '[]'::jsonb)
        from public.banner_actions a where a.banner_id = c.id
      ) as actions,
      (select count(*) from public.banner_impressions i where i.banner_id = c.id) as impression_count,
      (select count(*) from public.banner_clicks k where k.banner_id = c.id) as click_count
    from public.banner_campaigns c
    where c.status <> 'ARCHIVED' or true
  ) x;

  return v;
end;
$$;

grant execute on function public.admin_banner_listele() to authenticated;

-- Realtime for status changes
do $$
begin
  begin
    alter publication supabase_realtime add table public.banner_campaigns;
  exception when duplicate_object then
    null;
  end;
end $$;
