-- =============================================================================
-- TAMUSO · OYUN CÜZDANI — HARCAMA ÖNCELİĞİ VE KAYNAK İZOLASYONU
-- =============================================================================
--
-- SORUN (kanıtlanmış):
--   Oyun bahisleri `wallets.coins` (SATIN ALINAN) kovasından düşülüyordu; kazançlar
--   ise `wallets.game_coins` kovasına yazılıyordu. Sonuç: oyun coin'i 20M olan bir
--   kullanıcının 85.000 coin'lik Fruit Wheel seçimi satın alınan bakiyeden düşüyordu.
--   (fruit_wheel_apply_delta, storm_king_settle, join_game_session, create_game_session
--    ve eski slot settle RPC'leri tek kovayı hedefliyordu.)
--
-- BU MİGRASYON:
--   1. Tek bir atomik cüzdan katmanı tanımlar:
--        cuzdan_coin_harca()        → öncelik: game_coins → bonus_coins → coins(*)
--        cuzdan_oyun_kazanc_ekle()  → kazanç YALNIZCA game_coins
--        cuzdan_oyun_iade()         → harcama dağılımını tersine çevirir
--        cuzdan_oyun_tur_isle()     → bahis + kazanç tek çağrıda (eski RPC'ler için)
--      (*) satın alınan coin yalnızca politika izinliyse ve kullanıcı açık onay
--          verdiyse kullanılır (Apple/Google + mevzuat gereği kapatılabilir).
--   2. Her işlemi `cuzdan_coin_islemleri` defterine yazar (idempotent, silinemez).
--   3. Fruit Wheel, Storm King ve oda oturumu giriş ücretlerini yeni katmana taşır.
--   4. Geçmiş yanlış kesintiler için denetim + çift kayıtlı düzeltme mekanizması kurar.
--   5. Eski slot RPC'lerini (zeus/kaskad/nox/fair/astral) ortak katmana bağlar;
--      yamanamayan varsa `cuzdan_migrasyon_kayitlari`'na yazar (sessiz bozulma yok).
--
-- Mevcut bakiyeler SIFIRLANMAZ, toplam korunur.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Politika: satın alınan coin ile oyun
-- -----------------------------------------------------------------------------
create table if not exists public.oyun_cuzdan_politikasi (
  id smallint primary key default 1,
  satin_coin_ile_oyun boolean not null default true,
  satin_coin_onayi_zorunlu boolean not null default true,
  guncelleyen uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint oyun_cuzdan_politikasi_tek_satir check (id = 1)
);

insert into public.oyun_cuzdan_politikasi (id) values (1) on conflict (id) do nothing;

comment on table public.oyun_cuzdan_politikasi is
  'Oyunlarda satın alınan coin kullanımı. Apple/Google 5.3 veya yerel mevzuat gereği kapatmak için satin_coin_ile_oyun = false.';
comment on column public.oyun_cuzdan_politikasi.satin_coin_onayi_zorunlu is
  'true: satın alınan coin kullanılacaksa istemci açık onay göndermek zorunda (p_satin_coin_onay).';

alter table public.oyun_cuzdan_politikasi enable row level security;

drop policy if exists oyun_cuzdan_politikasi_okuma on public.oyun_cuzdan_politikasi;
create policy oyun_cuzdan_politikasi_okuma on public.oyun_cuzdan_politikasi
  for select to authenticated using (true);

revoke all on public.oyun_cuzdan_politikasi from public, anon;
revoke insert, update, delete on public.oyun_cuzdan_politikasi from authenticated;
grant select on public.oyun_cuzdan_politikasi to authenticated;

create or replace function public.oyun_satin_coin_ile_oyun_izinli()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select satin_coin_ile_oyun from public.oyun_cuzdan_politikasi where id = 1), false);
$$;

revoke all on function public.oyun_satin_coin_ile_oyun_izinli() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 1) İşlem defteri (tek finansal kayıt: kim, hangi kovadan, ne kadar, sonrası)
-- -----------------------------------------------------------------------------
create table if not exists public.cuzdan_coin_islemleri (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('spend', 'refund', 'reward')),
  idempotency_key text not null,
  ref_key text,
  game_code text,
  reason text not null,
  ref_type text,
  ref_id uuid,
  amount bigint not null check (amount >= 0),
  from_game_coins bigint not null default 0 check (from_game_coins >= 0),
  from_bonus_coins bigint not null default 0 check (from_bonus_coins >= 0),
  from_purchased_coins bigint not null default 0 check (from_purchased_coins >= 0),
  game_coins_after bigint not null,
  bonus_coins_after bigint not null,
  purchased_coins_after bigint not null,
  satin_coin_onayi boolean not null default false,
  created_at timestamptz not null default now(),
  constraint cuzdan_coin_islemleri_key_uzunluk check (length(btrim(idempotency_key)) between 8 and 200)
);

create unique index if not exists cuzdan_coin_islemleri_key_uidx
  on public.cuzdan_coin_islemleri (user_id, idempotency_key);
create index if not exists cuzdan_coin_islemleri_user_time_idx
  on public.cuzdan_coin_islemleri (user_id, created_at desc);
create index if not exists cuzdan_coin_islemleri_ref_idx
  on public.cuzdan_coin_islemleri (ref_type, ref_id);

comment on table public.cuzdan_coin_islemleri is
  'Oyun cüzdanı işlem defteri. from_* = hangi kovadan düşüldü/iade edildi, *_after = işlem sonrası bakiye.';
comment on column public.cuzdan_coin_islemleri.kind is
  'spend: bahis/giriş, reward: oyun kazancı, refund: iade/geri alma.';

alter table public.cuzdan_coin_islemleri enable row level security;

drop policy if exists cuzdan_coin_islemleri_okuma on public.cuzdan_coin_islemleri;
create policy cuzdan_coin_islemleri_okuma on public.cuzdan_coin_islemleri
  for select to authenticated
  using (user_id = auth.uid() or public.ben_admin_miyim());

revoke all on public.cuzdan_coin_islemleri from public, anon, authenticated;
grant select on public.cuzdan_coin_islemleri to authenticated;

create or replace function public.cuzdan_coin_islem_degismez()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Cüzdan işlem kaydı silinemez veya değiştirilemez (%)', old.id;
end;
$$;

drop trigger if exists cuzdan_coin_islem_degismez_trg on public.cuzdan_coin_islemleri;
create trigger cuzdan_coin_islem_degismez_trg
  before update or delete on public.cuzdan_coin_islemleri
  for each row execute function public.cuzdan_coin_islem_degismez();

