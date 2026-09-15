-- Canli destek: oturum + mesaj + temsilci (kullaniciya her zaman "Toprak")
-- Bos oturum / mesajsizlik: 3 dakika sonra kapanir

create table if not exists public.support_agents (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  alias text not null default 'Toprak',
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  agent_id uuid references public.profiles(id) on delete set null,
  status text not null default 'waiting'
    check (status in ('waiting', 'active', 'closed', 'idle_closed')),
  opened_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  closed_at timestamptz,
  close_reason text,
  created_at timestamptz not null default now()
);

create index if not exists support_sessions_user_idx
  on public.support_sessions (user_id, status, opened_at desc);
create index if not exists support_sessions_agent_idx
  on public.support_sessions (agent_id, status, opened_at desc);
create index if not exists support_sessions_waiting_idx
  on public.support_sessions (status, opened_at asc)
  where status = 'waiting';

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.support_sessions(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_role text not null check (sender_role in ('user', 'agent', 'system')),
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists support_messages_session_idx
  on public.support_messages (session_id, created_at asc);

alter table public.support_agents enable row level security;
alter table public.support_sessions enable row level security;
alter table public.support_messages enable row level security;

create or replace function public.ben_destek_temsilcisi_miyim()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.support_agents a
    where a.user_id = auth.uid() and a.is_active
  ) or public.ben_admin_miyim();
$$;

drop policy if exists "Support agents admin read" on public.support_agents;
create policy "Support agents admin read" on public.support_agents
  for select to authenticated
  using (public.ben_admin_miyim() or user_id = auth.uid());

drop policy if exists "Support sessions member read" on public.support_sessions;
create policy "Support sessions member read" on public.support_sessions
  for select to authenticated
  using (
    user_id = auth.uid()
    or agent_id = auth.uid()
    or public.ben_admin_miyim()
  );

drop policy if exists "Support messages member read" on public.support_messages;
create policy "Support messages member read" on public.support_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.support_sessions s
      where s.id = session_id
        and (
          s.user_id = auth.uid()
          or s.agent_id = auth.uid()
          or public.ben_admin_miyim()
        )
    )
  );

grant select on public.support_agents to authenticated;
grant select on public.support_sessions to authenticated;
grant select on public.support_messages to authenticated;
grant execute on function public.ben_destek_temsilcisi_miyim() to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.support_sessions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.support_messages;
  exception when duplicate_object then null;
  end;
end $$;

alter table public.support_sessions replica identity full;
alter table public.support_messages replica identity full;

-- Idle kapat (3 dk mesaj yok)
create or replace function public.destek_oturum_idle_kapat(p_session_id uuid)
returns public.support_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.support_sessions%rowtype;
begin
  select * into v_row from public.support_sessions where id = p_session_id for update;
  if not found then raise exception 'Oturum bulunamadi'; end if;
  if v_row.status not in ('waiting', 'active') then return v_row; end if;

  -- Son aktiviteden (acilis veya mesaj) 3 dk mesaj yoksa kapat
  if v_row.last_activity_at > now() - interval '3 minutes' then
    return v_row;
  end if;

  update public.support_sessions set
    status = 'idle_closed',
    closed_at = now(),
    close_reason = 'idle_3m'
  where id = p_session_id
  returning * into v_row;

  insert into public.support_messages (session_id, sender_id, sender_role, body)
  values (
    p_session_id, null, 'system',
    'Görüşme, 3 dakika boyunca mesaj olmadığı için sonlandırıldı.'
  );

  return v_row;
end;
$$;

create or replace function public.destek_oturum_ac()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_row public.support_sessions%rowtype;
  v_msgs jsonb;
begin
  if v_uid is null then raise exception 'Oturum gerekli'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir hesap destek acamaz'; end if;

  -- Acik oturum varsa devam
  select * into v_row
  from public.support_sessions
  where user_id = v_uid and status in ('waiting', 'active')
  order by opened_at desc
  limit 1
  for update;

  if found then
    v_row := public.destek_oturum_idle_kapat(v_row.id);
    if v_row.status in ('waiting', 'active') then
      select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at), '[]'::jsonb)
      into v_msgs
      from public.support_messages m where m.session_id = v_row.id;

      return jsonb_build_object(
        'session', to_jsonb(v_row),
        'messages', v_msgs,
        'agent_alias', 'Toprak'
      );
    end if;
  end if;

  insert into public.support_sessions (user_id, status, last_activity_at)
  values (v_uid, 'waiting', now())
  returning * into v_row;

  insert into public.support_messages (session_id, sender_id, sender_role, body)
  values (
    v_row.id, null, 'system',
    'Canlı desteke bağlandınız. Temsilci Toprak en kısa sürede size yardımcı olacak.'
  );

  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at), '[]'::jsonb)
  into v_msgs
  from public.support_messages m where m.session_id = v_row.id;

  return jsonb_build_object(
    'session', to_jsonb(v_row),
    'messages', v_msgs,
    'agent_alias', 'Toprak'
  );
