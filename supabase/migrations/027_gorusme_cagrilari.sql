-- 1:1 sesli/goruntulu gorusme + kayit/ekran-goruntusu guvenlik olaylari

create table if not exists public.direct_calls (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  caller_id uuid not null references public.profiles(id) on delete cascade,
  callee_id uuid not null references public.profiles(id) on delete cascade,
  call_type text not null check (call_type in ('audio', 'video')),
  status text not null default 'ringing'
    check (status in ('ringing', 'active', 'ended', 'rejected', 'missed', 'cancelled')),
  channel_name text not null,
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  ended_by uuid references public.profiles(id) on delete set null,
  end_reason text,
  created_at timestamptz not null default now()
);

create index if not exists direct_calls_callee_ringing_idx
  on public.direct_calls (callee_id, status, started_at desc);
create index if not exists direct_calls_thread_idx
  on public.direct_calls (thread_id, started_at desc);
create index if not exists direct_calls_caller_idx
  on public.direct_calls (caller_id, started_at desc);

create table if not exists public.call_security_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references public.direct_calls(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  peer_id uuid references public.profiles(id) on delete set null,
  thread_id uuid references public.message_threads(id) on delete set null,
  event_type text not null
    check (event_type in ('screenshot', 'screen_record', 'capture_blocked', 'capture_attempt')),
  platform text,
  call_type text,
  call_status text,
  details jsonb not null default '{}'::jsonb,
  admin_seen boolean not null default false,
  warning_sent_at timestamptz,
  warning_message text,
  created_at timestamptz not null default now()
);

create index if not exists call_security_events_admin_idx
  on public.call_security_events (admin_seen, created_at desc);

alter table public.direct_calls enable row level security;
alter table public.call_security_events enable row level security;

drop policy if exists "Calls participants read" on public.direct_calls;
create policy "Calls participants read"
  on public.direct_calls for select to authenticated
  using (auth.uid() = caller_id or auth.uid() = callee_id or public.ben_admin_miyim());

drop policy if exists "Security events own insert" on public.call_security_events;
create policy "Security events own insert"
  on public.call_security_events for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Security events admin read" on public.call_security_events;
create policy "Security events admin read"
  on public.call_security_events for select to authenticated
  using (public.ben_admin_miyim() or auth.uid() = user_id);

grant select on public.direct_calls to authenticated;
grant select, insert on public.call_security_events to authenticated;
grant update on public.call_security_events to authenticated;

-- Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table public.direct_calls;
  exception when duplicate_object then null;
  end;
end $$;

-- Karsi taraf (thread)
create or replace function public.mesaj_thread_karsi_profil(p_thread_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row record;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.message_thread_members
    where thread_id = p_thread_id and user_id = v_uid
  ) then
    raise exception 'Not a thread member';
  end if;

  select p.id, p.display_name, p.username, p.avatar_url, p.public_user_id
  into v_row
  from public.message_thread_members m
  join public.profiles p on p.id = m.user_id
  where m.thread_id = p_thread_id and m.user_id <> v_uid
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'display_name', v_row.display_name,
    'username', v_row.username,
    'avatar_url', v_row.avatar_url,
    'public_user_id', v_row.public_user_id
  );
end;
$$;

