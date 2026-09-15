-- 051: Plan gap — mikrofon kabul/red, PK maç başlat, hediye→PK skor
-- Run after 050

-- ---------------------------------------------------------------------------
-- Mikrofon isteği yanıtla (owner / cohost)
-- ---------------------------------------------------------------------------
create or replace function public.mikrofon_istegi_yanitla(
  p_request_id uuid,
  p_kabul boolean
)
returns public.room_mic_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.room_mic_requests%rowtype;
  v_role text;
  v_seat_id uuid;
  v_seat_index int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_req
  from public.room_mic_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'Request not found'; end if;
  if v_req.status <> 'pending' then raise exception 'Request already resolved'; end if;

  select role into v_role
  from public.room_members
  where room_id = v_req.room_id and user_id = v_uid;
  if v_role is null or v_role not in ('host', 'cohost') then
    -- host_id fallback
    if not exists (
      select 1 from public.rooms r
      where r.id = v_req.room_id and r.host_id = v_uid
    ) then
      raise exception 'Not authorized';
    end if;
  end if;

  if not p_kabul then
    update public.room_mic_requests
    set status = 'rejected', resolved_at = now()
    where id = p_request_id
    returning * into v_req;
    return v_req;
  end if;

  -- Bos koltuk bul
  select id, seat_index into v_seat_id, v_seat_index
  from public.room_seats
  where room_id = v_req.room_id
    and user_id is null
    and coalesce(is_locked, false) = false
  order by seat_index
  limit 1
  for update;

  if v_seat_id is null then
    raise exception 'No free mic seat';
  end if;

  update public.room_seats
  set user_id = v_req.user_id, is_muted = false
  where id = v_seat_id;

  insert into public.room_members (room_id, user_id, role)
  values (v_req.room_id, v_req.user_id, 'speaker')
  on conflict (room_id, user_id) do update
  set role = case
    when public.room_members.role = 'host' then 'host'
    when public.room_members.role = 'cohost' then 'cohost'
    else 'speaker'
  end;

  update public.room_mic_requests
  set status = 'accepted', resolved_at = now()
  where id = p_request_id
  returning * into v_req;

  return v_req;
end;
$$;

grant execute on function public.mikrofon_istegi_yanitla(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- PK maç başlat (oda veya canlı host)
-- ---------------------------------------------------------------------------
create or replace function public.pk_mac_baslat(
  p_pk_type text default '1v1',
  p_room_a_id uuid default null,
  p_room_b_id uuid default null,
  p_live_a_id uuid default null,
  p_live_b_id uuid default null,
  p_sure_saniye int default 300
)
returns public.pk_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_ok boolean := false;
  v_row public.pk_matches%rowtype;
  v_sure int := greatest(60, least(coalesce(p_sure_saniye, 300), 3600));
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_pk') then
    raise exception 'PK temporarily disabled';
  end if;
  if not public.ozellik_bayragi_aktif_mi('pk_enabled') then
    raise exception 'PK feature disabled';
  end if;

  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot start PK'; end if;

  if p_pk_type is null or p_pk_type not in (
    '1v1','2v2','team','agency','country','city','tournament'
  ) then
    raise exception 'Invalid pk_type';
  end if;

  if p_room_a_id is null and p_live_a_id is null then
    raise exception 'room_a or live_a required';
  end if;

  if p_room_a_id is not null then
    select exists(
      select 1 from public.rooms r
      where r.id = p_room_a_id and r.host_id = v_uid and r.is_live
    ) into v_ok;
  end if;

  if not v_ok and p_live_a_id is not null then
    select exists(
      select 1 from public.live_sessions ls
      where ls.id = p_live_a_id and ls.host_id = v_uid and ls.is_live
    ) into v_ok;
  end if;

  if not v_ok then raise exception 'Not authorized to start PK'; end if;

  -- Aynı oda/canlıda zaten live PK varsa engelle
  if exists (
    select 1 from public.pk_matches m
    where m.status = 'live'
      and (
        (p_room_a_id is not null and (m.room_a_id = p_room_a_id or m.room_b_id = p_room_a_id))
        or (p_live_a_id is not null and (m.live_a_id = p_live_a_id or m.live_b_id = p_live_a_id))
      )
  ) then
    raise exception 'PK already live for this room/live';
  end if;

  insert into public.pk_matches (
    pk_type, status, room_a_id, room_b_id, live_a_id, live_b_id,
    score_a, score_b, started_at, ends_at
  ) values (
    p_pk_type, 'live', p_room_a_id, p_room_b_id, p_live_a_id, p_live_b_id,
    0, 0, now(), now() + make_interval(secs => v_sure)
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.pk_mac_baslat(text, uuid, uuid, uuid, uuid, int) to authenticated;

create or replace function public.pk_mac_bitir(p_match_id uuid)
returns public.pk_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.pk_matches%rowtype;
  v_winner text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_row from public.pk_matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_row.status <> 'live' then raise exception 'Match not live'; end if;

  if not (
    (v_row.room_a_id is not null and exists (
      select 1 from public.rooms r where r.id = v_row.room_a_id and r.host_id = v_uid
    ))
    or (v_row.live_a_id is not null and exists (
      select 1 from public.live_sessions ls where ls.id = v_row.live_a_id and ls.host_id = v_uid
    ))
  ) then
    raise exception 'Not authorized';
  end if;

  if v_row.score_a > v_row.score_b then v_winner := 'a';
  elsif v_row.score_b > v_row.score_a then v_winner := 'b';
  else v_winner := 'draw';
  end if;

  update public.pk_matches
  set status = 'finished', finished_at = now(), winner_side = v_winner
  where id = p_match_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.pk_mac_bitir(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- send_gift: canlı PK skoruna coin harcamasını ekle
-- ---------------------------------------------------------------------------
create or replace function public.send_gift(
  p_room_id uuid,
  p_receiver_id uuid,
  p_gift_id uuid,
  p_quantity int default 1,
  p_idempotency_key text default null
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

  insert into public.gift_transactions (
    room_id, sender_id, receiver_id, gift_id, quantity,
    coins_spent, diamonds_earned, idempotency_key, agency_commission_snapshot
  ) values (
    p_room_id, v_sender, p_receiver_id, p_gift_id, p_quantity,
    v_cost, v_diamonds, nullif(trim(p_idempotency_key), ''), 0
  ) returning * into v_tx;

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    insert into public.finance_idempotency_keys (
      idempotency_key, user_id, operation, result_ref, result_payload
    ) values (
      p_idempotency_key, v_sender, 'gift_send', v_tx.id,
      jsonb_build_object('coins_spent', v_cost, 'diamonds', v_diamonds)
    )
    on conflict (idempotency_key) do nothing;
  end if;

  -- Canlı PK: hediye alan tarafın odası/canlısı hangi side ise skor ekle
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
        -- Gift basarili kalsin; PK skor ayrica loglanabilir
        null;
      end;
    end if;
  end if;

  return v_tx;
end;
$$;

grant execute on function public.send_gift(uuid, uuid, uuid, int, text) to authenticated;

-- Pending mic requests okunabilirlik (uye)
drop policy if exists "Mic requests readable members" on public.room_mic_requests;
create policy "Mic requests readable members" on public.room_mic_requests
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.rooms r
      where r.id = room_id and r.host_id = auth.uid()
    )
    or exists (
      select 1 from public.room_members rm
      where rm.room_id = room_mic_requests.room_id
        and rm.user_id = auth.uid()
        and rm.role in ('host', 'cohost')
    )
  );
