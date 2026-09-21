-- Ghost arama temizligi + uygulama yeniden acilisinda bitir + gecmis listesi/sil

-- 1) Kullanici bazli gizleme (karsi taraf gecmisi kalir)
create table if not exists public.direct_call_gizlenenler (
  user_id uuid not null references public.profiles(id) on delete cascade,
  call_id uuid not null references public.direct_calls(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, call_id)
);

alter table public.direct_call_gizlenenler enable row level security;

drop policy if exists "Call hides own" on public.direct_call_gizlenenler;
create policy "Call hides own"
  on public.direct_call_gizlenenler for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, delete on public.direct_call_gizlenenler to authenticated;

-- 2) Stale: ringing 45sn, active 15dk (app kill sonrasi kilitlenmesin)
create or replace function public.gorusme_stale_temizle()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ring int;
  v_act int;
begin
  update public.direct_calls set
    status = 'missed',
    ended_at = now(),
    end_reason = 'ring_timeout'
  where status = 'ringing'
    and started_at < now() - interval '45 seconds';
  get diagnostics v_ring = row_count;

  update public.direct_calls set
    status = 'ended',
    ended_at = now(),
    end_reason = 'stale_active'
  where status = 'active'
    and coalesce(answered_at, started_at) < now() - interval '15 minutes';
  get diagnostics v_act = row_count;

  return coalesce(v_ring, 0) + coalesce(v_act, 0);
end;
$$;

grant execute on function public.gorusme_stale_temizle() to authenticated;

-- 3) Uygulama acilisi / kill sonrasi: benim ringing+active hepsini bitir
create or replace function public.gorusme_benim_aktifleri_bitir(p_reason text default 'app_closed')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  update public.direct_calls set
    status = case
      when status = 'ringing' and caller_id = v_uid then 'cancelled'
      when status = 'ringing' then 'missed'
      else 'ended'
    end,
    ended_at = now(),
    ended_by = v_uid,
    end_reason = coalesce(nullif(trim(p_reason), ''), 'app_closed')
  where status in ('ringing', 'active')
    and (caller_id = v_uid or callee_id = v_uid);

  get diagnostics v_n = row_count;
  return coalesce(v_n, 0);
end;
$$;

grant execute on function public.gorusme_benim_aktifleri_bitir(text) to authenticated;

-- 4) Baslat: kendi takili ringing/active cagrilarini daima kapat, sonra yeni baslat
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
  v_stale public.direct_calls%rowtype;
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

  perform public.gorusme_stale_temizle();

  -- Bu cifteki / benim takili cagrilar: kendi tarafimdakileri kapat (ghost)
  update public.direct_calls set
    status = case
      when status = 'ringing' and caller_id = v_uid then 'cancelled'
      when status = 'ringing' then 'missed'
      else 'ended'
    end,
    ended_at = now(),
    ended_by = v_uid,
    end_reason = 'replaced_by_new_call'
  where status in ('ringing', 'active')
    and (
      (caller_id = v_uid and callee_id = v_peer)
      or (caller_id = v_peer and callee_id = v_uid)
    );

  -- Hâlâ baska bir aktif (nadir race) varsa engelle
  select * into v_stale
  from public.direct_calls
  where status in ('ringing', 'active')
    and (
      (caller_id = v_uid and callee_id = v_peer)
      or (caller_id = v_peer and callee_id = v_uid)
    )
  order by started_at desc
  limit 1;

  if found then
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

grant execute on function public.gorusme_baslat(uuid, text) to authenticated;

-- 5) Gecmis listesi
create or replace function public.benim_gorusme_gecmisim(p_limit int default 100)
returns table (
  id uuid,
  thread_id uuid,
  call_type text,
  status text,
  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  is_outgoing boolean,
  is_ongoing boolean,
  peer_id uuid,
  peer_display_name text,
  peer_username text,
  peer_avatar_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lim int := greatest(1, least(coalesce(p_limit, 100), 200));
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  return query
  select
    c.id,
    c.thread_id,
    c.call_type,
    c.status,
    c.started_at,
    c.answered_at,
    c.ended_at,
    c.end_reason,
    (c.caller_id = v_uid) as is_outgoing,
    (c.status in ('ringing', 'active')) as is_ongoing,
    case when c.caller_id = v_uid then c.callee_id else c.caller_id end as peer_id,
    p.display_name as peer_display_name,
    p.username as peer_username,
    p.avatar_url as peer_avatar_url
  from public.direct_calls c
  join public.profiles p
    on p.id = case when c.caller_id = v_uid then c.callee_id else c.caller_id end
  where (c.caller_id = v_uid or c.callee_id = v_uid)
    and not exists (
      select 1 from public.direct_call_gizlenenler g
      where g.user_id = v_uid and g.call_id = c.id
    )
  order by
    case when c.status in ('ringing', 'active') then 0 else 1 end,
    coalesce(c.ended_at, c.started_at) desc
  limit v_lim;
end;
$$;

grant execute on function public.benim_gorusme_gecmisim(int) to authenticated;

-- 6) Gecmisi gizle (sil)
create or replace function public.gorusme_gecmis_sil(p_call_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if not exists (
    select 1 from public.direct_calls
    where id = p_call_id
      and (caller_id = v_uid or callee_id = v_uid)
  ) then
    raise exception 'Gorusme bulunamadi';
  end if;

  -- Devam edeni bitir + gizle
  update public.direct_calls set
    status = case
      when status = 'ringing' and caller_id = v_uid then 'cancelled'
      when status = 'ringing' then 'missed'
      when status = 'active' then 'ended'
      else status
    end,
    ended_at = coalesce(ended_at, now()),
    ended_by = case when status in ('ringing', 'active') then v_uid else ended_by end,
    end_reason = case
      when status in ('ringing', 'active') then 'deleted_from_history'
      else end_reason
    end
  where id = p_call_id
    and (caller_id = v_uid or callee_id = v_uid);

  insert into public.direct_call_gizlenenler (user_id, call_id)
  values (v_uid, p_call_id)
  on conflict do nothing;

  return true;
end;
$$;

grant execute on function public.gorusme_gecmis_sil(uuid) to authenticated;
