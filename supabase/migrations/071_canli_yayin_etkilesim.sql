-- Canlı yayın: beğeni, hediye/coin sayacı, izleyici, moderasyon (at/ban)

alter table public.live_sessions
  add column if not exists like_count int not null default 0,
  add column if not exists gift_count int not null default 0,
  add column if not exists total_coins_earned bigint not null default 0;

-- Beğeniler (ekrana dokunma — kullanıcı başına 1 sayım)
create table if not exists public.live_session_likes (
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index if not exists live_session_likes_session_idx
  on public.live_session_likes (session_id, created_at desc);

alter table public.live_session_likes enable row level security;

drop policy if exists "Live likes readable" on public.live_session_likes;
create policy "Live likes readable" on public.live_session_likes
  for select to authenticated using (true);

-- Yayıncı atma / engelleme
create table if not exists public.live_session_bans (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('kick', 'ban')),
  reason text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (session_id, user_id)
);

create index if not exists live_session_bans_session_idx
  on public.live_session_bans (session_id);

alter table public.live_session_bans enable row level security;

drop policy if exists "Live bans host read" on public.live_session_bans;
create policy "Live bans host read" on public.live_session_bans
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.live_sessions s
      where s.id = session_id and s.host_id = auth.uid()
    )
  );

-- Aktif izleyiciler
create table if not exists public.live_session_viewers (
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index if not exists live_session_viewers_session_idx
  on public.live_session_viewers (session_id);

alter table public.live_session_viewers enable row level security;

drop policy if exists "Live viewers readable" on public.live_session_viewers;
create policy "Live viewers readable" on public.live_session_viewers
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Beğeni
-- ---------------------------------------------------------------------------
create or replace function public.canli_yayin_begen(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_live boolean;
  v_banned boolean;
  v_count int;
  v_yeni boolean := false;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then
    raise exception 'Misafir beğeni yapamaz';
  end if;

  select is_live into v_live from public.live_sessions where id = p_session_id;
  if not coalesce(v_live, false) then
    raise exception 'Yayın aktif değil';
  end if;

  select exists(
    select 1 from public.live_session_bans b
    where b.session_id = p_session_id
      and b.user_id = v_uid
      and b.action = 'ban'
      and (b.expires_at is null or b.expires_at > now())
  ) into v_banned;
  if v_banned then
    raise exception 'Bu yayından engellendin';
  end if;

  if not exists (
    select 1 from public.live_session_likes
    where session_id = p_session_id and user_id = v_uid
  ) then
    insert into public.live_session_likes (session_id, user_id)
    values (p_session_id, v_uid);
    v_yeni := true;
    update public.live_sessions
      set like_count = like_count + 1,
          score = score + 1
    where id = p_session_id;
  end if;

  select like_count into v_count from public.live_sessions where id = p_session_id;

  return jsonb_build_object(
    'ok', true,
    'liked', true,
    'like_count', coalesce(v_count, 0),
    'first', v_yeni
  );
end;
$$;

grant execute on function public.canli_yayin_begen(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- İzleyici gir / çık
-- ---------------------------------------------------------------------------
create or replace function public.canli_yayin_izleyici_gir(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
  v_live boolean;
  v_banned boolean;
  v_count int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select host_id, is_live into v_host, v_live
  from public.live_sessions where id = p_session_id;
  if not coalesce(v_live, false) then
    raise exception 'Yayın aktif değil';
  end if;

  select exists(
    select 1 from public.live_session_bans b
    where b.session_id = p_session_id
      and b.user_id = v_uid
      and (b.expires_at is null or b.expires_at > now())
  ) into v_banned;
  if v_banned then
    raise exception 'Bu yayına giremezsin';
  end if;

  if v_uid <> v_host then
    insert into public.live_session_viewers (session_id, user_id)
    values (p_session_id, v_uid)
    on conflict (session_id, user_id) do update
      set last_seen_at = now();
  end if;

  select count(*)::int into v_count
  from public.live_session_viewers
  where session_id = p_session_id;

  update public.live_sessions
    set viewer_count = v_count
  where id = p_session_id;

  return jsonb_build_object('ok', true, 'viewer_count', v_count);
end;
$$;

create or replace function public.canli_yayin_izleyici_cik(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  delete from public.live_session_viewers
  where session_id = p_session_id and user_id = v_uid;

  select count(*)::int into v_count
  from public.live_session_viewers
  where session_id = p_session_id;

  update public.live_sessions
    set viewer_count = v_count
  where id = p_session_id and is_live = true;

  return jsonb_build_object('ok', true, 'viewer_count', v_count);
end;
$$;

grant execute on function public.canli_yayin_izleyici_gir(uuid) to authenticated;
grant execute on function public.canli_yayin_izleyici_cik(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Yayıncı moderasyon: kick / ban / unban
-- ---------------------------------------------------------------------------
create or replace function public.canli_yayin_moderasyon(
  p_session_id uuid,
  p_target_user_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_action not in ('kick', 'ban', 'unban') then
    raise exception 'Geçersiz aksiyon';
  end if;

  select host_id into v_host
  from public.live_sessions where id = p_session_id;
  if v_host is null then raise exception 'Yayın bulunamadı'; end if;
  if v_host <> v_uid then raise exception 'Sadece yayıncı moderasyon yapabilir'; end if;
  if p_target_user_id = v_uid then raise exception 'Kendine aksiyon uygulanamaz'; end if;

  if p_action = 'unban' then
    delete from public.live_session_bans
    where session_id = p_session_id and user_id = p_target_user_id;
  else
    insert into public.live_session_bans (
      session_id, user_id, action, reason, created_by, expires_at
    ) values (
      p_session_id,
      p_target_user_id,
      p_action,
      p_reason,
      v_uid,
      case when p_action = 'kick' then now() + interval '6 hours' else null end
    )
    on conflict (session_id, user_id) do update
      set action = excluded.action,
          reason = excluded.reason,
          created_by = excluded.created_by,
          created_at = now(),
          expires_at = excluded.expires_at;

    delete from public.live_session_viewers
    where session_id = p_session_id and user_id = p_target_user_id;

    update public.live_sessions s
      set viewer_count = (
        select count(*)::int from public.live_session_viewers v where v.session_id = s.id
      )
    where s.id = p_session_id;
  end if;

  return jsonb_build_object('ok', true, 'action', p_action);
end;
$$;

grant execute on function public.canli_yayin_moderasyon(uuid, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- send_gift: 070 + aktif canlı yayına hediye/coin yansıt
-- ---------------------------------------------------------------------------
create or replace function public.send_gift(
  p_room_id uuid,
  p_receiver_id uuid,
  p_gift_id uuid,
  p_quantity int default 1,
  p_idempotency_key text default null,
  p_status_id uuid default null
)
returns public.gift_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_gift public.gifts%rowtype;
  v_cost bigint;
  v_diamonds bigint;
  v_sender_coins bigint;
  v_tx public.gift_transactions%rowtype;
  v_is_guest boolean;
  v_existing uuid;
  v_pk_id uuid;
  v_pk_side text;
  v_status_owner uuid;
  v_status_deleted timestamptz;
  v_live_id uuid;
begin
  if v_sender is null then
    raise exception 'Not authenticated';
  end if;

  if public.kill_switch_aktif_mi('kill_gift_send') then
    raise exception 'Gift send temporarily disabled';
  end if;

  if not public.ozellik_bayragi_aktif_mi('gifts_enabled') then
    raise exception 'Gifts feature disabled';
  end if;

  select is_guest into v_is_guest from public.profiles where id = v_sender;
  if coalesce(v_is_guest, false) then
    raise exception 'Guest cannot send gifts';
  end if;

  if p_quantity < 1 then
    raise exception 'Invalid quantity';
  end if;
  if v_sender = p_receiver_id then
    raise exception 'Cannot gift yourself';
  end if;

  if p_status_id is not null then
    select user_id, deleted_at into v_status_owner, v_status_deleted
    from public.status_posts where id = p_status_id;
    if v_status_owner is null or v_status_deleted is not null then
      raise exception 'Status not found';
    end if;
    if v_status_owner <> p_receiver_id then
      raise exception 'Gift receiver must be status owner';
    end if;
  end if;

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    select result_ref into v_existing
    from public.finance_idempotency_keys
    where idempotency_key = p_idempotency_key and user_id = v_sender;

    if v_existing is not null then
      select * into v_tx from public.gift_transactions where id = v_existing;
      if found then
        return v_tx;
      end if;
    end if;
  end if;

  select * into v_gift from public.gifts where id = p_gift_id and is_active;
  if not found then
    raise exception 'Gift not found';
  end if;

  v_cost := v_gift.coin_cost * p_quantity;
  v_diamonds := v_gift.diamond_value * p_quantity;

  select coins into v_sender_coins from public.wallets where user_id = v_sender for update;
  if v_sender_coins is null or v_sender_coins < v_cost then
    raise exception 'Insufficient coins';
  end if;

  perform 1 from public.wallets where user_id = p_receiver_id for update;
  insert into public.host_earnings (user_id, diamonds)
  values (p_receiver_id, 0)
  on conflict (user_id) do nothing;
  perform 1 from public.host_earnings where user_id = p_receiver_id for update;

  update public.wallets
    set coins = coins - v_cost, updated_at = now()
    where user_id = v_sender;

  update public.wallets
    set diamonds = diamonds + v_diamonds, updated_at = now()
    where user_id = p_receiver_id;

  update public.host_earnings
    set diamonds = diamonds + v_diamonds, updated_at = now()
    where user_id = p_receiver_id;

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type)
  values (
    v_sender, 'coins', -v_cost,
    (select coins from public.wallets where user_id = v_sender),
    'gift_sent', 'gift'
  );

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type)
  values (
    p_receiver_id, 'diamonds', v_diamonds,
    (select diamonds from public.wallets where user_id = p_receiver_id),
    'gift_received', 'gift'
  );

  insert into public.host_earnings_ledger (user_id, delta, balance_after, reason, ref_type)
  values (
    p_receiver_id, v_diamonds,
    (select diamonds from public.host_earnings where user_id = p_receiver_id),
    'gift_received', 'gift'
  );

  if p_room_id is not null then
    update public.rooms
      set total_coins_earned = total_coins_earned + v_cost
      where id = p_room_id;
  end if;

  -- Aktif canlı yayın popülerlik
  select id into v_live_id
  from public.live_sessions
  where host_id = p_receiver_id and is_live = true
  order by started_at desc
  limit 1;

  if v_live_id is not null then
    update public.live_sessions
      set gift_count = gift_count + p_quantity,
          total_coins_earned = total_coins_earned + v_cost,
          score = score + v_cost
    where id = v_live_id;
  end if;

  insert into public.gift_transactions (
    room_id, sender_id, receiver_id, gift_id, quantity,
    coins_spent, diamonds_earned, idempotency_key, agency_commission_snapshot,
    status_id
  ) values (
    p_room_id, v_sender, p_receiver_id, p_gift_id, p_quantity,
    v_cost, v_diamonds, nullif(trim(p_idempotency_key), ''), 0,
    p_status_id
  ) returning * into v_tx;

  if p_status_id is not null then
    update public.status_posts
      set gift_count = gift_count + p_quantity,
          updated_at = now()
      where id = p_status_id and deleted_at is null;
  end if;

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    insert into public.finance_idempotency_keys (
      idempotency_key, user_id, operation, result_ref, result_payload
    ) values (
      p_idempotency_key, v_sender, 'gift_send', v_tx.id,
      jsonb_build_object('coins_spent', v_cost, 'diamonds', v_diamonds)
    )
    on conflict (idempotency_key) do nothing;
  end if;

  if p_room_id is not null and not public.kill_switch_aktif_mi('kill_pk') then
    select m.id,
      case
        when m.room_a_id = p_room_id then 'a'
        when m.room_b_id = p_room_id then 'b'
        else null
      end
    into v_pk_id, v_pk_side
    from public.pk_matches m
    where m.status = 'live'
      and (m.room_a_id = p_room_id or m.room_b_id = p_room_id)
      and (m.ends_at is null or m.ends_at > now())
    order by m.started_at desc
    limit 1;

    if v_pk_id is not null and v_pk_side is not null then
      begin
        perform public.pk_skor_ekle(v_pk_id, v_pk_side, v_cost, 'gift', v_tx.id);
      exception when others then
        null;
      end;
    end if;
  end if;

  return v_tx;
end;
$$;

grant execute on function public.send_gift(uuid, uuid, uuid, int, text, uuid) to authenticated;

-- Banlı kullanıcı sohbet yazamasın
create or replace function public.canli_sohbet_mesaji_gonder(
  p_session_id uuid,
  p_body text
)
returns public.live_chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_host uuid;
  v_row public.live_chat_messages%rowtype;
  v_text text := trim(coalesce(p_body, ''));
  v_banned boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir canli sohbete yazamaz'; end if;
  if char_length(v_text) < 1 or char_length(v_text) > 500 then
    raise exception 'Gecersiz mesaj';
  end if;
  if not exists (
    select 1 from public.live_sessions where id = p_session_id and is_live = true
  ) then
    raise exception 'Yayin aktif degil';
  end if;

  select host_id into v_host from public.live_sessions where id = p_session_id;
  if v_host is not null and public.kullanicilar_engelli_mi(v_uid, v_host) then
    raise exception 'Bu kullaniciyla iletisim engellenmis';
  end if;

  select exists(
    select 1 from public.live_session_bans b
    where b.session_id = p_session_id
      and b.user_id = v_uid
      and (b.expires_at is null or b.expires_at > now())
  ) into v_banned;
  if v_banned then
    raise exception 'Bu yayından engellendin';
  end if;

  insert into public.live_chat_messages (session_id, user_id, body)
  values (p_session_id, v_uid, v_text)
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function public.canli_sohbet_mesaji_gonder(uuid, text) to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.live_session_likes;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.live_session_viewers;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.live_session_bans;
  exception when duplicate_object then null;
  end;
end $$;
