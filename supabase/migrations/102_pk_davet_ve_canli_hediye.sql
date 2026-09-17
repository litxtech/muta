-- 102: TikTok tarzı canlı PK daveti + canlı hediye→PK skor + cüzdan anlık kazanç

-- ---------------------------------------------------------------------------
-- PK davetleri
-- ---------------------------------------------------------------------------
create table if not exists public.pk_invites (
  id uuid primary key default gen_random_uuid(),
  from_live_id uuid not null references public.live_sessions(id) on delete cascade,
  to_live_id uuid not null references public.live_sessions(id) on delete cascade,
  from_host_id uuid not null references public.profiles(id) on delete cascade,
  to_host_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  sure_saniye int not null default 300
    check (sure_saniye >= 60 and sure_saniye <= 3600),
  match_id uuid references public.pk_matches(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 seconds'),
  responded_at timestamptz,
  constraint pk_invites_farkli_live check (from_live_id <> to_live_id),
  constraint pk_invites_farkli_host check (from_host_id <> to_host_id)
);

create index if not exists pk_invites_to_pending_idx
  on public.pk_invites (to_host_id, status, created_at desc)
  where status = 'pending';

create index if not exists pk_invites_from_pending_idx
  on public.pk_invites (from_host_id, status, created_at desc)
  where status = 'pending';

create index if not exists pk_invites_to_live_pending_idx
  on public.pk_invites (to_live_id, status)
  where status = 'pending';

alter table public.pk_invites enable row level security;

drop policy if exists "PK invites readable parties" on public.pk_invites;
create policy "PK invites readable parties" on public.pk_invites
  for select to authenticated
  using (auth.uid() = from_host_id or auth.uid() = to_host_id);

grant select on public.pk_invites to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.pk_invites;
  exception when duplicate_object then
    null;
  end;
end $$;

alter table public.pk_invites replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.pk_matches;
  exception when duplicate_object then
    null;
  end;
end $$;

alter table public.pk_matches replica identity full;

-- ---------------------------------------------------------------------------
-- Davet gönder
-- ---------------------------------------------------------------------------
create or replace function public.pk_davet_gonder(
  p_from_live_id uuid,
  p_to_live_id uuid,
  p_sure_saniye int default 300
)
returns public.pk_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_from public.live_sessions%rowtype;
  v_to public.live_sessions%rowtype;
  v_sure int := greatest(60, least(coalesce(p_sure_saniye, 300), 3600));
  v_row public.pk_invites%rowtype;
  v_from_name text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_pk') then
    raise exception 'PK temporarily disabled';
  end if;
  if not public.ozellik_bayragi_aktif_mi('pk_enabled') then
    raise exception 'PK feature disabled';
  end if;

  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot invite PK'; end if;

  if p_from_live_id is null or p_to_live_id is null then
    raise exception 'Both live sessions required';
  end if;
  if p_from_live_id = p_to_live_id then
    raise exception 'Cannot PK yourself';
  end if;

  select * into v_from from public.live_sessions where id = p_from_live_id for update;
  if not found or not v_from.is_live then raise exception 'Your live session not found'; end if;
  if v_from.host_id <> v_uid then raise exception 'Not your live session'; end if;

  select * into v_to from public.live_sessions where id = p_to_live_id for update;
  if not found or not v_to.is_live then raise exception 'Opponent live session not found'; end if;
  if v_to.host_id = v_uid then raise exception 'Cannot PK yourself'; end if;

  -- Taraflardan biri zaten canlı PK'deyse engelle
  if exists (
    select 1 from public.pk_matches m
    where m.status = 'live'
      and (
        m.live_a_id in (p_from_live_id, p_to_live_id)
        or m.live_b_id in (p_from_live_id, p_to_live_id)
      )
      and (m.ends_at is null or m.ends_at > now())
  ) then
    raise exception 'One side already in live PK';
  end if;

  -- Bekleyen davetleri süresi dolmuş say
  update public.pk_invites
  set status = 'expired', responded_at = now()
  where status = 'pending'
    and expires_at <= now()
    and (
      from_live_id in (p_from_live_id, p_to_live_id)
      or to_live_id in (p_from_live_id, p_to_live_id)
      or from_host_id in (v_uid, v_to.host_id)
      or to_host_id in (v_uid, v_to.host_id)
    );

  if exists (
    select 1 from public.pk_invites i
    where i.status = 'pending'
      and (
        i.from_live_id in (p_from_live_id, p_to_live_id)
        or i.to_live_id in (p_from_live_id, p_to_live_id)
      )
  ) then
    raise exception 'Pending PK invite already exists';
  end if;

  insert into public.pk_invites (
    from_live_id, to_live_id, from_host_id, to_host_id, status, sure_saniye, expires_at
  ) values (
    p_from_live_id, p_to_live_id, v_uid, v_to.host_id, 'pending', v_sure,
    now() + interval '60 seconds'
  )
  returning * into v_row;

  select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), 'Yayıncı')
  into v_from_name
  from public.profiles where id = v_uid;

  perform public.bildirim_kuyruga_ekle(
    v_to.host_id,
    'live',
    'PK daveti',
    v_from_name || ' seni canlı PK''ye davet etti',
    '/canli',
    jsonb_build_object(
      'invite_id', v_row.id,
      'from_live_id', p_from_live_id,
      'to_live_id', p_to_live_id,
      'from_host_id', v_uid
    )
  );

  return v_row;
