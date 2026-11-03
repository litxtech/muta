/**
 * Oyun cüzdanı — harcama önceliği ve kaynak izolasyonu SQL testleri.
 * İzole PGlite (bellek içi Postgres) üzerinde gerçek migration çalıştırılır.
 * Canlı veritabanına bağlanmaz.
 *
 * Calistir: npm run test:oyun-cuzdan
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const MIGRATION = '20261101120000_oyun_cuzdan_harcama_onceligi.sql';
const MIGRATION_ONAY = '20261101130000_oyun_oturum_satin_coin_onayi.sql';

const STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.test_flags (key text primary key, enabled boolean not null);
create table public.test_kill (key text primary key, active boolean not null);
create function public.ozellik_bayragi_aktif_mi(p text) returns boolean language sql stable as
  $$ select coalesce((select enabled from public.test_flags where key = p), true) $$;
create function public.kill_switch_aktif_mi(p text) returns boolean language sql stable as
  $$ select coalesce((select active from public.test_kill where key = p), false) $$;
create function public.ben_admin_miyim() returns boolean language sql stable as
  $$ select coalesce(current_setting('test.admin', true), '') = 'on' $$;

create table public.profiles (
  id uuid primary key,
  display_name text,
  is_admin boolean not null default false
);

create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coins bigint not null default 0 check (coins >= 0),
  diamonds bigint not null default 0,
  game_coins bigint not null default 0 check (game_coins >= 0),
  bonus_coins bigint not null default 0 check (bonus_coins >= 0),
  updated_at timestamptz not null default now()
);

create table public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  currency text not null,
  delta bigint not null,
  balance_after bigint,
  reason text,
  ref_type text,
  ref_id uuid,
  created_at timestamptz not null default now(),
  meta jsonb
);

-- Fruit Wheel: migration'ın dokunduğu tablo/fonksiyonların asgari hali
create table public.fruit_wheel_ledger (
  id bigserial primary key,
  user_id uuid not null,
  economy_mode text,
  delta bigint not null,
  balance_after bigint,
  reason text,
  round_id uuid,
  ref_id uuid,
  idempotency_key text not null unique
);
create table public.fruit_wheel_balances (
  user_id uuid primary key,
  closed_loop_coins bigint not null default 0,
  test_coins bigint not null default 0,
  updated_at timestamptz not null default now()
);
create table public.fruit_wheel_rounds (
  id uuid primary key,
  economy_mode text not null default 'PLATFORM_APPROVED_COIN',
  locks_at timestamptz,
  settled_at timestamptz,
  limits_snapshot jsonb,
  config_snapshot jsonb
);
create table public.fruit_wheel_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  round_id uuid not null,
  idempotency_key text not null,
  selections jsonb,
  delta bigint,
  balance_after bigint
);
create table public.fruit_wheel_selections (
  round_id uuid not null,
  user_id uuid not null,
  fruit_id text not null,
  amount bigint not null,
  status text not null
);
create function public.fruit_wheel_lock_balance(p_user uuid, p_mode text) returns bigint
  language sql stable as $$ select 0::bigint $$;
create function public.fruit_wheel_advance() returns void language sql as $$ select $$;
create function public.fruit_wheel_user_eligible(p_user uuid, p_mode text) returns text
  language sql stable as $$ select null::text $$;

-- Storm King (migration bu RPC'leri yeniden tanımlar)
create table public.storm_king_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  request_id uuid not null,
  room_id uuid,
  bet bigint not null,
  win bigint not null default 0,
  balance_before bigint not null,
  balance_after bigint not null,
  multiplier integer,
  capped boolean,
  result jsonb,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);
create table public.storm_king_aborts (
  user_id uuid not null,
  request_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
-- Slot RPC'leri: migration'ın onardığı gövde şeklinin asgari hali
create table public.slot_round_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  reasons text,
  balance_before bigint,
  balance_after bigint
);

create function public.zeus_settle_spin(
  p_user_id uuid, p_idempotency_key text, p_bet bigint, p_round_id uuid,
  p_result jsonb, p_is_bonus_spin boolean, p_admin_test boolean)
returns jsonb language plpgsql as $$
declare
  v_coins bigint;
  v_dg bigint;
  v_db bigint;
  v_win bigint;
  v_win_floor bigint;
  v_debit bigint;
  v_balance_after bigint;
  v_round_id uuid := coalesce(p_round_id, gen_random_uuid());
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key required';
  end if;
  v_win := coalesce((p_result->>'win')::bigint, 0);
  v_win_floor := floor(v_win)::bigint;
  v_debit := case when p_is_bonus_spin then 0 else p_bet end;
  select coins into v_coins from public.wallets where user_id = p_user_id for update;
  if v_coins is null then raise exception 'Wallet not found'; end if;
  if v_debit > 0 then
    if v_coins < v_debit then raise exception 'Insufficient coins'; end if;
    v_balance_after := v_coins - v_debit + floor(v_win)::bigint;
    update public.wallets
    set coins = v_balance_after, updated_at = now()
    where user_id = p_user_id;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user_id, 'coins', -v_debit, v_coins - v_debit, 'zeus_bet', 'zeus_round', v_round_id);
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user_id, 'coins', v_win_floor, v_balance_after, 'zeus_win', 'zeus_round', v_round_id);
  end if;
  return jsonb_build_object('balanceAfter', v_balance_after);
end $$;

create function public.nox_settle_spin(
  p_user_id uuid, p_idempotency_key text, p_bet bigint, p_round_id uuid,
  p_result jsonb, p_is_bonus_spin boolean, p_admin_test boolean)
returns jsonb language plpgsql as $$
declare
  v_coins bigint;
  v_win bigint;
  v_win_floor bigint;
  v_debit bigint;
  v_balance_after bigint;
  v_round_id uuid := coalesce(p_round_id, gen_random_uuid());
begin
  v_win := coalesce((p_result->>'win')::bigint, 0);
  v_win_floor := floor(v_win)::bigint;
  v_debit := case when p_is_bonus_spin then 0 else p_bet end;
  select coins into v_coins from public.wallets where user_id = p_user_id for update;
  if v_coins is null then raise exception 'Wallet not found'; end if;
  if v_debit > 0 then
    if v_coins < v_debit then raise exception 'Insufficient coins'; end if;
    v_balance_after := v_coins - v_debit + floor(v_win)::bigint;
    update public.wallets
    set coins = v_balance_after, updated_at = now()
    where user_id = p_user_id;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user_id, 'coins', -v_debit, v_coins - v_debit, 'slot_bet', 'nox_round', v_round_id);
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user_id, 'coins', v_win_floor, v_balance_after, 'slot_win', 'nox_round', v_round_id);
  end if;
  return jsonb_build_object('balanceAfter', v_balance_after);
end $$;

create table public.kaskad_transactions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid, user_id uuid, delta bigint, balance_after bigint, reason text
);

create function public.kozmik_kaskad_settle_spin(
  p_user_id uuid, p_idempotency_key text, p_bet_amount bigint, p_room_id uuid,
  p_result jsonb, p_is_bonus_spin boolean, p_admin_test boolean)
returns jsonb language plpgsql as $$
declare
  v_coins bigint;
  v_win bigint;
  v_win_floor bigint;
  v_debit bigint;
  v_balance_after bigint;
  v_round_id uuid;
begin
  v_round_id := coalesce(p_room_id, gen_random_uuid());
  v_win := coalesce((p_result->>'win')::bigint, 0);
  v_win_floor := floor(v_win)::bigint;
  v_debit := case when p_is_bonus_spin then 0 else p_bet_amount end;
  select coins into v_coins from public.wallets where user_id = p_user_id for update;
  if v_coins is null then raise exception 'Wallet not found'; end if;
  if v_debit > 0 then
    if v_coins < v_debit then raise exception 'Insufficient coins'; end if;
    v_balance_after := v_coins - v_debit + floor(v_win)::bigint;
    update public.wallets
    set coins = v_balance_after, updated_at = now()
    where user_id = p_user_id;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user_id, 'coins', -v_debit, v_coins - v_debit, 'kaskad_bet', 'kaskad_round', v_round_id);
    insert into public.kaskad_transactions (round_id, user_id, delta, balance_after, reason)
      values (v_round_id, p_user_id, -v_debit, v_coins - v_debit, 'bet');
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user_id, 'coins', v_win_floor, v_balance_after, 'kaskad_win', 'kaskad_round', v_round_id);
    insert into public.kaskad_transactions (round_id, user_id, delta, balance_after, reason)
      values (v_round_id, p_user_id, v_win_floor, v_balance_after, 'win');
  end if;
  return jsonb_build_object('balanceAfter', v_balance_after);
end $$;

create function public.fair_spin_settle_spin(
  p_user_id uuid, p_idempotency_key text, p_bet bigint, p_round_id uuid,
  p_result jsonb, p_admin_test boolean)
returns jsonb language plpgsql as $$
declare
  v_coins bigint;
  v_win bigint;
  v_debit bigint;
  v_balance_after bigint;
  v_round_id uuid := coalesce(p_round_id, gen_random_uuid());
begin
  v_win := coalesce((p_result->>'win')::bigint, 0);
  v_debit := p_bet;
  select coins into v_coins from public.wallets where user_id = p_user_id for update;
  if v_coins is null then raise exception 'Wallet not found'; end if;
  if v_debit > 0 then
    if v_coins < v_debit then raise exception 'Insufficient coins'; end if;
    v_balance_after := v_coins - v_debit + floor(v_win)::bigint;
    update public.wallets
    set coins = v_balance_after, updated_at = now()
    where user_id = p_user_id;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user_id, 'coins', -v_debit, v_coins - v_debit, 'fair_spin_bet', 'fair_spin_round', v_round_id);
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user_id, 'coins', v_win, v_balance_after, 'fair_spin_win', 'fair_spin_round', v_round_id);
  end if;
  return jsonb_build_object('balanceAfter', v_balance_after);
end $$;

create function public.astral_falls_settle_spin(
  p_user_id uuid, p_idempotency_key text, p_bet numeric, p_round_id uuid,
  p_result jsonb, p_is_bonus_spin boolean, p_admin_test boolean)
returns jsonb language plpgsql as $$
declare
  v_coins bigint;
  v_win bigint;
  v_win_floor bigint;
  v_debit numeric;
  v_balance_after bigint;
  v_round_id uuid := coalesce(p_round_id, gen_random_uuid());
begin
  v_win := coalesce((p_result->>'win')::bigint, 0);
  v_win_floor := floor(v_win)::bigint;
  v_debit := case when p_is_bonus_spin then 0 else p_bet end;
  select coins into v_coins from public.wallets where user_id = p_user_id for update;
  if v_coins is null then raise exception 'Wallet not found'; end if;
  if v_debit > 0 then
    if v_coins < ceil(v_debit) then raise exception 'Insufficient coins'; end if;
    v_balance_after := v_coins - ceil(v_debit)::bigint + v_win_floor;
    update public.wallets
    set coins = v_balance_after, updated_at = now()
    where user_id = p_user_id;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user_id, 'coins', -ceil(v_debit)::bigint, v_coins - ceil(v_debit)::bigint, 'astral_falls_bet', 'astral_falls_round', v_round_id);
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user_id, 'coins', v_win_floor, v_balance_after, 'astral_falls_win', 'astral_falls_round', v_round_id);
  end if;
  return jsonb_build_object('balanceAfter', v_balance_after);
end $$;

create function public.finish_game_session(p_session_id uuid)
returns jsonb language plpgsql as $$
declare
  r record;
  v_coins bigint;
  v_reward bigint := 500;
begin
  for r in select p_session_id as user_id, 1 as rank loop
        select coins into v_coins from public.wallets where user_id = r.user_id for update;
        if v_coins is null then
          insert into public.wallets (user_id, coins) values (r.user_id, 0)
          on conflict (user_id) do nothing;
          select coins into v_coins from public.wallets where user_id = r.user_id for update;
        end if;
        update public.wallets set coins = coins + v_reward, updated_at = now() where user_id = r.user_id;
        insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
        values (r.user_id, 'coins', v_reward, coalesce(v_coins,0) + v_reward, 'game_reward', 'game_session', p_session_id);
  end loop;
  return jsonb_build_object('ok', true);
end $$;

create table public.oda_oyun_coin_istatistik (  room_id uuid, user_id uuid, won_coin bigint default 0, spent_coin bigint default 0,
  updated_at timestamptz default now()
);
create table public.oda_oyun_harcama (
  id uuid primary key default gen_random_uuid(), room_id uuid, user_id uuid,
  spent_coin bigint, created_at timestamptz default now()
);
create function public.oda_oyun_coin_ekle(p_room uuid, p_user uuid, p_win bigint, p_bet bigint)
  returns void language sql as $$ select $$;
create function public.oyun_kazanc_duyuru_yaz(
  p_user uuid, p_room uuid, p_code text, p_ad text, p_win bigint, p_bet bigint, p_ref uuid, p_mult int)
  returns void language sql as $$ select $$;

-- Oda oturumu: migration'lar bu gövdeleri onarır (giriş ücreti + onay)
create function public.join_game_session(p_session_id uuid, p_entry_amount bigint)
returns jsonb language plpgsql security definer as $$
declare
  v_uid uuid := auth.uid();
  v_coins bigint;
  v_entry bigint := coalesce(p_entry_amount, 0);
begin
  if v_entry > 0 then
    if public.kill_switch_aktif_mi('kill_game_coin') then raise exception 'Game coin disabled'; end if;
      select coins into v_coins from public.wallets where user_id = v_uid for update;
      if v_coins is null or v_coins < v_entry then raise exception 'Insufficient coins'; end if;
      update public.wallets set coins = coins - v_entry, updated_at = now() where user_id = v_uid;
      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (v_uid, 'coins', -v_entry, v_coins - v_entry, 'game_entry', 'game_session', p_session_id);
  end if;
  return jsonb_build_object('ok', true, 'session_id', p_session_id);
end $$;

create function public.create_game_session(
  p_room_id uuid, p_game_code text, p_duration_seconds integer, p_max_players integer, p_entry_amount bigint)
returns jsonb language plpgsql security definer as $$
declare
  v_uid uuid := auth.uid();
  v_coins bigint;
  v_entry bigint := coalesce(p_entry_amount, 0);
begin
  if v_entry > 0 then
    if public.kill_switch_aktif_mi('kill_game_coin') then raise exception 'Game coin disabled'; end if;
    select coins into v_coins from public.wallets where user_id = v_uid for update;
    if v_coins is null or v_coins < v_entry then raise exception 'Insufficient coins'; end if;
    update public.wallets set coins = coins - v_entry, updated_at = now() where user_id = v_uid;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
    values (v_uid, 'coins', -v_entry, v_coins - v_entry, 'game_entry', 'game_session', null);
  end if;
  return jsonb_build_object('ok', true, 'room_id', p_room_id);
end $$;
`;

const U = {
  A: '00000000-0000-0000-0000-0000000000a1', // oyun 5000 + satın 2000
  B: '00000000-0000-0000-0000-0000000000b2', // oyun 0 + satın 2000
  C: '00000000-0000-0000-0000-0000000000c3', // oyun 0, ödül 300
  D: '00000000-0000-0000-0000-0000000000d4', // IAP
  E: '00000000-0000-0000-0000-0000000000e5', // geçmiş yanlış kesinti
};

let failed = 0;
let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', msg);
  } else {
    passed += 1;
  }
}
function esit(gercek: unknown, beklenen: unknown, msg: string) {
  assert(
    String(gercek) === String(beklenen),
    `${msg} (beklenen ${String(beklenen)}, gelen ${String(gercek)})`,
  );
}

const db = new PGlite();

async function deger<T = unknown>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<T>(sql, params);
  const satir = r.rows[0] as Record<string, unknown> | undefined;
  return (satir ? Object.values(satir)[0] : undefined) as T;
}
async function tek<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<T>(sql, params);
  return r.rows[0] as T;
}
async function hataBekle(sql: string, params: unknown[], icerik: string, msg: string) {
  try {
    await db.query(sql, params);
    assert(false, `${msg}: hata bekleniyordu (${icerik})`);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    assert(m.toLowerCase().includes(icerik.toLowerCase()), `${msg}: beklenen "${icerik}", gelen "${m}"`);
  }
}
async function kullanici(uid: string | null) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
}
async function admin(acik: boolean) {
  await db.query(`select set_config('test.admin', $1, false)`, [acik ? 'on' : 'off']);
}
async function cuzdan(uid: string) {
  return tek<{ coins: string; game_coins: string; bonus_coins: string }>(
    `select coins, game_coins, bonus_coins from public.wallets where user_id = $1`,
    [uid],
  );
}
async function bakiye(uid: string) {
  const w = await cuzdan(uid);
  return {
    coins: Number(w.coins),
    game: Number(w.game_coins),
    bonus: Number(w.bonus_coins),
    toplam: Number(w.coins) + Number(w.game_coins) + Number(w.bonus_coins),
  };
}
async function harca(
  uid: string,
  tutar: number,
  anahtar: string,
  onay = false,
  reason = 'test_spend',
) {
  return deger<Record<string, unknown>>(
    `select public.cuzdan_coin_harca($1, $2, $3, 'game', null, $4, 'test', $5)`,
    [uid, tutar, reason, anahtar, onay],
  );
}
async function kazanc(uid: string, tutar: number, anahtar: string) {
  return deger<Record<string, unknown>>(
    `select public.cuzdan_oyun_kazanc_ekle($1, $2, 'test_win', 'game', null, $3, 'test')`,
    [uid, tutar, anahtar],
  );
}

async function kur() {
  await db.exec(STUB);
  await db.exec(readFileSync(join(__dirname, '..', 'supabase', 'migrations', MIGRATION), 'utf8'));
  await db.exec(readFileSync(join(__dirname, '..', 'supabase', 'migrations', MIGRATION_ONAY), 'utf8'));
  await db.exec(`
    insert into public.profiles (id, display_name) values
      ('${U.A}', 'A'), ('${U.B}', 'B'), ('${U.C}', 'C'), ('${U.D}', 'D'), ('${U.E}', 'E');
    insert into public.wallets (user_id, coins, game_coins, bonus_coins) values
      ('${U.A}', 2000, 5000, 0),
      ('${U.B}', 2000, 0, 0),
      ('${U.C}', 0, 0, 300),
      ('${U.D}', 0, 0, 0),
      ('${U.E}', 0, 1000, 0);
  `);
}

async function testler() {
  // =========================================================================
  // 1) Oyun coinleri yeterliyken: yalnızca oyun kovasından düşer
  // =========================================================================
  let sonuc = await harca(U.A, 500, 'spend-0001');
  esit(sonuc.from_game_coins, 500, 'öncelik: 500 coin oyun kovasından');
  esit(sonuc.from_purchased_coins, 0, 'satın alınan kovaya dokunulmaz');
  let w = await bakiye(U.A);
  esit(w.game, 4500, 'oyun bakiyesi 5000 → 4500');
  esit(w.coins, 2000, 'satın alınan bakiye 2000 sabit');

  // =========================================================================
  // 2) Oyun coinleri yetersizken: onay olmadan satın alınana geçmez
  // =========================================================================
  const toplamOnce = (await bakiye(U.A)).toplam;
  await hataBekle(
    `select public.cuzdan_coin_harca($1, 6000, 'test_spend', 'game', null, 'spend-0002', 'test', false)`,
    [U.A],
    'satin_coin_onayi_gerekli',
    'oyun coini yetmezse açık onay istenir',
  );
  w = await bakiye(U.A);
  esit(w.game, 4500, 'başarısız denemede oyun bakiyesi değişmez');
  esit(w.coins, 2000, 'başarısız denemede satın alınan bakiye değişmez');
  esit(
    await deger(`select count(*) from public.cuzdan_coin_islemleri where idempotency_key = 'spend-0002'`),
    0,
    'başarısız deneme kayıt bırakmaz',
  );

  // Onayla: 4500 oyun + 1500 satın alınan
  sonuc = await harca(U.A, 6000, 'spend-0002', true);
  esit(sonuc.from_game_coins, 4500, 'onaylı karma harcama: oyun kovası önce');
  esit(sonuc.from_purchased_coins, 1500, 'kalan 1500 satın alınan kovadan');
  w = await bakiye(U.A);
  esit(w.game, 0, 'oyun bakiyesi sıfırlandı');
  esit(w.coins, 500, 'satın alınan bakiye 2000 → 500');

  // =========================================================================
  // 3) İade: harcama dağılımı tersine çevrilir, toplam korunur
  // =========================================================================
  const harcama = await tek<{ id: string; ref_id: string }>(
    `select id, ref_id from public.cuzdan_coin_islemleri where idempotency_key = 'spend-0002'`,
  );
  const iade = await deger<Record<string, unknown>>(
    `select public.cuzdan_oyun_iade($1, 6000, 'test_refund', 'game', $2, 'refund-0001', 'test')`,
    [U.A, harcama.ref_id],
  );
  esit(iade.refunded_game_coins, 4500, 'iade: 4500 oyun kovasına');
  esit(iade.refunded_purchased_coins, 1500, 'iade: 1500 satın alınan kovaya');
  w = await bakiye(U.A);
  esit(w.game, 4500, 'iade sonrası oyun bakiyesi geri geldi');
  esit(w.coins, 2000, 'iade sonrası satın alınan bakiye geri geldi');
  esit(w.toplam, toplamOnce, 'iade toplam bakiyeyi değiştirmez');

  // =========================================================================
  // 4) Sıfır oyun coini: politika açık + onay ile satın alınan coin
  // =========================================================================
  sonuc = await harca(U.B, 500, 'spend-0003', true);
  esit(sonuc.from_purchased_coins, 500, 'oyun coini yoksa onayla satın alınandan');
  w = await bakiye(U.B);
  esit(w.game, 0, 'oyun kovası negatife düşmez');
  esit(w.coins, 1500, 'satın alınan bakiye 2000 → 1500');

  // =========================================================================
  // 5) Politika kapalıyken satın alınan coin oyunda kullanılamaz
  // =========================================================================
  await db.exec(`update public.oyun_cuzdan_politikasi set satin_coin_ile_oyun = false where id = 1`);
  await hataBekle(
    `select public.cuzdan_coin_harca($1, 100, 'test_spend', 'game', null, 'spend-0004', 'test', true)`,
    [U.B],
    'satin_coin_kapali',
    'politika kapalıyken satın alınan coin harcanamaz',
  );
  const planKapali = await deger<Record<string, unknown>>(
    `select public.cuzdan_coin_harcama_plani($1, 100)`,
    [U.B],
  );
  esit(planKapali.yeterli, false, 'plan: satın alınan coin kapalıyken yeterli değil');
  esit(planKapali.satin_coin_izinli, false, 'plan: politika kapalı bildirilir');
  await db.exec(`update public.oyun_cuzdan_politikasi set satin_coin_ile_oyun = true where id = 1`);

  // =========================================================================
  // 6) Ödül/promosyon kovası: oyun → ödül sırası
  // =========================================================================
  await db.exec(`update public.wallets set game_coins = 100 where user_id = '${U.C}'`);
  sonuc = await harca(U.C, 250, 'spend-0005');
  esit(sonuc.from_game_coins, 100, 'önce oyun kovası');
  esit(sonuc.from_bonus_coins, 150, 'sonra ödül kovası');
  esit(sonuc.from_purchased_coins, 0, 'satın alınan kovaya dokunulmaz');
  w = await bakiye(U.C);
  esit(w.game, 0, 'ödül kovası kullanılınca oyun 0');
  esit(w.bonus, 150, 'ödül kovası 300 → 150');

  // =========================================================================
  // 7) Oyun kazancı yalnızca oyun kovasına yazılır
  // =========================================================================
  const onceKazanc = await bakiye(U.A);
  await kazanc(U.A, 1000, 'win-0001');
  w = await bakiye(U.A);
  esit(w.game, onceKazanc.game + 1000, 'kazanç oyun kovasına eklenir');
  esit(w.coins, onceKazanc.coins, 'kazanç satın alınan kovaya eklenmez');
  esit(w.bonus, onceKazanc.bonus, 'kazanç ödül kovasına eklenmez');

  // =========================================================================
  // 8) Idempotency: aynı işlem iki kez uygulanmaz
  // =========================================================================
  const tekrar = await harca(U.A, 500, 'spend-0001');
  esit(tekrar.duplicate, true, 'aynı anahtar tekrar işlenmez');
  w = await bakiye(U.A);
  esit(w.game, 5500, 'tekrar çağrı bakiyeyi değiştirmez');
  esit(
    await deger(`select count(*) from public.cuzdan_coin_islemleri where idempotency_key = 'spend-0001'`),
    1,
    'tek işlem kaydı',
  );
  esit(
    await deger(
      `select count(*) from public.wallet_ledger where reason = 'test_spend' and ref_id = $1`,
      [(await tek<{ ref_id: string }>(`select ref_id from public.cuzdan_coin_islemleri where idempotency_key = 'spend-0001'`)).ref_id],
    ),
    1,
    'tek defter satırı (yalnızca oyun kovası)',
  );

  // =========================================================================
  // 9) Aynı anda iki oyun: çifte harcama / negatif bakiye yok
  // =========================================================================
  await db.exec(`update public.wallets set game_coins = 1000 where user_id = '${U.A}'`);
  await hataBekle(
    `select public.cuzdan_coin_harca($1, 700, 'test_spend', 'game', null, 'paralel-a', 'test', false),
            public.cuzdan_coin_harca($1, 700, 'test_spend', 'game', null, 'paralel-b', 'test', false)`,
    [U.A],
    'satin_coin_onayi_gerekli',
    'eşzamanlı iki bahis onay olmadan satın alınan coine taşmaz',
  );
  w = await bakiye(U.A);
  esit(w.game, 1000, 'başarısız eşzamanlı tur bakiyeyi bozmaz');

  const s1 = await harca(U.A, 400, 'paralel-c');
  const s2 = await harca(U.A, 400, 'paralel-d');
  esit(s1.from_game_coins, 400, 'birinci tur oyun kovasından');
  esit(s2.from_game_coins, 400, 'ikinci tur oyun kovasından');
  w = await bakiye(U.A);
  esit(w.game, 200, 'iki tur sonrası kalan 200');

  // =========================================================================
  // 10) Başarısız oyun işlemi: bakiye ve defter değişmez
  // =========================================================================
  const onceBasarisiz = await bakiye(U.B);
  await hataBekle(
    `select public.cuzdan_coin_harca($1, 999999, 'test_spend', 'game', null, 'spend-basarisiz', 'test', false)`,
    [U.B],
    'insufficient',
    'yetersiz bakiyede harcama reddedilir',
  );
  const sonraBasarisiz = await bakiye(U.B);
  esit(sonraBasarisiz.toplam, onceBasarisiz.toplam, 'başarısız oyunda bakiye düşmez');
  esit(
    await deger(`select count(*) from public.cuzdan_coin_islemleri where idempotency_key = 'spend-basarisiz'`),
    0,
    'başarısız oyunda işlem kaydı oluşmaz',
  );

  // =========================================================================
  // 11) Tur katmanı: bahis + kazanç tek çağrıda doğru kovalara
  // =========================================================================
  await db.exec(`update public.wallets set game_coins = 3000, coins = 1000 where user_id = '${U.B}'`);
  const tur = await deger<Record<string, unknown>>(
    `select public.cuzdan_oyun_tur_isle($1, 300, 900, 'test', 'test_spend', 'test_win', 'test_round', 'tur-0001', false, null)`,
    [U.B],
  );
  esit(tur.from_game_coins, 300, 'tur: bahis oyun kovasından');
  esit(tur.from_purchased_coins, 0, 'tur: satın alınan kovaya dokunulmaz');
  w = await bakiye(U.B);
  esit(w.game, 3600, 'tur: 3000 - 300 + 900 = 3600');
  esit(w.coins, 1000, 'tur: satın alınan bakiye değişmez');

  // =========================================================================
  // 12) Fruit Wheel: gerçek hata senaryosu — 85.000 seçim, oyun coini varken
  // =========================================================================
  const RW = '30000000-0000-0000-0000-000000000001';
  await db.exec(`insert into public.fruit_wheel_rounds (id, locks_at) values ('${RW}', now() + interval '1 hour')`);
  await db.exec(`update public.wallets set game_coins = 20700000, coins = 5000 where user_id = '${U.A}'`);

  const oncekiSatir = await bakiye(U.A);
  await db.query(
    `select public.fruit_wheel_apply_delta($1, 'PLATFORM_APPROVED_COIN', -85000, 'fruit_wheel_selection', $2, null, 'fw_sel_test_0001', false)`,
    [U.A, RW],
  );
  w = await bakiye(U.A);
  esit(w.game, oncekiSatir.game - 85000, 'fruit wheel: 85.000 oyun kovasından düşer');
  esit(w.coins, 5000, 'fruit wheel: satın alınan kova korunur');
  esit(
    await deger(
      `select count(*) from public.wallet_ledger where user_id = $1 and currency = 'coins'
       and reason = 'fruit_wheel_selection' and delta < 0`,
      [U.A],
    ),
    0,
    'fruit wheel: satın alınan kovada negatif kayıt yok',
  );
  esit(
    await deger(
      `select from_purchased_coins from public.cuzdan_coin_islemleri where idempotency_key = 'fw_sel_test_0001'`,
    ),
    0,
    'fruit wheel: işlem defterinde satın alınan payı 0',
  );

  // Fruit Wheel kazancı oyun kovasına
  const onceFw = await bakiye(U.A);
  await db.query(
    `select public.fruit_wheel_apply_delta($1, 'PLATFORM_APPROVED_COIN', 120000, 'fruit_wheel_payout', $2, null, 'fw_win_test_0001', false)`,
    [U.A, RW],
  );
  w = await bakiye(U.A);
  esit(w.game, onceFw.game + 120000, 'fruit wheel kazancı oyun kovasına');
  esit(w.coins, 5000, 'fruit wheel kazancı satın alınan kovaya yazılmaz');

  // Fruit Wheel: oyun coini bitince onay ister
  await db.exec(`update public.wallets set game_coins = 0 where user_id = '${U.B}'`);
  await hataBekle(
    `select public.fruit_wheel_apply_delta($1, 'PLATFORM_APPROVED_COIN', -100, 'fruit_wheel_selection', $2, null, 'fw_sel_test_0002', false)`,
    [U.B, RW],
    'satin_coin_onayi_gerekli',
    'fruit wheel: satın alınan coine geçiş açık onay ister',
  );
  await db.query(
    `select public.fruit_wheel_apply_delta($1, 'PLATFORM_APPROVED_COIN', -100, 'fruit_wheel_selection', $2, null, 'fw_sel_test_0003', true)`,
    [U.B, RW],
  );
  w = await bakiye(U.B);
  esit(w.coins, 900, 'fruit wheel: onaylı satın alınan coin harcaması');
  esit(w.game, 0, 'fruit wheel: oyun kovası negatife düşmez');

  // =========================================================================
  // 13) IAP: yalnızca satın alınan kovaya yazar, oyun coinini korur
  // =========================================================================
  await db.exec(`update public.wallets set coins = 0, game_coins = 7500 where user_id = '${U.D}'`);
  const iap = readFileSync(
    join(__dirname, '..', 'supabase', 'migrations', '014_iap_stripe.sql'),
    'utf8',
  );
  assert(
    iap.includes('update public.wallets set coins = coins + v_coins'),
    'IAP: satın alınan kova artırılır',
  );
  assert(
    !/update public\.wallets set[^;]*game_coins\s*=/.test(iap),
    'IAP: game_coins sıfırlanmaz/değiştirilmez',
  );
  assert(
    iap.includes('finance_idempotency_keys') && iap.includes('provider_tx_id'),
    'IAP: aynı işlem ikinci kez bakiyeye yazılmaz',
  );
  // Satın alma sonrası oyun bakiyesi korunur (cüzdan güncelleme şekli)
  await db.exec(`update public.wallets set coins = coins + 10000 where user_id = '${U.D}'`);
  w = await bakiye(U.D);
  esit(w.coins, 10000, 'IAP sonrası satın alınan bakiye 10.000');
  esit(w.game, 7500, 'IAP sonrası oyun bakiyesi korunur');

  // =========================================================================
  // 14) Geçmiş yanlış kesinti: denetim + çift kayıtlı düzeltme
  // =========================================================================
  // E: 1000 oyun coini var (ledger), geçmişte 400 satın alınan coin'den oyun harcaması
  await db.exec(`
    delete from public.wallet_ledger
      where user_id in ('${U.A}', '${U.B}', '${U.C}', '${U.D}')
        and reason in ('test_spend', 'test_win', 'fruit_wheel_selection', 'fruit_wheel_payout');
    update public.wallets set coins = 0, game_coins = 1000 where user_id = '${U.E}';
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, created_at)
      values ('${U.E}', 'coins', 400, 400, 'coin_purchase', 'purchase', now() - interval '3 days');
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, created_at)
      values ('${U.E}', 'game_coins', 1000, 1000, 'fruit_wheel_payout', 'fruit_wheel', now() - interval '2 days');
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, created_at)
      values ('${U.E}', 'coins', -400, 0, 'fruit_wheel_selection', 'fruit_wheel', now() - interval '1 day');
  `);
  await kullanici(U.E);
  await admin(false);
  await hataBekle(
    `select public.admin_coin_harcama_denetimi_calistir()`,
    [],
    'Yetkisiz',
    'denetim yalnızca yönetici tarafından çalıştırılır',
  );
  await admin(true);
  await db.query(`select public.admin_coin_harcama_denetimi_calistir()`);
  const denetim = await tek<Record<string, string>>(
    `select * from public.coin_harcama_denetimi where user_id = $1`,
    [U.E],
  );
  esit(denetim.charged_amount, 400, 'denetim: düşülen tutar 400');
  esit(denetim.mischarged_amount, 400, 'denetim: oyun coini varken satın alınandan düşülmüş');
  esit(denetim.status, 'reported', 'denetim: otomatik düzeltme yapılmaz');

  const toplamE = (await bakiye(U.E)).toplam;
  const duzeltme = await deger<Record<string, unknown>>(
    `select public.admin_coin_harcama_duzeltme_onayla($1, 'Test düzeltme')`,
    [denetim.id],
  );
  esit(duzeltme.duzeltilen, 400, 'düzeltme: 400 satın alınan coine iade');
  w = await bakiye(U.E);
  esit(w.coins, 400, 'düzeltme: satın alınan bakiye 400');
  esit(w.game, 600, 'düzeltme: oyun kovasından 400 düşülür');
  esit(w.toplam, toplamE, 'düzeltme toplam bakiyeyi değiştirmez (çift kayıt)');
  await hataBekle(
    `select public.admin_coin_harcama_duzeltme_onayla($1, 'Tekrar')`,
    [denetim.id],
    'reported',
    'aynı denetim iki kez düzeltilemez',
  );

  const ozet = await deger<Record<string, unknown>>(`select public.admin_coin_harcama_denetim_ozeti()`);
  esit(ozet.toplam_yanlis_kesinti, 400, 'rapor: toplam yanlış kesinti');
  esit(ozet.duzeltilen_tutar, 400, 'rapor: düzeltilen tutar');
  await admin(false);

  // =========================================================================
  // 15) Slot settle RPC'leri: gövde onarımı + ortak katman
  // =========================================================================
  await db.exec(`update public.wallets set coins = 2000, game_coins = 5000, bonus_coins = 0 where user_id = '${U.A}'`);
  await db.query(
    `select public.zeus_settle_spin($1, 'zeus-settle-1', 500, gen_random_uuid(), '{"win":0}'::jsonb, false, false)`,
    [U.A],
  );
  w = await bakiye(U.A);
  esit(w.game, 4500, 'zeus settle: 500 oyun kovasından');
  esit(w.coins, 2000, 'zeus settle: satın alınan kova korunur');
  esit(
    await deger(
      `select count(*) from public.wallet_ledger where user_id = $1 and reason = 'zeus_bet' and currency = 'coins'`,
      [U.A],
    ),
    0,
    'zeus settle: satın alınan kovada defter satırı yok',
  );
  esit(
    await deger(
      `select count(*) from public.wallet_ledger where user_id = $1 and reason = 'zeus_bet' and currency = 'game_coins' and delta = -500`,
      [U.A],
    ),
    1,
    'zeus settle: defter satırı oyun kovasında',
  );

  await db.query(
    `select public.nox_settle_spin($1, 'nox-settle-1', 300, gen_random_uuid(), '{"win":0}'::jsonb, false, false)`,
    [U.A],
  );
  w = await bakiye(U.A);
  esit(w.game, 4200, 'nox settle: 300 oyun kovasından');
  esit(w.coins, 2000, 'nox settle: satın alınan kova korunur');
  esit(
    await deger(`select count(*) from public.wallet_ledger where user_id = $1 and reason in ('slot_bet','slot_win')`, [U.A]),
    0,
    'nox settle: eski slot defter satırı yazılmaz',
  );

  await db.query(
    `select public.fair_spin_settle_spin($1, 'fair-settle-1', 100, gen_random_uuid(), '{"win":0}'::jsonb, false)`,
    [U.A],
  );
  w = await bakiye(U.A);
  esit(w.game, 4100, 'fair spin settle: 100 oyun kovasından');
  esit(w.coins, 2000, 'fair spin settle: satın alınan kova korunur');

  await db.query(
    `select public.astral_falls_settle_spin($1, 'astral-settle-1', 250.4, gen_random_uuid(), '{"win":0}'::jsonb, false, false)`,
    [U.A],
  );
  w = await bakiye(U.A);
  esit(w.game, 3849, 'astral settle: ceil(250.4) = 251 oyun kovasından');
  esit(w.coins, 2000, 'astral settle: satın alınan kova korunur');

  await db.query(
    `select public.kozmik_kaskad_settle_spin($1, 'kaskad-settle-1', 200, gen_random_uuid(), '{"win":0}'::jsonb, false, false)`,
    [U.A],
  );
  w = await bakiye(U.A);
  esit(w.game, 3649, 'kaskad settle: 200 oyun kovasından');
  esit(w.coins, 2000, 'kaskad settle: satın alınan kova korunur');
  esit(
    await deger(
      `select count(*) from public.wallet_ledger where user_id = $1 and reason = 'kaskad_bet' and currency = 'coins'`,
      [U.A],
    ),
    0,
    'kaskad settle: satın alınan kovada defter satırı yok',
  );

  esit(
    await deger(
      `select count(*) from public.cuzdan_migrasyon_kayitlari
        where kind in ('unmatched', 'patch_failed') and detail like '%settle_spin%'`,
    ),
    0,
    'slot settle: tüm RPC gövdeleri onarıldı',
  );

  // =========================================================================
  // 16) Oda oyunu ödülü: yalnızca oyun kovasına
  // =========================================================================
  await db.exec(`update public.wallets set coins = 100, game_coins = 0, bonus_coins = 0 where user_id = '${U.D}'`);
  const oda = '40000000-0000-0000-0000-0000000000d4';
  await db.query(`select public.finish_game_session($1)`, [U.D]);
  w = await bakiye(U.D);
  esit(w.game, 500, 'oda ödülü oyun kovasına yazılır');
  esit(w.coins, 100, 'oda ödülü satın alınan kovaya yazılmaz');
  esit(
    await deger(
      `select count(*) from public.wallet_ledger where user_id = $1 and reason = 'game_reward' and currency = 'coins'`,
      [U.D],
    ),
    0,
    'oda ödülü satın alınan kovada defter satırı bırakmaz',
  );
  esit(
    await deger(
      `select count(*) from public.wallet_ledger where user_id = $1 and reason = 'game_reward' and currency = 'game_coins'`,
      [U.D],
    ),
    1,
    'oda ödülü oyun kovasında defter satırı bırakır',
  );

  // =========================================================================
  // 17) İşlem kayıtları silinemez / değiştirilemez
  // =========================================================================
  await hataBekle(
    `delete from public.cuzdan_coin_islemleri where idempotency_key = 'spend-0001'`,
    [],
    'silinemez',
    'işlem kaydı silinemez',
  );
  await hataBekle(
    `update public.cuzdan_coin_islemleri set amount = 1 where idempotency_key = 'spend-0001'`,
    [],
    'değiştirilemez',
    'işlem kaydı değiştirilemez',
  );

  // =========================================================================
  // 16) Cüzdan özeti istemciye ayrı bakiyeler verir
  // =========================================================================
  await kullanici(U.A);
  const ozetim = await deger<Record<string, unknown>>(`select public.cuzdan_oyun_cuzdani()`);
  esit(ozetim.purchased_coins, 2000, 'özet: satın alınan coin ayrı');
  assert(Number(ozetim.game_coins) > 0, 'özet: oyun coinleri ayrı');
  esit((ozetim.spend_order as string[]).join('>'), 'game_coins>bonus_coins>coins', 'özet: harcama sırası');
  const onizleme = await deger<Record<string, unknown>>(
    `select public.cuzdan_oyun_harcama_onizleme(100)`,
  );
  esit(onizleme.from_game_coins, 100, 'önizleme: 100 coin oyun kovasından');

  // =========================================================================
  // 18) Oda oturumu: oyun coinleri yetmezse satın alınan coin sessizce gitmez
  // =========================================================================
  await kullanici(U.A);
  await db.exec(`update public.wallets set coins = 2000, game_coins = 5000, bonus_coins = 0 where user_id = '${U.A}'`);
  const oturum = '50000000-0000-0000-0000-0000000000a5';

  // a) Oyun coinleri yeterli: yalnızca oyun kovasından, onay gerekmez
  await db.query(`select public.join_game_session($1, $2)`, [oturum, 500]);
  w = await bakiye(U.A);
  esit(w.game, 4500, 'oda girişi: 500 coin oyun kovasından');
  esit(w.coins, 2000, 'oda girişi: satın alınan kova korunur');

  // b) Oyun coinleri yetmiyor: sessizce satın alınana geçmez
  const oturum2 = '50000000-0000-0000-0000-0000000000a6';
  await hataBekle(
    `select public.join_game_session($1, $2)`,
    [oturum2, 5000],
    'cuzdan_satin_coin_onayi_gerekli',
    'oda girişi: onaysız satın alınan coin kullanılamaz',
  );
  w = await bakiye(U.A);
  esit(w.game, 4500, 'oda girişi (reddedildi): oyun bakiyesi değişmez');
  esit(w.coins, 2000, 'oda girişi (reddedildi): satın alınan bakiye değişmez');

  // c) Açık onayla: önce oyun, kalan satın alınan
  const oturum3 = '50000000-0000-0000-0000-0000000000a7';
  const katil = await deger<Record<string, unknown>>(
    `select public.oyun_oturumuna_katil($1, $2, $3)`,
    [oturum3, 5000, true],
  );
  esit(katil.ok, true, 'oda girişi: açık onayla katılım başarılı');
  w = await bakiye(U.A);
  esit(w.game, 0, 'onaylı giriş: oyun kovası önce tükendi');
  esit(w.coins, 1500, 'onaylı giriş: kalan 500 satın alınan kovadan');

  // d) Onay parametresi false ile sarmalayıcı da reddeder
  await kullanici(U.B);
  await db.exec(`update public.wallets set coins = 2000, game_coins = 0 where user_id = '${U.B}'`);
  await hataBekle(
    `select public.oyun_oturumuna_katil($1, $2, $3)`,
    ['50000000-0000-0000-0000-0000000000b8', 300, false],
    'cuzdan_satin_coin_onayi_gerekli',
    'sarmalayıcı: onay false iken satın alınan coin kullanılmaz',
  );

  // e) Politika kapalıyken onay verilse bile satın alınan coin oyun için kullanılmaz
  await db.exec(`update public.oyun_cuzdan_politikasi set satin_coin_ile_oyun = false where id = 1`);
  await hataBekle(
    `select public.oyun_oturumuna_katil($1, $2, $3)`,
    ['50000000-0000-0000-0000-0000000000b9', 300, true],
    'cuzdan_satin_coin_kapali',
    'politika kapalı: satın alınan coin oyun için kullanılamaz',
  );
  await db.exec(`update public.oyun_cuzdan_politikasi set satin_coin_ile_oyun = true where id = 1`);

  // f) Oturum oluşturma da aynı kurallara tabi
  await kullanici(U.B);
  const odaOlustur = await deger<Record<string, unknown>>(
    `select public.oyun_oturumu_olustur($1, $2, null, null, $3, $4)`,
    ['60000000-0000-0000-0000-0000000000b6', 'test', 400, true],
  );
  esit(odaOlustur.ok, true, 'oturum oluşturma: açık onayla başarılı');
  w = await bakiye(U.B);
  esit(w.game, 0, 'oturum oluşturma: oyun kovası 0 kalır');
  esit(w.coins, 1600, 'oturum oluşturma: 400 coin satın alınan kovadan');

  esit(
    await deger(
      `select count(*) from public.cuzdan_migrasyon_kayitlari
        where kind in ('unmatched', 'patch_failed') and detail like '%consent%'`,
    ),
    0,
    'oda oturumu: onay yamaları eksiksiz uygulandı',
  );
}

async function main() {
  await kur();
  await testler();
  console.log(`oyun-cuzdan-sql: ${passed} başarılı, ${failed} başarısız`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