end;
$$;

create or replace function public.destek_mesaj_gonder(
  p_session_id uuid,
  p_body text
)
returns public.support_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.support_sessions%rowtype;
  v_msg public.support_messages%rowtype;
  v_body text := trim(coalesce(p_body, ''));
  v_role text;
begin
  if v_uid is null then raise exception 'Oturum gerekli'; end if;
  if char_length(v_body) < 1 then raise exception 'Bos mesaj'; end if;
  if char_length(v_body) > 2000 then raise exception 'Mesaj cok uzun'; end if;

  select * into v_row from public.support_sessions where id = p_session_id for update;
  if not found then raise exception 'Oturum bulunamadi'; end if;

  v_row := public.destek_oturum_idle_kapat(p_session_id);
  if v_row.status not in ('waiting', 'active') then
    raise exception 'Gorusme kapandi';
  end if;

  if v_row.user_id = v_uid then
    v_role := 'user';
  elsif v_row.agent_id = v_uid and public.ben_destek_temsilcisi_miyim() then
    v_role := 'agent';
  elsif public.ben_admin_miyim() then
    -- Admin yanit verebilir; atama yoksa kendini ata
    v_role := 'agent';
    if v_row.agent_id is null then
      insert into public.support_agents (user_id, is_active, assigned_by)
      values (v_uid, true, v_uid)
      on conflict (user_id) do update set is_active = true, updated_at = now();

      update public.support_sessions set
        agent_id = v_uid,
        status = 'active'
      where id = p_session_id
      returning * into v_row;

      insert into public.support_messages (session_id, sender_id, sender_role, body)
      values (
        p_session_id, null, 'system',
        'Temsilci Toprak görüşmeye katıldı.'
      );
    end if;
  else
    raise exception 'Yetkisiz';
  end if;

  insert into public.support_messages (session_id, sender_id, sender_role, body)
  values (p_session_id, v_uid, v_role, v_body)
  returning * into v_msg;

  update public.support_sessions set
    last_activity_at = now(),
    status = case when status = 'waiting' and v_role = 'agent' then 'active' else status end
  where id = p_session_id;

  return v_msg;
end;
$$;

create or replace function public.destek_oturum_kapat(
  p_session_id uuid,
  p_reason text default 'manual'
)
returns public.support_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.support_sessions%rowtype;
begin
  if v_uid is null then raise exception 'Oturum gerekli'; end if;
  select * into v_row from public.support_sessions where id = p_session_id for update;
  if not found then raise exception 'Oturum bulunamadi'; end if;

  if not (
    v_row.user_id = v_uid
    or v_row.agent_id = v_uid
    or public.ben_admin_miyim()
  ) then
    raise exception 'Yetkisiz';
  end if;

  if v_row.status in ('closed', 'idle_closed') then return v_row; end if;

  update public.support_sessions set
    status = 'closed',
    closed_at = now(),
    close_reason = coalesce(nullif(trim(p_reason), ''), 'manual')
  where id = p_session_id
  returning * into v_row;

  insert into public.support_messages (session_id, sender_id, sender_role, body)
  values (p_session_id, v_uid, 'system', 'Görüşme sonlandırıldı.');

  return v_row;
end;
$$;