end;
$$;

grant execute on function public.pk_davet_gonder(uuid, uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Davet yanıtla (kabul → maç başlar)
-- ---------------------------------------------------------------------------
create or replace function public.pk_davet_yanitla(
  p_invite_id uuid,
  p_kabul boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.pk_invites%rowtype;
  v_from public.live_sessions%rowtype;
  v_to public.live_sessions%rowtype;
  v_match public.pk_matches%rowtype;
  v_from_name text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_inv from public.pk_invites where id = p_invite_id for update;
  if not found then raise exception 'Invite not found'; end if;
  if v_inv.to_host_id <> v_uid then raise exception 'Not authorized'; end if;
  if v_inv.status <> 'pending' then raise exception 'Invite already resolved'; end if;

  if v_inv.expires_at <= now() then
    update public.pk_invites
    set status = 'expired', responded_at = now()
    where id = p_invite_id
    returning * into v_inv;
    return jsonb_build_object('ok', false, 'status', 'expired', 'invite_id', v_inv.id);
  end if;

  if not p_kabul then
    update public.pk_invites
    set status = 'rejected', responded_at = now()
    where id = p_invite_id
    returning * into v_inv;

    select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), 'Yayıncı')
    into v_from_name
    from public.profiles where id = v_uid;

    perform public.bildirim_kuyruga_ekle(
      v_inv.from_host_id,
      'live',
      'PK reddedildi',
      v_from_name || ' PK davetini reddetti',
      '/canli',
      jsonb_build_object('invite_id', v_inv.id, 'status', 'rejected')
    );

    return jsonb_build_object('ok', true, 'status', 'rejected', 'invite_id', v_inv.id);
  end if;

  select * into v_from from public.live_sessions where id = v_inv.from_live_id;
  select * into v_to from public.live_sessions where id = v_inv.to_live_id;
  if not found or not v_from.is_live or not v_to.is_live then
    update public.pk_invites
    set status = 'expired', responded_at = now()
    where id = p_invite_id;
    raise exception 'Live session ended';
  end if;

  if exists (
    select 1 from public.pk_matches m
    where m.status = 'live'
      and (
        m.live_a_id in (v_inv.from_live_id, v_inv.to_live_id)
        or m.live_b_id in (v_inv.from_live_id, v_inv.to_live_id)
      )
      and (m.ends_at is null or m.ends_at > now())
  ) then
    raise exception 'Already in live PK';
  end if;

  insert into public.pk_matches (
    pk_type, status, live_a_id, live_b_id,
    score_a, score_b, started_at, ends_at
  ) values (
    '1v1', 'live', v_inv.from_live_id, v_inv.to_live_id,
    0, 0, now(), now() + make_interval(secs => v_inv.sure_saniye)
  )
  returning * into v_match;

  update public.pk_invites
  set status = 'accepted', responded_at = now(), match_id = v_match.id
  where id = p_invite_id
  returning * into v_inv;

  select coalesce(nullif(trim(display_name), ''), nullif(trim(username), ''), 'Yayıncı')
  into v_from_name
  from public.profiles where id = v_uid;

  perform public.bildirim_kuyruga_ekle(
    v_inv.from_host_id,
    'live',
    'PK kabul edildi',
    v_from_name || ' PK davetini kabul etti — maç başladı!',
    '/pk',
    jsonb_build_object(
      'invite_id', v_inv.id,
      'match_id', v_match.id,
      'status', 'accepted'
    )
  );

  return jsonb_build_object(
    'ok', true,
    'status', 'accepted',
    'invite_id', v_inv.id,
    'match_id', v_match.id,
    'ends_at', v_match.ends_at
  );
