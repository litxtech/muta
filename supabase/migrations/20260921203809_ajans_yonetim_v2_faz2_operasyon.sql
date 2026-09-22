-- Ajans Yönetim V2 Faz2: Ekipler, program, etkinlik, duyuru, görev/hedef, ajans odası

-- ---------------------------------------------------------------------------
-- Teams
-- ---------------------------------------------------------------------------
create table if not exists public.agency_teams (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  color text not null default '#7C5CFF',
  icon text not null default 'people',
  manager_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_teams_name_len check (char_length(name) between 1 and 60)
);

create table if not exists public.agency_team_members (
  team_id uuid not null references public.agency_teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists agency_teams_agency_idx on public.agency_teams (agency_id);

-- ---------------------------------------------------------------------------
-- Schedule + availability
-- ---------------------------------------------------------------------------
create table if not exists public.agency_schedules (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  host_id uuid references public.profiles(id) on delete set null,
  title text not null,
  kind text not null default 'live'
    check (kind in ('live','room','meeting')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  note text,
  status text not null default 'scheduled'
    check (status in ('scheduled','started','ended','cancelled','missed')),
  room_id uuid references public.rooms(id) on delete set null,
  live_session_id uuid references public.live_sessions(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists agency_schedules_agency_idx
  on public.agency_schedules (agency_id, starts_at);

create table if not exists public.agency_host_availability (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_minute int not null check (start_minute between 0 and 1439),
  end_minute int not null check (end_minute between 1 and 1440),
  is_available boolean not null default true,
  unique (agency_id, user_id, weekday, start_minute, end_minute)
);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create table if not exists public.agency_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  title text not null,
  description text not null default '',
  cover_url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  kind text not null default 'room' check (kind in ('live','room','other')),
  status text not null default 'DRAFT'
    check (status in ('DRAFT','SCHEDULED','LIVE','ENDED','CANCELLED')),
  room_id uuid references public.rooms(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agency_event_participants (
  event_id uuid not null references public.agency_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited'
    check (status in ('invited','accepted','declined','attended')),
  primary key (event_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------
create table if not exists public.agency_announcements (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  title text not null,
  body text not null,
  image_url text,
  audience text not null default 'all'
    check (audience in ('all','team','role','users')),
  team_id uuid references public.agency_teams(id) on delete set null,
  role_code text,
  user_ids uuid[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  push_sent boolean not null default false,
  created_at timestamptz not null default now(),
  constraint agency_announcements_body_len check (char_length(body) <= 4000)
);

create table if not exists public.agency_announcement_reads (
  announcement_id uuid not null references public.agency_announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create table if not exists public.agency_push_rate_limits (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  day date not null default (timezone('utc', now()))::date,
  push_count int not null default 0,
  primary key (agency_id, day)
);

-- ---------------------------------------------------------------------------
-- Tasks + goals
-- ---------------------------------------------------------------------------
create table if not exists public.agency_tasks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  title text not null,
  description text not null default '',
  assigned_to uuid references public.profiles(id) on delete set null,
  team_id uuid references public.agency_teams(id) on delete set null,
  start_at timestamptz,
  due_at timestamptz,
  status text not null default 'open'
    check (status in ('open','in_progress','done','cancelled')),
  verification_type text not null default 'manual'
    check (verification_type in ('manual','live_count','room_hours','profile_complete')),
  verification_target numeric(12,2) default 0,
  progress numeric(12,2) not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agency_goals (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  title text not null,
  metric text not null
    check (metric in ('live_hours','room_hours','active_hosts','custom')),
  target_value numeric(12,2) not null,
  current_value numeric(12,2) not null default 0,
  period text not null default 'monthly'
    check (period in ('weekly','monthly','custom')),
  host_id uuid references public.profiles(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Agency-only rooms (additive on rooms)
-- ---------------------------------------------------------------------------
alter table public.rooms
  add column if not exists agency_id uuid references public.agencies(id) on delete set null,
  add column if not exists access_mode text not null default 'public'
    check (access_mode in ('public','agency_members_only','password'));

create index if not exists rooms_agency_idx on public.rooms (agency_id)
  where agency_id is not null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.agency_teams enable row level security;
alter table public.agency_team_members enable row level security;
alter table public.agency_schedules enable row level security;
alter table public.agency_host_availability enable row level security;
alter table public.agency_events enable row level security;
alter table public.agency_event_participants enable row level security;
alter table public.agency_announcements enable row level security;
alter table public.agency_announcement_reads enable row level security;
alter table public.agency_tasks enable row level security;
alter table public.agency_goals enable row level security;

drop policy if exists "agency_teams_select" on public.agency_teams;
create policy "agency_teams_select" on public.agency_teams for select to authenticated
  using (
    public.agency_has_permission(agency_id, 'agency.manage_teams')
    or exists (
      select 1 from public.host_profiles hp
      where hp.agency_id = agency_teams.agency_id and hp.user_id = auth.uid() and hp.status = 'agency'
    )
  );

drop policy if exists "agency_schedules_select" on public.agency_schedules;
create policy "agency_schedules_select" on public.agency_schedules for select to authenticated
  using (
    host_id = auth.uid()
    or public.agency_has_permission(agency_id, 'agency.manage_schedule')
  );

drop policy if exists "agency_events_select" on public.agency_events;
create policy "agency_events_select" on public.agency_events for select to authenticated
  using (
    public.agency_has_permission(agency_id, 'agency.manage_events')
    or exists (
      select 1 from public.host_profiles hp
      where hp.agency_id = agency_events.agency_id and hp.user_id = auth.uid() and hp.status = 'agency'
    )
  );

drop policy if exists "agency_announcements_select" on public.agency_announcements;
create policy "agency_announcements_select" on public.agency_announcements for select to authenticated
  using (
    public.agency_has_permission(agency_id, 'agency.manage_announcements')
    or exists (
      select 1 from public.host_profiles hp
      where hp.agency_id = agency_announcements.agency_id and hp.user_id = auth.uid() and hp.status = 'agency'
    )
  );

drop policy if exists "agency_tasks_select" on public.agency_tasks;
create policy "agency_tasks_select" on public.agency_tasks for select to authenticated
  using (
    assigned_to = auth.uid()
    or public.agency_has_permission(agency_id, 'agency.manage_tasks')
  );

drop policy if exists "agency_goals_select" on public.agency_goals;
create policy "agency_goals_select" on public.agency_goals for select to authenticated
  using (
    public.agency_has_permission(agency_id, 'agency.view_analytics')
    or exists (
      select 1 from public.host_profiles hp
      where hp.agency_id = agency_goals.agency_id and hp.user_id = auth.uid() and hp.status = 'agency'
    )
  );

grant select on public.agency_teams to authenticated;
grant select on public.agency_schedules to authenticated;
grant select on public.agency_events to authenticated;
grant select on public.agency_announcements to authenticated;
grant select on public.agency_tasks to authenticated;
grant select on public.agency_goals to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.ajans_ekip_olustur(
  p_agency_id uuid,
  p_name text,
  p_color text default '#7C5CFF',
  p_icon text default 'people',
  p_manager_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_teams');
  if v_name = '' then raise exception 'Ekip adı zorunlu'; end if;

  insert into public.agency_teams (agency_id, name, color, icon, manager_id, created_by)
  values (p_agency_id, left(v_name, 60), coalesce(nullif(p_color,''), '#7C5CFF'),
          coalesce(nullif(p_icon,''), 'people'), p_manager_id, auth.uid())
  returning id into v_id;

  perform public.agency_audit_yaz(p_agency_id, 'team_create', 'Ekip oluşturuldu: ' || v_name, null,
    jsonb_build_object('team_id', v_id));
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.ajans_ekip_olustur(uuid, text, text, text, uuid) to authenticated;

create or replace function public.ajans_ekip_uye_ekle(
  p_team_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select agency_id into v_agency from public.agency_teams where id = p_team_id;
  if not found then raise exception 'Ekip yok'; end if;
  perform public.agency_require_permission(v_agency, 'agency.manage_teams');

  if not exists (
    select 1 from public.host_profiles
    where agency_id = v_agency and user_id = p_user_id and status = 'agency'
  ) then raise exception 'Üye ajansa kayıtlı değil'; end if;

  insert into public.agency_team_members (team_id, user_id)
  values (p_team_id, p_user_id)
  on conflict do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.ajans_ekip_uye_ekle(uuid, uuid) to authenticated;

create or replace function public.ajans_ekip_listesi(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.agency_has_permission(p_agency_id, 'agency.manage_teams')
     and not exists (
       select 1 from public.host_profiles
       where agency_id = p_agency_id and user_id = auth.uid() and status = 'agency'
     ) then
    raise exception 'Forbidden';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'color', t.color,
      'icon', t.icon,
      'manager_id', t.manager_id,
      'uye_sayisi', (
        select count(*)::int from public.agency_team_members m where m.team_id = t.id
      )
    ) order by t.name)
    from public.agency_teams t where t.agency_id = p_agency_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.ajans_ekip_listesi(uuid) to authenticated;

create or replace function public.ajans_program_olustur(
  p_agency_id uuid,
  p_title text,
  p_kind text,
  p_starts_at timestamptz,
  p_ends_at timestamptz default null,
  p_host_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_schedule');

  insert into public.agency_schedules (
    agency_id, host_id, title, kind, starts_at, ends_at, note, created_by
  ) values (
    p_agency_id, p_host_id, left(trim(p_title), 120),
    coalesce(nullif(p_kind,''), 'live'), p_starts_at, p_ends_at,
    left(coalesce(p_note,''), 500), auth.uid()
  ) returning id into v_id;

  perform public.agency_audit_yaz(p_agency_id, 'schedule_create', 'Program oluşturuldu', p_host_id,
    jsonb_build_object('schedule_id', v_id));
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.ajans_program_olustur(uuid, text, text, timestamptz, timestamptz, uuid, text) to authenticated;

create or replace function public.ajans_program_listesi(
  p_agency_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_schedule');

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'kind', s.kind,
      'starts_at', s.starts_at,
      'ends_at', s.ends_at,
      'status', s.status,
      'host_id', s.host_id,
      'note', s.note,
      'host_name', coalesce(p.display_name, p.username)
    ) order by s.starts_at)
    from public.agency_schedules s
    left join public.profiles p on p.id = s.host_id
    where s.agency_id = p_agency_id
      and (p_from is null or s.starts_at >= p_from)
      and (p_to is null or s.starts_at <= p_to)
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.ajans_program_listesi(uuid, timestamptz, timestamptz) to authenticated;

create or replace function public.ajans_etkinlik_olustur(
  p_agency_id uuid,
  p_title text,
  p_description text default '',
  p_starts_at timestamptz default now(),
  p_ends_at timestamptz default null,
  p_kind text default 'room',
  p_status text default 'DRAFT',
  p_cover_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_events');

  insert into public.agency_events (
    agency_id, title, description, cover_url, starts_at, ends_at, kind, status, created_by
  ) values (
    p_agency_id, left(trim(p_title), 120), left(coalesce(p_description,''), 4000),
    p_cover_url, p_starts_at, p_ends_at,
    coalesce(nullif(p_kind,''), 'room'),
    coalesce(nullif(p_status,''), 'DRAFT'),
    auth.uid()
  ) returning id into v_id;

  perform public.agency_audit_yaz(p_agency_id, 'event_create', 'Etkinlik oluşturuldu', null,
    jsonb_build_object('event_id', v_id));
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.ajans_etkinlik_olustur(uuid, text, text, timestamptz, timestamptz, text, text, text) to authenticated;

create or replace function public.ajans_etkinlik_listesi(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not (
    public.agency_has_permission(p_agency_id, 'agency.manage_events')
    or exists (select 1 from public.host_profiles where agency_id = p_agency_id and user_id = auth.uid() and status = 'agency')
  ) then raise exception 'Forbidden'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id,
      'title', e.title,
      'description', e.description,
      'cover_url', e.cover_url,
      'starts_at', e.starts_at,
      'ends_at', e.ends_at,
      'kind', e.kind,
      'status', e.status
    ) order by e.starts_at desc)
    from public.agency_events e where e.agency_id = p_agency_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.ajans_etkinlik_listesi(uuid) to authenticated;

create or replace function public.ajans_duyuru_olustur(
  p_agency_id uuid,
  p_title text,
  p_body text,
  p_audience text default 'all',
  p_team_id uuid default null,
  p_role_code text default null,
  p_user_ids uuid[] default '{}',
  p_send_push boolean default false,
  p_image_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_day date := (timezone('utc', now()))::date;
  v_count int;
  v_targets uuid[];
  v_uid uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_announcements');

  insert into public.agency_announcements (
    agency_id, title, body, image_url, audience, team_id, role_code, user_ids, created_by, push_sent
  ) values (
    p_agency_id, left(trim(p_title), 120), left(trim(p_body), 4000), p_image_url,
    coalesce(nullif(p_audience,''), 'all'), p_team_id, p_role_code,
    coalesce(p_user_ids, '{}'), auth.uid(), false
  ) returning id into v_id;

  if p_send_push then
    insert into public.agency_push_rate_limits (agency_id, day, push_count)
    values (p_agency_id, v_day, 0)
    on conflict do nothing;

    select push_count into v_count
    from public.agency_push_rate_limits
    where agency_id = p_agency_id and day = v_day
    for update;

    if coalesce(v_count, 0) >= 10 then
      raise exception 'Günlük push limiti aşıldı (10)';
    end if;

    -- Hedef kullanıcılar
    if p_audience = 'users' then
      v_targets := coalesce(p_user_ids, '{}');
    elsif p_audience = 'team' and p_team_id is not null then
      select coalesce(array_agg(m.user_id), '{}') into v_targets
      from public.agency_team_members m where m.team_id = p_team_id;
    elsif p_audience = 'role' and p_role_code is not null then
      select coalesce(array_agg(s.user_id), '{}') into v_targets
      from public.agency_staff_roles s
      where s.agency_id = p_agency_id and s.role_code = p_role_code;
    else
      select coalesce(array_agg(hp.user_id), '{}') into v_targets
      from public.host_profiles hp
      where hp.agency_id = p_agency_id and hp.status = 'agency';
    end if;

    foreach v_uid in array v_targets loop
      perform public.bildirim_kuyruga_ekle(
        v_uid,
        'agency_announcement',
        left(trim(p_title), 80),
        left(trim(p_body), 160),
        '/ajans/' || p_agency_id::text || '/duyurular',
        jsonb_build_object('agency_id', p_agency_id, 'announcement_id', v_id)
      );
    end loop;

    update public.agency_push_rate_limits
    set push_count = push_count + 1
    where agency_id = p_agency_id and day = v_day;

    update public.agency_announcements set push_sent = true where id = v_id;
  end if;

  perform public.agency_audit_yaz(p_agency_id, 'announcement_create', 'Duyuru oluşturuldu', null,
    jsonb_build_object('announcement_id', v_id, 'push', p_send_push));
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.ajans_duyuru_olustur(uuid, text, text, text, uuid, text, uuid[], boolean, text) to authenticated;

create or replace function public.ajans_duyuru_listesi(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not (
    public.agency_has_permission(p_agency_id, 'agency.manage_announcements')
    or exists (select 1 from public.host_profiles where agency_id = p_agency_id and user_id = auth.uid() and status = 'agency')
  ) then raise exception 'Forbidden'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'title', a.title,
      'body', a.body,
      'image_url', a.image_url,
      'audience', a.audience,
      'created_at', a.created_at,
      'push_sent', a.push_sent,
      'okundu', exists (
        select 1 from public.agency_announcement_reads r
        where r.announcement_id = a.id and r.user_id = auth.uid()
      )
    ) order by a.created_at desc)
    from public.agency_announcements a where a.agency_id = p_agency_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.ajans_duyuru_listesi(uuid) to authenticated;

create or replace function public.ajans_gorev_olustur(
  p_agency_id uuid,
  p_title text,
  p_description text default '',
  p_assigned_to uuid default null,
  p_team_id uuid default null,
  p_due_at timestamptz default null,
  p_verification_type text default 'manual',
  p_verification_target numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_tasks');

  insert into public.agency_tasks (
    agency_id, title, description, assigned_to, team_id, due_at,
    verification_type, verification_target, created_by
  ) values (
    p_agency_id, left(trim(p_title), 120), left(coalesce(p_description,''), 2000),
    p_assigned_to, p_team_id, p_due_at,
    coalesce(nullif(p_verification_type,''), 'manual'),
    coalesce(p_verification_target, 0), auth.uid()
  ) returning id into v_id;

  perform public.agency_audit_yaz(p_agency_id, 'task_create', 'Görev oluşturuldu', p_assigned_to,
    jsonb_build_object('task_id', v_id));
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.ajans_gorev_olustur(uuid, text, text, uuid, uuid, timestamptz, text, numeric) to authenticated;

create or replace function public.ajans_gorev_listesi(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not (
    public.agency_has_permission(p_agency_id, 'agency.manage_tasks')
    or exists (select 1 from public.host_profiles where agency_id = p_agency_id and user_id = auth.uid() and status = 'agency')
  ) then raise exception 'Forbidden'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id,
      'title', t.title,
      'description', t.description,
      'assigned_to', t.assigned_to,
      'team_id', t.team_id,
      'due_at', t.due_at,
      'status', t.status,
      'verification_type', t.verification_type,
      'verification_target', t.verification_target,
      'progress', t.progress
    ) order by t.created_at desc)
    from public.agency_tasks t where t.agency_id = p_agency_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.ajans_gorev_listesi(uuid) to authenticated;

create or replace function public.ajans_hedef_olustur(
  p_agency_id uuid,
  p_title text,
  p_metric text,
  p_target_value numeric,
  p_period text default 'monthly',
  p_host_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_current numeric := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_tasks');

  if p_metric = 'live_hours' then
    select coalesce(sum(extract(epoch from (
      coalesce(ls.ended_at, case when ls.is_live then now() else ls.started_at end) - ls.started_at
    )) / 3600.0), 0) into v_current
    from public.live_sessions ls
    join public.host_profiles hp on hp.user_id = ls.host_id
    where hp.agency_id = p_agency_id and hp.status = 'agency'
      and (p_host_id is null or ls.host_id = p_host_id)
      and ls.started_at >= date_trunc('month', now());
  elsif p_metric = 'room_hours' then
    select coalesce(sum(extract(epoch from (
      coalesce(r.ended_at, case when r.is_live then now() else r.created_at end) - r.created_at
    )) / 3600.0), 0) into v_current
    from public.rooms r
    join public.host_profiles hp on hp.user_id = r.host_id
    where hp.agency_id = p_agency_id and hp.status = 'agency'
      and (p_host_id is null or r.host_id = p_host_id)
      and r.created_at >= date_trunc('month', now());
  elsif p_metric = 'active_hosts' then
    select count(*)::numeric into v_current
    from public.host_profiles hp
    where hp.agency_id = p_agency_id and hp.status = 'agency';
  end if;

  insert into public.agency_goals (
    agency_id, title, metric, target_value, current_value, period, host_id,
    starts_at, ends_at
  ) values (
    p_agency_id, left(trim(p_title), 120), p_metric, p_target_value, v_current,
    coalesce(nullif(p_period,''), 'monthly'), p_host_id,
    date_trunc('month', now()), date_trunc('month', now()) + interval '1 month'
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'current_value', v_current);
end;
$$;

grant execute on function public.ajans_hedef_olustur(uuid, text, text, numeric, text, uuid) to authenticated;

create or replace function public.ajans_hedef_listesi(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.view_analytics');

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id,
      'title', g.title,
      'metric', g.metric,
      'target_value', g.target_value,
      'current_value', g.current_value,
      'period', g.period,
      'host_id', g.host_id,
      'progress_pct', case
        when g.target_value <= 0 then 0
        else least(100, round((g.current_value / g.target_value) * 100.0, 1))
      end
    ) order by g.created_at desc)
    from public.agency_goals g
    where g.agency_id = p_agency_id and g.is_active
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.ajans_hedef_listesi(uuid) to authenticated;

-- Ajans üyelerine özel oda
create or replace function public.ajans_ozel_oda_kur(
  p_agency_id uuid,
  p_title text,
  p_host_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
  v_room uuid;
  v_title text := left(trim(coalesce(p_title, '')), 80);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_rooms');

  v_host := coalesce(p_host_id, v_uid);
  if not exists (
    select 1 from public.host_profiles
    where agency_id = p_agency_id and user_id = v_host and status = 'agency'
  ) and not exists (
    select 1 from public.agencies where id = p_agency_id and owner_id = v_host
  ) then
    raise exception 'Host ajans üyesi değil';
  end if;

  if v_title = '' then v_title := 'Ajans Odası'; end if;

  insert into public.rooms (host_id, title, mode, is_live, agency_id, access_mode)
  values (v_host, v_title, 'party', true, p_agency_id, 'agency_members_only')
  returning id into v_room;

  insert into public.room_members (room_id, user_id, role)
  values (v_room, v_host, 'host')
  on conflict do nothing;

  perform public.agency_audit_yaz(p_agency_id, 'agency_room_create', 'Özel ajans odası', v_host,
    jsonb_build_object('room_id', v_room));

  return jsonb_build_object('ok', true, 'room_id', v_room);
end;
$$;

grant execute on function public.ajans_ozel_oda_kur(uuid, text, uuid) to authenticated;

-- Odaya girişte agency_members_only kontrolü için helper
create or replace function public.oda_ajans_erisim_ok(p_room_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_agency uuid;
begin
  select access_mode, agency_id into v_mode, v_agency
  from public.rooms where id = p_room_id;
  if not found then return false; end if;
  if coalesce(v_mode, 'public') <> 'agency_members_only' then return true; end if;
  if v_agency is null then return false; end if;
  if public.ben_admin_miyim() then return true; end if;
  if exists (select 1 from public.agencies a where a.id = v_agency and a.owner_id = auth.uid()) then
    return true;
  end if;
  return exists (
    select 1 from public.host_profiles hp
    where hp.agency_id = v_agency and hp.user_id = auth.uid() and hp.status = 'agency'
  );
end;
$$;