-- Admin: temsilci ekle / cikar
create or replace function public.admin_destek_temsilci_ayarla(
  p_user_id uuid,
  p_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_user_id is null then raise exception 'Kullanici gerekli'; end if;

  insert into public.support_agents (user_id, is_active, assigned_by, alias)
  values (p_user_id, coalesce(p_active, true), auth.uid(), 'Toprak')
  on conflict (user_id) do update set
    is_active = coalesce(p_active, true),
    assigned_by = auth.uid(),
    alias = 'Toprak',
    updated_at = now();

  return jsonb_build_object('ok', true, 'user_id', p_user_id, 'is_active', coalesce(p_active, true));
end;
$$;

create or replace function public.admin_destek_temsilci_listesi()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', a.user_id,
      'is_active', a.is_active,
      'alias', a.alias,
      'created_at', a.created_at,
      'display_name', p.display_name,
      'username', p.username,
      'avatar_url', p.avatar_url
    ) order by a.is_active desc, a.created_at desc)
    from public.support_agents a
    join public.profiles p on p.id = a.user_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_destek_oturum_listesi(p_limit int default 40)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_destek_temsilcisi_miyim() then raise exception 'Forbidden'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb)
    from (
      select
        s.id,
        s.user_id,
        s.agent_id,
        s.status,
        s.opened_at,
        s.last_activity_at,
        s.closed_at,
        s.close_reason,
        jsonb_build_object(
          'display_name', u.display_name,
          'username', u.username,
          'avatar_url', u.avatar_url
        ) as kullanici,
        case when a.id is not null then jsonb_build_object(
          'display_name', a.display_name,
          'username', a.username
        ) else null end as temsilci,
        (
          select count(*)::int from public.support_messages m where m.session_id = s.id
        ) as mesaj_sayisi
      from public.support_sessions s
      join public.profiles u on u.id = s.user_id
      left join public.profiles a on a.id = s.agent_id
      where
        public.ben_admin_miyim()
        or s.agent_id = auth.uid()
        or s.status = 'waiting'
      order by
        case s.status when 'waiting' then 0 when 'active' then 1 else 2 end,
        s.opened_at desc
      limit least(greatest(coalesce(p_limit, 40), 1), 100)
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_destek_oturum_ata(
  p_session_id uuid,
  p_agent_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.support_sessions%rowtype;
  v_aktif boolean;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  select is_active into v_aktif from public.support_agents where user_id = p_agent_id;
  if not coalesce(v_aktif, false) then
    raise exception 'Temsilci aktif degil — once temsilci olarak ekleyin';
  end if;

  select * into v_row from public.support_sessions where id = p_session_id for update;
  if not found then raise exception 'Oturum bulunamadi'; end if;
  if v_row.status in ('closed', 'idle_closed') then
    raise exception 'Kapali oturuma atama yapilamaz';
  end if;

  update public.support_sessions set
    agent_id = p_agent_id,
    status = 'active',
    last_activity_at = now()
  where id = p_session_id
  returning * into v_row;

  insert into public.support_messages (session_id, sender_id, sender_role, body)
  values (
    p_session_id, null, 'system',
    'Temsilci Toprak görüşmeye katıldı.'
  );

  return jsonb_build_object('ok', true, 'session', to_jsonb(v_row));
end;
$$;

create or replace function public.destek_oturum_detay(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.support_sessions%rowtype;
  v_msgs jsonb;
begin
  if v_uid is null then raise exception 'Oturum gerekli'; end if;
  select * into v_row from public.support_sessions where id = p_session_id;
  if not found then raise exception 'Oturum bulunamadi'; end if;

  if not (
    v_row.user_id = v_uid
    or v_row.agent_id = v_uid
    or public.ben_admin_miyim()
  ) then
    raise exception 'Yetkisiz';
  end if;

  if v_row.status in ('waiting', 'active') then
    v_row := public.destek_oturum_idle_kapat(p_session_id);
  end if;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at), '[]'::jsonb)
  into v_msgs
  from public.support_messages m where m.session_id = p_session_id;

  return jsonb_build_object(
    'session', to_jsonb(v_row),
    'messages', v_msgs,
    'agent_alias', 'Toprak'
  );
end;
$$;

grant execute on function public.destek_oturum_idle_kapat(uuid) to authenticated;
grant execute on function public.destek_oturum_ac() to authenticated;
grant execute on function public.destek_mesaj_gonder(uuid, text) to authenticated;
grant execute on function public.destek_oturum_kapat(uuid, text) to authenticated;
grant execute on function public.destek_oturum_detay(uuid) to authenticated;
grant execute on function public.admin_destek_temsilci_ayarla(uuid, boolean) to authenticated;
grant execute on function public.admin_destek_temsilci_listesi() to authenticated;
grant execute on function public.admin_destek_oturum_listesi(int) to authenticated;
grant execute on function public.admin_destek_oturum_ata(uuid, uuid) to authenticated;