end;
$$;

grant execute on function public.pk_davet_yanitla(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Davet iptal (gönderen)
-- ---------------------------------------------------------------------------
create or replace function public.pk_davet_iptal(p_invite_id uuid)
returns public.pk_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.pk_invites%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_inv from public.pk_invites where id = p_invite_id for update;
  if not found then raise exception 'Invite not found'; end if;
  if v_inv.from_host_id <> v_uid then raise exception 'Not authorized'; end if;
  if v_inv.status <> 'pending' then raise exception 'Invite already resolved'; end if;

  update public.pk_invites
  set status = 'cancelled', responded_at = now()
  where id = p_invite_id
  returning * into v_inv;

  return v_inv;
end;
$$;

grant execute on function public.pk_davet_iptal(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- send_gift: canlı PK skorunu alıcı tarafına işle (oda + canlı)
-- ---------------------------------------------------------------------------
create or replace function public.send_gift(
  p_room_id uuid,
  p_receiver_id uuid,
  p_gift_id uuid,
  p_quantity int default 1,
  p_idempotency_key text default null,
  p_status_id uuid default null,
  p_live_session_id uuid default null
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
  v_recv_live uuid;
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

  -- Alıcı cüzdanı anlık elmas kazancı
  perform 1 from public.wallets where user_id = p_receiver_id for update;
  insert into public.wallets (user_id, coins, diamonds)
  values (p_receiver_id, 0, 0)
  on conflict (user_id) do nothing;
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

  -- Hediye hangi yayına işlensin: açıkça verilen veya alıcının aktif yayını
  v_live_id := p_live_session_id;
  if v_live_id is not null then
    if not exists (
      select 1 from public.live_sessions
      where id = v_live_id and host_id = p_receiver_id and is_live = true
    ) then
      v_live_id := null;
    end if;
  end if;

  if v_live_id is null then
    select id into v_live_id
    from public.live_sessions
    where host_id = p_receiver_id and is_live = true
    order by started_at desc
    limit 1;
  end if;

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
    status_id, live_session_id
  ) values (
    p_room_id, v_sender, p_receiver_id, p_gift_id, p_quantity,
    v_cost, v_diamonds, nullif(trim(p_idempotency_key), ''), 0,
    p_status_id, v_live_id
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
      jsonb_build_object(
        'coins_spent', v_cost,
        'diamonds', v_diamonds,
        'try_estimate', round((v_cost::numeric) * 0.1, 2)
      )
    )
    on conflict (idempotency_key) do nothing;
  end if;

  -- PK skor: oda veya canlı — alıcının tarafına
  if not public.kill_switch_aktif_mi('kill_pk') then
    v_pk_id := null;
    v_pk_side := null;

    if p_room_id is not null then
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
    end if;

    if v_pk_id is null then
      v_recv_live := v_live_id;
      if v_recv_live is null then
        select id into v_recv_live
        from public.live_sessions
        where host_id = p_receiver_id and is_live = true
        order by started_at desc
        limit 1;
      end if;

      if v_recv_live is not null then
        select m.id,
          case
            when m.live_a_id = v_recv_live then 'a'
            when m.live_b_id = v_recv_live then 'b'
            else null
          end
        into v_pk_id, v_pk_side
        from public.pk_matches m
        where m.status = 'live'
          and (m.live_a_id = v_recv_live or m.live_b_id = v_recv_live)
          and (m.ends_at is null or m.ends_at > now())
        order by m.started_at desc
        limit 1;
      end if;
    end if;

    -- Alıcı host_id ile de eşleştir (PK'da seçilen yayıncı)
    if v_pk_id is null then
      select m.id,
        case
          when la.host_id = p_receiver_id then 'a'
          when lb.host_id = p_receiver_id then 'b'
          else null
        end
      into v_pk_id, v_pk_side
      from public.pk_matches m
      left join public.live_sessions la on la.id = m.live_a_id
      left join public.live_sessions lb on lb.id = m.live_b_id
      where m.status = 'live'
        and (m.ends_at is null or m.ends_at > now())
        and (la.host_id = p_receiver_id or lb.host_id = p_receiver_id)
      order by m.started_at desc
      limit 1;
    end if;

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

grant execute on function public.send_gift(uuid, uuid, uuid, int, text, uuid, uuid) to authenticated;
