-- Takas mahkeme: 3’lü grup (satıcı + alıcı + yargıç), mavi tik, kara, grup kapat
-- Normal DM 1:1 kalır; mahkeme thread_kind = 'mahkeme'

-- ---------------------------------------------------------------------------
-- 1) Profil / thread kolonları
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_platform_official boolean not null default false,
  add column if not exists is_platform_yargic boolean not null default false;

alter table public.message_threads
  add column if not exists thread_kind text not null default 'dm',
  add column if not exists title text,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles(id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'message_threads_kind_chk'
  ) then
    alter table public.message_threads
      add constraint message_threads_kind_chk
      check (thread_kind in ('dm', 'mahkeme'));
  end if;
end $$;

create index if not exists message_threads_kind_idx
  on public.message_threads (thread_kind);

-- ---------------------------------------------------------------------------
-- 2) Mahkeme / anlaşmazlık tablosu
-- ---------------------------------------------------------------------------
create table if not exists public.trade_disputes (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.coin_trade_offers(id) on delete cascade,
  thread_id uuid not null unique references public.message_threads(id) on delete cascade,
  status text not null default 'open'
    check (status in ('open', 'resolved', 'closed', 'kara')),
  reason text not null,
  opened_by uuid not null references public.profiles(id),
  yargic_id uuid not null references public.profiles(id),
  seller_id uuid not null references public.profiles(id),
  buyer_user_id uuid references public.profiles(id),
  buyer_agency_id uuid references public.agencies(id),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trade_disputes_status_idx on public.trade_disputes (status, created_at desc);
create index if not exists trade_disputes_yargic_idx on public.trade_disputes (yargic_id);
create index if not exists trade_disputes_thread_idx on public.trade_disputes (thread_id);

create table if not exists public.trade_dispute_actions (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.trade_disputes(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action text not null
    check (action in ('opened', 'defense', 'kara', 'close', 'warn', 'note')),
  target_user_id uuid references public.profiles(id),
  body text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists trade_dispute_actions_dispute_idx
  on public.trade_dispute_actions (dispute_id, created_at desc);

alter table public.trade_disputes enable row level security;
alter table public.trade_dispute_actions enable row level security;

drop policy if exists trade_disputes_member_select on public.trade_disputes;
create policy trade_disputes_member_select on public.trade_disputes
  for select to authenticated
  using (
    opened_by = auth.uid()
    or seller_id = auth.uid()
    or buyer_user_id = auth.uid()
    or yargic_id = auth.uid()
    or public.ben_admin_miyim()
    or exists (
      select 1 from public.message_thread_members m
      where m.thread_id = trade_disputes.thread_id and m.user_id = auth.uid()
    )
  );

drop policy if exists trade_dispute_actions_member_select on public.trade_dispute_actions;
create policy trade_dispute_actions_member_select on public.trade_dispute_actions
  for select to authenticated
  using (
    exists (
      select 1 from public.trade_disputes d
      join public.message_thread_members m on m.thread_id = d.thread_id
      where d.id = trade_dispute_actions.dispute_id and m.user_id = auth.uid()
    )
    or public.ben_admin_miyim()
  );

-- ---------------------------------------------------------------------------
-- 3) Yargıç seçimi / atama
-- ---------------------------------------------------------------------------
create or replace function public.platform_yargic_getir()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.profiles
  where is_platform_yargic = true
    and deleted_at is null
    and banned_at is null
  order by updated_at desc nulls last
  limit 1;

  if v_id is not null then return v_id; end if;

  select id into v_id
  from public.profiles
  where is_admin = true
    and deleted_at is null
    and banned_at is null
  order by created_at asc
  limit 1;

  return v_id;
end;
$$;

create or replace function public.admin_platform_yargic_ata(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  if p_user_id is null then raise exception 'user required'; end if;

  update public.profiles
  set is_platform_yargic = false, updated_at = now()
  where is_platform_yargic = true and id <> p_user_id;

  update public.profiles set
    is_platform_yargic = true,
    is_platform_official = true,
    is_verified = true,
    updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('ok', true, 'yargic_id', p_user_id);
end;
$$;

grant execute on function public.platform_yargic_getir() to authenticated;
grant execute on function public.admin_platform_yargic_ata(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Inbox: mahkeme gruplarını destekle (DM tek peer)
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
  closed_at timestamptz
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
      else p_peer.id
    end,
    case
      when t.thread_kind = 'mahkeme' then coalesce(
        nullif(trim(t.title), ''),
        'Mahkeme · Takas'
      )
      else coalesce(nullif(trim(p_peer.display_name), ''), nullif(trim(p_peer.username), ''), 'Kullanıcı')
    end,
    case
      when t.thread_kind = 'mahkeme' then coalesce(p_y.username, 'yargic')
      else p_peer.username
    end,
    case
      when t.thread_kind = 'mahkeme' then coalesce(p_y.avatar_url, p_peer.avatar_url)
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
    t.closed_at
  from public.message_thread_members m_me
  join public.message_threads t on t.id = m_me.thread_id
  left join public.trade_disputes d on d.thread_id = t.id
  left join public.profiles p_y on p_y.id = d.yargic_id
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
-- 5) DM aç: yalnızca 2 kişilik dm thread
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
-- 6) mesaj_gonder: kapalı mahkeme + çoklu üye bildirim
-- ---------------------------------------------------------------------------
create or replace function public.mesaj_gonder(
  p_thread_id uuid,
  p_body text default '',
  p_message_type text default 'text',
  p_media_url text default null,
  p_client_id uuid default null
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
  v_peer uuid;
  v_sender_name text;
  v_preview text;
  v_type text := lower(coalesce(nullif(trim(p_message_type), ''), 'text'));
  v_body text := coalesce(p_body, '');
  v_media text := nullif(trim(coalesce(p_media_url, '')), '');
  v_kind text;
  v_closed timestamptz;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_type not in ('text','image','video','voice','emoji','gift','system') then
    raise exception 'Invalid message type';
  end if;
  if public.kill_switch_aktif_mi('kill_gift_send') and v_type = 'gift' then
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

  select thread_kind, closed_at into v_kind, v_closed
  from public.message_threads where id = p_thread_id;

  if v_closed is not null then
    raise exception 'Mahkeme / sohbet kapalı';
  end if;

  if coalesce(v_kind, 'dm') <> 'mahkeme' then
    select user_id into v_peer
    from public.message_thread_members
    where thread_id = p_thread_id and user_id <> v_uid
    limit 1;
    if v_peer is not null and public.kullanicilar_engelli_mi(v_uid, v_peer) then
      raise exception 'Bu kullaniciyla iletisim engellenmis';
    end if;
  end if;

  if p_client_id is not null then
    select * into v_msg from public.direct_messages
    where sender_id = v_uid and client_id = p_client_id
    limit 1;
    if found then return v_msg; end if;
  end if;

  if v_type in ('image','video','voice') then
    if v_media is null then raise exception 'Media required'; end if;
  elsif length(trim(v_body)) = 0 then
    raise exception 'Empty message';
  end if;

  v_preview := case
    when v_type = 'image' then '📷 Fotoğraf'
    when v_type = 'video' then '🎥 Video'
    when v_type = 'voice' then '🎤 Ses'
    when v_type = 'system' then left(trim(v_body), 120)
    else left(trim(v_body), 120)
  end;

  insert into public.direct_messages (
    thread_id, sender_id, body, message_type, media_url, client_id
  ) values (
    p_thread_id,
    v_uid,
    case when length(trim(v_body)) = 0 then null else left(trim(v_body), 4000) end,
    v_type,
    v_media,
    p_client_id
  )
  returning * into v_msg;

  update public.message_threads set
    updated_at = now(),
    last_message_at = now(),
    last_message_preview = v_preview
  where id = p_thread_id;

  update public.message_thread_members set
    archived_at = null,
    deleted_at = null
  where thread_id = p_thread_id
    and (archived_at is not null or deleted_at is not null);

  select coalesce(display_name, username, 'Birisi') into v_sender_name
  from public.profiles where id = v_uid;

  for v_peer in
    select user_id from public.message_thread_members
    where thread_id = p_thread_id and user_id <> v_uid
  loop
    if coalesce(v_kind, 'dm') = 'mahkeme'
       or not public.kullanicilar_engelli_mi(v_uid, v_peer) then
      perform public.bildirim_kuyruga_ekle(
        v_peer,
        'messages',
        case when coalesce(v_kind, 'dm') = 'mahkeme' then 'Mahkeme' else v_sender_name end,
        v_preview,
        '/mesaj/' || p_thread_id::text,
        jsonb_build_object(
          'thread_id', p_thread_id,
          'sender_id', v_uid,
          'type', case when coalesce(v_kind, 'dm') = 'mahkeme' then 'mahkeme' else 'dm' end,
          'message_type', v_type
        )
      );
    end if;
  end loop;

  return v_msg;
end;
$$;

grant execute on function public.mesaj_gonder(uuid, text, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Thread karşı profil → mahkeme meta
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

  select thread_kind, title, closed_at
  into v_kind, v_title, v_closed
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
    'uyeler', '[]'::jsonb
  );
end;
$$;

grant execute on function public.mesaj_thread_karsi_profil(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) Mahkeme kur
-- ---------------------------------------------------------------------------
create or replace function public.takas_mahkeme_kur(
  p_offer_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.coin_trade_offers%rowtype;
  v_existing public.trade_disputes%rowtype;
  v_yargic uuid;
  v_buyer uuid;
  v_agency_owner uuid;
  v_thread uuid;
  v_dispute_id uuid;
  v_reason text := left(trim(coalesce(p_reason, '')), 2000);
  v_body text;
  v_seller_ad text;
  v_buyer_ad text;
  v_msg_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if length(v_reason) < 10 then
    raise exception 'Anlaşmazlık gerekçesi en az 10 karakter olmalı';
  end if;

  select * into v_offer from public.coin_trade_offers where id = p_offer_id for update;
  if not found then raise exception 'Teklif bulunamadı'; end if;

  if v_offer.buyer_type = 'agency' then
    select owner_id into v_agency_owner
    from public.agencies where id = v_offer.buyer_agency_id;
    v_buyer := v_agency_owner;
  else
    v_buyer := v_offer.buyer_user_id;
  end if;

  if v_uid <> v_offer.seller_id
     and v_uid <> coalesce(v_buyer, '00000000-0000-0000-0000-000000000000'::uuid)
     and not public.ben_admin_miyim()
     and not exists (
       select 1 from public.profiles p
       where p.id = v_uid and (p.is_platform_yargic or p.is_admin)
     )
  then
    raise exception 'Forbidden: yalnızca taraf veya platform mahkeme açabilir';
  end if;

  select * into v_existing from public.trade_disputes where offer_id = p_offer_id;
  if found then
    return jsonb_build_object(
      'ok', true,
      'dispute_id', v_existing.id,
      'thread_id', v_existing.thread_id,
      'already', true
    );
  end if;

  v_yargic := public.platform_yargic_getir();
  if v_yargic is null then
    raise exception 'Platform yargıcı tanımlı değil. Admin bir yargıç atamalı.';
  end if;

  if v_buyer is null then raise exception 'Alıcı bulunamadı'; end if;
  if v_buyer = v_offer.seller_id then raise exception 'Geçersiz taraflar'; end if;

  insert into public.message_threads (thread_kind, title)
  values (
    'mahkeme',
    'Mahkeme · ' || left(p_offer_id::text, 8)
  )
  returning id into v_thread;

  insert into public.message_thread_members (thread_id, user_id)
  values
    (v_thread, v_offer.seller_id),
    (v_thread, v_buyer),
    (v_thread, v_yargic)
  on conflict do nothing;

  insert into public.trade_disputes (
    offer_id, thread_id, status, reason, opened_by, yargic_id,
    seller_id, buyer_user_id, buyer_agency_id
  ) values (
    p_offer_id, v_thread, 'open', v_reason, v_uid, v_yargic,
    v_offer.seller_id,
    case when v_offer.buyer_type = 'user' then v_offer.buyer_user_id end,
    case when v_offer.buyer_type = 'agency' then v_offer.buyer_agency_id end
  )
  returning id into v_dispute_id;

  v_seller_ad := public.profil_gosterim_adi(v_offer.seller_id);
  v_buyer_ad := public.profil_gosterim_adi(v_buyer);

  v_body :=
    '⚖️ MUTA MAHKEME AÇILDI' || E'\n\n'
    || 'Teklif: ' || p_offer_id::text || E'\n'
    || 'Durum: ' || coalesce(v_offer.status, '—') || E'\n'
    || 'Coin: ' || coalesce(v_offer.coins::text, '0') || E'\n'
    || 'Katalog: ' || coalesce(v_offer.katalog_tl::text, '—') || ' ₺' || E'\n'
    || 'Satıcı net (%40): ' || coalesce(v_offer.satici_net_tl::text, '—') || ' ₺' || E'\n'
    || 'Platform (%60): ' || coalesce(v_offer.platform_pay_tl::text, '—') || ' ₺' || E'\n'
    || 'Ödeme penceresi: ' || coalesce(v_offer.odeme_pencere, '01–15 / 15–31') || E'\n'
    || 'Teklif zamanı: ' || to_char(v_offer.created_at at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI') || E'\n'
    || 'Satıcı: ' || coalesce(v_seller_ad, '—') || E'\n'
    || 'Alıcı: ' || coalesce(v_buyer_ad, '—') || E'\n'
    || 'Açan: ' || coalesce(public.profil_gosterim_adi(v_uid), '—') || E'\n\n'
    || 'Anlaşmazlık gerekçesi:' || E'\n' || v_reason || E'\n\n'
    || 'Bu grupta satıcı, alıcı ve platform yargıcı yer alır. Savunmalarınızı buraya yazın.' || E'\n'
    || 'Dolandırıcılık, sahte dekont, cevap vermeme veya usulsüzlükte platform KARA işlemi başlatabilir; hesap askıya alınabilir / kapatılabilir.' || E'\n'
    || 'Grubu kapatma yetkisi yalnızca platform yargıcındadır.';

  insert into public.direct_messages (
    thread_id, sender_id, body, message_type
  ) values (
    v_thread, v_yargic, left(v_body, 4000), 'system'
  )
  returning id into v_msg_id;

  update public.message_threads set
    last_message_at = now(),
    last_message_preview = left(v_body, 120),
    updated_at = now()
  where id = v_thread;

  insert into public.trade_dispute_actions (
    dispute_id, actor_id, action, body, meta
  ) values (
    v_dispute_id, v_uid, 'opened', v_reason,
    jsonb_build_object('offer_id', p_offer_id, 'message_id', v_msg_id)
  );

  -- Bildirimler
  perform public.bildirim_kuyruga_ekle(
    v_offer.seller_id, 'wallet', 'Mahkeme açıldı',
    'Takas anlaşmazlığı için mahkeme kuruldu. Savunmanızı yazın.',
    '/mesaj/' || v_thread::text,
    jsonb_build_object('type', 'mahkeme', 'dispute_id', v_dispute_id, 'thread_id', v_thread)
  );
  if v_buyer <> v_offer.seller_id then
    perform public.bildirim_kuyruga_ekle(
      v_buyer, 'wallet', 'Mahkeme açıldı',
      'Takas anlaşmazlığı için mahkeme kuruldu. Savunmanızı yazın.',
      '/mesaj/' || v_thread::text,
      jsonb_build_object('type', 'mahkeme', 'dispute_id', v_dispute_id, 'thread_id', v_thread)
    );
  end if;
  if v_yargic <> v_uid then
    perform public.bildirim_kuyruga_ekle(
      v_yargic, 'wallet', 'Yeni mahkeme',
      'İnceleme bekleyen takas mahkemesi.',
      '/mesaj/' || v_thread::text,
      jsonb_build_object('type', 'mahkeme', 'dispute_id', v_dispute_id, 'thread_id', v_thread)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'dispute_id', v_dispute_id,
    'thread_id', v_thread,
    'already', false
  );
end;
$$;

grant execute on function public.takas_mahkeme_kur(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9) Kara mekanizması (yargıç / admin)
-- ---------------------------------------------------------------------------
create or replace function public.takas_mahkeme_kara_ac(
  p_dispute_id uuid,
  p_target_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_d public.trade_disputes%rowtype;
  v_reason text := left(trim(coalesce(p_reason, '')), 2000);
  v_body text;
  v_target_ad text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if length(v_reason) < 8 then
    raise exception 'Kara gerekçesi en az 8 karakter olmalı';
  end if;

  select * into v_d from public.trade_disputes where id = p_dispute_id for update;
  if not found then raise exception 'Mahkeme bulunamadı'; end if;

  if v_uid <> v_d.yargic_id
     and not public.ben_admin_miyim()
     and not exists (
       select 1 from public.profiles p
       where p.id = v_uid and p.is_platform_yargic
     )
  then
    raise exception 'Forbidden: yalnızca yargıç / platform';
  end if;

  if p_target_user_id is null
     or (
       p_target_user_id <> v_d.seller_id
       and p_target_user_id is distinct from v_d.buyer_user_id
       and not exists (
         select 1 from public.agencies a
         where a.id = v_d.buyer_agency_id and a.owner_id = p_target_user_id
       )
     )
  then
    raise exception 'Hedef taraf mahkemede değil';
  end if;

  if p_target_user_id = v_d.yargic_id then
    raise exception 'Yargıç kara listelenemez';
  end if;

  -- Yargıç admin olmasa da mahkemeden kara (ban) uygulayabilir
  update public.profiles set
    banned_at = now(),
    ban_reason = 'mahkeme_kara: ' || v_reason,
    updated_at = now()
  where id = p_target_user_id;

  update public.device_sessions
    set revoked_at = now()
  where user_id = p_target_user_id and revoked_at is null;

  begin
    perform public.platform_guvenlik_ban_cihazlar(p_target_user_id, 'mahkeme_kara: ' || v_reason);
  exception when undefined_function then
    null;
  end;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    p_target_user_id, 'account_banned', 'high',
    jsonb_build_object(
      'reason', 'mahkeme_kara: ' || v_reason,
      'by', v_uid,
      'dispute_id', p_dispute_id,
      'source', 'mahkeme'
    )
  );

  update public.trade_disputes set
    status = 'kara',
    updated_at = now()
  where id = p_dispute_id;

  v_target_ad := public.profil_gosterim_adi(p_target_user_id);
  v_body :=
    '⬛ KARA İŞLEM AÇILDI' || E'\n\n'
    || 'Hedef: ' || coalesce(v_target_ad, p_target_user_id::text) || E'\n'
    || 'Gerekçe: ' || v_reason || E'\n\n'
    || 'Platform incelemesi sonucu hesap işlemi başlatıldı (askı / kapatma yolu).'
    || ' Bu karar mahkeme kaydına işlendi.';

  insert into public.direct_messages (
    thread_id, sender_id, body, message_type
  ) values (
    v_d.thread_id, v_uid, left(v_body, 4000), 'system'
  );

  update public.message_threads set
    last_message_at = now(),
    last_message_preview = left(v_body, 120),
    updated_at = now()
  where id = v_d.thread_id;

  insert into public.trade_dispute_actions (
    dispute_id, actor_id, action, target_user_id, body, meta
  ) values (
    p_dispute_id, v_uid, 'kara', p_target_user_id, v_reason,
    jsonb_build_object('ban', true)
  );

  return jsonb_build_object('ok', true, 'status', 'kara');
end;
$$;

grant execute on function public.takas_mahkeme_kara_ac(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 10) Mahkeme grubunu kapat (yalnızca platform)
-- ---------------------------------------------------------------------------
create or replace function public.takas_mahkeme_kapat(
  p_dispute_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_d public.trade_disputes%rowtype;
  v_note text := left(trim(coalesce(p_note, 'Mahkeme platform tarafından kapatıldı.')), 1000);
  v_body text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_d from public.trade_disputes where id = p_dispute_id for update;
  if not found then raise exception 'Mahkeme bulunamadı'; end if;

  if v_uid <> v_d.yargic_id
     and not public.ben_admin_miyim()
     and not exists (
       select 1 from public.profiles p
       where p.id = v_uid and p.is_platform_yargic
     )
  then
    raise exception 'Forbidden: yalnızca yargıç / platform grubu kapatabilir';
  end if;

  update public.trade_disputes set
    status = case when status = 'kara' then 'kara' else 'closed' end,
    closed_at = now(),
    closed_by = v_uid,
    updated_at = now()
  where id = p_dispute_id;

  update public.message_threads set
    closed_at = now(),
    closed_by = v_uid,
    updated_at = now()
  where id = v_d.thread_id;

  v_body := '🔒 MAHKEME KAPATILDI' || E'\n\n' || v_note;

  insert into public.direct_messages (
    thread_id, sender_id, body, message_type
  ) values (
    v_d.thread_id, v_uid, left(v_body, 4000), 'system'
  );

  update public.message_threads set
    last_message_at = now(),
    last_message_preview = left(v_body, 120)
  where id = v_d.thread_id;

  insert into public.trade_dispute_actions (
    dispute_id, actor_id, action, body
  ) values (
    p_dispute_id, v_uid, 'close', v_note
  );

  return jsonb_build_object('ok', true, 'closed', true);
end;
$$;

grant execute on function public.takas_mahkeme_kapat(uuid, text) to authenticated;

-- Platform resmi hesapları (yargıç profili dokununca)
create or replace function public.platform_resmi_hesaplari_listele()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'username', p.username,
    'avatar_url', p.avatar_url,
    'public_user_id', p.public_user_id,
    'is_platform_official', p.is_platform_official,
    'is_platform_yargic', p.is_platform_yargic,
    'is_verified', p.is_verified
  ) order by p.is_platform_yargic desc, p.display_name), '[]'::jsonb)
  from public.profiles p
  where (p.is_platform_official or p.is_platform_yargic)
    and p.deleted_at is null
    and p.banned_at is null;
$$;

grant execute on function public.platform_resmi_hesaplari_listele() to authenticated;