-- -----------------------------------------------------------------------------
-- 2) Harcama planı (server-side, saf hesap)
--    Öncelik: oyun → ödül/promosyon → satın alınan
-- -----------------------------------------------------------------------------
create or replace function public.cuzdan_coin_harcama_plani(p_user_id uuid, p_amount bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_c bigint;
  v_g bigint;
  v_b bigint;
  v_need bigint;
  v_fg bigint := 0;
  v_fb bigint := 0;
  v_fc bigint := 0;
  v_izin boolean := public.oyun_satin_coin_ile_oyun_izinli();
  v_toplam bigint;
begin
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_amount', 'amount', coalesce(p_amount, 0));
  end if;

  select coalesce(coins, 0), coalesce(game_coins, 0), coalesce(bonus_coins, 0)
    into v_c, v_g, v_b
  from public.wallets where user_id = p_user_id;

  if v_c is null then
    return jsonb_build_object('ok', false, 'code', 'wallet_not_found', 'amount', p_amount);
  end if;

  v_toplam := v_c + v_g + v_b;
  v_need := p_amount;

  -- ÖNCELİK 1: oyun coinleri
  v_fg := least(v_g, v_need);
  v_need := v_need - v_fg;
  -- ÖNCELİK 2: ödül/promosyon coinleri (nakde çevrilemez, oyun için uygun)
  v_fb := least(v_b, v_need);
  v_need := v_need - v_fb;
  -- ÖNCELİK 3: satın alınan coinler (politika + açık onay)
  v_fc := least(v_c, v_need);
  v_need := v_need - v_fc;

  return jsonb_build_object(
    'ok', true,
    'code', case
      when v_need > 0 then 'insufficient_balance'
      when v_fc > 0 and not v_izin then 'satin_coin_kapali'
      else 'ok'
    end,
    'amount', p_amount,
    'from_game_coins', v_fg,
    'from_bonus_coins', v_fb,
    'from_purchased_coins', v_fc,
    'satin_coin_gerekli', v_fc > 0,
    'satin_coin_izinli', v_izin,
    'satin_coin_onayi_gerekli', v_fc > 0 and v_izin,
    'yeterli', v_need = 0 and (v_fc = 0 or v_izin),
    'eksik', v_need,
    'game_coins', v_g,
    'bonus_coins', v_b,
    'purchased_coins', v_c,
    'total_coins', v_toplam,
    'game_coins_after', v_g - v_fg,
    'bonus_coins_after', v_b - v_fb,
    'purchased_coins_after', v_c - v_fc,
    'total_coins_after', v_toplam - (v_fg + v_fb + v_fc)
  );
end;
$$;

revoke all on function public.cuzdan_coin_harcama_plani(uuid, bigint) from public, anon, authenticated;
grant execute on function public.cuzdan_coin_harcama_plani(uuid, bigint) to service_role;

-- -----------------------------------------------------------------------------
-- 3) Atomik harcama
-- -----------------------------------------------------------------------------
create or replace function public.cuzdan_coin_harca(
  p_user_id uuid,
  p_amount bigint,
  p_reason text,
  p_ref_type text default 'game',
  p_ref_id uuid default null,
  p_idempotency_key text default null,
  p_game_code text default null,
  p_satin_coin_onay boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_row public.cuzdan_coin_islemleri%rowtype;
  v_c bigint;
  v_g bigint;
  v_b bigint;
  v_need bigint;
  v_fg bigint := 0;
  v_fb bigint := 0;
  v_fc bigint := 0;
  v_ref uuid;
begin
  if p_user_id is null then raise exception 'Cüzdan sahibi gerekli'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Geçersiz tutar'; end if;
  if v_key is null then raise exception 'Idempotency anahtarı gerekli'; end if;

  v_ref := coalesce(p_ref_id, md5(p_user_id::text || ':' || v_key)::uuid);

  -- Erken idempotency: aynı anahtar daha önce işlendi mi?
  select * into v_row from public.cuzdan_coin_islemleri
  where user_id = p_user_id and idempotency_key = v_key;
  if found then
    return jsonb_build_object(
      'ok', true, 'duplicate', true, 'transaction_id', v_row.id,
      'amount', v_row.amount, 'reason', v_row.reason, 'game_code', v_row.game_code,
      'from_game_coins', v_row.from_game_coins,
      'from_bonus_coins', v_row.from_bonus_coins,
      'from_purchased_coins', v_row.from_purchased_coins,
      'satin_coin_kullanildi', v_row.from_purchased_coins > 0,
      'game_coins', v_row.game_coins_after,
      'bonus_coins', v_row.bonus_coins_after,
      'purchased_coins', v_row.purchased_coins_after,
      'total_coins', v_row.game_coins_after + v_row.bonus_coins_after + v_row.purchased_coins_after
    );
  end if;

  select coalesce(coins, 0), coalesce(game_coins, 0), coalesce(bonus_coins, 0)
    into v_c, v_g, v_b
  from public.wallets where user_id = p_user_id
  for update;

  if v_c is null then raise exception 'Cüzdan bulunamadı'; end if;

  -- Kilit alındıktan sonra tekrar kontrol (eşzamanlı aynı anahtar)
  select * into v_row from public.cuzdan_coin_islemleri
  where user_id = p_user_id and idempotency_key = v_key;
  if found then
    return jsonb_build_object(
      'ok', true, 'duplicate', true, 'transaction_id', v_row.id,
      'amount', v_row.amount, 'reason', v_row.reason, 'game_code', v_row.game_code,
      'from_game_coins', v_row.from_game_coins,
      'from_bonus_coins', v_row.from_bonus_coins,
      'from_purchased_coins', v_row.from_purchased_coins,
      'satin_coin_kullanildi', v_row.from_purchased_coins > 0,
      'game_coins', v_row.game_coins_after,
      'bonus_coins', v_row.bonus_coins_after,
      'purchased_coins', v_row.purchased_coins_after,
      'total_coins', v_row.game_coins_after + v_row.bonus_coins_after + v_row.purchased_coins_after
    );
  end if;

  v_need := p_amount;

  -- ÖNCELİK 1: oyun coinleri
  v_fg := least(v_g, v_need);
  v_need := v_need - v_fg;
  -- ÖNCELİK 2: ödül/promosyon coinleri
  v_fb := least(v_b, v_need);
  v_need := v_need - v_fb;
  -- ÖNCELİK 3: satın alınan coinler
  v_fc := least(v_c, v_need);
  v_need := v_need - v_fc;

  if v_need > 0 then
    raise exception 'Insufficient coins (eksik: %)', v_need using errcode = 'P0001';
  end if;

  if v_fc > 0 then
    if not public.oyun_satin_coin_ile_oyun_izinli() then
      raise exception 'cuzdan_satin_coin_kapali' using errcode = 'P0001';
    end if;
    if not coalesce(p_satin_coin_onay, false) then
      raise exception 'cuzdan_satin_coin_onayi_gerekli: %', v_fc using errcode = 'P0001';
    end if;
  end if;

  update public.wallets
    set coins = v_c - v_fc,
        game_coins = v_g - v_fg,
        bonus_coins = v_b - v_fb,
        updated_at = now()
  where user_id = p_user_id;

  insert into public.cuzdan_coin_islemleri (
    user_id, kind, idempotency_key, ref_key, game_code, reason, ref_type, ref_id, amount,
    from_game_coins, from_bonus_coins, from_purchased_coins,
    game_coins_after, bonus_coins_after, purchased_coins_after, satin_coin_onayi
  ) values (
    p_user_id, 'spend', v_key, v_key, p_game_code, p_reason, p_ref_type, v_ref, p_amount,
    v_fg, v_fb, v_fc,
    v_g - v_fg, v_b - v_fb, v_c - v_fc, coalesce(p_satin_coin_onay, false)
  ) returning * into v_row;

  if v_fg > 0 then
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
    values (p_user_id, 'game_coins', -v_fg, v_g - v_fg, p_reason, p_ref_type, v_ref);
  end if;
  if v_fb > 0 then
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
    values (p_user_id, 'bonus_coins', -v_fb, v_b - v_fb, p_reason, p_ref_type, v_ref);
  end if;
  if v_fc > 0 then
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
    values (p_user_id, 'coins', -v_fc, v_c - v_fc, p_reason, p_ref_type, v_ref);
  end if;

  return jsonb_build_object(
    'ok', true, 'duplicate', false, 'transaction_id', v_row.id,
    'amount', p_amount, 'reason', p_reason, 'game_code', p_game_code,
    'from_game_coins', v_fg,
    'from_bonus_coins', v_fb,
    'from_purchased_coins', v_fc,
    'satin_coin_kullanildi', v_fc > 0,
    'game_coins', v_g - v_fg,
    'bonus_coins', v_b - v_fb,
    'purchased_coins', v_c - v_fc,
    'total_coins', (v_g - v_fg) + (v_b - v_fb) + (v_c - v_fc)
  );
end;
$$;

comment on function public.cuzdan_coin_harca(uuid, bigint, text, text, uuid, text, text, boolean) is
  'Oyun harcaması: game_coins → bonus_coins → coins. Satın alınan coin yalnızca politika + açık onayla. Idempotent.';

revoke all on function public.cuzdan_coin_harca(uuid, bigint, text, text, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.cuzdan_coin_harca(uuid, bigint, text, text, uuid, text, text, boolean) to service_role;

-- -----------------------------------------------------------------------------
-- 4) Atomik kazanç — YALNIZCA oyun coin kovası
-- -----------------------------------------------------------------------------
create or replace function public.cuzdan_oyun_kazanc_ekle(
  p_user_id uuid,
  p_amount bigint,
  p_reason text,
  p_ref_type text default 'game',
  p_ref_id uuid default null,
  p_idempotency_key text default null,
  p_game_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_row public.cuzdan_coin_islemleri%rowtype;
  v_c bigint;
  v_g bigint;
  v_b bigint;
  v_ref uuid;
begin
  if p_user_id is null then raise exception 'Cüzdan sahibi gerekli'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Geçersiz tutar'; end if;
  if v_key is null then raise exception 'Idempotency anahtarı gerekli'; end if;

  v_ref := coalesce(p_ref_id, md5(p_user_id::text || ':' || v_key)::uuid);

  select * into v_row from public.cuzdan_coin_islemleri
  where user_id = p_user_id and idempotency_key = v_key;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'transaction_id', v_row.id,
      'amount', v_row.amount, 'game_coins', v_row.game_coins_after,
      'bonus_coins', v_row.bonus_coins_after, 'purchased_coins', v_row.purchased_coins_after,
      'total_coins', v_row.game_coins_after + v_row.bonus_coins_after + v_row.purchased_coins_after);
  end if;

  select coalesce(coins, 0), coalesce(game_coins, 0), coalesce(bonus_coins, 0)
    into v_c, v_g, v_b
  from public.wallets where user_id = p_user_id
  for update;

  if v_c is null then raise exception 'Cüzdan bulunamadı'; end if;

  select * into v_row from public.cuzdan_coin_islemleri
  where user_id = p_user_id and idempotency_key = v_key;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'transaction_id', v_row.id,
      'amount', v_row.amount, 'game_coins', v_row.game_coins_after,
      'bonus_coins', v_row.bonus_coins_after, 'purchased_coins', v_row.purchased_coins_after,
      'total_coins', v_row.game_coins_after + v_row.bonus_coins_after + v_row.purchased_coins_after);
  end if;

  -- Kazanç YALNIZCA game_coins kovasına yazılır. coins ve bonus_coins'e dokunulmaz.
  update public.wallets
    set game_coins = v_g + p_amount, updated_at = now()
  where user_id = p_user_id;

  insert into public.cuzdan_coin_islemleri (
    user_id, kind, idempotency_key, ref_key, game_code, reason, ref_type, ref_id, amount,
    from_game_coins, from_bonus_coins, from_purchased_coins,
    game_coins_after, bonus_coins_after, purchased_coins_after
  ) values (
    p_user_id, 'reward', v_key, v_key, p_game_code, p_reason, p_ref_type, v_ref, p_amount,
    0, 0, 0, v_g + p_amount, v_b, v_c
  ) returning * into v_row;

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
  values (p_user_id, 'game_coins', p_amount, v_g + p_amount, p_reason, p_ref_type, v_ref);

  return jsonb_build_object(
    'ok', true, 'duplicate', false, 'transaction_id', v_row.id,
    'amount', p_amount,
    'game_coins', v_g + p_amount, 'bonus_coins', v_b, 'purchased_coins', v_c,
    'total_coins', v_g + p_amount + v_b + v_c
  );