-- Cagri baslat
create or replace function public.gorusme_baslat(
  p_thread_id uuid,
  p_call_type text
)
returns public.direct_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_peer uuid;
  v_guest boolean;
  v_type text := lower(trim(p_call_type));
  v_row public.direct_calls%rowtype;
  v_channel text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_type not in ('audio', 'video') then raise exception 'Gecersiz cagri turu'; end if;

  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir arama yapamaz'; end if;

  if not exists (
    select 1 from public.message_thread_members
    where thread_id = p_thread_id and user_id = v_uid
  ) then
    raise exception 'Not a thread member';
  end if;

  select user_id into v_peer
  from public.message_thread_members
  where thread_id = p_thread_id and user_id <> v_uid
  limit 1;
  if v_peer is null then raise exception 'Karsi taraf yok'; end if;

  -- Aktif/ringing varsa yeniden baslatma
  if exists (
    select 1 from public.direct_calls
    where status in ('ringing', 'active')
      and (
        (caller_id = v_uid and callee_id = v_peer)
        or (caller_id = v_peer and callee_id = v_uid)
      )
  ) then
    raise exception 'Zaten aktif bir gorusme var';
  end if;

  v_channel := 'dm_call_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.direct_calls (
    thread_id, caller_id, callee_id, call_type, status, channel_name
  ) values (
    p_thread_id, v_uid, v_peer, v_type, 'ringing', v_channel
  ) returning * into v_row;

  insert into public.direct_messages (thread_id, sender_id, body, message_type)
  values (
    p_thread_id,
    v_uid,
    case when v_type = 'video' then '📹 Görüntülü arama' else '📞 Sesli arama' end,
    'system'
  );

  update public.message_threads set
    updated_at = now(),
    last_message_at = now(),
    last_message_preview = case when v_type = 'video' then 'Görüntülü arama' else 'Sesli arama' end
  where id = p_thread_id;

  return v_row;
end;
$$;

create or replace function public.gorusme_cevapla(p_call_id uuid)
returns public.direct_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.direct_calls%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  update public.direct_calls set
    status = 'active',
    answered_at = now()
  where id = p_call_id
    and callee_id = v_uid
    and status = 'ringing'
  returning * into v_row;

  if not found then raise exception 'Cagri cevaplanamadi'; end if;
  return v_row;
end;
$$;

create or replace function public.gorusme_reddet(p_call_id uuid)
returns public.direct_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.direct_calls%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  update public.direct_calls set
    status = 'rejected',
    ended_at = now(),
    ended_by = v_uid,
    end_reason = 'rejected'
  where id = p_call_id
    and callee_id = v_uid
    and status = 'ringing'
  returning * into v_row;

  if not found then raise exception 'Cagri reddedilemedi'; end if;
  return v_row;
end;
$$;

-- Her iki tarafta da aninda biter
create or replace function public.gorusme_bitir(
  p_call_id uuid,
  p_reason text default 'hangup'
)
returns public.direct_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.direct_calls%rowtype;
  v_status text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_row from public.direct_calls where id = p_call_id;
  if not found then raise exception 'Cagri yok'; end if;
  if v_uid <> v_row.caller_id and v_uid <> v_row.callee_id then
    raise exception 'Forbidden';
  end if;
  if v_row.status in ('ended', 'rejected', 'missed', 'cancelled') then
    return v_row;
  end if;

  if v_row.status = 'ringing' and v_uid = v_row.caller_id then
    v_status := 'cancelled';
  elsif v_row.status = 'ringing' then
    v_status := 'missed';
  else
    v_status := 'ended';
  end if;

  update public.direct_calls set
    status = v_status,
    ended_at = now(),
    ended_by = v_uid,
    end_reason = coalesce(nullif(trim(p_reason), ''), 'hangup')
  where id = p_call_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.gorusme_getir(p_call_id uuid)
returns public.direct_calls
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.direct_calls%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_row from public.direct_calls where id = p_call_id;
  if not found then raise exception 'Cagri yok'; end if;
  if v_uid <> v_row.caller_id and v_uid <> v_row.callee_id and not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;
  return v_row;
end;
$$;

