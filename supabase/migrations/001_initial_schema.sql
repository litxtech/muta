-- Muta: Live voice chat + monetization schema
-- Run in Supabase SQL Editor (Dashboard → SQL)

create extension if not exists "pgcrypto";

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text default '',
  avatar_url text,
  gender text check (gender in ('female', 'male', 'other', 'prefer_not')),
  birth_date date,
  country text,
  language text default 'tr',
  is_host boolean default false,
  is_verified boolean default false,
  level int default 1,
  xp int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Wallets (coins spendable, diamonds earnable)
create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coins bigint not null default 0 check (coins >= 0),
  diamonds bigint not null default 0 check (diamonds >= 0),
  updated_at timestamptz default now()
);

-- Coin packages (IAP catalog)
create table if not exists public.coin_packages (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  title text not null,
  coins bigint not null,
  bonus_coins bigint not null default 0,
  price_usd numeric(10,2) not null,
  badge text,
  is_active boolean default true,
  sort_order int default 0
);

-- Gift catalog
create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  emoji text not null,
  coin_cost bigint not null check (coin_cost > 0),
  diamond_value bigint not null check (diamond_value >= 0),
  animation text default 'burst',
  rarity text default 'common' check (rarity in ('common','rare','epic','legendary')),
  is_active boolean default true,
  sort_order int default 0
);

-- Voice rooms
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  topic text,
  cover_url text,
  mode text not null default 'party' check (mode in ('party','dating','karaoke','game','private')),
  max_seats int not null default 8 check (max_seats between 2 and 20),
  is_live boolean default true,
  is_locked boolean default false,
  password_hash text,
  listener_count int default 0,
  total_coins_earned bigint default 0,
  created_at timestamptz default now(),
  ended_at timestamptz
);

create index if not exists rooms_live_idx on public.rooms (is_live, created_at desc);

-- Room seats / mic positions
create table if not exists public.room_seats (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  seat_index int not null check (seat_index >= 0),
  user_id uuid references public.profiles(id) on delete set null,
  is_muted boolean default false,
  is_locked boolean default false,
  unique (room_id, seat_index)
);

-- Room presence (listeners)
create table if not exists public.room_members (
  room_id uuid references public.rooms(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'listener' check (role in ('host','cohost','speaker','listener')),
  joined_at timestamptz default now(),
  primary key (room_id, user_id)
);

-- Gift transactions
create table if not exists public.gift_transactions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete set null,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  gift_id uuid not null references public.gifts(id),
  quantity int not null default 1 check (quantity > 0),
  coins_spent bigint not null,
  diamonds_earned bigint not null,
  created_at timestamptz default now()
);

create index if not exists gift_tx_receiver_idx on public.gift_transactions (receiver_id, created_at desc);
create index if not exists gift_tx_room_idx on public.gift_transactions (room_id, created_at desc);

-- Coin purchases (ledger)
create table if not exists public.coin_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  package_id uuid references public.coin_packages(id),
  coins_added bigint not null,
  amount_usd numeric(10,2),
  provider text default 'manual',
  provider_tx_id text,
  status text default 'completed' check (status in ('pending','completed','failed','refunded')),
  created_at timestamptz default now()
);

-- Diamond withdrawals / earnings payouts
create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  diamonds bigint not null check (diamonds > 0),
  amount_usd numeric(10,2) not null,
  method text not null default 'bank',
  details jsonb default '{}'::jsonb,
  status text default 'pending' check (status in ('pending','approved','paid','rejected')),
  created_at timestamptz default now(),
  processed_at timestamptz
);

-- Wallet ledger for audit
create table if not exists public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  currency text not null check (currency in ('coins','diamonds')),
  delta bigint not null,
  balance_after bigint not null,
  reason text not null,
  ref_type text,
  ref_id uuid,
  created_at timestamptz default now()
);

-- Auto profile + wallet on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
begin
  uname := coalesce(
    new.raw_user_meta_data->>'username',
    'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
  );

  insert into public.profiles (id, username, display_name, gender)
  values (
    new.id,
    uname,
    coalesce(new.raw_user_meta_data->>'display_name', uname),
    coalesce(new.raw_user_meta_data->>'gender', null)
  );

  insert into public.wallets (user_id, coins, diamonds)
  values (new.id, 100, 0); -- welcome coins

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason)
  values (new.id, 'coins', 100, 100, 'welcome_bonus');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Send gift (atomic)