end;
$$;

comment on function public.cuzdan_oyun_kazanc_ekle(uuid, bigint, text, text, uuid, text, text) is
  'Oyun kazancı: yalnızca wallets.game_coins. Nakde çevrilemez, satın alınan bakiyeye veya yayıncı kazancına yazılmaz.';

revoke all on function public.cuzdan_oyun_kazanc_ekle(uuid, bigint, text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.cuzdan_oyun_kazanc_ekle(uuid, bigint, text, text, uuid, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- 5) İade — harcama dağılımını tersine çevirir (önce satın alınan, sonra ödül, sonra oyun)
-- -----------------------------------------------------------------------------
create or replace function public.cuzdan_oyun_iade(
  p_user_id uuid,
  p_amount bigint,
  p_reason text,
  p_ref_type text,
  p_ref_id uuid,
  p_idempotency_key text,
  p_game_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_row public.cuzdan_coin_islemleri%rowtype;
  v_c bigint;
  v_g bigint;
  v_b bigint;
  v_need bigint;
  v_used_c bigint;
  v_used_b bigint;
  v_used_g bigint;
  v_dg bigint := 0;
  v_db bigint := 0;
  v_dc bigint := 0;
begin
  if p_user_id is null then raise exception 'Cüzdan sahibi gerekli'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Geçersiz tutar'; end if;
  if p_ref_id is null then raise exception 'İade referansı gerekli'; end if;
  if v_key is null then raise exception 'Idempotency anahtarı gerekli'; end if;

  select * into v_row from public.cuzdan_coin_islemleri
  where user_id = p_user_id and idempotency_key = v_key;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'transaction_id', v_row.id,
      'amount', v_row.amount,
      'refunded_game_coins', v_row.from_game_coins,
      'refunded_bonus_coins', v_row.from_bonus_coins,
      'refunded_purchased_coins', v_row.from_purchased_coins,
      'game_coins', v_row.game_coins_after, 'bonus_coins', v_row.bonus_coins_after,
      'purchased_coins', v_row.purchased_coins_after,
      'total_coins', v_row.game_coins_after + v_row.bonus_coins_after + v_row.purchased_coins_after);
  end if;

  select coalesce(coins, 0), coalesce(game_coins, 0), coalesce(bonus_coins, 0)
    into v_c, v_g, v_b
  from public.wallets where user_id = p_user_id
  for update;

  if v_c is null then raise exception 'Cüzdan bulunamadı'; end if;

  select * into v_row from public.cuzdan_coin_islemleri
  where user_id = p_user_id and idempotency_key = v_key;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'transaction_id', v_row.id,
      'amount', v_row.amount,
      'refunded_game_coins', v_row.from_game_coins,
      'refunded_bonus_coins', v_row.from_bonus_coins,
      'refunded_purchased_coins', v_row.from_purchased_coins,
      'game_coins', v_row.game_coins_after, 'bonus_coins', v_row.bonus_coins_after,
      'purchased_coins', v_row.purchased_coins_after,
      'total_coins', v_row.game_coins_after + v_row.bonus_coins_after + v_row.purchased_coins_after);
  end if;

  -- Bu referansta harcanan dağılım (spend - önceki iadeler)
  select
    coalesce(sum(case when kind = 'spend' then from_purchased_coins else -from_purchased_coins end), 0),
    coalesce(sum(case when kind = 'spend' then from_bonus_coins else -from_bonus_coins end), 0),
    coalesce(sum(case when kind = 'spend' then from_game_coins else -from_game_coins end), 0)
  into v_used_c, v_used_b, v_used_g
  from public.cuzdan_coin_islemleri
  where user_id = p_user_id and ref_type = p_ref_type and ref_id = p_ref_id
    and kind in ('spend', 'refund');

  -- Ters sıra: satın alınan → ödül → oyun
  v_need := p_amount;
  v_dc := least(greatest(v_used_c, 0), v_need);
  v_need := v_need - v_dc;
  v_db := least(greatest(v_used_b, 0), v_need);
  v_need := v_need - v_db;
  v_dg := least(greatest(v_used_g, 0), v_need);
  v_need := v_need - v_dg;

  if v_need > 0 then
    raise exception 'İade tutarı harcamayı aşıyor (kalan: %)', v_need;
  end if;

  update public.wallets
    set coins = v_c + v_dc,
        game_coins = v_g + v_dg,
        bonus_coins = v_b + v_db,
        updated_at = now()
  where user_id = p_user_id;

  insert into public.cuzdan_coin_islemleri (
    user_id, kind, idempotency_key, ref_key, game_code, reason, ref_type, ref_id, amount,
    from_game_coins, from_bonus_coins, from_purchased_coins,
    game_coins_after, bonus_coins_after, purchased_coins_after
  ) values (
    p_user_id, 'refund', v_key, v_key, p_game_code, p_reason, p_ref_type, p_ref_id, p_amount,
    v_dg, v_db, v_dc, v_g + v_dg, v_b + v_db, v_c + v_dc
  ) returning * into v_row;

  if v_dg > 0 then
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
    values (p_user_id, 'game_coins', v_dg, v_g + v_dg, p_reason, p_ref_type, p_ref_id);
  end if;
  if v_db > 0 then
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
    values (p_user_id, 'bonus_coins', v_db, v_b + v_db, p_reason, p_ref_type, p_ref_id);
  end if;
  if v_dc > 0 then
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
    values (p_user_id, 'coins', v_dc, v_c + v_dc, p_reason, p_ref_type, p_ref_id);
  end if;

  return jsonb_build_object(
    'ok', true, 'duplicate', false, 'transaction_id', v_row.id, 'amount', p_amount,
    'refunded_game_coins', v_dg, 'refunded_bonus_coins', v_db, 'refunded_purchased_coins', v_dc,
    'game_coins', v_g + v_dg, 'bonus_coins', v_b + v_db, 'purchased_coins', v_c + v_dc,
    'total_coins', v_g + v_dg + v_b + v_db + v_c + v_dc
  );
end;
$$;

revoke all on function public.cuzdan_oyun_iade(uuid, bigint, text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.cuzdan_oyun_iade(uuid, bigint, text, text, uuid, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- 6) Tek tur: bahis + kazanç (eski oyun RPC'leri bunu çağırır)
-- -----------------------------------------------------------------------------
create or replace function public.cuzdan_oyun_tur_isle(
  p_user_id uuid,
  p_bet bigint,
  p_win bigint,
  p_game_code text,
  p_bet_reason text,
  p_win_reason text,
  p_ref_type text,
  p_idempotency_key text,
  p_satin_coin_onay boolean default false,
  p_ref_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_bet bigint := greatest(coalesce(p_bet, 0), 0);
  v_win bigint := greatest(coalesce(p_win, 0), 0);
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_before public.wallets%rowtype;
  v_spend jsonb := '{}'::jsonb;
  v_reward jsonb := '{}'::jsonb;
  v_c bigint;
  v_g bigint;
  v_b bigint;
begin
  if p_user_id is null then raise exception 'Cüzdan sahibi gerekli'; end if;
  if v_key is null then raise exception 'Idempotency anahtarı gerekli'; end if;

  select * into v_before from public.wallets where user_id = p_user_id;

  if v_bet > 0 then
    v_spend := public.cuzdan_coin_harca(
      p_user_id, v_bet, p_bet_reason, p_ref_type, p_ref_id,
      v_key || ':bet', p_game_code, p_satin_coin_onay
    );
  end if;

  if v_win > 0 then
    v_reward := public.cuzdan_oyun_kazanc_ekle(
      p_user_id, v_win, p_win_reason, p_ref_type, p_ref_id, v_key || ':win', p_game_code
    );
  end if;

  select coalesce(coins, 0), coalesce(game_coins, 0), coalesce(bonus_coins, 0)
    into v_c, v_g, v_b
  from public.wallets where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', coalesce((v_spend->>'duplicate')::boolean, false)
                 or coalesce((v_reward->>'duplicate')::boolean, false),
    'bet', v_bet,
    'win', v_win,
    'balance_before', coalesce(v_before.coins, 0) + coalesce(v_before.game_coins, 0) + coalesce(v_before.bonus_coins, 0),
    'balance_after', v_c + v_g + v_b,
    'from_game_coins', coalesce((v_spend->>'from_game_coins')::bigint, 0),
    'from_bonus_coins', coalesce((v_spend->>'from_bonus_coins')::bigint, 0),
    'from_purchased_coins', coalesce((v_spend->>'from_purchased_coins')::bigint, 0),
    'satin_coin_kullanildi', coalesce((v_spend->>'from_purchased_coins')::bigint, 0) > 0,
    'game_coins', v_g,
    'bonus_coins', v_b,
    'purchased_coins', v_c,
    'transaction_id', coalesce(v_spend->>'transaction_id', v_reward->>'transaction_id')
  );
end;
$$;

revoke all on function public.cuzdan_oyun_tur_isle(uuid, bigint, bigint, text, text, text, text, text, boolean, uuid) from public, anon, authenticated;
grant execute on function public.cuzdan_oyun_tur_isle(uuid, bigint, bigint, text, text, text, text, text, boolean, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 7) İstemci RPC'leri (yalnızca kendi cüzdanı)
-- -----------------------------------------------------------------------------
create or replace function public.cuzdan_oyun_cuzdani()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_w public.wallets%rowtype;
  v_izin boolean := public.oyun_satin_coin_ile_oyun_izinli();
  v_onay_zorunlu boolean := coalesce(
    (select satin_coin_onayi_zorunlu from public.oyun_cuzdan_politikasi where id = 1), true);
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'auth');
  end if;

  select * into v_w from public.wallets where user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'game_coins', coalesce(v_w.game_coins, 0),
    'bonus_coins', coalesce(v_w.bonus_coins, 0),
    'purchased_coins', coalesce(v_w.coins, 0),
    'total_coins', coalesce(v_w.coins, 0) + coalesce(v_w.game_coins, 0) + coalesce(v_w.bonus_coins, 0),
    'satin_coin_ile_oyun', v_izin,
    'satin_coin_onayi_zorunlu', v_onay_zorunlu,
    'spend_order', jsonb_build_array('game_coins', 'bonus_coins', 'coins')
  );
