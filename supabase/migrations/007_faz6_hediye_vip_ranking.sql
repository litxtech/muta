-- FAZ 6: Gift catalog genisletme, VIP/levels, rankings
-- Run after 001–006

-- Gift categories (dinamik, hard-code yok)
create table if not exists public.gift_categories (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

insert into public.gift_categories (code, name, sort_order) values
  ('popular','Popular',1),('new','New',2),('love','Love',3),('fun','Fun',4),
  ('cute','Cute',5),('food','Food',6),('animals','Animals',7),('cars','Cars',8),
  ('luxury','Luxury',9),('royal','Royal',10),('fantasy','Fantasy',11),('space','Space',12),
  ('music','Music',13),('sports','Sports',14),('event','Event',15),('seasonal','Seasonal',16),
  ('vip','VIP',17),('limited','Limited',18),('agency','Agency',19),('pk','PK',20),
  ('legendary','Legendary',21),('mythic','Mythic',22)
on conflict (code) do nothing;

-- Expand gifts catalog columns
alter table public.gifts
  add column if not exists slug text,
  add column if not exists category_code text,
  add column if not exists subcategory text,
  add column if not exists thumbnail_url text,
  add column if not exists static_image_url text,
  add column if not exists animation_url text,
  add column if not exists animation_type text default 'lottie',
  add column if not exists duration_ms int default 2000,
  add column if not exists sound_url text,
  add column if not exists sound_volume numeric(3,2) default 0.8,
  add column if not exists gift_level int default 1,
  add column if not exists combo_enabled boolean default true,
  add column if not exists combo_timeout_ms int default 3000,
  add column if not exists full_screen boolean default false,
  add column if not exists global_announcement boolean default false,
  add column if not exists minimum_level int default 1,
  add column if not exists minimum_vip int default 0,
  add column if not exists agency_exclusive boolean default false,
  add column if not exists event_exclusive boolean default false,
  add column if not exists country_restriction text,
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz,
  add column if not exists featured boolean default false,
  add column if not exists is_new boolean default false,
  add column if not exists is_limited boolean default false;

-- Expand rarity check: drop old and add new if needed
-- Keep existing rarity text; allow mythic/limited/exclusive via no hard check recreate

update public.gifts set
  slug = coalesce(slug, code),
  category_code = coalesce(category_code,
    case rarity
      when 'legendary' then 'legendary'
      when 'epic' then 'luxury'
      when 'rare' then 'love'
      else 'popular'
    end
  )
where slug is null or category_code is null;

-- Gift rarities admin-managed
create table if not exists public.gift_rarities (
  code text primary key,
  name text not null,
  sort_order int not null default 0,
  cinematic_threshold_coins bigint default 999,
  is_active boolean not null default true
);

insert into public.gift_rarities (code, name, sort_order, cinematic_threshold_coins) values
  ('common','Common',1,999999),
  ('rare','Rare',2,500),
  ('epic','Epic',3,200),
  ('legendary','Legendary',4,100),
  ('mythic','Mythic',5,50),
  ('limited','Limited',6,100),
  ('exclusive','Exclusive',7,50)
on conflict (code) do nothing;

-- VIP levels (adet hard-code degil)
create table if not exists public.vip_levels (
  level int primary key check (level >= 0),
  name text not null,
  min_spend_coin bigint not null default 0,
  profile_frame text,
  entrance_effect text,
  chat_bubble text,
  username_effect text,
  badge text,
  exclusive_gifts boolean default false,
  hide_online boolean default false,
  is_active boolean not null default true
);

insert into public.vip_levels (level, name, min_spend_coin, badge) values
  (0,'None',0,null),
  (1,'VIP 1',500,'vip1'),
  (2,'VIP 2',2000,'vip2'),
  (3,'VIP 3',5000,'vip3'),
  (4,'VIP 4',12000,'vip4'),
  (5,'VIP 5',30000,'vip5'),
  (6,'VIP 6',60000,'vip6'),
  (7,'VIP 7',120000,'vip7'),
  (8,'VIP 8',250000,'vip8'),
  (9,'VIP 9',500000,'vip9'),
  (10,'VIP 10',1000000,'vip10')
on conflict (level) do nothing;

-- Gifter thresholds
create table if not exists public.gifter_levels (
  level int primary key check (level >= 1),
  name text not null,
  min_spent_coin bigint not null,
  badge text,
  is_active boolean not null default true
);

insert into public.gifter_levels (level, name, min_spent_coin, badge) values
  (1,'Bronze Gifter',0,'g1'),
  (2,'Silver Gifter',1000,'g2'),
  (3,'Gold Gifter',5000,'g3'),
  (4,'Platinum Gifter',20000,'g4'),
  (5,'Diamond Gifter',50000,'g5'),
  (6,'Master Gifter',100000,'g6'),
  (7,'Legend Gifter',250000,'g7'),
  (8,'Mythic Gifter',500000,'g8')
on conflict (level) do nothing;

-- Charm thresholds (received gifts)
create table if not exists public.charm_levels (
  level int primary key check (level >= 1),
  name text not null,
  min_received_gifts bigint not null,
  badge text,
  is_active boolean not null default true
);

insert into public.charm_levels (level, name, min_received_gifts, badge) values
  (1,'Rising Star',0,'c1'),
  (2,'Charming',50,'c2'),
  (3,'Popular',200,'c3'),
  (4,'Sensation',1000,'c4'),
  (5,'Icon',5000,'c5'),
  (6,'Superstar',20000,'c6'),
  (7,'Legend',50000,'c7')
on conflict (level) do nothing;

-- Recharge thresholds (top-up activity — Top Gifter'dan AYRI)
create table if not exists public.recharge_levels (
  level int primary key check (level >= 1),
  name text not null,
  min_topup_coin bigint not null,
  badge text,
  is_active boolean not null default true
);

insert into public.recharge_levels (level, name, min_topup_coin, badge) values
  (1,'Recharge I',0,'r1'),
  (2,'Recharge II',500,'r2'),
  (3,'Recharge III',2000,'r3'),
  (4,'Recharge IV',10000,'r4'),
  (5,'Recharge V',50000,'r5'),
  (6,'Recharge VI',150000,'r6'),
  (7,'Recharge VII',500000,'r7')
on conflict (level) do nothing;

-- Gift collections
create table if not exists public.user_gift_collections (
  user_id uuid not null references public.profiles(id) on delete cascade,
  gift_id uuid not null references public.gifts(id) on delete cascade,
  sent_count bigint not null default 0,
  received_count bigint not null default 0,
  updated_at timestamptz default now(),
  primary key (user_id, gift_id)
);

-- Global gift feed (high value banners)
create table if not exists public.global_gift_feed (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  gift_id uuid not null references public.gifts(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  coins_spent bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists global_gift_feed_created_idx
  on public.global_gift_feed (created_at desc);

-- Leaderboard snapshots (Top Recharge vs Top Gifter AYRI)
create table if not exists public.leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  board_type text not null
    check (board_type in (
      'host','gifter','agency','room','top_recharge','city','city_supporter'
    )),
  period text not null check (period in ('daily','weekly','monthly','all_time')),
  period_key text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  agency_id uuid,
  room_id uuid,
  city_id uuid,
  score bigint not null default 0,
  rank int,
  created_at timestamptz not null default now(),
  unique (board_type, period, period_key, user_id)
);

create index if not exists leaderboard_lookup_idx
  on public.leaderboard_snapshots (board_type, period, period_key, rank);

-- Recalc helper: update profile stats vip/gifter/charm from thresholds
create or replace function public.prestige_seviyelerini_yenile(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spent bigint;
  v_topup bigint;
  v_recv bigint;
  v_vip int;
  v_gifter int;
  v_charm int;
begin
  insert into public.user_profile_stats (user_id) values (p_user_id)
  on conflict do nothing;

  select total_spent_coin, total_topup_coin, total_gifts_received
  into v_spent, v_topup, v_recv
  from public.user_profile_stats where user_id = p_user_id;

  v_spent := coalesce(v_spent, 0);
  v_topup := coalesce(v_topup, 0);
  v_recv := coalesce(v_recv, 0);

  select coalesce(max(level), 0) into v_vip from public.vip_levels
  where is_active and min_spend_coin <= v_spent;

  select coalesce(max(level), 1) into v_gifter from public.gifter_levels
  where is_active and min_spent_coin <= v_spent;

  select coalesce(max(level), 1) into v_charm from public.charm_levels
  where is_active and min_received_gifts <= v_recv;

  update public.user_profile_stats set
    vip_level = v_vip,
    charm_level = v_charm,
    gifter_rank = v_gifter,
    recharge_rank = (
      select coalesce(max(level), 1) from public.recharge_levels
      where is_active and min_topup_coin <= v_topup
    ),
    updated_at = now()
  where user_id = p_user_id;
end;
$$;

-- After gift: collection + optional global feed + prestige
create or replace function public.hediye_sonrasi_prestige()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gift public.gifts%rowtype;
begin
  select * into v_gift from public.gifts where id = new.gift_id;

  insert into public.user_gift_collections (user_id, gift_id, sent_count, received_count)
  values (new.sender_id, new.gift_id, new.quantity, 0)
  on conflict (user_id, gift_id) do update set
    sent_count = user_gift_collections.sent_count + excluded.sent_count,
    updated_at = now();

  insert into public.user_gift_collections (user_id, gift_id, sent_count, received_count)
  values (new.receiver_id, new.gift_id, 0, new.quantity)
  on conflict (user_id, gift_id) do update set
    received_count = user_gift_collections.received_count + excluded.received_count,
    updated_at = now();

  if coalesce(v_gift.global_announcement, false)
     or new.coins_spent >= coalesce(
       (select cinematic_threshold_coins from public.gift_rarities where code = v_gift.rarity),
       9999
     ) then
    insert into public.global_gift_feed (
      sender_id, receiver_id, gift_id, room_id, coins_spent
    ) values (
      new.sender_id, new.receiver_id, new.gift_id, new.room_id, new.coins_spent
    );
  end if;

  perform public.prestige_seviyelerini_yenile(new.sender_id);
  perform public.prestige_seviyelerini_yenile(new.receiver_id);

  return new;
end;
$$;

drop trigger if exists gift_tx_prestige_trg on public.gift_transactions;
create trigger gift_tx_prestige_trg
  after insert on public.gift_transactions
  for each row execute function public.hediye_sonrasi_prestige();

-- Topup coin on purchase → recharge prestige
create or replace function public.satin_alma_sonrasi_prestige()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profile_stats (user_id) values (new.user_id)
  on conflict do nothing;
  update public.user_profile_stats set
    total_topup_coin = total_topup_coin + new.coins_added,
    updated_at = now()
  where user_id = new.user_id;
  perform public.prestige_seviyelerini_yenile(new.user_id);
  return new;
end;
$$;

drop trigger if exists coin_purchase_prestige_trg on public.coin_purchases;
create trigger coin_purchase_prestige_trg
  after insert on public.coin_purchases
  for each row
  when (new.status = 'completed')
  execute function public.satin_alma_sonrasi_prestige();

-- Leaderboard refresh (daily gifter / recharge samples)
create or replace function public.liderlik_siralamasi_yenile(
  p_board_type text,
  p_period text default 'daily'
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := to_char(now() at time zone 'utc', 'YYYY-MM-DD');
  v_count int := 0;
begin
  if p_board_type = 'gifter' then
    delete from public.leaderboard_snapshots
    where board_type = 'gifter' and period = p_period and period_key = v_key;

    insert into public.leaderboard_snapshots (board_type, period, period_key, user_id, score, rank)
    select 'gifter', p_period, v_key, user_id, total_spent_coin,
      row_number() over (order by total_spent_coin desc)
    from public.user_profile_stats
    where total_spent_coin > 0
    order by total_spent_coin desc
    limit 100;
    get diagnostics v_count = row_count;

  elsif p_board_type = 'top_recharge' then
    delete from public.leaderboard_snapshots
    where board_type = 'top_recharge' and period = p_period and period_key = v_key;

    insert into public.leaderboard_snapshots (board_type, period, period_key, user_id, score, rank)
    select 'top_recharge', p_period, v_key, user_id, total_topup_coin,
      row_number() over (order by total_topup_coin desc)
    from public.user_profile_stats
    where total_topup_coin > 0
    order by total_topup_coin desc
    limit 100;
    get diagnostics v_count = row_count;

  elsif p_board_type = 'host' then
    delete from public.leaderboard_snapshots
    where board_type = 'host' and period = p_period and period_key = v_key;

    insert into public.leaderboard_snapshots (board_type, period, period_key, user_id, score, rank)
    select 'host', p_period, v_key, user_id, total_gifts_received,
      row_number() over (order by total_gifts_received desc)
    from public.user_profile_stats
    where total_gifts_received > 0
    order by total_gifts_received desc
    limit 100;
    get diagnostics v_count = row_count;
  end if;

  return v_count;
end;
$$;

-- RLS
alter table public.gift_categories enable row level security;
alter table public.gift_rarities enable row level security;
alter table public.vip_levels enable row level security;
alter table public.gifter_levels enable row level security;
alter table public.charm_levels enable row level security;
alter table public.recharge_levels enable row level security;
alter table public.user_gift_collections enable row level security;
alter table public.global_gift_feed enable row level security;
alter table public.leaderboard_snapshots enable row level security;

drop policy if exists "Gift categories readable" on public.gift_categories;
create policy "Gift categories readable" on public.gift_categories
  for select to authenticated using (is_active);
drop policy if exists "Gift rarities readable" on public.gift_rarities;
create policy "Gift rarities readable" on public.gift_rarities
  for select to authenticated using (is_active);
drop policy if exists "VIP levels readable" on public.vip_levels;
create policy "VIP levels readable" on public.vip_levels
  for select to authenticated using (is_active);
drop policy if exists "Gifter levels readable" on public.gifter_levels;
create policy "Gifter levels readable" on public.gifter_levels
  for select to authenticated using (is_active);
drop policy if exists "Charm levels readable" on public.charm_levels;
create policy "Charm levels readable" on public.charm_levels
  for select to authenticated using (is_active);
drop policy if exists "Recharge levels readable" on public.recharge_levels;
create policy "Recharge levels readable" on public.recharge_levels
  for select to authenticated using (is_active);
drop policy if exists "Own gift collections" on public.user_gift_collections;
create policy "Own gift collections" on public.user_gift_collections
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Global gift feed readable" on public.global_gift_feed;
create policy "Global gift feed readable" on public.global_gift_feed
  for select to authenticated using (true);
drop policy if exists "Leaderboards readable" on public.leaderboard_snapshots;
create policy "Leaderboards readable" on public.leaderboard_snapshots
  for select to authenticated using (true);

grant select on public.gift_categories to authenticated;
grant select on public.gift_rarities to authenticated;
grant select on public.vip_levels to authenticated;
grant select on public.gifter_levels to authenticated;
grant select on public.charm_levels to authenticated;
grant select on public.recharge_levels to authenticated;
grant select on public.user_gift_collections to authenticated;
grant select on public.global_gift_feed to authenticated;
grant select on public.leaderboard_snapshots to authenticated;
grant execute on function public.prestige_seviyelerini_yenile(uuid) to authenticated;
grant execute on function public.liderlik_siralamasi_yenile(text, text) to authenticated;
