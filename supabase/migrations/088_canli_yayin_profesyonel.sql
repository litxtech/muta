-- Canlı yayın: kategori/konu + hediye live_session_id (overlay realtime, medya yolu dokunulmaz)

alter table public.live_sessions
  add column if not exists category text,
  add column if not exists topic text;

alter table public.gift_transactions
  add column if not exists live_session_id uuid references public.live_sessions(id) on delete set null;

create index if not exists gift_tx_live_session_idx
  on public.gift_transactions (live_session_id, created_at desc)
  where live_session_id is not null;

-- Yayındaki hediyeler tüm authenticated kullanıcılara görünsün (oda room_id kuralı gibi)
drop policy if exists "Gift tx readable by parties" on public.gift_transactions;
create policy "Gift tx readable by parties"
  on public.gift_transactions for select to authenticated
  using (
    auth.uid() = sender_id
    or auth.uid() = receiver_id
    or room_id is not null
    or live_session_id is not null
  );

create or replace function public.canli_yayin_baslat(
  p_title text,
  p_mode text default 'solo',
  p_category text default null,
  p_topic text default null
)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_row public.live_sessions%rowtype;
  v_room_name text;
  v_cat text := nullif(trim(coalesce(p_category, '')), '');
  v_topic text := nullif(trim(coalesce(p_topic, '')), '');
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_live') then
    raise exception 'Live temporarily disabled';
  end if;
  if not public.ozellik_bayragi_aktif_mi('live_enabled') then
    raise exception 'Live feature disabled';
  end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot go live'; end if;
  if length(trim(coalesce(p_title, ''))) < 2 then
    raise exception 'Title required';
  end if;

  -- Aynı anda tek aktif yayın
  update public.live_sessions
    set is_live = false, ended_at = coalesce(ended_at, now())
  where host_id = v_uid and is_live = true;

  v_room_name := 'live_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.live_sessions (
    host_id, title, mode, livekit_room_name, is_live, category, topic
  ) values (
    v_uid,
    left(trim(p_title), 80),
    coalesce(nullif(trim(p_mode), ''), 'solo'),
    v_room_name,
    true,
    left(v_cat, 32),
    left(v_topic, 80)
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.canli_yayin_baslat(text, text, text, text) to authenticated;

-- send_gift: canlı oturum kimliği + overlay animasyonu için herkese görünür kayıt
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

  -- Açık live_session_id doğrula; yoksa alıcının aktif yayını
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

grant execute on function public.send_gift(uuid, uuid, uuid, int, text, uuid, uuid) to authenticated;