end;
$$;

grant execute on function public.cuzdan_oyun_cuzdani() to authenticated;

create or replace function public.cuzdan_oyun_harcama_onizleme(p_amount bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'auth');
  end if;
  return public.cuzdan_coin_harcama_plani(v_uid, p_amount);
end;
$$;

grant execute on function public.cuzdan_oyun_harcama_onizleme(bigint) to authenticated;

-- -----------------------------------------------------------------------------
-- 8) Fruit Wheel: harcama önceliği + satın alınan coin onayı
-- -----------------------------------------------------------------------------
drop function if exists public.fruit_wheel_apply_delta(uuid, text, bigint, text, uuid, uuid, text);

create or replace function public.fruit_wheel_apply_delta(
  p_user uuid,
  p_mode text,
  p_delta bigint,
  p_reason text,
  p_round uuid,
  p_ref uuid,
  p_idem text,
  p_satin_coin_onay boolean default false
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_bal bigint;
  v_after bigint;
  v_c bigint;
  v_g bigint;
  v_b bigint;
  v_dc bigint := 0;
  v_dg bigint := 0;
  v_db bigint := 0;
  v_nc bigint;
  v_ng bigint;
  v_nb bigint;
  v_kalan bigint;
  v_ref uuid := coalesce(p_ref, p_round);
  v_kind text;
begin
  if exists (select 1 from public.fruit_wheel_ledger where idempotency_key = p_idem) then
    select balance_after into v_after from public.fruit_wheel_ledger where idempotency_key = p_idem;
    return v_after;
  end if;

  if p_mode = 'PLATFORM_APPROVED_COIN' then
    select coins, game_coins, bonus_coins into v_c, v_g, v_b
    from public.wallets where user_id = p_user for update;
    if v_c is null then raise exception 'Wallet not found'; end if;
    v_bal := v_c + v_g + v_b;
    if v_bal + p_delta < 0 then raise exception 'Insufficient coins'; end if;
    v_after := v_bal + p_delta;

    if p_delta < 0 then
      -- ÖNCELİK: oyun coinleri → ödül coinleri → satın alınan coinler
      v_kalan := -p_delta;
      v_dg := least(v_g, v_kalan);
      v_kalan := v_kalan - v_dg;
      v_db := least(v_b, v_kalan);
      v_kalan := v_kalan - v_db;
      v_dc := least(v_c, v_kalan);
      v_kalan := v_kalan - v_dc;
      if v_kalan > 0 then raise exception 'Insufficient coins'; end if;

      -- Satın alınan coin kullanılacaksa: politika izinli + açık onay
      if v_dc > 0 then
        if not public.oyun_satin_coin_ile_oyun_izinli() then
          raise exception 'cuzdan_satin_coin_kapali';
        end if;
        if not coalesce(p_satin_coin_onay, false) then
          raise exception 'cuzdan_satin_coin_onayi_gerekli: %', v_dc;
        end if;
      end if;

      v_dc := -v_dc;
      v_dg := -v_dg;
      v_db := -v_db;
    elsif p_delta > 0 and p_reason = 'fruit_wheel_payout' then
      v_dg := p_delta;
    elsif p_delta > 0 then
      select
        coalesce(-sum(l.delta) filter (where l.currency = 'coins'), 0),
        coalesce(-sum(l.delta) filter (where l.currency = 'game_coins'), 0),
        coalesce(-sum(l.delta) filter (where l.currency = 'bonus_coins'), 0)
      into v_nc, v_ng, v_nb
      from public.wallet_ledger l
      where l.user_id = p_user
        and l.ref_type = 'fruit_wheel'
        and l.ref_id = p_round
        and l.reason in ('fruit_wheel_selection', 'fruit_wheel_selection_refund');
      v_kalan := p_delta;
      v_db := least(greatest(v_nb, 0), v_kalan);
      v_kalan := v_kalan - v_db;
      v_dg := least(greatest(v_ng, 0), v_kalan);
      v_kalan := v_kalan - v_dg;
      v_dc := least(greatest(v_nc, 0), v_kalan);
      v_db := v_db + (v_kalan - v_dc);
    end if;

    update public.wallets
      set coins = v_c + v_dc,
          game_coins = v_g + v_dg,
          bonus_coins = v_b + v_db,
          updated_at = now()
      where user_id = p_user;

    if v_dc <> 0 then
      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user, 'coins', v_dc, v_c + v_dc, p_reason, 'fruit_wheel', v_ref);
    end if;
    if v_dg <> 0 then
      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user, 'game_coins', v_dg, v_g + v_dg, p_reason, 'fruit_wheel', v_ref);
    end if;
    if v_db <> 0 then
      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (p_user, 'bonus_coins', v_db, v_b + v_db, p_reason, 'fruit_wheel', v_ref);
    end if;

    -- Birleşik işlem defteri (tek finansal kayıt)
    if not exists (select 1 from public.cuzdan_coin_islemleri
                   where user_id = p_user and idempotency_key = p_idem) then
      v_kind := case
        when p_delta < 0 then 'spend'
        when p_reason like '%refund%' then 'refund'
        else 'reward'
      end;
      insert into public.cuzdan_coin_islemleri (
        user_id, kind, idempotency_key, ref_key, game_code, reason, ref_type, ref_id, amount,
        from_game_coins, from_bonus_coins, from_purchased_coins,
        game_coins_after, bonus_coins_after, purchased_coins_after, satin_coin_onayi
      ) values (
        p_user, v_kind, p_idem, p_idem, 'fruit_wheel', p_reason, 'fruit_wheel', v_ref, abs(p_delta),
        abs(v_dg), abs(v_db), abs(v_dc), v_g + v_dg, v_b + v_db, v_c + v_dc,
        coalesce(p_satin_coin_onay, false)
      );
    end if;
  else
    v_bal := public.fruit_wheel_lock_balance(p_user, p_mode);
    if v_bal + p_delta < 0 then raise exception 'Insufficient coins'; end if;
    v_after := v_bal + p_delta;
    if p_mode = 'CLOSED_LOOP_GAME_BALANCE' then
      update public.fruit_wheel_balances set closed_loop_coins = v_after, updated_at = now() where user_id = p_user;
    else
      update public.fruit_wheel_balances set test_coins = v_after, updated_at = now() where user_id = p_user;
    end if;
  end if;

  insert into public.fruit_wheel_ledger (user_id, economy_mode, delta, balance_after, reason, round_id, ref_id, idempotency_key)
  values (p_user, p_mode, p_delta, v_after, p_reason, p_round, p_ref, p_idem);
  return v_after;
end; $$;

revoke all on function public.fruit_wheel_apply_delta(uuid, text, bigint, text, uuid, uuid, text, boolean) from public, anon, authenticated;

drop function if exists public.fruit_wheel_confirm(uuid, text, jsonb);

