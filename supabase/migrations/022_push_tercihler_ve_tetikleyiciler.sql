-- Push tercihleri + otomatik bildirim kuyrugu (mesaj, hediye, canli, takip)

-- ---------------------------------------------------------------------------
-- Tercihler
-- ---------------------------------------------------------------------------
create table if not exists public.user_push_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  all_enabled boolean not null default true,
  messages boolean not null default true,
  gifts boolean not null default true,
  live boolean not null default true,
  rooms boolean not null default true,
  social boolean not null default true,
  wallet boolean not null default true,
  system boolean not null default true,
  updated_at timestamptz not null default now()
);

drop trigger if exists user_push_preferences_updated_at on public.user_push_preferences;
create trigger user_push_preferences_updated_at
  before update on public.user_push_preferences
  for each row execute function public.set_updated_at();

alter table public.user_push_preferences enable row level security;

drop policy if exists "Own push prefs" on public.user_push_preferences;
create policy "Own push prefs"
  on public.user_push_preferences for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.user_push_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- Yardimcilar
-- ---------------------------------------------------------------------------
create or replace function public.push_tercih_satiri_al(p_user_id uuid)
returns public.user_push_preferences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_push_preferences%rowtype;
begin
  insert into public.user_push_preferences (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_row from public.user_push_preferences where user_id = p_user_id;
  return v_row;
end;
$$;

create or replace function public.push_tercihi_aktif_mi(
  p_user_id uuid,
  p_category text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.user_push_preferences%rowtype;
  v_cat text := lower(trim(coalesce(p_category, 'system')));
begin
  if p_user_id is null then return false; end if;
  v_row := public.push_tercih_satiri_al(p_user_id);
  if not v_row.all_enabled then return false; end if;

  return case v_cat
    when 'messages' then v_row.messages
    when 'message' then v_row.messages
    when 'gifts' then v_row.gifts
    when 'gift' then v_row.gifts
    when 'live' then v_row.live
    when 'rooms' then v_row.rooms
    when 'room' then v_row.rooms
    when 'social' then v_row.social
    when 'follow' then v_row.social
    when 'wallet' then v_row.wallet
    when 'system' then v_row.system
    else true
  end;
end;
$$;

/** Tercihe uygun outbox kaydi; ana islemi bloklamaz */
create or replace function public.bildirim_kuyruga_ekle(
  p_user_id uuid,
  p_category text,
  p_title text,
  p_body text default null,
  p_deep_link text default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_cat text := lower(trim(coalesce(p_category, 'system')));
begin
  if p_user_id is null then return null; end if;
  if p_title is null or length(trim(p_title)) = 0 then return null; end if;

  if not public.push_tercihi_aktif_mi(p_user_id, v_cat) then
    return null;
  end if;

  if not public.hesap_aktif_mi(p_user_id) then
    return null;
  end if;

  insert into public.notification_outbox (
    user_id, category, title, body, deep_link, payload, status
  ) values (
    p_user_id,
    v_cat,
    left(trim(p_title), 120),
    case when p_body is null then null else left(trim(p_body), 400) end,
    p_deep_link,
    coalesce(p_payload, '{}'::jsonb),
    'pending'
  )
  returning id into v_id;

  return v_id;
exception when others then
  -- Push asla ana islemi bozmasin
  return null;
end;
$$;

create or replace function public.benim_push_tercihlerimi_getir()
returns public.user_push_preferences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  return public.push_tercih_satiri_al(v_uid);
end;
$$;

create or replace function public.benim_push_tercihlerimi_kaydet(
  p_all_enabled boolean default null,
  p_messages boolean default null,
  p_gifts boolean default null,
  p_live boolean default null,
  p_rooms boolean default null,
  p_social boolean default null,
  p_wallet boolean default null,
  p_system boolean default null
)
returns public.user_push_preferences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.user_push_preferences%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  perform public.push_tercih_satiri_al(v_uid);

  update public.user_push_preferences set
    all_enabled = coalesce(p_all_enabled, all_enabled),
    messages = coalesce(p_messages, messages),
    gifts = coalesce(p_gifts, gifts),
    live = coalesce(p_live, live),
    rooms = coalesce(p_rooms, rooms),
    social = coalesce(p_social, social),
    wallet = coalesce(p_wallet, wallet),
    system = coalesce(p_system, system),
    updated_at = now()
  where user_id = v_uid
  returning * into v_row;

  if p_all_enabled is not null then
    update public.device_push_tokens
    set notification_enabled = p_all_enabled
    where user_id = v_uid;
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mesaj → alici push
-- ---------------------------------------------------------------------------
create or replace function public.mesaj_gonder(
  p_thread_id uuid,
  p_body text,
  p_message_type text default 'text'
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
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_gift_send') and p_message_type = 'gift' then
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

  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'Empty message';
  end if;

  v_preview := left(trim(p_body), 120);

  insert into public.direct_messages (thread_id, sender_id, body, message_type)
  values (p_thread_id, v_uid, left(trim(p_body), 4000), coalesce(p_message_type, 'text'))
  returning * into v_msg;

  update public.message_threads set
    updated_at = now(),
    last_message_at = now(),
    last_message_preview = v_preview
  where id = p_thread_id;

  select coalesce(display_name, username, 'Birisi') into v_sender_name
  from public.profiles where id = v_uid;

  for v_peer in
    select user_id from public.message_thread_members
    where thread_id = p_thread_id and user_id <> v_uid
  loop
    perform public.bildirim_kuyruga_ekle(
      v_peer,
      'messages',
      v_sender_name,
      v_preview,
      '/mesaj/' || p_thread_id::text,
      jsonb_build_object(
        'thread_id', p_thread_id,
        'sender_id', v_uid,
        'type', 'dm'
      )
    );
  end loop;

  return v_msg;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hediye alindi → push (trigger)
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
begin
  select coalesce(display_name, username, 'Birisi') into v_sender_name
  from public.profiles where id = new.sender_id;

  select coalesce(name, 'Hediye') into v_gift_name
  from public.gifts where id = new.gift_id;

  perform public.bildirim_kuyruga_ekle(
    new.receiver_id,
    'gifts',
    'Hediye aldın',
    v_sender_name || ' sana ' || coalesce(v_gift_name, 'hediye') ||
      case when new.quantity > 1 then ' ×' || new.quantity::text else '' end || ' gönderdi',
    case when new.room_id is not null then '/lobi/' || new.room_id::text else '/(tabs)/wallet' end,
    jsonb_build_object(
      'gift_tx_id', new.id,
      'sender_id', new.sender_id,
      'room_id', new.room_id,
      'type', 'gift_received'
    )
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

-- ---------------------------------------------------------------------------
-- Canli yayin → takipcilere push
-- ---------------------------------------------------------------------------
create or replace function public.canli_yayin_baslat(
  p_title text,
  p_mode text default 'solo'
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
  v_host_name text;
  v_follower uuid;
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

  v_room_name := 'live_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.live_sessions (host_id, title, mode, livekit_room_name, is_live)
  values (v_uid, left(trim(p_title), 80), coalesce(p_mode, 'solo'), v_room_name, true)
  returning * into v_row;

  select coalesce(display_name, username, 'Biri') into v_host_name
  from public.profiles where id = v_uid;

  for v_follower in
    select follower_id from public.follows
    where following_id = v_uid
    limit 200
  loop
    perform public.bildirim_kuyruga_ekle(
      v_follower,
      'live',
      v_host_name || ' canlıda',
      coalesce(nullif(trim(p_title), ''), 'Canlı yayın başladı'),
      '/canli',
      jsonb_build_object(
        'live_id', v_row.id,
        'host_id', v_uid,
        'type', 'live_start'
      )
    );
  end loop;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Takip → hedefe push
-- ---------------------------------------------------------------------------
create or replace function public.takip_et(p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_guest boolean;
  v_name text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_uid = p_target_id then raise exception 'Invalid target'; end if;

  select is_guest into v_is_guest from public.profiles where id = v_uid;
  if coalesce(v_is_guest, false) then
    raise exception 'Guest cannot follow';
  end if;

  insert into public.follows (follower_id, following_id)
  values (v_uid, p_target_id)
  on conflict do nothing;

  select coalesce(display_name, username, 'Birisi') into v_name
  from public.profiles where id = v_uid;

  perform public.bildirim_kuyruga_ekle(
    p_target_id,
    'social',
    'Yeni takipçi',
    v_name || ' seni takip etmeye başladı',
    '/(tabs)/profile',
    jsonb_build_object('follower_id', v_uid, 'type', 'follow')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Coin yukleme tamamlandi → wallet push (trigger)
-- ---------------------------------------------------------------------------
create or replace function public.coin_yukleme_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.status, 'completed') in ('completed', 'paid') then
      perform public.bildirim_kuyruga_ekle(
        new.user_id,
        'wallet',
        'Yükleme tamam',
        new.coins_added::text || ' coin hesabına eklendi',
        '/(tabs)/wallet',
        jsonb_build_object('purchase_id', new.id, 'type', 'coin_purchase')
      );
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from new.status
       and coalesce(new.status, '') in ('completed', 'paid')
       and coalesce(old.status, '') not in ('completed', 'paid') then
      perform public.bildirim_kuyruga_ekle(
        new.user_id,
        'wallet',
        'Yükleme tamam',
        new.coins_added::text || ' coin hesabına eklendi',
        '/(tabs)/wallet',
        jsonb_build_object('purchase_id', new.id, 'type', 'coin_purchase')
      );
    end if;
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists coin_yukleme_push_trg on public.coin_purchases;
create trigger coin_yukleme_push_trg
  after insert or update of status on public.coin_purchases
  for each row execute function public.coin_yukleme_push();

-- ---------------------------------------------------------------------------
-- Oda canli oldu → takipcilere rooms push
-- ---------------------------------------------------------------------------
create or replace function public.oda_canli_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_name text;
  v_follower uuid;
begin
  if coalesce(old.is_live, false) = true then
    return new;
  end if;
  if coalesce(new.is_live, false) <> true then
    return new;
  end if;

  select coalesce(display_name, username, 'Biri') into v_host_name
  from public.profiles where id = new.host_id;

  for v_follower in
    select follower_id from public.follows
    where following_id = new.host_id
    limit 200
  loop
    perform public.bildirim_kuyruga_ekle(
      v_follower,
      'rooms',
      v_host_name || ' odada',
      coalesce(nullif(trim(new.title), ''), 'Oda açıldı'),
      '/lobi/' || new.id::text,
      jsonb_build_object(
        'room_id', new.id,
        'host_id', new.host_id,
        'type', 'room_live'
      )
    );
  end loop;

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists oda_canli_push_trg on public.rooms;
create trigger oda_canli_push_trg
  after insert or update of is_live on public.rooms
  for each row execute function public.oda_canli_push();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant execute on function public.bildirim_kuyruga_ekle(uuid, text, text, text, text, jsonb) to authenticated, service_role;
grant execute on function public.benim_push_tercihlerimi_getir() to authenticated;
grant execute on function public.benim_push_tercihlerimi_kaydet(boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.push_tercihi_aktif_mi(uuid, text) to authenticated, service_role;
