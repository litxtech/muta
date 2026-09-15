-- Durum gönderisine hediye: status_id + gift_count + bildirim hedefi

alter table public.gift_transactions
  add column if not exists status_id uuid references public.status_posts(id) on delete set null;

create index if not exists gift_tx_status_idx
  on public.gift_transactions (status_id, created_at desc)
  where status_id is not null;

alter table public.status_posts
  add column if not exists gift_count int not null default 0;

-- ---------------------------------------------------------------------------
-- send_gift: opsiyonel durum gönderisi (eski imzayı düşür — overload kalmasın)
-- ---------------------------------------------------------------------------
drop function if exists public.send_gift(uuid, uuid, uuid, int, text);

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

-- ---------------------------------------------------------------------------
-- Hediye bildirimi: durum gönderisine derin link
-- ---------------------------------------------------------------------------
create or replace function public.hediye_alindi_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_name text;
  v_gift_name text;
  v_deep text;
  v_payload jsonb;
begin
  select coalesce(display_name, username, 'Birisi') into v_sender_name
  from public.profiles where id = new.sender_id;

  select coalesce(name, 'Hediye') into v_gift_name
  from public.gifts where id = new.gift_id;

  if new.status_id is not null then
    v_deep := '/durum/' || new.status_id::text;
  elsif new.room_id is not null then
    v_deep := '/room/' || new.room_id::text;
  else
    v_deep := '/(tabs)/wallet';
  end if;

  v_payload := jsonb_build_object(
    'gift_tx_id', new.id,
    'sender_id', new.sender_id,
    'room_id', new.room_id,
    'status_id', new.status_id,
    'type', case when new.status_id is not null then 'status_gift' else 'gift_received' end
  );

  perform public.bildirim_kuyruga_ekle(
    new.receiver_id,
    'gifts',
    case when new.status_id is not null then 'Gönderine hediye geldi' else 'Hediye aldın' end,
    v_sender_name || ' sana ' || coalesce(v_gift_name, 'hediye') ||
      case when new.quantity > 1 then ' ×' || new.quantity::text else '' end || ' gönderdi',
    v_deep,
    v_payload
  );
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists hediye_alindi_push_trg on public.gift_transactions;
create trigger hediye_alindi_push_trg
  after insert on public.gift_transactions
  for each row execute function public.hediye_alindi_push();

-- Deep link çözümüne status_id
create or replace function public.bildirim_hedef_link(
  p_category text,
  p_deep_link text,
  p_payload jsonb
)
returns text
language plpgsql
immutable
as $$
declare
  v_type text := lower(coalesce(p_payload->>'type', ''));
  v_link text := nullif(trim(coalesce(p_deep_link, '')), '');
  v_thread text := nullif(trim(coalesce(p_payload->>'thread_id', '')), '');
  v_room text := nullif(trim(coalesce(p_payload->>'room_id', '')), '');
  v_live text := nullif(trim(coalesce(p_payload->>'live_id', '')), '');
  v_status text := nullif(trim(coalesce(p_payload->>'status_id', '')), '');
  v_actor text := nullif(trim(coalesce(
    p_payload->>'follower_id',
    p_payload->>'sender_id',
    p_payload->>'host_id',
    p_payload->>'actor_id',
    ''
  )), '');
begin
  if v_link is not null
     and v_link not in ('/(tabs)/profile', '/profile', '/bildirimler') then
    return v_link;
  end if;

  if v_status is not null then
    return '/durum/' || v_status;
  end if;
  if v_thread is not null then
    return '/mesaj/' || v_thread;
  end if;
  if v_live is not null then
    return '/canli/' || v_live;
  end if;
  if v_room is not null then
    return '/room/' || v_room;
  end if;
  if v_type = 'follow' and v_actor is not null then
    return '/kullanici/' || v_actor;
  end if;
  if v_type in ('gift_received', 'status_gift', 'dm') and v_actor is not null and v_room is null then
    if v_type = 'status_gift' and v_status is not null then
      return '/durum/' || v_status;
    end if;
    return '/kullanici/' || v_actor;
  end if;
  if lower(coalesce(p_category, '')) = 'wallet' then
    return '/(tabs)/wallet';
  end if;
  if v_link is not null then
    return v_link;
  end if;
  if v_actor is not null then
    return '/kullanici/' || v_actor;
  end if;
  return null;
end;
$$;

-- Feed + detay: gift_count
create or replace function public.durum_akisi(p_limit int default 40, p_before timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc)
    from (
      select
        s.id,
        s.user_id,
        s.media_type,
        s.media_url,
        s.caption,
        s.like_count,
        s.comment_count,
        coalesce(s.gift_count, 0) as gift_count,
        s.created_at,
        coalesce(p.display_name, p.username, 'Kullanıcı') as display_name,
        p.username,
        p.avatar_url,
        p.public_user_id,
        exists(
          select 1 from public.status_likes l
          where l.status_id = s.id and l.user_id = v_uid
        ) as liked_by_me,
        (s.user_id = v_uid) as is_mine
      from public.status_posts s
      join public.profiles p on p.id = s.user_id
      where s.deleted_at is null
        and p.deleted_at is null
        and p.banned_at is null
        and not public.kullanicilar_engelli_mi(v_uid, s.user_id)
        and (p_before is null or s.created_at < p_before)
      order by s.created_at desc
      limit least(greatest(coalesce(p_limit, 40), 1), 80)
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.durum_akisi(int, timestamptz) to authenticated;

create or replace function public.durum_detay(p_status_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select jsonb_build_object(
    'id', s.id,
    'user_id', s.user_id,
    'media_type', s.media_type,
    'media_url', s.media_url,
    'caption', s.caption,
    'like_count', s.like_count,
    'comment_count', s.comment_count,
    'gift_count', coalesce(s.gift_count, 0),
    'created_at', s.created_at,
    'display_name', coalesce(p.display_name, p.username, 'Kullanıcı'),
    'username', p.username,
    'avatar_url', p.avatar_url,
    'public_user_id', p.public_user_id,
    'liked_by_me', exists(
      select 1 from public.status_likes l
      where l.status_id = s.id and l.user_id = v_uid
    ),
    'is_mine', (s.user_id = v_uid)
  )
  into v_row
  from public.status_posts s
  join public.profiles p on p.id = s.user_id
  where s.id = p_status_id and s.deleted_at is null;

  if v_row is null then raise exception 'Durum yok'; end if;
  return v_row;
end;
$$;

grant execute on function public.durum_detay(uuid) to authenticated;