create or replace function public.fruit_wheel_confirm(
  p_round_id uuid,
  p_key text,
  p_items jsonb,
  p_satin_coin_onay boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r public.fruit_wheel_rounds%rowtype;
  v_cmd public.fruit_wheel_commands%rowtype;
  v_item jsonb;
  v_id text;
  v_amt bigint;
  v_seen text[] := '{}';
  v_new_total bigint := 0;
  v_old_total bigint := 0;
  v_delta bigint;
  v_after bigint;
  v_min bigint;
  v_max_f bigint;
  v_max_t bigint;
  v_enabled boolean;
  v_cmd_id uuid;
  v_gate text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'code', 'auth');
  end if;
  if p_key is null or length(trim(p_key)) < 8 or length(p_key) > 80 then
    return jsonb_build_object('ok', false, 'code', 'idempotency');
  end if;
  if public.kill_switch_aktif_mi('kill_games')
     or not public.ozellik_bayragi_aktif_mi('games_enabled')
     or not public.ozellik_bayragi_aktif_mi('fruit_wheel_enabled') then
    return jsonb_build_object('ok', false, 'code', 'feature_disabled');
  end if;

  perform pg_advisory_xact_lock(84218421);
  perform public.fruit_wheel_advance();

  select * into r from public.fruit_wheel_rounds where id = p_round_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'round_closed');
  end if;

  perform public.fruit_wheel_lock_balance(v_uid, r.economy_mode);

  select * into v_cmd
  from public.fruit_wheel_commands
  where user_id = v_uid and idempotency_key = trim(p_key);
  if found then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'balance', v_cmd.balance_after,
      'roundId', v_cmd.round_id
    );
  end if;

  if now() >= r.locks_at or r.settled_at is not null then
    return jsonb_build_object('ok', false, 'code', 'round_closed');
  end if;

  v_gate := public.fruit_wheel_user_eligible(v_uid, r.economy_mode);
  if v_gate is not null then
    return jsonb_build_object('ok', false, 'code', v_gate);
  end if;

  v_min := coalesce((r.limits_snapshot->>'minimumSelection')::bigint, 10);
  v_max_f := coalesce((r.limits_snapshot->>'maximumSelectionPerFruit')::bigint, 100000);
  v_max_t := coalesce((r.limits_snapshot->>'maximumTotalPerRound')::bigint, 500000);

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_id := v_item->>'fruitId';
    if v_id is null or v_id = any (v_seen) then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
    begin
      v_amt := trunc((v_item->>'amount')::numeric)::bigint;
    exception when others then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end;
    if v_amt is null or v_amt < 0 then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
    if v_amt = 0 then
      continue;
    end if;
    select coalesce((f->>'enabled')::boolean, true) into v_enabled
    from jsonb_array_elements(r.config_snapshot->'fruits') f
    where f->>'id' = v_id
    limit 1;
    if v_enabled is null or not v_enabled then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
    if v_amt < v_min or v_amt > v_max_f then
      return jsonb_build_object('ok', false, 'code', 'limit');
    end if;
    v_seen := v_seen || v_id;
    v_new_total := v_new_total + v_amt;
  end loop;

  if coalesce(array_length(v_seen, 1), 0) > 4 then
    return jsonb_build_object('ok', false, 'code', 'limit');
  end if;

  if v_new_total > v_max_t then
    return jsonb_build_object('ok', false, 'code', 'limit');
  end if;

  select coalesce(sum(amount), 0) into v_old_total
  from public.fruit_wheel_selections
  where round_id = r.id and user_id = v_uid;

  v_delta := v_old_total - v_new_total;

  begin
    v_after := public.fruit_wheel_apply_delta(
      v_uid,
      r.economy_mode,
      v_delta,
      case when v_delta >= 0 then 'fruit_wheel_selection_refund' else 'fruit_wheel_selection' end,
      r.id,
      null,
      'fw_sel_' || v_uid::text || '_' || trim(p_key),
      coalesce(p_satin_coin_onay, false)
    );
  exception when others then
    if sqlerrm ilike '%satin_coin_onayi_gerekli%' then
      return jsonb_build_object(
        'ok', false,
        'code', 'satin_coin_onayi_gerekli',
        'plan', public.cuzdan_coin_harcama_plani(v_uid, greatest(-v_delta, 0))
      );
    end if;
    if sqlerrm ilike '%satin_coin_kapali%' then
      return jsonb_build_object(
        'ok', false,
        'code', 'satin_coin_kapali',
        'plan', public.cuzdan_coin_harcama_plani(v_uid, greatest(-v_delta, 0))
      );
    end if;
    if sqlerrm ilike '%Insufficient%' then
      return jsonb_build_object('ok', false, 'code', 'insufficient_balance');
    end if;
    raise;
  end;

  delete from public.fruit_wheel_selections
  where round_id = r.id and user_id = v_uid;

  insert into public.fruit_wheel_selections (round_id, user_id, fruit_id, amount, status)
  select r.id, v_uid, v_id2, v_amt2, 'confirmed'
  from (
    select item->>'fruitId' as v_id2, trunc((item->>'amount')::numeric)::bigint as v_amt2
    from jsonb_array_elements(p_items) item
  ) q
  where v_amt2 > 0;

  insert into public.fruit_wheel_commands (
    user_id, round_id, idempotency_key, selections, delta, balance_after
  ) values (
    v_uid, r.id, trim(p_key), p_items, v_delta, v_after
  )
  returning id into v_cmd_id;

  update public.fruit_wheel_ledger
  set ref_id = v_cmd_id
  where idempotency_key = 'fw_sel_' || v_uid::text || '_' || trim(p_key);

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'balance', v_after,
    'roundId', r.id,
    'total', v_new_total
  );
end;
$$;

revoke all on function public.fruit_wheel_confirm(uuid, text, jsonb, boolean) from public, anon;
grant execute on function public.fruit_wheel_confirm(uuid, text, jsonb, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- 9) Storm King: bahis önceliği (kazanç zaten game_coins) + iade dağılımı
-- -----------------------------------------------------------------------------
drop function if exists public.storm_king_settle(uuid, uuid, bigint, uuid, jsonb);

