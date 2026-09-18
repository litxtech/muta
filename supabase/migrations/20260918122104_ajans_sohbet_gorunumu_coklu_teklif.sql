-- Ajans sohbeti: karşı taraf ajans adı/logo (sahip adı değil) + profil linki
-- DM açarken peer_agency_id ile markala

alter table public.message_threads
  add column if not exists peer_agency_id uuid references public.agencies(id);

create index if not exists message_threads_peer_agency_idx
  on public.message_threads (peer_agency_id)
  where peer_agency_id is not null;

comment on column public.message_threads.peer_agency_id is
  'Ajans adına açılan sohbet — karşı tarafta ajans adı gösterilir (sahip adı değil)';

-- ---------------------------------------------------------------------------
-- Ajans sohbeti aç / getir
-- ---------------------------------------------------------------------------
create or replace function public.ajans_sohbet_ac_veya_getir(p_agency_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_name text;
  v_thread uuid;
  v_guest boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_agency_id is null then raise exception 'Agency required'; end if;

  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then
    raise exception 'Guest cannot start messages';
  end if;

  select owner_id, name into v_owner, v_name
  from public.agencies
  where id = p_agency_id and status = 'active';
  if v_owner is null then raise exception 'Agency not found'; end if;
  if v_owner = v_uid then raise exception 'Kendi ajansına mesaj açılamaz'; end if;

  if public.kullanicilar_engelli_mi(v_uid, v_owner) then
    raise exception 'Bu kullaniciyla iletisim engellenmis';
  end if;

  -- Aynı kullanıcı + aynı ajans markalı thread
  select m1.thread_id into v_thread
  from public.message_thread_members m1
  join public.message_thread_members m2 on m1.thread_id = m2.thread_id
  join public.message_threads t on t.id = m1.thread_id
  where m1.user_id = v_uid
    and m2.user_id = v_owner
    and coalesce(t.thread_kind, 'dm') = 'dm'
    and t.peer_agency_id = p_agency_id
    and (
      select count(*) from public.message_thread_members mx
      where mx.thread_id = m1.thread_id
    ) = 2
  limit 1;

  if v_thread is not null then
    update public.message_thread_members set
      deleted_at = null,
      archived_at = null
    where thread_id = v_thread and user_id = v_uid
      and (deleted_at is not null or archived_at is not null);
    return v_thread;
  end if;

  insert into public.message_threads (thread_kind, peer_agency_id, title)
  values ('dm', p_agency_id, coalesce(nullif(trim(v_name), ''), 'Ajans'))
  returning id into v_thread;

  insert into public.message_thread_members (thread_id, user_id) values
    (v_thread, v_uid), (v_thread, v_owner);

  return v_thread;
end;
$$;

grant execute on function public.ajans_sohbet_ac_veya_getir(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Kişisel DM: ajans-markalı thread’lere karışmasın
-- ---------------------------------------------------------------------------
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

  if public.kullanicilar_engelli_mi(v_uid, p_other_user_id) then
    raise exception 'Bu kullaniciyla iletisim engellenmis';
  end if;

  select m1.thread_id into v_thread
  from public.message_thread_members m1
  join public.message_thread_members m2 on m1.thread_id = m2.thread_id
  join public.message_threads t on t.id = m1.thread_id
  where m1.user_id = v_uid
    and m2.user_id = p_other_user_id
    and coalesce(t.thread_kind, 'dm') = 'dm'
    and t.peer_agency_id is null
    and (
      select count(*) from public.message_thread_members mx
      where mx.thread_id = m1.thread_id
    ) = 2
  limit 1;

  if v_thread is not null then
    update public.message_thread_members set
      deleted_at = null,
      archived_at = null
    where thread_id = v_thread and user_id = v_uid
      and (deleted_at is not null or archived_at is not null);
    return v_thread;
  end if;

  insert into public.message_threads (thread_kind) values ('dm') returning id into v_thread;
  insert into public.message_thread_members (thread_id, user_id) values
    (v_thread, v_uid), (v_thread, p_other_user_id);

  return v_thread;
end;
$$;

grant execute on function public.ozel_sohbet_ac_veya_getir(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Inbox: ajans markası (kullanıcı tarafında ajans adı)
-- ---------------------------------------------------------------------------
drop function if exists public.mesaj_konularini_getir(int, boolean);

create or replace function public.mesaj_konularini_getir(
  p_limit int default 50,
  p_arsiv boolean default false
)
returns table (
  id uuid,
  updated_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text,
  peer_id uuid,
  peer_display_name text,
  peer_username text,
  peer_avatar_url text,
  unread_count bigint,
  archived_at timestamptz,
  thread_kind text,
  thread_title text,
  peer_is_verified boolean,
  peer_is_platform_official boolean,
  closed_at timestamptz,
  peer_agency_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  return query
  select
    t.id,
    t.updated_at,
    t.last_message_at,
    t.last_message_preview,
    case
      when t.thread_kind = 'mahkeme' then coalesce(d.yargic_id, p_peer.id)
      when t.peer_agency_id is not null and v_uid is distinct from ag.owner_id
        then coalesce(ag.owner_id, p_peer.id)
      else p_peer.id
    end,
    case
      when t.thread_kind = 'mahkeme' then coalesce(
        nullif(trim(t.title), ''),
        'Mahkeme · Takas'
      )
      when t.peer_agency_id is not null and v_uid is distinct from ag.owner_id
        then coalesce(nullif(trim(ag.name), ''), 'Ajans')
      else coalesce(nullif(trim(p_peer.display_name), ''), nullif(trim(p_peer.username), ''), 'Kullanıcı')
    end,
    case
      when t.thread_kind = 'mahkeme' then coalesce(p_y.username, 'yargic')
      when t.peer_agency_id is not null and v_uid is distinct from ag.owner_id
        then coalesce(ag.agency_public_id, 'ajans')
      else p_peer.username
    end,
    case
      when t.thread_kind = 'mahkeme' then coalesce(p_y.avatar_url, p_peer.avatar_url)
      when t.peer_agency_id is not null and v_uid is distinct from ag.owner_id
        then coalesce(ag.logo_url, p_peer.avatar_url)
      else p_peer.avatar_url
    end,
    (
      select count(*)::bigint
      from public.direct_messages dm
      where dm.thread_id = t.id
        and dm.sender_id <> v_uid
        and dm.deleted_at is null
        and dm.created_at > coalesce(m_me.last_read_at, '1970-01-01'::timestamptz)
        and (m_me.clear_before is null or dm.created_at > m_me.clear_before)
        and not exists (
          select 1 from public.direct_message_hidden h
          where h.user_id = v_uid and h.message_id = dm.id
        )
    ) as unread_count,
    m_me.archived_at,
    t.thread_kind,
    t.title,
    case
      when t.thread_kind = 'mahkeme' then coalesce(p_y.is_verified, true)
      else coalesce(p_peer.is_verified, false)
    end,
    case
      when t.thread_kind = 'mahkeme' then coalesce(p_y.is_platform_official, true)
      else coalesce(p_peer.is_platform_official, false)
    end,
    t.closed_at,
    t.peer_agency_id
  from public.message_thread_members m_me
  join public.message_threads t on t.id = m_me.thread_id
  left join public.trade_disputes d on d.thread_id = t.id
  left join public.profiles p_y on p_y.id = d.yargic_id
  left join public.agencies ag on ag.id = t.peer_agency_id
  left join lateral (
    select p.*
    from public.message_thread_members m2
    join public.profiles p on p.id = m2.user_id
    where m2.thread_id = t.id
      and m2.user_id <> v_uid
      and (
        t.thread_kind <> 'mahkeme'
        or m2.user_id = d.yargic_id
        or d.yargic_id is null
      )
    order by case when m2.user_id = d.yargic_id then 0 else 1 end
    limit 1
  ) p_peer on true
  where m_me.user_id = v_uid
    and m_me.deleted_at is null
    and (
      t.thread_kind = 'mahkeme'
      or p_peer.id is null
      or not public.kullanicilar_engelli_mi(v_uid, p_peer.id)
    )
    and (
      (coalesce(p_arsiv, false) = false and m_me.archived_at is null)
      or (p_arsiv = true and m_me.archived_at is not null)
    )
  order by t.last_message_at desc nulls last
  limit v_limit;
end;
$$;

grant execute on function public.mesaj_konularini_getir(int, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Thread karşı profil: ajans markası
-- ---------------------------------------------------------------------------
create or replace function public.mesaj_thread_karsi_profil(p_thread_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row record;
  v_kind text;
  v_title text;
  v_closed timestamptz;
  v_agency_id uuid;
  v_agency record;
  v_dispute public.trade_disputes%rowtype;
  v_yargic record;
  v_uyeler jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.message_thread_members
    where thread_id = p_thread_id and user_id = v_uid
  ) then
    raise exception 'Not a thread member';
  end if;

  select thread_kind, title, closed_at, peer_agency_id
  into v_kind, v_title, v_closed, v_agency_id
  from public.message_threads where id = p_thread_id;

  if coalesce(v_kind, 'dm') = 'mahkeme' then
    select * into v_dispute from public.trade_disputes where thread_id = p_thread_id;

    select p.id, p.display_name, p.username, p.avatar_url, p.public_user_id,
           p.is_verified, p.is_platform_official, p.is_platform_yargic, p.is_admin
    into v_yargic
    from public.profiles p
    where p.id = coalesce(v_dispute.yargic_id, v_uid);

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'username', p.username,
      'avatar_url', p.avatar_url,
      'public_user_id', p.public_user_id,
      'is_verified', p.is_verified,
      'is_platform_official', p.is_platform_official,
      'is_platform_yargic', p.is_platform_yargic,
      'rol', case
        when p.id = v_dispute.yargic_id then 'yargic'
        when p.id = v_dispute.seller_id then 'satici'
        when p.id = v_dispute.buyer_user_id then 'alici'
        else 'uye'
      end
    ) order by case
      when p.id = v_dispute.yargic_id then 0
      when p.id = v_dispute.seller_id then 1
      else 2
    end), '[]'::jsonb)
    into v_uyeler
    from public.message_thread_members m
    join public.profiles p on p.id = m.user_id
    where m.thread_id = p_thread_id;

    return jsonb_build_object(
      'id', coalesce(v_yargic.id, v_uid),
      'display_name', coalesce(nullif(trim(v_title), ''), 'Mahkeme · Takas'),
      'username', coalesce(v_yargic.username, 'yargic'),
      'avatar_url', v_yargic.avatar_url,
      'public_user_id', v_yargic.public_user_id,
      'is_verified', coalesce(v_yargic.is_verified, true),
      'is_platform_official', coalesce(v_yargic.is_platform_official, true),
      'is_platform_yargic', coalesce(v_yargic.is_platform_yargic, true),
      'thread_kind', 'mahkeme',
      'thread_title', coalesce(nullif(trim(v_title), ''), 'Mahkeme · Takas'),
      'closed_at', v_closed,
      'dispute_id', v_dispute.id,
      'dispute_status', v_dispute.status,
      'offer_id', v_dispute.offer_id,
      'yargic_id', v_dispute.yargic_id,
      'can_moderate', (
        v_uid = v_dispute.yargic_id
        or public.ben_admin_miyim()
        or exists (
          select 1 from public.profiles x
          where x.id = v_uid and (x.is_platform_yargic or x.is_admin)
        )
      ),
      'uyeler', v_uyeler
    );
  end if;

  -- Ajans markalı sohbet: kullanıcı tarafında ajans adı
  if v_agency_id is not null then
    select a.id, a.name, a.logo_url, a.agency_public_id, a.owner_id
    into v_agency
    from public.agencies a
    where a.id = v_agency_id;

    if found and v_uid is distinct from v_agency.owner_id then
      return jsonb_build_object(
        'id', v_agency.owner_id,
        'display_name', coalesce(nullif(trim(v_agency.name), ''), 'Ajans'),
        'username', coalesce(v_agency.agency_public_id, 'ajans'),
        'avatar_url', v_agency.logo_url,
        'public_user_id', null,
        'is_verified', false,
        'is_platform_official', false,
        'is_platform_yargic', false,
        'thread_kind', 'dm',
        'closed_at', v_closed,
        'can_moderate', false,
        'peer_agency_id', v_agency.id,
        'agency_name', v_agency.name,
        'agency_logo_url', v_agency.logo_url,
        'uyeler', '[]'::jsonb
      );
    end if;
  end if;

  select p.id, p.display_name, p.username, p.avatar_url, p.public_user_id,
         p.is_verified, p.is_platform_official, p.is_platform_yargic
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
    'public_user_id', v_row.public_user_id,
    'is_verified', coalesce(v_row.is_verified, false),
    'is_platform_official', coalesce(v_row.is_platform_official, false),
    'is_platform_yargic', coalesce(v_row.is_platform_yargic, false),
    'thread_kind', 'dm',
    'closed_at', v_closed,
    'can_moderate', false,
    'peer_agency_id', v_agency_id,
    'uyeler', '[]'::jsonb
  );
end;
$$;

grant execute on function public.mesaj_thread_karsi_profil(uuid) to authenticated;