create or replace function public.send_gift(
  p_room_id uuid,
  p_receiver_id uuid,
  p_gift_id uuid,
  p_quantity int default 1
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
begin
  if v_sender is null then
    raise exception 'Not authenticated';
  end if;
  if p_quantity < 1 then
    raise exception 'Invalid quantity';
  end if;
  if v_sender = p_receiver_id then
    raise exception 'Cannot gift yourself';
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

  update public.wallets
    set coins = coins - v_cost, updated_at = now()
    where user_id = v_sender;

  update public.wallets
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

  if p_room_id is not null then
    update public.rooms
      set total_coins_earned = total_coins_earned + v_cost
      where id = p_room_id;
  end if;

  insert into public.gift_transactions (
    room_id, sender_id, receiver_id, gift_id, quantity, coins_spent, diamonds_earned
  ) values (
    p_room_id, v_sender, p_receiver_id, p_gift_id, p_quantity, v_cost, v_diamonds
  ) returning * into v_tx;

  return v_tx;
end;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.coin_packages enable row level security;
alter table public.gifts enable row level security;
alter table public.rooms enable row level security;
alter table public.room_seats enable row level security;
alter table public.room_members enable row level security;
alter table public.gift_transactions enable row level security;
alter table public.coin_purchases enable row level security;
alter table public.payout_requests enable row level security;
alter table public.wallet_ledger enable row level security;

-- Profiles policies
create policy "Profiles are viewable by authenticated"
  on public.profiles for select to authenticated using (true);
create policy "Users update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Wallets
create policy "Users read own wallet"
  on public.wallets for select to authenticated using (auth.uid() = user_id);

-- Catalogs public read
create policy "Coin packages readable"
  on public.coin_packages for select to authenticated using (is_active);
create policy "Gifts readable"
  on public.gifts for select to authenticated using (is_active);

-- Rooms
create policy "Live rooms readable"
  on public.rooms for select to authenticated using (true);
create policy "Hosts create rooms"
  on public.rooms for insert to authenticated with check (auth.uid() = host_id);
create policy "Hosts update own rooms"
  on public.rooms for update to authenticated using (auth.uid() = host_id);

-- Seats / members
create policy "Room seats readable"
  on public.room_seats for select to authenticated using (true);
create policy "Room seats manage by host"
  on public.room_seats for all to authenticated
  using (exists (select 1 from public.rooms r where r.id = room_id and r.host_id = auth.uid()))
  with check (exists (select 1 from public.rooms r where r.id = room_id and r.host_id = auth.uid()));

create policy "Room members readable"
  on public.room_members for select to authenticated using (true);
create policy "Users join rooms"
  on public.room_members for insert to authenticated with check (auth.uid() = user_id);
create policy "Users leave rooms"
  on public.room_members for delete to authenticated using (auth.uid() = user_id);

-- Gift tx
create policy "Gift tx readable by parties"
  on public.gift_transactions for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id or room_id is not null);

-- Purchases / payouts / ledger own only
create policy "Own purchases"
  on public.coin_purchases for select to authenticated using (auth.uid() = user_id);
create policy "Own payouts"
  on public.payout_requests for select to authenticated using (auth.uid() = user_id);
create policy "Create payout"
  on public.payout_requests for insert to authenticated with check (auth.uid() = user_id);
create policy "Own ledger"
  on public.wallet_ledger for select to authenticated using (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.wallets to authenticated;
grant select on public.coin_packages to authenticated;
grant select on public.gifts to authenticated;
grant select, insert, update on public.rooms to authenticated;
grant select, insert, update, delete on public.room_seats to authenticated;
grant select, insert, delete on public.room_members to authenticated;
grant select on public.gift_transactions to authenticated;
grant select on public.coin_purchases to authenticated;
grant select, insert on public.payout_requests to authenticated;
grant select on public.wallet_ledger to authenticated;
grant execute on function public.send_gift to authenticated;