create or replace function public.storm_king_settle(
  p_user_id uuid,
  p_request_id uuid,
  p_bet bigint,
  p_room_id uuid,
  p_result jsonb,
  p_satin_coin_onay boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_existing public.storm_king_spins%rowtype;
  v_c bigint;
  v_g bigint;
  v_b bigint;
  v_win bigint;
  v_plan jsonb;
  v_spend jsonb;
  v_reward jsonb;
  v_after bigint;
  v_game_after bigint;
  v_bonus_after bigint;
  v_total_after bigint;
  v_spin_id uuid;
  v_multiplier integer;
  v_capped boolean;
  v_stored jsonb;
begin
  if p_user_id is null then raise exception 'user required'; end if;
  if p_request_id is null then raise exception 'requestId required'; end if;
  if p_bet is null or p_bet not in (10, 50, 100, 500, 1000) then raise exception 'Bet not allowed'; end if;
  if p_result is null or jsonb_typeof(p_result) <> 'object' then raise exception 'result required'; end if;

  if public.kill_switch_aktif_mi('kill_games') then raise exception 'Games temporarily disabled'; end if;
  if public.kill_switch_aktif_mi('kill_game_coin') then raise exception 'Game coin disabled'; end if;
  if not public.ozellik_bayragi_aktif_mi('games_enabled') then raise exception 'Games feature disabled'; end if;
  if not public.ozellik_bayragi_aktif_mi('storm_king_enabled') then raise exception 'Storm King disabled'; end if;

  select coins, game_coins, bonus_coins into v_c, v_g, v_b
  from public.wallets where user_id = p_user_id for update;
  if v_c is null then raise exception 'Wallet not found'; end if;

  select * into v_existing from public.storm_king_spins
  where user_id = p_user_id and request_id = p_request_id;
  if found then
    if v_existing.refunded_at is not null then
      return jsonb_build_object('cancelled', true, 'duplicate', true,
        'balance', v_c + v_g + v_b, 'game_balance', v_g, 'win', 0, 'result', null,
        'purchased_coins', v_c, 'bonus_coins', v_b);
    end if;
    return jsonb_build_object('duplicate', true,
      'balance', v_c + v_g + v_b, 'game_balance', v_g,
      'win', v_existing.win, 'result', v_existing.result,
      'purchased_coins', v_c, 'bonus_coins', v_b);
  end if;

  if exists (select 1 from public.storm_king_aborts where user_id = p_user_id and request_id = p_request_id) then
    return jsonb_build_object('cancelled', true, 'duplicate', false,
      'balance', v_c + v_g + v_b, 'game_balance', v_g, 'win', 0, 'result', null,
      'purchased_coins', v_c, 'bonus_coins', v_b);
  end if;

  -- Öncelik planı: game_coins → bonus_coins → coins (politika + onay)
  v_plan := public.cuzdan_coin_harcama_plani(p_user_id, p_bet);
  if not coalesce((v_plan->>'yeterli')::boolean, false) then
    if coalesce((v_plan->>'satin_coin_izinli')::boolean, true) = false
       and coalesce((v_plan->>'from_purchased_coins')::bigint, 0) > 0 then
      raise exception 'cuzdan_satin_coin_kapali';
    end if;
    if coalesce((v_plan->>'eksik')::bigint, 0) > 0 then
      raise exception 'Insufficient coins';
    end if;
    raise exception 'cuzdan_satin_coin_onayi_gerekli';
  end if;
  if coalesce((v_plan->>'from_purchased_coins')::bigint, 0) > 0
     and not coalesce(p_satin_coin_onay, false) then
    raise exception 'cuzdan_satin_coin_onayi_gerekli';
  end if;

  if coalesce((p_result->>'finalWin')::numeric, -1) < 0 then raise exception 'Invalid win'; end if;
  v_win := least(greatest(floor((p_result->>'finalWin')::numeric)::bigint, 0), p_bet * 5000);

  v_multiplier := greatest(coalesce((p_result->>'multiplierSum')::integer, 1), 1);
  v_capped := coalesce((p_result->>'capped')::boolean, false)
    or floor(coalesce((p_result->>'finalWin')::numeric, 0))::bigint > p_bet * 5000;
  v_after := v_c - least(p_bet, coalesce((v_plan->>'from_purchased_coins')::bigint, 0));
  v_game_after := v_g - coalesce((v_plan->>'from_game_coins')::bigint, 0);
  v_bonus_after := v_b - coalesce((v_plan->>'from_bonus_coins')::bigint, 0);
  v_total_after := v_after + v_game_after + v_bonus_after;
  v_stored := p_result || jsonb_build_object('finalWin', v_win, 'multiplierSum', v_multiplier, 'capped', v_capped);

  insert into public.storm_king_spins (
    user_id, request_id, room_id, bet, win, balance_before, balance_after, multiplier, capped, result
  ) values (
    p_user_id, p_request_id, p_room_id, p_bet, v_win, v_c + v_g + v_b, v_total_after, v_multiplier, v_capped, v_stored
  ) returning id into v_spin_id;

  v_spend := public.cuzdan_coin_harca(
    p_user_id, p_bet, 'storm_king_bet', 'storm_king_spin', v_spin_id,
    'sk_bet_' || p_request_id::text, 'storm_king', p_satin_coin_onay
  );

  if v_win > 0 then
    v_reward := public.cuzdan_oyun_kazanc_ekle(
      p_user_id, v_win, 'storm_king_win', 'storm_king_spin', v_spin_id,
      'sk_win_' || p_request_id::text, 'storm_king'
    );
    v_game_after := coalesce((v_reward->>'game_coins')::bigint, v_game_after + v_win);
  end if;

  v_total_after := coalesce((v_spend->>'total_coins')::bigint, v_total_after)
                   + coalesce(v_win, 0);
  v_after := coalesce((v_spend->>'purchased_coins')::bigint, v_after);
  v_bonus_after := coalesce((v_spend->>'bonus_coins')::bigint, v_bonus_after);

  if p_room_id is not null then
    perform public.oda_oyun_coin_ekle(p_room_id, p_user_id, v_win, p_bet);
  end if;

  if v_win > 0 then
    perform public.oyun_kazanc_duyuru_yaz(
      p_user_id, p_room_id, 'storm_king', 'Fırtına Kralı', v_win, p_bet, v_spin_id, v_multiplier
    );
  end if;

  return jsonb_build_object('duplicate', false,
    'balance', v_total_after, 'game_balance', v_game_after,
    'purchased_coins', v_after, 'bonus_coins', v_bonus_after,
    'billed_from_game_coins', coalesce((v_spend->>'from_game_coins')::bigint, 0),
    'billed_from_bonus_coins', coalesce((v_spend->>'from_bonus_coins')::bigint, 0),
    'billed_from_purchased_coins', coalesce((v_spend->>'from_purchased_coins')::bigint, 0),
    'win', v_win, 'result', v_stored);
exception
  when unique_violation then
    select * into v_existing from public.storm_king_spins
    where user_id = p_user_id and request_id = p_request_id;
    if not found then raise; end if;
    if v_existing.refunded_at is not null then
      return jsonb_build_object('cancelled', true, 'duplicate', true,
        'balance', v_existing.balance_after, 'game_balance', v_g, 'win', 0, 'result', null);
    end if;
    return jsonb_build_object('duplicate', true, 'balance', v_existing.balance_after,
      'win', v_existing.win, 'result', v_existing.result);
end;
$$;

revoke all on function public.storm_king_settle(uuid, uuid, bigint, uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.storm_king_settle(uuid, uuid, bigint, uuid, jsonb, boolean) to service_role;

create or replace function public.storm_king_abort(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_c bigint;
  v_g bigint;
  v_b bigint;
  v_spin public.storm_king_spins%rowtype;
  v_iade jsonb;
  v_from_game bigint;
begin
  if v_uid is null or p_request_id is null then raise exception 'request required'; end if;

  select coins, game_coins, bonus_coins into v_c, v_g, v_b
  from public.wallets where user_id = v_uid for update;
  if v_c is null then raise exception 'Wallet not found'; end if;

  insert into public.storm_king_aborts (user_id, request_id)
  values (v_uid, p_request_id)
  on conflict (user_id, request_id) do nothing;

  select * into v_spin from public.storm_king_spins
  where user_id = v_uid and request_id = p_request_id;

  if not found then
    return jsonb_build_object('cancelled', true, 'pending', true, 'duplicate', false,
      'balance', v_c + v_g + v_b, 'game_balance', v_g, 'refunded', 0, 'reversed_win', 0);
  end if;

  if v_spin.refunded_at is not null then
    return jsonb_build_object('cancelled', true, 'pending', false, 'duplicate', true,
      'balance', v_c + v_g + v_b, 'game_balance', v_g, 'refunded', 0, 'reversed_win', 0);
  end if;

  -- Bahis, kaydedilmiş harcama dağılımı tersine çevrilerek iade edilir.
  v_iade := public.cuzdan_oyun_iade(
    v_uid, v_spin.bet, 'storm_king_refund', 'storm_king_spin', v_spin.id,
    'sk_refund_' || p_request_id::text, 'storm_king'
  );

  -- Kazanç geri alınır: yalnızca hâlâ mevcut olan oyun coininden, negatife düşmeden.
  v_from_game := least(v_spin.win, (select coalesce(game_coins, 0) from public.wallets where user_id = v_uid));
  if v_from_game > 0 then
    perform public.cuzdan_coin_harca(
      v_uid, v_from_game, 'storm_king_refund_win', 'storm_king_spin', v_spin.id,
      'sk_refund_win_' || p_request_id::text, 'storm_king', true
    );
  end if;

  update public.storm_king_spins set refunded_at = now() where id = v_spin.id;

  if v_spin.room_id is not null then
    update public.oda_oyun_coin_istatistik
      set won_coin = greatest(won_coin - v_spin.win, 0),
          spent_coin = greatest(spent_coin - v_spin.bet, 0),
          updated_at = now()
      where room_id = v_spin.room_id and user_id = v_uid;

    delete from public.oda_oyun_harcama
    where id = (
      select id from public.oda_oyun_harcama
      where room_id = v_spin.room_id and user_id = v_uid and spent_coin = v_spin.bet
      order by created_at desc limit 1
    );
  end if;

  select coins, game_coins, bonus_coins into v_c, v_g, v_b
  from public.wallets where user_id = v_uid;

  return jsonb_build_object('cancelled', true, 'pending', false, 'duplicate', false,
    'balance', v_c + v_g + v_b, 'game_balance', v_g,
    'purchased_coins', v_c, 'bonus_coins', v_b,
    'refunded', coalesce((v_iade->>'refunded_purchased_coins')::bigint, 0)
                + coalesce((v_iade->>'refunded_bonus_coins')::bigint, 0)
                + coalesce((v_iade->>'refunded_game_coins')::bigint, 0),
    'reversed_win', v_from_game);
end;
$$;

grant execute on function public.storm_king_abort(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 10) Oda oturumu giriş ücreti: öncelikli kovadan (create/join)
-- -----------------------------------------------------------------------------
create table if not exists public.cuzdan_migrasyon_kayitlari (
  id bigserial primary key,
  kind text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

alter table public.cuzdan_migrasyon_kayitlari enable row level security;
drop policy if exists cuzdan_migrasyon_kayitlari_admin on public.cuzdan_migrasyon_kayitlari;
create policy cuzdan_migrasyon_kayitlari_admin on public.cuzdan_migrasyon_kayitlari
  for select to authenticated using (public.ben_admin_miyim());
revoke all on public.cuzdan_migrasyon_kayitlari from public, anon, authenticated;
grant select on public.cuzdan_migrasyon_kayitlari to authenticated;

do $mig$
declare
  v_src text;
  v_old text;
  v_new text;
begin
  -- join_game_session: giriş ücreti
  begin
    v_src := replace(pg_get_functiondef('public.join_game_session(uuid,bigint)'::regprocedure), E'\r\n', E'\n');
    v_old := replace($f$
      select coins into v_coins from public.wallets where user_id = v_uid for update;
      if v_coins is null or v_coins < v_entry then raise exception 'Insufficient coins'; end if;
      update public.wallets set coins = coins - v_entry, updated_at = now() where user_id = v_uid;
      insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
      values (v_uid, 'coins', -v_entry, v_coins - v_entry, 'game_entry', 'game_session', p_session_id);$f$, E'\r\n', E'\n');
    v_new := replace(v_src, v_old, replace($f$
      perform public.cuzdan_coin_harca(
        v_uid, v_entry, 'game_entry', 'game_session', p_session_id,
        'gs_entry_' || p_session_id::text || '_' || v_uid::text, 'game_session', true);$f$, E'\r\n', E'\n'));
    if v_new = v_src then
      insert into public.cuzdan_migrasyon_kayitlari (kind, detail) values ('unmatched', 'join_game_session');
    else
      execute v_new;
      insert into public.cuzdan_migrasyon_kayitlari (kind, detail) values ('patched', 'join_game_session');
    end if;
  exception when others then
    insert into public.cuzdan_migrasyon_kayitlari (kind, detail)
    values ('patch_failed', 'join_game_session :: ' || sqlerrm);
  end;

  -- create_game_session: kurucu giriş ücreti
  begin
    v_src := replace(pg_get_functiondef('public.create_game_session(uuid,text,integer,integer,bigint)'::regprocedure), E'\r\n', E'\n');
    v_old := replace($f$
    select coins into v_coins from public.wallets where user_id = v_uid for update;
    if v_coins is null or v_coins < v_entry then raise exception 'Insufficient coins'; end if;
    update public.wallets set coins = coins - v_entry, updated_at = now() where user_id = v_uid;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
    values (v_uid, 'coins', -v_entry, v_coins - v_entry, 'game_entry', 'game_session', null);$f$, E'\r\n', E'\n');
    v_new := replace(v_src, v_old, replace($f$
    perform public.cuzdan_coin_harca(
      v_uid, v_entry, 'game_entry', 'game_session', null,
      'gs_create_' || coalesce(p_game_code, 'oda') || '_' || v_uid::text || '_' || extract(epoch from now())::bigint::text,
      p_game_code, true);$f$, E'\r\n', E'\n'));
    if v_new = v_src then
      insert into public.cuzdan_migrasyon_kayitlari (kind, detail) values ('unmatched', 'create_game_session');
    else
      execute v_new;
      insert into public.cuzdan_migrasyon_kayitlari (kind, detail) values ('patched', 'create_game_session');
    end if;
  exception when others then
    insert into public.cuzdan_migrasyon_kayitlari (kind, detail)
    values ('patch_failed', 'create_game_session :: ' || sqlerrm);
  end;
end;
$mig$;

-- -----------------------------------------------------------------------------
-- 11) Geçmiş yanlış kesinti denetimi + çift kayıtlı düzeltme
-- -----------------------------------------------------------------------------
create table if not exists public.coin_harcama_denetimi (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ledger_id uuid not null unique,
  ledger_created_at timestamptz not null,
  reason text,
  game_code text,
  ref_type text,
  ref_id uuid,
  charged_amount bigint not null,
  game_coins_at_time bigint not null default 0,
  bonus_coins_at_time bigint not null default 0,
  mischarged_amount bigint not null,
  status text not null default 'reported'
    check (status in ('reported', 'approved', 'corrected', 'rejected', 'not_possible')),
  correction_ledger_id uuid,
  corrected_amount bigint not null default 0,
  note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  audit_created_at timestamptz not null default now()
);

create index if not exists coin_harcama_denetimi_user_idx
  on public.coin_harcama_denetimi (user_id, status);

comment on table public.coin_harcama_denetimi is
  'Geçmişte satın alınan coinlerden düşülen oyun harcamaları. mischarged_amount = o anda oyun/ödül coininden karşılanabilecek tutar.';

alter table public.coin_harcama_denetimi enable row level security;

drop policy if exists coin_harcama_denetimi_admin on public.coin_harcama_denetimi;
create policy coin_harcama_denetimi_admin on public.coin_harcama_denetimi
  for select to authenticated using (public.ben_admin_miyim());

revoke all on public.coin_harcama_denetimi from public, anon, authenticated;
grant select on public.coin_harcama_denetimi to authenticated;

-- Denetimi (yeniden) hesaplar. Bakiye DEĞİŞTİRMEZ.
create or replace function public.admin_coin_harcama_denetimi_calistir()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_eklenen integer := 0;
  r record;
  v_game bigint;
  v_bonus bigint;
  v_mis bigint;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Yetkisiz';
  end if;

  for r in
    select l.id, l.user_id, l.created_at, l.reason, l.ref_type, l.ref_id, (-l.delta) as charged
    from public.wallet_ledger l
    where l.currency = 'coins'
      and l.delta < 0
      and (
        l.reason like '%\_bet' escape '\'
        or l.reason = 'fruit_wheel_selection'
        or l.reason = 'game_entry'
      )
      and not exists (select 1 from public.coin_harcama_denetimi d where d.ledger_id = l.id)
  loop
    select coalesce((
      select g.balance_after from public.wallet_ledger g
      where g.user_id = r.user_id and g.currency = 'game_coins'
        and g.created_at <= r.created_at and g.balance_after is not null
      order by g.created_at desc, g.id desc limit 1
    ), 0) into v_game;

    select coalesce((
      select bb.balance_after from public.wallet_ledger bb
      where bb.user_id = r.user_id and bb.currency = 'bonus_coins'
        and bb.created_at <= r.created_at and bb.balance_after is not null
      order by bb.created_at desc, bb.id desc limit 1
    ), 0) into v_bonus;

    v_mis := least(r.charged, greatest(v_game, 0) + greatest(v_bonus, 0));

    insert into public.coin_harcama_denetimi (
      user_id, ledger_id, ledger_created_at, reason, ref_type, ref_id,
      charged_amount, game_coins_at_time, bonus_coins_at_time, mischarged_amount
    ) values (
      r.user_id, r.id, r.created_at, r.reason, r.ref_type, r.ref_id,
      r.charged, greatest(v_game, 0), greatest(v_bonus, 0), v_mis
    )
    on conflict (ledger_id) do nothing;

    v_eklenen := v_eklenen + 1;
  end loop;

  return jsonb_build_object('ok', true, 'yeni_kayit', v_eklenen);
end;
$$;

revoke all on function public.admin_coin_harcama_denetimi_calistir() from public, anon;
grant execute on function public.admin_coin_harcama_denetimi_calistir() to authenticated, service_role;

-- Denetim raporu (bakiye değiştirmez)
create or replace function public.admin_coin_harcama_denetim_ozeti()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.ben_admin_miyim() then
    raise exception 'Yetkisiz';
  end if;

  return jsonb_build_object(
    'ok', true,
    'toplam_kayit', (select count(*) from public.coin_harcama_denetimi),
    'etkilenen_kullanici', (select count(distinct user_id) from public.coin_harcama_denetimi),
    'toplam_yanlis_kesinti', (select coalesce(sum(mischarged_amount), 0) from public.coin_harcama_denetimi),
    'duzeltilen_tutar', (select coalesce(sum(corrected_amount), 0) from public.coin_harcama_denetimi
                          where status = 'corrected'),
    'durumlar', (select coalesce(jsonb_object_agg(status, adet), '{}'::jsonb) from (
        select status, count(*) as adet from public.coin_harcama_denetimi group by status
      ) s),
    'kullanicilar', (select coalesce(jsonb_agg(x order by x.mischarged desc), '[]'::jsonb) from (
        select user_id, count(*) as adet,
               sum(charged_amount) as charged, sum(mischarged_amount) as mischarged,
               max(status) as status
        from public.coin_harcama_denetimi
        group by user_id
      ) x)
  );
end;
$$;

revoke all on function public.admin_coin_harcama_denetim_ozeti() from public, anon;
grant execute on function public.admin_coin_harcama_denetim_ozeti() to authenticated, service_role;

-- Tek kayıt için çift kayıtlı düzeltme: satın alınan coin +X, oyun coin -X.
-- Toplam bakiye değişmez; oyun sonucu, diğer kullanıcılar ve kazanç geçmişi etkilenmez.
create or replace function public.admin_coin_harcama_duzeltme_onayla(
  p_denetim_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_d public.coin_harcama_denetimi%rowtype;
  v_c bigint;
  v_g bigint;
  v_b bigint;
  v_move bigint;
  v_coins_ledger uuid;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Yetkisiz';
  end if;

  select * into v_d from public.coin_harcama_denetimi where id = p_denetim_id for update;
  if not found then raise exception 'Denetim kaydı bulunamadı'; end if;
  if v_d.status <> 'reported' then
    raise exception 'Kayıt % durumunda; yalnızca "reported" düzeltilebilir', v_d.status;
  end if;
  if v_d.mischarged_amount <= 0 then
    update public.coin_harcama_denetimi
      set status = 'not_possible', reviewed_by = auth.uid(), reviewed_at = now(),
          note = coalesce(p_note, 'Yanlış kesinti tespit edilmedi')
      where id = v_d.id;
    return jsonb_build_object('ok', true, 'durum', 'not_possible', 'duzeltilen', 0);
  end if;

  select coins, game_coins, bonus_coins into v_c, v_g, v_b
  from public.wallets where user_id = v_d.user_id for update;
  if v_c is null then raise exception 'Cüzdan bulunamadı'; end if;

  -- Oyun coin'i bugün yeterli değilse kısmi düzeltme yapılmaz (negatif bakiye yasak).
  if v_g < v_d.mischarged_amount then
    raise exception 'Kullanıcının oyun coin bakiyesi yetersiz (gerekli %, mevcut %)',
      v_d.mischarged_amount, v_g;
  end if;

  v_move := v_d.mischarged_amount;

  update public.wallets
    set coins = v_c + v_move,
        game_coins = v_g - v_move,
        updated_at = now()
  where user_id = v_d.user_id;

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id, meta)
  values (v_d.user_id, 'coins', v_move, v_c + v_move, 'coin_harcama_duzeltme',
    'coin_harcama_denetimi', v_d.id,
    jsonb_build_object('kaynak_ledger', v_d.ledger_id, 'note', p_note))
  returning id into v_coins_ledger;

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id, meta)
  values (v_d.user_id, 'game_coins', -v_move, v_g - v_move, 'coin_harcama_duzeltme',
    'coin_harcama_denetimi', v_d.id,
    jsonb_build_object('kaynak_ledger', v_d.ledger_id, 'note', p_note));

  update public.coin_harcama_denetimi
    set status = 'corrected', corrected_amount = v_move,
        correction_ledger_id = v_coins_ledger,
        reviewed_by = auth.uid(), reviewed_at = now(), note = p_note
  where id = v_d.id;

  return jsonb_build_object('ok', true, 'durum', 'corrected', 'duzeltilen', v_move,
    'purchased_coins', v_c + v_move, 'game_coins', v_g - v_move,
    'total_coins', v_c + v_move + v_g - v_move + v_b);
end;
$$;

revoke all on function public.admin_coin_harcama_duzeltme_onayla(uuid, text) from public, anon;
grant execute on function public.admin_coin_harcama_duzeltme_onayla(uuid, text) to authenticated, service_role;

create or replace function public.admin_coin_harcama_denetim_reddet(
  p_denetim_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.ben_admin_miyim() then
    raise exception 'Yetkisiz';
  end if;

  update public.coin_harcama_denetimi
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), note = p_note
  where id = p_denetim_id and status = 'reported';

  if not found then raise exception 'Kayıt bulunamadı veya zaten işlenmiş'; end if;
  return jsonb_build_object('ok', true, 'durum', 'rejected');
end;
$$;

revoke all on function public.admin_coin_harcama_denetim_reddet(uuid, text) from public, anon;
grant execute on function public.admin_coin_harcama_denetim_reddet(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 12) Eski slot settle RPC'leri — ortak katmana bağla
--     Yamanamayan fonksiyon sessizce bırakılmaz; kayda geçer.
-- -----------------------------------------------------------------------------
do $mig$
declare
  v_rec record;
  v_fn regprocedure;
  v_src text;
  v_new text;
  v_step1 text;
  v_step2 text;
  v_step3 text;
begin
  for v_rec in
    select * from (values
      ('public.zeus_settle_spin(uuid,text,bigint,uuid,jsonb,boolean,boolean)', 'v_debit', 'floor(v_win)::bigint', 'zeus', 'zeus_round', 'zeus'),
      ('public.kozmik_kaskad_settle_spin(uuid,text,bigint,uuid,jsonb,boolean,boolean)', 'v_debit', 'floor(v_win)::bigint', 'kaskad', 'kaskad_round', 'kaskad'),
      ('public.nox_settle_spin(uuid,text,bigint,uuid,jsonb,boolean,boolean)', 'v_debit', 'floor(v_win)::bigint', 'nox', 'nox_round', 'nox|slot'),
      ('public.fair_spin_settle_spin(uuid,text,bigint,uuid,jsonb,boolean)', 'v_debit', 'floor(v_win)::bigint', 'fair_spin', 'fair_spin_round', 'fair_spin'),
      ('public.astral_falls_settle_spin(uuid,text,numeric,uuid,jsonb,boolean,boolean)', 'ceil(v_debit)::bigint', 'v_win_floor', 'astral_falls', 'astral_falls_round', 'astral_falls')
    ) as t(fn, bet, win, game, ref, re)
  loop
    begin
      v_fn := v_rec.fn::regprocedure;
      v_src := replace(pg_get_functiondef(v_fn), E'\r\n', E'\n');
    exception when others then
      insert into public.cuzdan_migrasyon_kayitlari (kind, detail) values ('missing_fn', v_rec.fn);
      continue;
    end;

    -- 1) bakiye okuması: tek kova yerine toplam (kontrol + rapor için)
    v_step1 := regexp_replace(v_src,
      'select\s+coins\s+into\s+v_coins(\s+from\s+public\.wallets\s+where\s+user_id\s*=\s*[a-z_]+(\s+for\s+update)?\s*;)',
      'select coalesce(coins,0) + coalesce(game_coins,0) + coalesce(bonus_coins,0) into v_coins\1',
      'gi');

    -- 2) tek kovalı cüzdan yazımı yerine ortak tur katmanı
    v_step2 := regexp_replace(v_step1,
      'update\s+public\.wallets\s+set\s+coins\s*=\s*v_balance_after,\s*updated_at\s*=\s*now\(\)\s*where\s+user_id\s*=\s*p_user_id;',
      'v_balance_after := (public.cuzdan_oyun_tur_isle('
        'p_user_id, ' || v_rec.bet || ', ' || v_rec.win || ', '
        '''' || v_rec.game || ''', ''' || v_rec.game || '_bet'', ''' || v_rec.game || '_win'', '
        '''' || v_rec.ref || ''', p_idempotency_key, false, null)->>''balance_after'')::bigint;',
      'gi');

    -- 3) eski tek kovalı defter kayıtları (ortak katman yazar)
    v_step3 := regexp_replace(v_step2,
      'insert\s+into\s+public\.wallet_ledger\s*\([^)]*\)\s*values\s*\([^;]*?''' || '(' || v_rec.re || ')_(bet|win)' || '''[^;]*?\);',
      'null;', 'gi');

    if v_step1 = v_src or v_step2 = v_step1 or v_step3 = v_step2 then
      insert into public.cuzdan_migrasyon_kayitlari (kind, detail)
      values ('unmatched', v_rec.fn);
      continue;
    end if;

    begin
      execute v_step3;
      insert into public.cuzdan_migrasyon_kayitlari (kind, detail)
      values ('patched', v_rec.fn);
    exception when others then
      insert into public.cuzdan_migrasyon_kayitlari (kind, detail)
      values ('patch_failed', v_rec.fn || ' :: ' || sqlerrm);
    end;
  end loop;
end;
$mig$;

-- Spin context RPC'leri de toplam bakiyeyi döndürsün (edge ön kontrolü).
do $mig$
declare
  v_rec record;
  v_fn regprocedure;
  v_src text;
  v_new text;
begin
  for v_rec in
    select * from (values
      ('public.zeus_spin_context(uuid)'),
      ('public.kozmik_kaskad_spin_context(uuid)'),
      ('public.nox_spin_context(uuid)'),
      ('public.fair_spin_spin_context(uuid)'),
      ('public.astral_falls_spin_context(uuid)')
    ) as t(fn)
  loop
    begin
      v_fn := v_rec.fn::regprocedure;
      v_src := replace(pg_get_functiondef(v_fn), E'\r\n', E'\n');
    exception when others then
      insert into public.cuzdan_migrasyon_kayitlari (kind, detail) values ('missing_ctx', v_rec.fn);
      continue;
    end;

    v_new := regexp_replace(v_src,
      'select\s+coalesce\(coins,\s*0\)\s+into\s+v_coins(\s+from\s+public\.wallets\s+where\s+user_id\s*=\s*[a-z_]+;)',
      'select coalesce(coins,0) + coalesce(game_coins,0) + coalesce(bonus_coins,0) into v_coins\1',
      'gi');

    if v_new = v_src then
      insert into public.cuzdan_migrasyon_kayitlari (kind, detail) values ('unmatched_ctx', v_rec.fn);
      continue;
    end if;

    begin
      execute v_new;
      insert into public.cuzdan_migrasyon_kayitlari (kind, detail) values ('patched_ctx', v_rec.fn);
    exception when others then
      insert into public.cuzdan_migrasyon_kayitlari (kind, detail)
      values ('patch_failed_ctx', v_rec.fn || ' :: ' || sqlerrm);
    end;
  end loop;
end;
$mig$;

-- -----------------------------------------------------------------------------
-- 13) Oda oyunu ödülü: kazanç YALNIZCA oyun coin kovasına
--     (finish_game_session eskiden `wallets.coins`e yazıyordu → oyun kazancı
--      satın alınan bakiyeye dönüşüyordu.)
-- -----------------------------------------------------------------------------
do $mig$
declare
  v_src text;
  v_old text;
  v_new text;
begin
  v_src := replace(pg_get_functiondef('public.finish_game_session(uuid)'::regprocedure), E'\r\n', E'\n');
  v_old := replace($f$
        select coins into v_coins from public.wallets where user_id = r.user_id for update;
        if v_coins is null then
          insert into public.wallets (user_id, coins) values (r.user_id, 0)
          on conflict (user_id) do nothing;
          select coins into v_coins from public.wallets where user_id = r.user_id for update;
        end if;
        update public.wallets set coins = coins + v_reward, updated_at = now() where user_id = r.user_id;
        insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
        values (r.user_id, 'coins', v_reward, coalesce(v_coins,0) + v_reward, 'game_reward', 'game_session', p_session_id);$f$, E'\r\n', E'\n');
  v_new := replace(v_src, v_old, replace($f$
        insert into public.wallets (user_id, coins) values (r.user_id, 0)
        on conflict (user_id) do nothing;
        perform public.cuzdan_oyun_kazanc_ekle(
          r.user_id, v_reward, 'game_reward', 'game_session', p_session_id,
          'gs_reward_' || p_session_id::text || '_' || r.user_id::text, 'game_session'
        );$f$, E'\r\n', E'\n'));
  if v_new = v_src then
    insert into public.cuzdan_migrasyon_kayitlari (kind, detail) values ('unmatched', 'finish_game_session');
  else
    execute v_new;
    insert into public.cuzdan_migrasyon_kayitlari (kind, detail) values ('patched', 'finish_game_session');
  end if;
exception when others then
  insert into public.cuzdan_migrasyon_kayitlari (kind, detail)
  values ('patch_failed', 'finish_game_session :: ' || sqlerrm);
end;
$mig$;

notify pgrst, 'reload schema';
