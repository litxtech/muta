-- Ajans Yönetim V2 Faz4: Destek, güvenlik, mesaj kanalları, manager permission listesi

-- ---------------------------------------------------------------------------
-- Support tickets (ajans içi; platform support_sessions'tan ayrı)
-- ---------------------------------------------------------------------------
create table if not exists public.agency_support_tickets (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  body text not null,
  status text not null default 'open'
    check (status in ('open','in_progress','resolved','closed')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_support_subject_len check (char_length(subject) between 1 and 120),
  constraint agency_support_body_len check (char_length(body) between 1 and 4000)
);

create table if not exists public.agency_support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.agency_support_tickets(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint agency_support_msg_len check (char_length(body) between 1 and 2000)
);

-- ---------------------------------------------------------------------------
-- Security events
-- ---------------------------------------------------------------------------
create table if not exists public.agency_security_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  title text not null,
  body text not null default '',
  severity text not null default 'medium'
    check (severity in ('low','medium','high','critical')),
  event_type text not null default 'general',
  acked boolean not null default false,
  acked_by uuid references public.profiles(id) on delete set null,
  acked_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agency_security_events_agency_idx
  on public.agency_security_events (agency_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Agency channels (mevcut message_threads genişletme)
-- ---------------------------------------------------------------------------
alter table public.message_threads
  add column if not exists agency_channel_kind text;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'message_threads_thread_kind_check'
  ) then
    alter table public.message_threads drop constraint message_threads_thread_kind_check;
  end if;
  alter table public.message_threads
    add constraint message_threads_thread_kind_check
    check (thread_kind in ('dm', 'mahkeme', 'agency_channel'));
exception when others then
  null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'message_threads_agency_channel_kind_check'
  ) then
    alter table public.message_threads
      add constraint message_threads_agency_channel_kind_check
      check (
        agency_channel_kind is null
        or agency_channel_kind in ('general','announcements','hosts','managers')
      );
  end if;
end $$;

create table if not exists public.agency_channels (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  channel_kind text not null
    check (channel_kind in ('general','announcements','hosts','managers')),
  thread_id uuid references public.message_threads(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (agency_id, channel_kind)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.agency_support_tickets enable row level security;
alter table public.agency_support_messages enable row level security;
alter table public.agency_security_events enable row level security;
alter table public.agency_channels enable row level security;

drop policy if exists "agency_support_select" on public.agency_support_tickets;
create policy "agency_support_select" on public.agency_support_tickets for select to authenticated
  using (
    created_by = auth.uid()
    or public.agency_has_permission(agency_id, 'agency.manage_support')
  );

drop policy if exists "agency_security_select" on public.agency_security_events;
create policy "agency_security_select" on public.agency_security_events for select to authenticated
  using (public.agency_has_permission(agency_id, 'agency.view_audit'));

drop policy if exists "agency_channels_select" on public.agency_channels;
create policy "agency_channels_select" on public.agency_channels for select to authenticated
  using (
    exists (
      select 1 from public.host_profiles hp
      where hp.agency_id = agency_channels.agency_id
        and hp.user_id = auth.uid() and hp.status = 'agency'
    )
    or public.agency_has_permission(agency_id, 'agency.view_dashboard')
  );

grant select on public.agency_support_tickets to authenticated;
grant select on public.agency_security_events to authenticated;
grant select on public.agency_channels to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.ajans_destek_olustur(
  p_agency_id uuid,
  p_subject text,
  p_body text,
  p_priority text default 'normal'
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

  if not (
    exists (
      select 1 from public.host_profiles
      where agency_id = p_agency_id and user_id = auth.uid() and status = 'agency'
    )
    or exists (select 1 from public.agencies where id = p_agency_id and owner_id = auth.uid())
    or public.agency_has_permission(p_agency_id, 'agency.manage_support')
  ) then raise exception 'Forbidden'; end if;

  insert into public.agency_support_tickets (
    agency_id, created_by, subject, body, priority
  ) values (
    p_agency_id, auth.uid(),
    left(trim(p_subject), 120),
    left(trim(p_body), 4000),
    coalesce(nullif(p_priority,''), 'normal')
  ) returning id into v_id;

  perform public.agency_audit_yaz(p_agency_id, 'support_create', 'Destek talebi', auth.uid(),
    jsonb_build_object('ticket_id', v_id));
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.ajans_destek_olustur(uuid, text, text, text) to authenticated;

create or replace function public.ajans_destek_listesi(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_support');

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id,
      'subject', t.subject,
      'body', t.body,
      'status', t.status,
      'priority', t.priority,
      'created_by', t.created_by,
      'created_at', t.created_at,
      'creator_name', coalesce(p.display_name, p.username)
    ) order by t.created_at desc)
    from public.agency_support_tickets t
    left join public.profiles p on p.id = t.created_by
    where t.agency_id = p_agency_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.ajans_destek_listesi(uuid) to authenticated;

create or replace function public.ajans_destek_durum(
  p_ticket_id uuid,
  p_status text
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
  select agency_id into v_agency from public.agency_support_tickets where id = p_ticket_id;
  if not found then raise exception 'Talep yok'; end if;
  perform public.agency_require_permission(v_agency, 'agency.manage_support');

  update public.agency_support_tickets
  set status = p_status, updated_at = now()
  where id = p_ticket_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.ajans_destek_durum(uuid, text) to authenticated;

create or replace function public.ajans_guvenlik_olay_ekle(
  p_agency_id uuid,
  p_title text,
  p_body text default '',
  p_severity text default 'medium',
  p_event_type text default 'general'
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
  if not (public.ben_admin_miyim() or public.agency_has_permission(p_agency_id, 'agency.manage_settings')) then
    raise exception 'Forbidden';
  end if;

  insert into public.agency_security_events (
    agency_id, title, body, severity, event_type
  ) values (
    p_agency_id, left(trim(p_title), 120), left(coalesce(p_body,''), 2000),
    coalesce(nullif(p_severity,''), 'medium'),
    coalesce(nullif(p_event_type,''), 'general')
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.ajans_guvenlik_olay_ekle(uuid, text, text, text, text) to authenticated;

create or replace function public.ajans_guvenlik_listesi(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.view_audit');

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id,
      'title', e.title,
      'body', e.body,
      'severity', e.severity,
      'event_type', e.event_type,
      'acked', e.acked,
      'created_at', e.created_at
    ) order by e.created_at desc)
    from public.agency_security_events e
    where e.agency_id = p_agency_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.ajans_guvenlik_listesi(uuid) to authenticated;

create or replace function public.ajans_guvenlik_ack(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select agency_id into v_agency from public.agency_security_events where id = p_event_id;
  if not found then raise exception 'Olay yok'; end if;
  perform public.agency_require_permission(v_agency, 'agency.view_audit');

  update public.agency_security_events
  set acked = true, acked_by = auth.uid(), acked_at = now()
  where id = p_event_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.ajans_guvenlik_ack(uuid) to authenticated;

create or replace function public.ajans_kanal_hazirla(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_thread uuid;
  v_channel uuid;
  v_owner uuid;
  v_kinds text[] := array['general','announcements','hosts','managers'];
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_settings');

  select owner_id into v_owner from public.agencies where id = p_agency_id;
  if not found then raise exception 'Ajans yok'; end if;

  foreach v_kind in array v_kinds loop
    select id, thread_id into v_channel, v_thread
    from public.agency_channels
    where agency_id = p_agency_id and channel_kind = v_kind;

    if v_channel is null then
      insert into public.message_threads (thread_kind, peer_agency_id, agency_channel_kind, title)
      values ('agency_channel', p_agency_id, v_kind, 'Ajans · ' || v_kind)
      returning id into v_thread;

      insert into public.message_thread_members (thread_id, user_id)
      values (v_thread, v_owner)
      on conflict do nothing;

      insert into public.agency_channels (agency_id, channel_kind, thread_id)
      values (p_agency_id, v_kind, v_thread);
    end if;
  end loop;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'channel_kind', c.channel_kind,
      'thread_id', c.thread_id
    ))
    from public.agency_channels c where c.agency_id = p_agency_id
  ), '[]'::jsonb);
exception
  when undefined_column then
    -- thread_kind/peer_agency_id varyasyonu
    raise exception 'Mesaj altyapısı ajans kanalları için hazır değil';
end;
$$;

grant execute on function public.ajans_kanal_hazirla(uuid) to authenticated;

create or replace function public.ajans_kanal_listesi(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not (
    public.agency_has_permission(p_agency_id, 'agency.view_dashboard')
    or exists (
      select 1 from public.host_profiles
      where agency_id = p_agency_id and user_id = auth.uid() and status = 'agency'
    )
  ) then raise exception 'Forbidden'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'channel_kind', c.channel_kind,
      'thread_id', c.thread_id
    ) order by c.channel_kind)
    from public.agency_channels c where c.agency_id = p_agency_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.ajans_kanal_listesi(uuid) to authenticated;

create or replace function public.ajans_staff_listesi(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_roles');

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', s.user_id,
      'role_code', s.role_code,
      'display_name', p.display_name,
      'username', p.username,
      'avatar_url', p.avatar_url,
      'overrides', coalesce((
        select jsonb_agg(jsonb_build_object(
          'permission', o.permission_code,
          'granted', o.granted
        ))
        from public.agency_staff_permission_overrides o
        where o.agency_id = p_agency_id and o.user_id = s.user_id
      ), '[]'::jsonb)
    ) order by s.role_code, p.display_name)
    from public.agency_staff_roles s
    join public.profiles p on p.id = s.user_id
    where s.agency_id = p_agency_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.ajans_staff_listesi(uuid) to authenticated;