-- Guvenlik olayi (screenshot / kayit)
create or replace function public.gorusme_guvenlik_olayi(
  p_call_id uuid,
  p_event_type text,
  p_platform text default null,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_call public.direct_calls%rowtype;
  v_id uuid;
  v_peer uuid;
  v_type text := lower(trim(p_event_type));
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_type not in ('screenshot', 'screen_record', 'capture_blocked', 'capture_attempt') then
    raise exception 'Gecersiz olay';
  end if;

  select * into v_call from public.direct_calls where id = p_call_id;
  if not found then raise exception 'Cagri yok'; end if;
  if v_uid <> v_call.caller_id and v_uid <> v_call.callee_id then
    raise exception 'Forbidden';
  end if;

  v_peer := case when v_uid = v_call.caller_id then v_call.callee_id else v_call.caller_id end;

  insert into public.call_security_events (
    call_id, user_id, peer_id, thread_id, event_type, platform,
    call_type, call_status, details
  ) values (
    p_call_id, v_uid, v_peer, v_call.thread_id, v_type, p_platform,
    v_call.call_type, v_call.status, coalesce(p_details, '{}'::jsonb)
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.admin_gorusme_guvenlik_listesi(p_limit int default 50)
returns table (
  id uuid,
  call_id uuid,
  user_id uuid,
  peer_id uuid,
  thread_id uuid,
  event_type text,
  platform text,
  call_type text,
  call_status text,
  details jsonb,
  admin_seen boolean,
  warning_sent_at timestamptz,
  warning_message text,
  created_at timestamptz,
  user_name text,
  peer_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  return query
  select
    e.id, e.call_id, e.user_id, e.peer_id, e.thread_id, e.event_type, e.platform,
    e.call_type, e.call_status, e.details, e.admin_seen, e.warning_sent_at,
    e.warning_message, e.created_at,
    coalesce(u.display_name, u.username, 'Kullanici'),
    coalesce(p.display_name, p.username, 'Karsi')
  from public.call_security_events e
  left join public.profiles u on u.id = e.user_id
  left join public.profiles p on p.id = e.peer_id
  order by e.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

create or replace function public.admin_gorusme_uyari_gonder(
  p_event_id uuid,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_e public.call_security_events%rowtype;
  v_msg text := trim(p_message);
  v_thread uuid;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if v_msg is null or length(v_msg) < 3 then raise exception 'Uyari metni gerekli'; end if;

  select * into v_e from public.call_security_events where id = p_event_id;
  if not found then raise exception 'Olay yok'; end if;

  -- Uyari: admin ile hedef arasinda 1:1 sohbet
  v_thread := public.ozel_sohbet_ac_veya_getir(v_e.user_id);

  insert into public.direct_messages (thread_id, sender_id, body, message_type)
  values (
    v_thread,
    auth.uid(),
    '⚠️ Yönetim uyarısı: ' || left(v_msg, 3500),
    'system'
  );

  update public.message_threads set
    updated_at = now(),
    last_message_at = now(),
    last_message_preview = 'Yönetim uyarısı'
  where id = v_thread;

  update public.call_security_events set
    admin_seen = true,
    warning_sent_at = now(),
    warning_message = left(v_msg, 2000)
  where id = p_event_id;

  perform public.admin_audit_yaz(
    v_e.user_id,
    'call_security_warn',
    'Gorusme guvenlik uyarisi gonderildi',
    jsonb_build_object('event_id', p_event_id, 'call_id', v_e.call_id)
  );

  return jsonb_build_object('ok', true, 'thread_id', v_thread);
end;
$$;

create or replace function public.admin_gorusme_olay_goruldu(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  update public.call_security_events set admin_seen = true where id = p_event_id;
end;
$$;

grant execute on function public.mesaj_thread_karsi_profil(uuid) to authenticated;
grant execute on function public.gorusme_baslat(uuid, text) to authenticated;
grant execute on function public.gorusme_cevapla(uuid) to authenticated;
grant execute on function public.gorusme_reddet(uuid) to authenticated;
grant execute on function public.gorusme_bitir(uuid, text) to authenticated;
grant execute on function public.gorusme_getir(uuid) to authenticated;
grant execute on function public.gorusme_guvenlik_olayi(uuid, text, text, jsonb) to authenticated;
grant execute on function public.admin_gorusme_guvenlik_listesi(int) to authenticated;
grant execute on function public.admin_gorusme_uyari_gonder(uuid, text) to authenticated;
grant execute on function public.admin_gorusme_olay_goruldu(uuid) to authenticated;
