-- =============================================================================
-- TAMUSO — Yayıncı Kazanç ve Aylık Ödeme Sistemi (v2)
--
-- Mevcut coin ekonomisini DEĞİŞTİRMEZ:
--   * wallets.coins / game_coins / bonus_coins / diamonds korunur.
--   * Satın alınan coin harcaması dışındaki hediye kaynakları gelir oluşturmaz.
--   * Geçmiş creator_earning_entries kayıtları güncellenmez/silinmez.
--
-- Eklenenler:
--   * Aylık mali dönem (1 → ay sonu), ödeme günü ayın 15'i.
--   * Yayıncı programı kaydı + sözleşme sürümü + uygunluk kontrolleri.
--   * Hediye bazlı gelir uygunluğu ve elmas ödül defteri.
--   * Ödeme hesapları (maskeli), ödeme partileri, onaylar, işlem kayıtları.
--   * İade / chargeback düzeltmeleri ve değiştirilemez mali denetim kayıtları.
--   * Ülke bazlı ödeme yöntemleri + banka tatili takvimi.
--   * Admin finans merkezi RPC'leri.
--
-- Gerçek para transferi YAPILMAZ. Ödeme partileri yalnızca manuel onay ve
-- manuel transfer referansı ile kapanır; otomatik sağlayıcı çağrısı yoktur.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Yapılandırma: aylık dönem + ödeme günü
-- ---------------------------------------------------------------------------

alter table public.platform_economy_config
  add column if not exists payout_day smallint not null default 15,
  add column if not exists settlement_mode text not null default 'monthly',
  add column if not exists payout_auto_transfer_enabled boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'platform_economy_payout_day_check') then
    alter table public.platform_economy_config
      add constraint platform_economy_payout_day_check
      check (payout_day between 1 and 28);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'platform_economy_settlement_mode_check') then
    alter table public.platform_economy_config
      add constraint platform_economy_settlement_mode_check
      check (settlement_mode in ('monthly'));
  end if;
end $$;

create or replace function public.ekonomi_config_getir()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v public.platform_economy_config%rowtype;
begin
  select * into v from public.platform_economy_config where id = 1;
  if not found then
    return jsonb_build_object(
      'coin_try', 0.10, 'diamond_try', 0.10, 'gift_host_share', 0.80,
      'default_agency_share', 0.20, 'iap_store_fee_estimate', 0.30,
      'creator_share', 0.40, 'platform_share', 0.60, 'revenue_usd_per_coin', 0.005,
      'payout_min_usd', 25.00, 'payout_transfer_fee_usd', 0,
      'payout_day', 15, 'settlement_mode', 'monthly',
      'payout_auto_transfer_enabled', false, 'updated_at', null
    );
  end if;
  return jsonb_build_object(
    'coin_try', v.coin_try,
    'diamond_try', v.diamond_try,
    'gift_host_share', v.gift_host_share,
    'default_agency_share', v.default_agency_share,
    'iap_store_fee_estimate', v.iap_store_fee_estimate,
    'creator_share', v.creator_share,
    'platform_share', 1 - v.creator_share,
    'revenue_usd_per_coin', v.revenue_usd_per_coin,
    'payout_min_usd', v.payout_min_usd,
    'payout_transfer_fee_usd', v.payout_transfer_fee_usd,
    'payout_day', v.payout_day,
    'settlement_mode', v.settlement_mode,
    'payout_auto_transfer_enabled', v.payout_auto_transfer_enabled,
    'updated_at', v.updated_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 1) Aylık mali dönem
--    Örnek: 1–31 Ekim kazançları → Ekim dönemi → 15 Kasım ödemesi.
-- ---------------------------------------------------------------------------

create or replace function public.odeme_donemi_bas(p_at timestamptz)
returns date
language sql
immutable
as $$
  select date_trunc('month', (p_at at time zone 'UTC'))::date;
$$;

create or replace function public.odeme_donemi_bit(p_at timestamptz)
returns date
language sql
immutable
as $$
  select (date_trunc('month', (p_at at time zone 'UTC')) + interval '1 month - 1 day')::date;
$$;

create or replace function public.odeme_ay_bas(p_month date)
returns date
language sql
immutable
as $$
  select date_trunc('month', p_month)::date;
$$;

create or replace function public.odeme_ay_bit(p_month date)
returns date
language sql
immutable
as $$
  select (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
$$;

create table if not exists public.bank_holidays (
  id uuid primary key default gen_random_uuid(),
  country_code text,
  holiday_date date not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint bank_holidays_country_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$')
);

create unique index if not exists bank_holidays_uniq
  on public.bank_holidays (coalesce(country_code, '*'), holiday_date, name);

alter table public.bank_holidays enable row level security;

drop policy if exists bank_holidays_read on public.bank_holidays;
create policy bank_holidays_read on public.bank_holidays
  for select to authenticated using (true);

drop policy if exists bank_holidays_admin on public.bank_holidays;
create policy bank_holidays_admin on public.bank_holidays
  for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

-- Hafta sonu + ülke tatilleri atlanır.
create or replace function public.sonraki_is_gunu(p_date date, p_country text default null)
returns date
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v date := p_date;
  v_guard int := 0;
begin
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 40;
    if extract(isodow from v) in (6, 7) then
      v := v + 1;
      continue;
    end if;
    if exists (
      select 1 from public.bank_holidays h
      where h.holiday_date = v
        and (h.country_code is null or upper(h.country_code) = upper(coalesce(p_country, '')))
    ) then
      v := v + 1;
      continue;
    end if;
    exit;
  end loop;
  return v;
end;
$$;

grant execute on function public.sonraki_is_gunu(date, text) to authenticated;

-- Ayın ödeme günü (varsayılan 15) — tatil ise ilk iş günü.
create or replace function public.odeme_gunu(p_month date, p_country text default null)
returns date
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_day smallint;
  v_target date;
begin
  select coalesce(payout_day, 15) into v_day from public.platform_economy_config where id = 1;
  v_day := coalesce(v_day, 15);
  v_target := (date_trunc('month', p_month)::date + (v_day - 1));
  return public.sonraki_is_gunu(v_target, p_country);
end;
$$;

grant execute on function public.odeme_gunu(date, text) to authenticated;

create table if not exists public.monthly_settlement_periods (
  id uuid primary key default gen_random_uuid(),
  period_month date not null unique,
  period_start date not null,
  period_end date not null,
  status text not null default 'open'
    check (status in ('open', 'closing', 'closed', 'payment_list', 'processing', 'paid')),
  payout_date date,
  payout_batch_id uuid,
  creator_share numeric(5,4),
  min_payout_usd numeric(14,2),
  gift_revenue_usd numeric(16,4) not null default 0,
  creator_earnings_usd numeric(16,4) not null default 0,
  platform_share_usd numeric(16,4) not null default 0,
  adjusted_usd numeric(16,4) not null default 0,
  eligible_creator_count int not null default 0,
  payable_creator_count int not null default 0,
  closed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_settlement_period_month_check
    check (period_month = date_trunc('month', period_month)::date)
);

alter table public.monthly_settlement_periods enable row level security;

drop policy if exists monthly_settlement_periods_read on public.monthly_settlement_periods;
create policy monthly_settlement_periods_read on public.monthly_settlement_periods
  for select to authenticated using (true);

drop policy if exists monthly_settlement_periods_admin on public.monthly_settlement_periods;
create policy monthly_settlement_periods_admin on public.monthly_settlement_periods
  for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

-- ---------------------------------------------------------------------------
-- 2) Yayıncı programı: sözleşme sürümü + kayıt + uygunluk
-- ---------------------------------------------------------------------------

create table if not exists public.creator_contract_versions (
  id uuid primary key default gen_random_uuid(),
  version int not null unique,
  title text not null,
  summary_md text not null,
  policy_code text not null default 'gift_earnings',
  effective_from date not null default current_date,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.creator_contract_versions enable row level security;

drop policy if exists creator_contract_versions_read on public.creator_contract_versions;
create policy creator_contract_versions_read on public.creator_contract_versions
  for select to authenticated using (true);

drop policy if exists creator_contract_versions_admin on public.creator_contract_versions;
create policy creator_contract_versions_admin on public.creator_contract_versions
  for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

insert into public.creator_contract_versions (version, title, summary_md, policy_code, effective_from, is_active)
values (
  1,
  'Tamuso Yayıncı Kazanç Programı Sözleşmesi',
  $c$Tamuso Yayıncı Kazanç Programı; uygun içerik üretimi ve gelir paylaşımına uygun hediyelerden elde edilen geliri düzenler.
• Yayıncı payı %40, Tamuso platform payı %60'tır. Oran, doğrulanmış dağıtılabilir gelire uygulanır.
• Minimum ödeme 25 USD'dir. Ödemeler aylık dönem kapanışından sonra ayın 15'inde başlatılır.
• Uygunluk: 18 yaş, kimlik (KYC), vergi bilgisi, doğrulanmış ödeme hesabı ve güvenli hesap.
• Oyun coinleri ve ödül coinleri ile gönderilen hediyeler yayıncı geliri oluşturmaz.
• İade, itiraz ve güvenlik incelemesindeki tutarlar ödeme dışında tutulabilir.
• Geçmişte kesinleşmiş kazançlar sonraki sözleşme değişiklikleriyle geriye dönük silinmez.
• Tam metin: Hediye Gönderme, Alma ve Yayıncı Kazanç Politikası (gift_earnings).$c$,
  'gift_earnings',
  current_date,
  true
)
on conflict (version) do nothing;

create table if not exists public.creator_program_enrollments (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'applied'
    check (status in ('applied', 'approved', 'suspended', 'rejected', 'withdrawn')),
  country_code text,
  payout_currency text not null default 'USD',
  tax_status text not null default 'pending'
    check (tax_status in ('pending', 'complete', 'not_required')),
  tax_reference text,
  contract_version_id uuid references public.creator_contract_versions(id),
  contract_accepted_at timestamptz,
  age_confirmed_at timestamptz,
  applied_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  rejection_reason text,
  suspended_reason text,
  updated_at timestamptz not null default now()
);

alter table public.creator_program_enrollments enable row level security;

drop policy if exists creator_program_enrollments_own on public.creator_program_enrollments;
create policy creator_program_enrollments_own on public.creator_program_enrollments
  for select to authenticated
  using (user_id = auth.uid() or public.ben_admin_miyim());

drop policy if exists creator_program_enrollments_admin_write on public.creator_program_enrollments;
create policy creator_program_enrollments_admin_write on public.creator_program_enrollments
  for update to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

-- Yayıncı uygunluğu: yaş, KYC, banka, vergi, program durumu ve açık yüksek risk.
create or replace function public.yayinci_uygunluk_durumu(p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := coalesce(p_user, auth.uid());
  v_enr public.creator_program_enrollments%rowtype;
  v_birth date;
  v_kyc text;
  v_bank_status text;
  v_high_risk boolean;
  v_adult boolean;
  v_program boolean;
  v_kyc_ok boolean;
  v_bank_ok boolean;
  v_tax_ok boolean;
  v_ok boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_user is not null and p_user <> auth.uid() and not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;

  select * into v_enr from public.creator_program_enrollments where user_id = v_uid;
  select birth_date into v_birth from public.profiles where id = v_uid;
  select kyc_status into v_kyc from public.wallet_accounts where user_id = v_uid;
  select status into v_bank_status from public.creator_payout_accounts where user_id = v_uid;

  v_adult := v_birth is not null and v_birth <= (current_date - interval '18 years');
  v_program := v_enr.user_id is not null and v_enr.status = 'approved';
  v_kyc_ok := coalesce(v_kyc, 'none') = 'approved';
  v_bank_ok := coalesce(v_bank_status, '') = 'verified';
  v_tax_ok := v_enr.tax_status in ('complete', 'not_required');
  v_high_risk := exists (
    select 1 from public.finance_risk_flags
    where user_id = v_uid and status = 'open' and severity = 'high'
  );
  v_ok := v_adult and v_program and v_kyc_ok and v_bank_ok and v_tax_ok and not v_high_risk;

  return jsonb_build_object(
    'user_id', v_uid,
    'is_adult', v_adult,
    'program_status', coalesce(v_enr.status, 'none'),
    'program_approved', v_program,
    'kyc_status', coalesce(v_kyc, 'none'),
    'kyc_verified', v_kyc_ok,
    'payout_account_status', coalesce(v_bank_status, 'none'),
    'payout_account_verified', v_bank_ok,
    'tax_status', coalesce(v_enr.tax_status, 'pending'),
    'tax_complete', v_tax_ok,
    'open_high_risk', v_high_risk,
    'eligible', v_ok
  );
end;
$$;

grant execute on function public.yayinci_uygunluk_durumu(uuid) to authenticated;

create or replace function public.yayinci_program_basvuru(
  p_country_code text default null,
  p_tax_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_birth date;
  v_ver uuid;
  v_row public.creator_program_enrollments%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_uid and coalesce(is_guest, false)) then
    raise exception 'guest_not_allowed';
  end if;

  select birth_date into v_birth from public.profiles where id = v_uid;
  if v_birth is null or v_birth > (current_date - interval '18 years') then
    raise exception 'adult_required';
  end if;

  select id into v_ver from public.creator_contract_versions
  where is_active order by version desc limit 1;
  if v_ver is null then raise exception 'contract_missing'; end if;

  insert into public.creator_program_enrollments (
    user_id, status, country_code, tax_status, contract_version_id,
    contract_accepted_at, age_confirmed_at
  ) values (
    v_uid, 'applied', upper(nullif(trim(p_country_code), '')),
    case when p_tax_confirmed then 'complete' else 'pending' end,
    v_ver, now(), now()
  )
  on conflict (user_id) do update set
    status = case
      when public.creator_program_enrollments.status in ('suspended', 'rejected', 'withdrawn')
        then 'applied'
      else public.creator_program_enrollments.status
    end,
    country_code = coalesce(excluded.country_code, public.creator_program_enrollments.country_code),
    tax_status = case when p_tax_confirmed then 'complete' else public.creator_program_enrollments.tax_status end,
    contract_version_id = excluded.contract_version_id,
    contract_accepted_at = excluded.contract_accepted_at,
    age_confirmed_at = excluded.age_confirmed_at,
    updated_at = now()
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.yayinci_program_basvuru(text, boolean) to authenticated;

create or replace function public.yayinci_sozlesme_kabul(p_version int default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_ver uuid;
  v_row public.creator_program_enrollments%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select id into v_ver from public.creator_contract_versions
  where is_active and (p_version is null or version = p_version)
  order by version desc limit 1;
  if v_ver is null then raise exception 'contract_missing'; end if;

  insert into public.creator_program_enrollments (user_id, contract_version_id, contract_accepted_at)
  values (v_uid, v_ver, now())
  on conflict (user_id) do update set
    contract_version_id = excluded.contract_version_id,
    contract_accepted_at = excluded.contract_accepted_at,
    updated_at = now()
  returning * into v_row;

  insert into public.financial_audit_events (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'creator_contract_accepted', 'creator_enrollment', v_uid,
    jsonb_build_object('contract_version_id', v_ver));

  return to_jsonb(v_row);
end;
$$;

grant execute on function public.yayinci_sozlesme_kabul(int) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Hediye gelir uygunluğu + elmas defteri
-- ---------------------------------------------------------------------------

create table if not exists public.creator_reward_diamonds (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null check (amount > 0),
  kind text not null default 'gift' check (kind in ('gift', 'program_bonus', 'adjustment')),
  source_type text not null default 'gift',
  source_id uuid not null,
  period_month date not null default date_trunc('month', now())::date,
  note text,
  created_at timestamptz not null default now(),
  constraint creator_reward_diamonds_source_uniq unique (creator_id, kind, source_type, source_id)
);

create index if not exists creator_reward_diamonds_creator_idx
  on public.creator_reward_diamonds (creator_id, created_at desc);

alter table public.creator_reward_diamonds enable row level security;

drop policy if exists creator_reward_diamonds_own on public.creator_reward_diamonds;
create policy creator_reward_diamonds_own on public.creator_reward_diamonds
  for select to authenticated
  using (creator_id = auth.uid() or public.ben_admin_miyim());

create or replace function public.creator_reward_diamonds_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'creator_reward_diamonds değiştirilemez';
end;
$$;

drop trigger if exists creator_reward_diamonds_immutable_trg on public.creator_reward_diamonds;
create trigger creator_reward_diamonds_immutable_trg
  before update or delete on public.creator_reward_diamonds
  for each row execute function public.creator_reward_diamonds_immutable();

create table if not exists public.gift_revenue_eligibility (
  gift_transaction_id uuid primary key references public.gift_transactions(id) on delete restrict,
  sender_id uuid references public.profiles(id) on delete set null,
  creator_id uuid references public.profiles(id) on delete set null,
  coin_source text not null,
  channel text,
  coins bigint not null default 0,
  verified_purchase boolean not null default false,
  eligible boolean not null default false,
  reason text,
  gross_usd numeric(14,4) not null default 0,
  creator_usd numeric(14,4) not null default 0,
  platform_usd numeric(14,4) not null default 0,
  refund_status text not null default 'none'
    check (refund_status in ('none', 'refunded', 'chargeback')),
  review_status text not null default 'clear'
    check (review_status in ('clear', 'review', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gift_revenue_eligibility_creator_idx
  on public.gift_revenue_eligibility (creator_id, created_at desc);
create index if not exists gift_revenue_eligibility_open_idx
  on public.gift_revenue_eligibility (review_status) where review_status <> 'clear';

alter table public.gift_revenue_eligibility enable row level security;

drop policy if exists gift_revenue_eligibility_own on public.gift_revenue_eligibility;
create policy gift_revenue_eligibility_own on public.gift_revenue_eligibility
  for select to authenticated
  using (
    creator_id = auth.uid() or sender_id = auth.uid() or public.ben_admin_miyim()
  );

create or replace function public.gift_revenue_eligibility_trg()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_e public.creator_earning_entries%rowtype;
  v_found boolean := false;
  v_reason text;
begin
  select * into v_e from public.creator_earning_entries
  where source_type = 'gift' and source_id = new.id;
  v_found := found;

  if v_found then
    v_reason := v_e.ineligible_reason;
    insert into public.gift_revenue_eligibility (
      gift_transaction_id, sender_id, creator_id, coin_source, channel, coins,
      verified_purchase, eligible, reason, gross_usd, creator_usd, platform_usd,
      review_status
    ) values (
      new.id, new.sender_id, new.receiver_id, new.coin_source, new.channel,
      coalesce(new.coins_spent, 0), v_e.eligible, v_e.eligible, v_reason,
      v_e.gross_usd, v_e.creator_usd, v_e.platform_usd,
      case when v_e.hold_reason is null then 'clear' else 'review' end
    )
    on conflict (gift_transaction_id) do nothing;
  else
    v_reason := case
      when new.coin_source <> 'purchased' then new.coin_source || '_coins'
      else 'not_evaluated'
    end;
    insert into public.gift_revenue_eligibility (
      gift_transaction_id, sender_id, creator_id, coin_source, channel, coins,
      verified_purchase, eligible, reason, review_status
    ) values (
      new.id, new.sender_id, new.receiver_id, new.coin_source, new.channel,
      coalesce(new.coins_spent, 0), false, false, v_reason,
      case when new.coin_source = 'purchased' then 'review' else 'clear' end
    )
    on conflict (gift_transaction_id) do nothing;
  end if;

  if coalesce(new.diamonds_earned, 0) > 0 then
    insert into public.creator_reward_diamonds (
      creator_id, amount, kind, source_type, source_id, period_month
    ) values (
      new.receiver_id, new.diamonds_earned, 'gift', 'gift', new.id,
      date_trunc('month', coalesce(new.created_at, now()))::date
    )
    on conflict (creator_id, kind, source_type, source_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists gift_revenue_eligibility_ins on public.gift_transactions;
create trigger gift_revenue_eligibility_ins
  after insert on public.gift_transactions
  for each row execute function public.gift_revenue_eligibility_trg();

-- ---------------------------------------------------------------------------
-- 4) Ödeme hesapları (maskeli; değişiklikte yeniden doğrulama)
-- ---------------------------------------------------------------------------

create table if not exists public.creator_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  method text not null default 'bank_transfer'
    check (method in ('bank_transfer', 'local_transfer', 'wallet_transfer')),
  country_code text,
  currency text not null default 'USD',
  account_holder text not null,
  bank_name text,
  iban_masked text not null,
  iban_hash text not null,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'verified', 'rejected', 'disabled')),
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  last_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_payout_accounts_status_idx
  on public.creator_payout_accounts (status);

alter table public.creator_payout_accounts enable row level security;

drop policy if exists creator_payout_accounts_own on public.creator_payout_accounts;
create policy creator_payout_accounts_own on public.creator_payout_accounts
  for select to authenticated
  using (user_id = auth.uid() or public.ben_admin_miyim());

-- Yazma yalnızca security definer RPC'lerden. Doğrudan insert/update politikası yok.

create or replace function public.iban_normalize(p_iban text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_iban, ''), '\s', '', 'g'));
$$;

create or replace function public.iban_maskeli(p_iban text)
returns text
language sql
immutable
as $$
  select case
    when length(public.iban_normalize(p_iban)) < 8 then '****'
    else left(public.iban_normalize(p_iban), 4) || ' **** ' ||
         right(public.iban_normalize(p_iban), 4)
  end;
$$;

create or replace function public.yayinci_odeme_hesabi_getir()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_acc public.creator_payout_accounts%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_acc from public.creator_payout_accounts where user_id = v_uid;
  if not found then
    return jsonb_build_object('exists', false, 'status', 'none');
  end if;
  return jsonb_build_object(
    'exists', true,
    'id', v_acc.id,
    'method', v_acc.method,
    'country_code', v_acc.country_code,
    'currency', v_acc.currency,
    'account_holder', v_acc.account_holder,
    'bank_name', v_acc.bank_name,
    'iban_masked', v_acc.iban_masked,
    'status', v_acc.status,
    'verified_at', v_acc.verified_at,
    'last_changed_at', v_acc.last_changed_at
  );
end;
$$;

grant execute on function public.yayinci_odeme_hesabi_getir() to authenticated;

create or replace function public.yayinci_odeme_hesabi_kaydet(
  p_account_holder text,
  p_bank_name text,
  p_iban text,
  p_country_code text,
  p_currency text default 'USD',
  p_method text default 'bank_transfer'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_iban text;
  v_old public.creator_payout_accounts%rowtype;
  v_row public.creator_payout_accounts%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if coalesce(trim(p_account_holder), '') = '' then raise exception 'account_holder_required'; end if;
  v_iban := public.iban_normalize(p_iban);
  if length(v_iban) < 15 or length(v_iban) > 34 then raise exception 'invalid_iban'; end if;
  if p_method not in ('bank_transfer', 'local_transfer', 'wallet_transfer') then
    raise exception 'invalid_method';
  end if;

  select * into v_old from public.creator_payout_accounts where user_id = v_uid;

  -- Mevcut banka hesabı tablosu (mobil uyumluluk) da güncel tutulur.
  insert into public.user_bank_accounts (user_id, account_holder, bank_name, iban)
  values (v_uid, p_account_holder, coalesce(p_bank_name, '—'), v_iban)
  on conflict (user_id) do update set
    account_holder = excluded.account_holder,
    bank_name = excluded.bank_name,
    iban = excluded.iban,
    updated_at = now();

  insert into public.creator_payout_accounts (
    user_id, method, country_code, currency, account_holder, bank_name,
    iban_masked, iban_hash, status, verified_at, last_changed_at
  ) values (
    v_uid, p_method, upper(nullif(trim(p_country_code), '')),
    upper(coalesce(nullif(trim(p_currency), ''), 'USD')),
    p_account_holder, p_bank_name,
    public.iban_maskeli(v_iban), md5(v_iban),
    'pending_verification', null, now()
  )
  on conflict (user_id) do update set
    method = excluded.method,
    country_code = excluded.country_code,
    currency = excluded.currency,
    account_holder = excluded.account_holder,
    bank_name = excluded.bank_name,
    iban_masked = excluded.iban_masked,
    iban_hash = excluded.iban_hash,
    status = case
      when public.creator_payout_accounts.iban_hash = excluded.iban_hash
        then public.creator_payout_accounts.status
      else 'pending_verification'
    end,
    verified_at = case
      when public.creator_payout_accounts.iban_hash = excluded.iban_hash
        then public.creator_payout_accounts.verified_at
      else null
    end,
    last_changed_at = now(),
    updated_at = now()
  returning * into v_row;

  insert into public.financial_audit_events (actor_id, action, entity_type, entity_id, details)
  values (
    v_uid,
    case when v_old.id is null then 'payout_account_created' else 'payout_account_updated' end,
    'creator_payout_account', v_row.id,
    jsonb_build_object('iban_masked', v_row.iban_masked, 'verification_required', v_row.status = 'pending_verification')
  );

  return jsonb_build_object(
    'exists', true,
    'id', v_row.id,
    'method', v_row.method,
    'country_code', v_row.country_code,
    'currency', v_row.currency,
    'account_holder', v_row.account_holder,
    'bank_name', v_row.bank_name,
    'iban_masked', v_row.iban_masked,
    'status', v_row.status,
    'verified_at', v_row.verified_at,
    'last_changed_at', v_row.last_changed_at
  );
end;
$$;

grant execute on function public.yayinci_odeme_hesabi_kaydet(text, text, text, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Ödeme partileri, işlemleri, onaylar, itirazlar
-- ---------------------------------------------------------------------------

create table if not exists public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  period_month date not null,
  payout_date date not null,
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'approved', 'processing', 'completed', 'cancelled')),
  mode text not null default 'manual' check (mode in ('manual')),
  currency text not null default 'USD',
  total_amount_usd numeric(16,2) not null default 0,
  total_fee_usd numeric(16,2) not null default 0,
  total_net_usd numeric(16,2) not null default 0,
  item_count int not null default 0,
  skipped_count int not null default 0,
  note text,
  created_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  processed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_batches_period_month_check
    check (period_month = date_trunc('month', period_month)::date)
);

create index if not exists payout_batches_status_idx
  on public.payout_batches (status, payout_date);
create unique index if not exists payout_batches_period_active_uniq
  on public.payout_batches (period_month) where status <> 'cancelled';

alter table public.payout_batches enable row level security;

create table if not exists public.payout_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.payout_batches(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete restrict,
  payout_request_id uuid references public.creator_payout_requests(id) on delete set null,
  payout_account_id uuid references public.creator_payout_accounts(id) on delete set null,
  amount_usd numeric(14,2) not null check (amount_usd > 0),
  fee_usd numeric(14,2) not null default 0 check (fee_usd >= 0),
  net_usd numeric(14,2) not null check (net_usd >= 0),
  currency text not null default 'USD',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'sent', 'paid', 'failed', 'removed')),
  external_reference text,
  failure_reason text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_batch_items_batch_creator_uniq unique (batch_id, creator_id)
);

create unique index if not exists payout_batch_items_request_uniq
  on public.payout_batch_items (payout_request_id)
  where payout_request_id is not null;
create index if not exists payout_batch_items_creator_idx
  on public.payout_batch_items (creator_id, created_at desc);

alter table public.payout_batch_items enable row level security;

drop policy if exists payout_batch_items_read on public.payout_batch_items;
create policy payout_batch_items_read on public.payout_batch_items
  for select to authenticated
  using (creator_id = auth.uid() or public.ben_admin_miyim());

drop policy if exists payout_batches_read on public.payout_batches;
create policy payout_batches_read on public.payout_batches
  for select to authenticated
  using (
    public.ben_admin_miyim()
    or exists (
      select 1 from public.payout_batch_items i
      where i.batch_id = payout_batches.id and i.creator_id = auth.uid()
    )
  );

create table if not exists public.payout_transactions (
  id uuid primary key default gen_random_uuid(),
  batch_item_id uuid not null references public.payout_batch_items(id) on delete restrict,
  provider text not null default 'manual',
  provider_transfer_id text,
  amount_usd numeric(14,2) not null check (amount_usd > 0),
  currency text not null default 'USD',
  status text not null default 'created'
    check (status in ('created', 'sent', 'completed', 'failed', 'cancelled')),
  attempt int not null default 1,
  error text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists payout_transactions_provider_ref_uniq
  on public.payout_transactions (provider, provider_transfer_id)
  where provider_transfer_id is not null;
create unique index if not exists payout_transactions_one_success
  on public.payout_transactions (batch_item_id)
  where status in ('sent', 'completed');

alter table public.payout_transactions enable row level security;

drop policy if exists payout_transactions_read on public.payout_transactions;
create policy payout_transactions_read on public.payout_transactions
  for select to authenticated
  using (
    public.ben_admin_miyim()
    or exists (
      select 1 from public.payout_batch_items i
      where i.id = batch_item_id and i.creator_id = auth.uid()
    )
  );

create table if not exists public.payout_approvals (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.payout_batches(id) on delete cascade,
  item_id uuid references public.payout_batch_items(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action text not null check (action in ('created', 'submitted', 'approved', 'rejected', 'cancelled', 'adjusted')),
  note text,
  amount_usd numeric(14,2),
  created_at timestamptz not null default now()
);

create index if not exists payout_approvals_batch_idx
  on public.payout_approvals (batch_id, created_at desc);

alter table public.payout_approvals enable row level security;

drop policy if exists payout_approvals_read on public.payout_approvals;
create policy payout_approvals_read on public.payout_approvals
  for select to authenticated
  using (
    public.ben_admin_miyim()
    or exists (
      select 1 from public.payout_batch_items i
      where i.batch_id = payout_approvals.batch_id and i.creator_id = auth.uid()
    )
  );

create table if not exists public.payout_disputes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  batch_item_id uuid references public.payout_batch_items(id) on delete set null,
  earning_id uuid references public.creator_earning_entries(id) on delete set null,
  kind text not null default 'payout'
    check (kind in ('payout', 'earning', 'refund', 'account')),
  subject text not null,
  body text not null,
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'rejected')),
  resolution_note text,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payout_disputes_user_idx
  on public.payout_disputes (user_id, created_at desc);

alter table public.payout_disputes enable row level security;

drop policy if exists payout_disputes_own on public.payout_disputes;
create policy payout_disputes_own on public.payout_disputes
  for select to authenticated
  using (user_id = auth.uid() or public.ben_admin_miyim());

create or replace function public.yayinci_itiraz_olustur(
  p_kind text,
  p_subject text,
  p_body text,
  p_batch_item_id uuid default null,
  p_earning_id uuid default null
)
returns public.payout_disputes
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.payout_disputes%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if coalesce(trim(p_subject), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'subject_and_body_required';
  end if;
  if p_kind not in ('payout', 'earning', 'refund', 'account') then
    raise exception 'invalid_kind';
  end if;
  if p_batch_item_id is not null and not exists (
    select 1 from public.payout_batch_items where id = p_batch_item_id and creator_id = v_uid
  ) then
    raise exception 'Forbidden';
  end if;
  if p_earning_id is not null and not exists (
    select 1 from public.creator_earning_entries where id = p_earning_id and creator_id = v_uid
  ) then
    raise exception 'Forbidden';
  end if;

  insert into public.payout_disputes (
    user_id, batch_item_id, earning_id, kind, subject, body
  ) values (
    v_uid, p_batch_item_id, p_earning_id, p_kind, p_subject, p_body
  ) returning * into v_row;

  insert into public.financial_audit_events (actor_id, action, entity_type, entity_id, details)
  values (v_uid, 'payout_dispute_opened', 'payout_dispute', v_row.id,
    jsonb_build_object('kind', p_kind));

  return v_row;
end;
$$;

grant execute on function public.yayinci_itiraz_olustur(text, text, text, uuid, uuid)
  to authenticated;

create or replace function public.yayinci_itirazlarim()
returns setof public.payout_disputes
language sql
stable
security definer
set search_path to 'public'
as $$
  select * from public.payout_disputes
  where user_id = auth.uid()
  order by created_at desc
  limit 50;
$$;

grant execute on function public.yayinci_itirazlarim() to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Mizan değişiklikleri (append-only) + mali denetim
-- ---------------------------------------------------------------------------

create table if not exists public.creator_earning_adjustments (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  earning_id uuid references public.creator_earning_entries(id) on delete set null,
  gift_transaction_id uuid references public.gift_transactions(id) on delete set null,
  amount_usd numeric(14,4) not null check (amount_usd <> 0),
  kind text not null check (kind in ('refund', 'chargeback', 'correction', 'fee', 'dispute')),
  reason text not null,
  period_month date not null default date_trunc('month', now())::date,
  applied boolean not null default false,
  applied_batch_item_id uuid references public.payout_batch_items(id) on delete set null,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists creator_earning_adjustments_open_idx
  on public.creator_earning_adjustments (creator_id) where applied = false;

alter table public.creator_earning_adjustments enable row level security;

drop policy if exists creator_earning_adjustments_own on public.creator_earning_adjustments;
create policy creator_earning_adjustments_own on public.creator_earning_adjustments
  for select to authenticated
  using (creator_id = auth.uid() or public.ben_admin_miyim());

create or replace function public.creator_earning_adjustments_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'creator_earning_adjustments silinemez';
  end if;
  if new.amount_usd <> old.amount_usd or new.creator_id <> old.creator_id
     or new.kind <> old.kind or new.reason <> old.reason then
    raise exception 'creator_earning_adjustments değiştirilemez';
  end if;
  return new;
end;
$$;

drop trigger if exists creator_earning_adjustments_immutable_trg on public.creator_earning_adjustments;
create trigger creator_earning_adjustments_immutable_trg
  before update or delete on public.creator_earning_adjustments
  for each row execute function public.creator_earning_adjustments_immutable();

create table if not exists public.financial_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  amount_usd numeric(14,4),
  before_state jsonb,
  after_state jsonb,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists financial_audit_events_entity_idx
  on public.financial_audit_events (entity_type, entity_id, created_at desc);
create index if not exists financial_audit_events_actor_idx
  on public.financial_audit_events (actor_id, created_at desc);

alter table public.financial_audit_events enable row level security;

drop policy if exists financial_audit_events_admin on public.financial_audit_events;
create policy financial_audit_events_admin on public.financial_audit_events
  for select to authenticated using (public.ben_admin_miyim());

create or replace function public.financial_audit_events_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'financial_audit_events değiştirilemez veya silinemez';
end;
$$;

drop trigger if exists financial_audit_events_immutable_trg on public.financial_audit_events;
create trigger financial_audit_events_immutable_trg
  before update or delete on public.financial_audit_events
  for each row execute function public.financial_audit_events_immutable();

create or replace function public.finans_denetim_yaz(
  p_actor uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_amount numeric default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
begin
  insert into public.financial_audit_events (
    actor_id, action, entity_type, entity_id, amount_usd, before_state, after_state, details
  ) values (
    p_actor, p_action, p_entity_type, p_entity_id, p_amount, p_before, p_after, coalesce(p_details, '{}'::jsonb)
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.finans_denetim_yaz(uuid, text, text, uuid, numeric, jsonb, jsonb, jsonb)
  from public, anon, authenticated;

-- Ödeme hesabı doğrulama (admin)
create or replace function public.admin_odeme_hesabi_dogrula(
  p_account_id uuid,
  p_status text,
  p_note text default null
)
returns public.creator_payout_accounts
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row public.creator_payout_accounts%rowtype;
  v_before jsonb;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  if p_status not in ('verified', 'rejected', 'disabled') then raise exception 'invalid_status'; end if;
  if p_status = 'rejected' and coalesce(trim(p_note), '') = '' then raise exception 'note_required'; end if;

  select to_jsonb(a) into v_before from public.creator_payout_accounts a where a.id = p_account_id;
  if v_before is null then raise exception 'Not found'; end if;

  update public.creator_payout_accounts set
    status = p_status,
    verified_at = case when p_status = 'verified' then now() else verified_at end,
    verified_by = case when p_status = 'verified' then auth.uid() else verified_by end,
    updated_at = now()
  where id = p_account_id
  returning * into v_row;

  perform public.finans_denetim_yaz(
    auth.uid(), 'payout_account_verified', 'creator_payout_account', v_row.id,
    null, v_before, to_jsonb(v_row), jsonb_build_object('note', p_note)
  );

  return v_row;
end;
$$;

grant execute on function public.admin_odeme_hesabi_dogrula(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Ülke bazlı ödeme yöntemleri
-- ---------------------------------------------------------------------------

create table if not exists public.country_payout_methods (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  method text not null default 'bank_transfer'
    check (method in ('bank_transfer', 'local_transfer', 'wallet_transfer')),
  provider text,
  currency text not null default 'USD',
  min_payout_usd numeric(14,2) not null default 25.00,
  is_enabled boolean not null default false,
  auto_payout boolean not null default false,
  requires_kyc boolean not null default true,
  requires_tax_info boolean not null default true,
  requirements jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint country_payout_methods_country_check
    check (country_code ~ '^[A-Z]{2}$'),
  constraint country_payout_methods_uniq unique (country_code, method)
);

alter table public.country_payout_methods enable row level security;

drop policy if exists country_payout_methods_read on public.country_payout_methods;
create policy country_payout_methods_read on public.country_payout_methods
  for select to authenticated using (is_enabled or public.ben_admin_miyim());

drop policy if exists country_payout_methods_admin on public.country_payout_methods;
create policy country_payout_methods_admin on public.country_payout_methods
  for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

insert into public.country_payout_methods (country_code, method, provider, currency, is_enabled, auto_payout, note)
values
  ('TR', 'bank_transfer', null, 'USD', false, false, 'Otomatik ödeme sağlayıcısı sözleşmesi tamamlanmadı.'),
  ('PH', 'local_transfer', null, 'USD', false, false, 'Yerel transfer kanalı doğrulanmadı.'),
  ('CO', 'local_transfer', null, 'USD', false, false, 'Yerel transfer kanalı doğrulanmadı.'),
  ('VE', 'local_transfer', null, 'USD', false, false, 'Ödeme kısıtları nedeniyle otomatik ödeme kapalı.'),
  ('EG', 'local_transfer', null, 'USD', false, false, 'Yerel transfer kanalı doğrulanmadı.')
on conflict (country_code, method) do nothing;

-- ---------------------------------------------------------------------------
-- 8) Özet / geçmiş / grafik RPC'leri (mobil)
-- ---------------------------------------------------------------------------

create or replace function public.yayinci_kazanc_ozeti()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_cfg public.platform_economy_config%rowtype;
  v jsonb;
  v_today date := (now() at time zone 'UTC')::date;
  v_cur_start date;
  v_open public.creator_payout_requests%rowtype;
  v_adj numeric(14,4);
  v_enrollment public.creator_program_enrollments%rowtype;
  v_next date;
  v_min numeric(14,2);
  v_available numeric(14,4);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_cfg from public.platform_economy_config where id = 1;
  v_min := coalesce(v_cfg.payout_min_usd, 25.00);
  v_cur_start := date_trunc('month', v_today)::date;

  select * into v_enrollment from public.creator_program_enrollments where user_id = v_uid;

  select coalesce(jsonb_build_object(
    'eligible_gross_usd', coalesce(sum(e.gross_usd) filter (where e.eligible), 0),
    'creator_share_usd', coalesce(sum(e.creator_usd) filter (where e.eligible), 0),
    'deductions_usd', coalesce(sum(e.deductions_usd) filter (where e.eligible), 0),
    'pending_usd', coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'pending'), 0),
    'available_usd', coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'available'), 0),
    'on_hold_usd', coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'on_hold'), 0),
    'in_payout_usd', coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'in_payout'), 0),
    'paid_usd', coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'paid'), 0),
    'ineligible_count', count(*) filter (where not e.eligible),
    'lifetime_creator_usd', coalesce(sum(e.creator_usd) filter (where e.eligible), 0),
    'by_channel', coalesce((
      select jsonb_object_agg(c.channel, c.total)
      from (
        select channel, sum(net_usd) as total
        from public.creator_earning_entries
        where creator_id = v_uid and eligible
        group by channel
      ) c
    ), '{}'::jsonb)
  ), '{}'::jsonb) into v
  from public.creator_earning_entries e
  where e.creator_id = v_uid;

  select coalesce(sum(a.amount_usd), 0) into v_adj
  from public.creator_earning_adjustments a
  where a.creator_id = v_uid and a.applied = false;

  v_available := greatest(0, coalesce((v->>'available_usd')::numeric, 0) + v_adj);

  select * into v_open from public.creator_payout_requests
  where user_id = v_uid and status in ('pending', 'under_review', 'approved', 'sent_to_bank', 'on_hold')
  order by created_at desc limit 1;

  v_next := public.odeme_gunu((v_cur_start + interval '1 month')::date, null);

  return v || jsonb_build_object(
    'currency', 'USD',
    'creator_share', coalesce(v_cfg.creator_share, 0.40),
    'platform_share', 1 - coalesce(v_cfg.creator_share, 0.40),
    'payout_min_usd', v_min,
    'payout_fee_usd', coalesce(v_cfg.payout_transfer_fee_usd, 0),
    'payout_day', coalesce(v_cfg.payout_day, 15),
    'current_period_start', public.odeme_donemi_bas(now()),
    'current_period_end', public.odeme_donemi_bit(now()),
    'next_processing_date', v_next,
    'next_payout_date', v_next,
    'adjustments_usd', v_adj,
    'available_usd', v_available,
    'diamonds', coalesce((
      select sum(d.amount) from public.creator_reward_diamonds d
      where d.creator_id = v_uid
    ), 0),
    'minimum_reached', v_available >= v_min,
    'amount_to_minimum_usd', greatest(0, v_min - v_available),
    'withdrawals_enabled', public.yayinci_cekim_aktif_mi(),
    'payout_method', 'bank_transfer',
    'program_status', coalesce(v_enrollment.status, 'none'),
    'tax_status', coalesce(v_enrollment.tax_status, 'pending'),
    'eligibility', public.yayinci_uygunluk_durumu(v_uid),
    'open_request', case when v_open.id is null then null else to_jsonb(v_open) - 'idempotency_key' end
  );
end;
$$;

grant execute on function public.yayinci_kazanc_ozeti() to authenticated;

create or replace function public.yayinci_kazanc_kayitlari_v2(
  p_channel text default null,
  p_status text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  created_at timestamptz,
  source_type text,
  channel text,
  coin_source text,
  coins bigint,
  gross_usd numeric,
  creator_rate numeric,
  creator_usd numeric,
  agency_usd numeric,
  platform_usd numeric,
  deductions_usd numeric,
  net_usd numeric,
  eligible boolean,
  ineligible_reason text,
  status text,
  period_start date,
  period_end date,
  payer_name text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select e.id, e.created_at, e.source_type, e.channel, e.coin_source, e.coins,
         e.gross_usd, e.creator_rate, e.creator_usd, e.agency_usd, e.platform_usd,
         e.deductions_usd, e.net_usd, e.eligible, e.ineligible_reason,
         public.yayinci_kazanc_durumu(e), e.period_start, e.period_end,
         public.profil_gosterim_adi(e.payer_id)
  from public.creator_earning_entries e
  where e.creator_id = auth.uid()
    and (p_channel is null or e.channel = p_channel)
    and (p_status is null or public.yayinci_kazanc_durumu(e) = p_status)
  order by e.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.yayinci_kazanc_kayitlari_v2(text, text, int, int) to authenticated;

create or replace function public.yayinci_kazanc_grafikleri(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_days int := least(greatest(coalesce(p_days, 30), 7), 180);
  v_daily jsonb;
  v_weekly jsonb;
  v_monthly jsonb;
  v_channel jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select coalesce(jsonb_agg(d order by d.day), '[]'::jsonb) into v_daily
  from (
    select gs::date as day,
           coalesce(sum(e.creator_usd) filter (where e.eligible), 0)::numeric(14,4) as creator_usd,
           coalesce(sum(e.gross_usd) filter (where e.eligible), 0)::numeric(14,4) as gross_usd,
           count(e.id) filter (where e.eligible) as gift_count
    from generate_series((now() at time zone 'UTC')::date - (v_days - 1),
                         (now() at time zone 'UTC')::date, interval '1 day') gs
    left join public.creator_earning_entries e
      on e.creator_id = v_uid
     and e.created_at >= gs
     and e.created_at < gs + interval '1 day'
    group by gs
  ) d;

  select coalesce(jsonb_agg(w order by w.week_start), '[]'::jsonb) into v_weekly
  from (
    select date_trunc('week', e.created_at)::date as week_start,
           coalesce(sum(e.creator_usd) filter (where e.eligible), 0)::numeric(14,4) as creator_usd,
           count(e.id) filter (where e.eligible) as gift_count
    from public.creator_earning_entries e
    where e.creator_id = v_uid
      and e.created_at >= date_trunc('week', now() - interval '12 weeks')
    group by 1
  ) w;

  select coalesce(jsonb_agg(m order by m.month_start), '[]'::jsonb) into v_monthly
  from (
    select date_trunc('month', e.created_at)::date as month_start,
           coalesce(sum(e.creator_usd) filter (where e.eligible), 0)::numeric(14,4) as creator_usd,
           coalesce(sum(e.gross_usd) filter (where e.eligible), 0)::numeric(14,4) as gross_usd,
           count(e.id) filter (where e.eligible) as gift_count
    from public.creator_earning_entries e
    where e.creator_id = v_uid
      and e.created_at >= date_trunc('month', now() - interval '5 months')
    group by 1
  ) m;

  select coalesce(jsonb_object_agg(c.channel, c.total), '{}'::jsonb) into v_channel
  from (
    select channel, sum(creator_usd)::numeric(14,4) as total
    from public.creator_earning_entries
    where creator_id = v_uid and eligible
      and created_at >= now() - interval '90 days'
    group by channel
  ) c;

  return jsonb_build_object(
    'days', v_days,
    'daily', v_daily,
    'weekly', v_weekly,
    'monthly', v_monthly,
    'by_channel', v_channel
  );
end;
$$;

grant execute on function public.yayinci_kazanc_grafikleri(int) to authenticated;

create or replace function public.yayinci_odeme_gecmisi()
returns table (
  id uuid,
  batch_id uuid,
  batch_created_at timestamptz,
  period_month date,
  payout_date date,
  amount_usd numeric,
  fee_usd numeric,
  net_usd numeric,
  currency text,
  status text,
  iban_masked text,
  external_reference text,
  paid_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select i.id, b.id, b.created_at, b.period_month, b.payout_date,
         i.amount_usd, i.fee_usd, i.net_usd, i.currency, i.status,
         a.iban_masked, i.external_reference, i.paid_at
  from public.payout_batch_items i
  join public.payout_batches b on b.id = i.batch_id
  left join public.creator_payout_accounts a on a.id = i.payout_account_id
  where i.creator_id = auth.uid()
  order by b.period_month desc, i.created_at desc
  limit 60;
$$;

grant execute on function public.yayinci_odeme_gecmisi() to authenticated;

create or replace function public.yayinci_program_durumu()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_enr public.creator_program_enrollments%rowtype;
  v_ver public.creator_contract_versions%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select * into v_enr from public.creator_program_enrollments where user_id = v_uid;
  select * into v_ver from public.creator_contract_versions
    where id = v_enr.contract_version_id
    order by version desc limit 1;

  return jsonb_build_object(
    'enrollment', case when v_enr.user_id is null then null else to_jsonb(v_enr) end,
    'contract', case when v_ver.id is null then null else jsonb_build_object(
      'id', v_ver.id, 'version', v_ver.version, 'title', v_ver.title,
      'summary_md', v_ver.summary_md, 'policy_code', v_ver.policy_code,
      'effective_from', v_ver.effective_from
    ) end,
    'eligibility', public.yayinci_uygunluk_durumu(v_uid),
    'payout_calendar', jsonb_build_object(
      'payout_day', coalesce((select payout_day from public.platform_economy_config where id = 1), 15),
      'next_payout_date', public.odeme_gunu(date_trunc('month', (now() at time zone 'UTC') + interval '1 month')::date, null),
      'minimum_usd', coalesce((select payout_min_usd from public.platform_economy_config where id = 1), 25.00)
    )
  );
end;
$$;

grant execute on function public.yayinci_program_durumu() to authenticated;

-- ---------------------------------------------------------------------------
-- 9) Aylık kapanış / ödeme listesi hazırlama (admin)
-- ---------------------------------------------------------------------------

create or replace function public.admin_yayinci_donem_kapat(p_month date)
returns public.monthly_settlement_periods
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_month date := public.odeme_ay_bas(p_month);
  v_cfg public.platform_economy_config%rowtype;
  v_row public.monthly_settlement_periods%rowtype;
  v_gross numeric(16,4);
  v_creator numeric(16,4);
  v_platform numeric(16,4);
  v_adjusted numeric(16,4);
  v_count int;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  if v_month >= date_trunc('month', (now() at time zone 'UTC'))::date then
    raise exception 'period_not_closed';
  end if;

  select * into v_cfg from public.platform_economy_config where id = 1;

  select coalesce(sum(gross_usd), 0), coalesce(sum(creator_usd), 0),
         coalesce(sum(platform_usd), 0), count(distinct creator_id)
    into v_gross, v_creator, v_platform, v_count
  from public.creator_earning_entries
  where eligible and period_start = v_month;

  select coalesce(sum(amount_usd), 0) into v_adjusted
  from public.creator_earning_adjustments
  where period_month = v_month and applied = false;

  insert into public.monthly_settlement_periods (
    period_month, period_start, period_end, status, payout_date,
    creator_share, min_payout_usd, gift_revenue_usd, creator_earnings_usd,
    platform_share_usd, adjusted_usd, eligible_creator_count, closed_at
  ) values (
    v_month, v_month, public.odeme_ay_bit(v_month), 'closed',
    public.odeme_gunu((v_month + interval '1 month')::date, null),
    coalesce(v_cfg.creator_share, 0.40), coalesce(v_cfg.payout_min_usd, 25.00),
    v_gross, v_creator, v_platform, v_adjusted, v_count, now()
  )
  on conflict (period_month) do update set
    status = case
      when public.monthly_settlement_periods.status in ('paid', 'processing')
        then public.monthly_settlement_periods.status
      else 'closed'
    end,
    payout_date = excluded.payout_date,
    gift_revenue_usd = excluded.gift_revenue_usd,
    creator_earnings_usd = excluded.creator_earnings_usd,
    platform_share_usd = excluded.platform_share_usd,
    adjusted_usd = excluded.adjusted_usd,
    eligible_creator_count = excluded.eligible_creator_count,
    closed_at = coalesce(public.monthly_settlement_periods.closed_at, now()),
    updated_at = now()
  returning * into v_row;

  perform public.finans_denetim_yaz(
    auth.uid(), 'settlement_period_closed', 'monthly_settlement_period', v_row.id,
    v_gross, null, to_jsonb(v_row), jsonb_build_object('month', v_month)
  );

  return v_row;
end;
$$;

grant execute on function public.admin_yayinci_donem_kapat(date) to authenticated;

create or replace function public.admin_yayinci_odeme_listesi_hazirla(
  p_month date,
  p_note text default null
)
returns public.payout_batches
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_month date := public.odeme_ay_bas(p_month);
  v_today date := (now() at time zone 'UTC')::date;
  v_cfg public.platform_economy_config%rowtype;
  v_period public.monthly_settlement_periods%rowtype;
  v_batch public.payout_batches%rowtype;
  v_batch_id uuid;
  v_rec record;
  v_amount numeric(14,2);
  v_fee numeric(14,2);
  v_net numeric(14,2);
  v_adj numeric(14,2);
  v_req public.creator_payout_requests%rowtype;
  v_acc public.creator_payout_accounts%rowtype;
  v_elig jsonb;
  v_items int := 0;
  v_total numeric(16,2) := 0;
  v_total_fee numeric(16,2) := 0;
  v_skipped int := 0;
  v_payout_date date;
  v_key text;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  if v_month >= date_trunc('month', v_today)::date then raise exception 'period_not_closed'; end if;

  select * into v_cfg from public.platform_economy_config where id = 1;

  -- Dönem kapalı değilse kapat.
  select * into v_period from public.monthly_settlement_periods where period_month = v_month;
  if not found then
    v_period := public.admin_yayinci_donem_kapat(v_month);
  end if;

  if exists (select 1 from public.payout_batches where period_month = v_month and status <> 'cancelled') then
    raise exception 'batch_exists';
  end if;

  v_payout_date := public.odeme_gunu((v_month + interval '1 month')::date, null);

  insert into public.payout_batches (
    period_month, payout_date, status, mode, total_amount_usd, note, created_by
  ) values (
    v_month, v_payout_date, 'draft', 'manual', 0, p_note, auth.uid()
  ) returning * into v_batch;
  v_batch_id := v_batch.id;

  -- Yalnızca kapalı dönemdeki, uygun, ödeme talebine bağlanmamış kazançlar.
  for v_rec in
    select e.creator_id,
           sum(e.net_usd)::numeric(14,2) as amount,
           count(*) as cnt
    from public.creator_earning_entries e
    where e.eligible
      and e.period_start = v_month
      and e.period_end < v_today
      and e.payout_request_id is null
      and e.paid_at is null
      and e.hold_reason is null
    group by e.creator_id
    order by e.creator_id
  loop
    v_amount := floor(coalesce(v_rec.amount, 0) * 100) / 100;
    continue when v_amount <= 0;

    v_elig := public.yayinci_uygunluk_durumu(v_rec.creator_id);
    if not coalesce((v_elig->>'eligible')::boolean, false) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    -- Ödeme hesabı doğrulanmış olmalı.
    select * into v_acc from public.creator_payout_accounts where user_id = v_rec.creator_id;
    if not found or v_acc.status <> 'verified' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select coalesce(sum(a.amount_usd), 0) into v_adj
    from public.creator_earning_adjustments a
    where a.creator_id = v_rec.creator_id and a.applied = false;

    v_amount := greatest(0, v_amount + v_adj);
    if v_amount < coalesce(v_cfg.payout_min_usd, 25.00) then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    if v_amount <= 0 then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_fee := least(coalesce(v_cfg.payout_transfer_fee_usd, 0), v_amount);
    v_net := v_amount - v_fee;

    -- Aynı dönem için talebin iki kez oluşmasını engelle.
    v_key := 'batch:' || v_month::text || ':' || v_rec.creator_id::text;
    if exists (select 1 from public.creator_payout_requests where user_id = v_rec.creator_id
               and status in ('pending', 'under_review', 'approved', 'sent_to_bank', 'on_hold')) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.creator_payout_requests (
      user_id, amount_usd, fee_usd, net_usd, account_holder, bank_name, iban_masked,
      idempotency_key, period_end, status
    ) values (
      v_rec.creator_id, v_amount, v_fee, v_net, v_acc.account_holder, v_acc.bank_name,
      v_acc.iban_masked, v_key, public.odeme_ay_bit(v_month), 'pending'
    )
    on conflict (idempotency_key) do nothing
    returning * into v_req;

    if v_req.id is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    update public.creator_earning_entries e
      set payout_request_id = v_req.id
    where e.creator_id = v_rec.creator_id
      and e.eligible
      and e.period_start = v_month
      and e.payout_request_id is null
      and e.paid_at is null;

    update public.creator_earning_adjustments a
      set applied = true
    where a.creator_id = v_rec.creator_id and a.applied = false;

    insert into public.payout_batch_items (
      batch_id, creator_id, payout_request_id, payout_account_id,
      amount_usd, fee_usd, net_usd, currency, status
    ) values (
      v_batch_id, v_rec.creator_id, v_req.id, v_acc.id,
      v_amount, v_fee, v_net, 'USD', 'pending'
    );

    insert into public.creator_payout_events (request_id, actor_id, from_status, to_status, note)
    values (v_req.id, auth.uid(), null, 'pending', 'Aylık ödeme listesine eklendi');

    insert into public.payout_approvals (batch_id, actor_id, action, note, amount_usd)
    values (v_batch_id, auth.uid(), 'created', 'Ödeme listesine eklendi', v_amount);

    perform public.bildirim_kuyruga_ekle(
      v_rec.creator_id, 'wallet', 'Ödeme listeniz hazırlandı',
      v_month::text || ' dönemi kazancınız ödeme onayına sunuldu.',
      '/cuzdan/yayinci-kazanclari',
      jsonb_build_object('type', 'creator_payout_listed', 'month', v_month, 'batch_id', v_batch_id)
    );

    v_items := v_items + 1;
    v_total := v_total + v_amount;
    v_total_fee := v_total_fee + v_fee;
  end loop;

  update public.payout_batches set
    status = case when v_items > 0 then 'pending_approval' else 'draft' end,
    total_amount_usd = v_total,
    total_fee_usd = v_total_fee,
    total_net_usd = v_total - v_total_fee,
    item_count = v_items,
    skipped_count = v_skipped,
    updated_at = now()
  where id = v_batch_id
  returning * into v_batch;

  update public.monthly_settlement_periods set
    status = case when v_items > 0 then 'payment_list' else 'closed' end,
    payout_batch_id = v_batch_id,
    payable_creator_count = v_items,
    updated_at = now()
  where period_month = v_month;

  perform public.finans_denetim_yaz(
    auth.uid(), 'payout_batch_prepared', 'payout_batch', v_batch_id,
    v_total, null, to_jsonb(v_batch),
    jsonb_build_object('month', v_month, 'items', v_items, 'skipped', v_skipped)
  );

  return v_batch;
end;
$$;

grant execute on function public.admin_yayinci_odeme_listesi_hazirla(date, text) to authenticated;

create or replace function public.admin_yayinci_odeme_batch_onayla(
  p_batch_id uuid,
  p_note text default null
)
returns public.payout_batches
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_batch public.payout_batches%rowtype;
  v_item record;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;

  select * into v_batch from public.payout_batches where id = p_batch_id for update;
  if not found then raise exception 'Not found'; end if;
  if v_batch.status = 'approved' then return v_batch; end if;
  if v_batch.status <> 'pending_approval' then raise exception 'invalid_status'; end if;
  if v_batch.item_count <= 0 then raise exception 'empty_batch'; end if;

  for v_item in select * from public.payout_batch_items where batch_id = p_batch_id and status = 'pending'
  loop
    update public.payout_batch_items set status = 'approved', updated_at = now() where id = v_item.id;

    if v_item.payout_request_id is not null then
      update public.creator_payout_requests set
        status = 'approved',
        reviewed_at = coalesce(reviewed_at, now()),
        approved_at = now(),
        status_note = coalesce(p_note, status_note),
        updated_at = now()
      where id = v_item.payout_request_id;

      insert into public.creator_payout_events (request_id, actor_id, from_status, to_status, note)
      values (v_item.payout_request_id, auth.uid(), 'pending', 'approved', p_note);
    end if;

    insert into public.payout_approvals (batch_id, item_id, actor_id, action, note, amount_usd)
    values (p_batch_id, v_item.id, auth.uid(), 'approved', p_note, v_item.amount_usd);
  end loop;

  update public.payout_batches set
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now(),
    note = coalesce(p_note, note),
    updated_at = now()
  where id = p_batch_id
  returning * into v_batch;

  update public.monthly_settlement_periods set status = 'processing', updated_at = now()
  where payout_batch_id = p_batch_id and status = 'payment_list';

  perform public.finans_denetim_yaz(
    auth.uid(), 'payout_batch_approved', 'payout_batch', p_batch_id,
    v_batch.total_amount_usd, null, to_jsonb(v_batch), jsonb_build_object('note', p_note)
  );

  return v_batch;
end;
$$;

grant execute on function public.admin_yayinci_odeme_batch_onayla(uuid, text) to authenticated;

create or replace function public.admin_yayinci_odeme_batch_iptal(
  p_batch_id uuid,
  p_note text
)
returns public.payout_batches
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_batch public.payout_batches%rowtype;
  v_item record;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'note_required'; end if;

  select * into v_batch from public.payout_batches where id = p_batch_id for update;
  if not found then raise exception 'Not found'; end if;
  if v_batch.status in ('processing', 'completed') then raise exception 'invalid_status'; end if;

  for v_item in select * from public.payout_batch_items where batch_id = p_batch_id
  loop
    if v_item.status = 'paid' then
      raise exception 'paid_item_cannot_cancel';
    end if;
    update public.payout_batch_items set status = 'removed', updated_at = now() where id = v_item.id;
    if v_item.payout_request_id is not null then
      update public.creator_payout_requests set
        status = 'cancelled', cancelled_at = now(), status_note = p_note, updated_at = now()
      where id = v_item.payout_request_id;
      insert into public.creator_payout_events (request_id, actor_id, from_status, to_status, note)
      values (v_item.payout_request_id, auth.uid(), 'pending', 'cancelled', p_note);
    end if;
  end loop;

  update public.creator_earning_entries e set payout_request_id = null
  where e.payout_request_id in (
    select i.payout_request_id from public.payout_batch_items i
    where i.batch_id = p_batch_id and i.payout_request_id is not null
  );

  update public.payout_batches set
    status = 'cancelled', cancelled_at = now(), note = p_note, updated_at = now()
  where id = p_batch_id returning * into v_batch;

  update public.monthly_settlement_periods set status = 'closed', payout_batch_id = null, updated_at = now()
  where payout_batch_id = p_batch_id;

  perform public.finans_denetim_yaz(
    auth.uid(), 'payout_batch_cancelled', 'payout_batch', p_batch_id,
    v_batch.total_amount_usd, null, to_jsonb(v_batch), jsonb_build_object('note', p_note)
  );

  return v_batch;
end;
$$;

grant execute on function public.admin_yayinci_odeme_batch_iptal(uuid, text) to authenticated;

-- Manuel transfer: önce "sent", sonra "paid". Aynı öğe iki kez ödenemez.
create or replace function public.admin_yayinci_odeme_oge_isle(
  p_item_id uuid,
  p_action text,
  p_reference text default null,
  p_note text default null
)
returns public.payout_batch_items
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_item public.payout_batch_items%rowtype;
  v_batch public.payout_batches%rowtype;
  v_req public.creator_payout_requests%rowtype;
  v_uid uuid := auth.uid();
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  if p_action not in ('sent', 'completed', 'failed') then raise exception 'invalid_action'; end if;
  if p_action in ('sent', 'completed') and coalesce(trim(p_reference), '') = '' then
    raise exception 'reference_required';
  end if;
  if p_action = 'failed' and coalesce(trim(p_note), '') = '' then
    raise exception 'note_required';
  end if;

  select * into v_item from public.payout_batch_items where id = p_item_id for update;
  if not found then raise exception 'Not found'; end if;
  select * into v_batch from public.payout_batches where id = v_item.batch_id for update;
  if v_batch.status <> 'approved' and v_batch.status <> 'processing' and v_batch.status <> 'completed' then
    raise exception 'batch_not_approved';
  end if;

  if p_action = 'sent' then
    if v_item.status not in ('approved', 'pending') then raise exception 'invalid_transition'; end if;
    update public.payout_batch_items set
      status = 'sent', sent_at = now(), external_reference = p_reference, updated_at = now()
    where id = p_item_id returning * into v_item;

    insert into public.payout_transactions (
      batch_item_id, provider, provider_transfer_id, amount_usd, currency, status, created_by
    ) values (
      p_item_id, 'manual', p_reference, v_item.net_usd, v_item.currency, 'sent', v_uid
    );

    if v_item.payout_request_id is not null then
      update public.creator_payout_requests set
        status = 'sent_to_bank', sent_at = now(), status_note = coalesce(p_note, status_note), updated_at = now()
      where id = v_item.payout_request_id;
      insert into public.creator_payout_events (request_id, actor_id, from_status, to_status, note)
      values (v_item.payout_request_id, v_uid, 'approved', 'sent_to_bank', coalesce(p_note, p_reference));
    end if;

    update public.payout_batches set status = 'processing', processed_at = coalesce(processed_at, now()), updated_at = now()
    where id = v_item.batch_id;
  elsif p_action = 'completed' then
    if v_item.status <> 'sent' then raise exception 'invalid_transition'; end if;

    update public.payout_batch_items set
      status = 'paid', paid_at = now(), external_reference = coalesce(p_reference, external_reference), updated_at = now()
    where id = p_item_id returning * into v_item;

    update public.payout_transactions set status = 'completed', completed_at = now()
    where batch_item_id = p_item_id and status = 'sent';

    if v_item.payout_request_id is not null then
      update public.creator_payout_requests set
        status = 'completed', completed_at = now(), status_note = coalesce(p_note, status_note), updated_at = now()
      where id = v_item.payout_request_id;
      update public.creator_earning_entries set paid_at = now()
      where payout_request_id = v_item.payout_request_id;
      insert into public.creator_payout_events (request_id, actor_id, from_status, to_status, note)
      values (v_item.payout_request_id, v_uid, 'sent_to_bank', 'completed', coalesce(p_note, p_reference));
    end if;
  else
    if v_item.status not in ('sent', 'approved', 'pending') then raise exception 'invalid_transition'; end if;
    update public.payout_batch_items set
      status = 'failed', failure_reason = p_note, updated_at = now()
    where id = p_item_id returning * into v_item;
    update public.payout_transactions set status = 'failed', error = p_note
    where batch_item_id = p_item_id and status = 'sent';
    if v_item.payout_request_id is not null then
      update public.creator_payout_requests set
        status = 'failed', failed_at = now(), failure_reason = p_note, updated_at = now()
      where id = v_item.payout_request_id;
      update public.creator_earning_entries set payout_request_id = null
      where payout_request_id = v_item.payout_request_id;
      insert into public.creator_payout_events (request_id, actor_id, from_status, to_status, note)
      values (v_item.payout_request_id, v_uid, 'sent_to_bank', 'failed', p_note);
    end if;
  end if;

  perform public.finans_denetim_yaz(
    v_uid, 'payout_item_' || p_action, 'payout_batch_item', p_item_id,
    v_item.amount_usd, null, to_jsonb(v_item),
    jsonb_build_object('reference', p_reference, 'note', p_note)
  );

  -- Tüm öğeler ödendiyse parti ve dönem kapanır.
  if p_action = 'completed' and not exists (
    select 1 from public.payout_batch_items
    where batch_id = v_item.batch_id and status in ('pending', 'approved', 'sent')
  ) then
    update public.payout_batches set status = 'completed', completed_at = now(), updated_at = now()
    where id = v_item.batch_id;
    update public.monthly_settlement_periods set status = 'paid', paid_at = now(), updated_at = now()
    where payout_batch_id = v_item.batch_id;
  end if;

  perform public.bildirim_kuyruga_ekle(
    v_item.creator_id, 'wallet',
    case p_action when 'sent' then 'Ödemeniz gönderildi' when 'completed' then 'Ödemeniz tamamlandı' else 'Ödeme sorunu' end,
    case p_action
      when 'sent' then 'Ödemeniz bankaya iletildi.'
      when 'completed' then 'Ödemeniz hesabınıza geçti.'
      else coalesce(p_note, 'Ödeme tamamlanamadı; destek ile iletişime geçin.')
    end,
    '/cuzdan/yayinci-kazanclari',
    jsonb_build_object('type', 'creator_payout_item', 'item_id', p_item_id, 'status', p_action)
  );

  return v_item;
end;
$$;

grant execute on function public.admin_yayinci_odeme_oge_isle(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 10) İade / chargeback
-- ---------------------------------------------------------------------------

create or replace function public.admin_yayinci_iade_isle(
  p_gift_transaction_id uuid,
  p_kind text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_gift public.gift_transactions%rowtype;
  v_elig public.gift_revenue_eligibility%rowtype;
  v_earning public.creator_earning_entries%rowtype;
  v_amount numeric(14,4);
  v_adj_id uuid;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  if p_kind not in ('refund', 'chargeback') then raise exception 'invalid_kind'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'note_required'; end if;

  select * into v_gift from public.gift_transactions where id = p_gift_transaction_id;
  if not found then raise exception 'Not found'; end if;
  select * into v_elig from public.gift_revenue_eligibility where gift_transaction_id = p_gift_transaction_id;
  if not found then raise exception 'eligibility_missing'; end if;
  if v_elig.refund_status <> 'none' then raise exception 'already_refunded'; end if;

  update public.gift_revenue_eligibility set
    refund_status = case when p_kind = 'chargeback' then 'chargeback' else 'refunded' end,
    review_status = 'blocked',
    eligible = false,
    updated_at = now()
  where gift_transaction_id = p_gift_transaction_id
  returning * into v_elig;

  select * into v_earning from public.creator_earning_entries
  where source_type = 'gift' and source_id = p_gift_transaction_id;

  if found then
    if v_earning.paid_at is null and v_earning.payout_request_id is null then
      update public.creator_earning_entries set
        eligible = false,
        ineligible_reason = 'refunded_' || p_kind,
        hold_reason = null
      where id = v_earning.id;
      v_amount := 0;
    else
      v_amount := -1 * v_earning.creator_usd;
      insert into public.creator_earning_adjustments (
        creator_id, earning_id, gift_transaction_id, amount_usd, kind, reason, actor_id
      ) values (
        v_earning.creator_id, v_earning.id, p_gift_transaction_id, v_amount,
        case when p_kind = 'chargeback' then 'chargeback' else 'refund' end,
        p_note, v_uid
      ) returning id into v_adj_id;
      update public.creator_earning_entries set hold_reason = 'refund_review' where id = v_earning.id;
    end if;

    insert into public.finance_risk_flags (user_id, kind, severity, ref_type, ref_id, details)
    values (
      v_earning.creator_id,
      case when p_kind = 'chargeback' then 'chargeback' else 'refund' end,
      case when p_kind = 'chargeback' then 'high' else 'medium' end,
      'gift', p_gift_transaction_id,
      jsonb_build_object('note', p_note, 'by', v_uid, 'amount_usd', v_earning.creator_usd)
    );
  end if;

  perform public.finans_denetim_yaz(
    v_uid, 'gift_' || p_kind, 'gift_transaction', p_gift_transaction_id,
    coalesce(v_earning.creator_usd, 0), to_jsonb(v_elig), null,
    jsonb_build_object('note', p_note, 'creator_id', v_earning.creator_id)
  );

  return jsonb_build_object(
    'ok', true,
    'gift_transaction_id', p_gift_transaction_id,
    'refund_status', v_elig.refund_status,
    'adjustment_id', v_adj_id,
    'earning_id', v_earning.id
  );
end;
$$;

grant execute on function public.admin_yayinci_iade_isle(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 11) Admin finans merkezi RPC'leri
-- ---------------------------------------------------------------------------

create or replace function public.admin_yayinci_finans_ozet()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_cfg public.platform_economy_config%rowtype;
  v_today date := (now() at time zone 'UTC')::date;
  v_month date := date_trunc('month', (now() at time zone 'UTC'))::date;
  v_next date;
  v_result jsonb;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  select * into v_cfg from public.platform_economy_config where id = 1;
  v_next := public.odeme_gunu((v_month + interval '1 month')::date, null);

  select jsonb_build_object(
    'total_gift_revenue_usd', coalesce(sum(gross_usd) filter (where eligible), 0),
    'creator_earnings_usd', coalesce(sum(creator_usd) filter (where eligible), 0),
    'platform_share_usd', coalesce(sum(platform_usd) filter (where eligible), 0),
    'pending_usd', coalesce(sum(net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'pending'), 0),
    'available_usd', coalesce(sum(net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'available'), 0),
    'on_hold_usd', coalesce(sum(net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'on_hold'), 0),
    'in_payout_usd', coalesce(sum(net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'in_payout'), 0),
    'paid_usd', coalesce(sum(net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'paid'), 0),
    'ineligible_usd', coalesce(sum(gross_usd) filter (where not eligible), 0),
    'this_month_creator_usd', coalesce(sum(creator_usd) filter (where eligible and created_at >= v_month), 0),
    'this_month_platform_usd', coalesce(sum(platform_usd) filter (where eligible and created_at >= v_month), 0),
    'this_month_gift_count', count(*) filter (where eligible and created_at >= v_month),
    'creators_with_earnings', count(distinct creator_id) filter (where eligible),
    'creators_above_min', count(distinct creator_id) filter (
      where eligible and public.yayinci_kazanc_durumu(e) = 'available'
    )
  ) into v_result
  from public.creator_earning_entries e;

  return v_result || jsonb_build_object(
    'currency', 'USD',
    'creator_share', coalesce(v_cfg.creator_share, 0.40),
    'platform_share', 1 - coalesce(v_cfg.creator_share, 0.40),
    'payout_min_usd', coalesce(v_cfg.payout_min_usd, 25.00),
    'payout_day', coalesce(v_cfg.payout_day, 15),
    'current_period_start', v_month,
    'current_period_end', public.odeme_ay_bit(v_month),
    'next_payout_date', v_next,
    'open_risk_flags', (select count(*) from public.finance_risk_flags where status = 'open'),
    'open_disputes', (select count(*) from public.payout_disputes where status in ('open', 'reviewing')),
    'pending_batches', (select count(*) from public.payout_batches where status = 'pending_approval'),
    'paid_creators', (
      select count(distinct i.creator_id) from public.payout_batch_items i where i.status = 'paid'
    ),
    'creators_waiting', (
      select count(distinct e.creator_id)
      from public.creator_earning_entries e
      where e.eligible and public.yayinci_kazanc_durumu(e) = 'available'
        and e.payout_request_id is null
    )
  );
end;
$$;

grant execute on function public.admin_yayinci_finans_ozet() to authenticated;

create or replace function public.admin_yayinci_listesi(
  p_limit int default 50,
  p_offset int default 0,
  p_q text default null
)
returns table (
  user_id uuid,
  display_name text,
  username text,
  country_code text,
  program_status text,
  tax_status text,
  kyc_status text,
  payout_account_status text,
  lifetime_gross_usd numeric,
  lifetime_creator_usd numeric,
  available_usd numeric,
  pending_usd numeric,
  paid_usd numeric,
  on_hold_usd numeric,
  min_reached boolean,
  open_flags int
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    p.id,
    coalesce(p.display_name, p.username)::text,
    p.username::text,
    coalesce(en.country_code, upper(coalesce(p.country_code, ''))),
    coalesce(en.status, 'none'),
    coalesce(en.tax_status, 'pending'),
    coalesce(wa.kyc_status, 'none'),
    coalesce(cpa.status, 'none'),
    coalesce(sum(e.gross_usd) filter (where e.eligible), 0)::numeric(14,4),
    coalesce(sum(e.creator_usd) filter (where e.eligible), 0)::numeric(14,4),
    coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'available'), 0)::numeric(14,4),
    coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'pending'), 0)::numeric(14,4),
    coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'paid'), 0)::numeric(14,4),
    coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'on_hold'), 0)::numeric(14,4),
    coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'available'), 0)
      >= coalesce((select payout_min_usd from public.platform_economy_config where id = 1), 25),
    (select count(*) from public.finance_risk_flags f where f.user_id = p.id and f.status = 'open')::int
  from public.profiles p
  join public.creator_earning_entries e on e.creator_id = p.id
  left join public.creator_program_enrollments en on en.user_id = p.id
  left join public.wallet_accounts wa on wa.user_id = p.id
  left join public.creator_payout_accounts cpa on cpa.user_id = p.id
  where p_q is null or coalesce(p.display_name, p.username, '') ilike '%' || p_q || '%'
  group by p.id, p.display_name, p.username, p.country_code, en.country_code, en.status,
           en.tax_status, wa.kyc_status, cpa.status
  order by 10 desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.admin_yayinci_listesi(int, int, text) to authenticated;

create or replace function public.admin_yayinci_kazanc_gunluk(
  p_from date default null,
  p_to date default null
)
returns table (
  day date,
  gift_count int,
  coins bigint,
  gift_revenue_usd numeric,
  creator_usd numeric,
  platform_usd numeric,
  eligible_creator_count int
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    (e.created_at at time zone 'UTC')::date,
    count(*)::int,
    coalesce(sum(e.coins), 0)::bigint,
    coalesce(sum(e.gross_usd) filter (where e.eligible), 0)::numeric(14,4),
    coalesce(sum(e.creator_usd) filter (where e.eligible), 0)::numeric(14,4),
    coalesce(sum(e.platform_usd) filter (where e.eligible), 0)::numeric(14,4),
    count(distinct e.creator_id) filter (where e.eligible)::int
  from public.creator_earning_entries e
  where public.ben_admin_miyim()
    and (p_from is null or e.created_at >= p_from)
    and (p_to is null or e.created_at < (p_to + 1))
  group by 1
  order by 1 desc
  limit 120;
$$;

grant execute on function public.admin_yayinci_kazanc_gunluk(date, date) to authenticated;

create or replace function public.admin_yayinci_kazanc_aylik(p_months int default 12)
returns table (
  month_start date,
  gift_count int,
  creator_count int,
  gift_revenue_usd numeric,
  creator_usd numeric,
  platform_usd numeric
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    date_trunc('month', e.created_at)::date,
    count(*)::int,
    count(distinct e.creator_id)::int,
    coalesce(sum(e.gross_usd) filter (where e.eligible), 0)::numeric(14,4),
    coalesce(sum(e.creator_usd) filter (where e.eligible), 0)::numeric(14,4),
    coalesce(sum(e.platform_usd) filter (where e.eligible), 0)::numeric(14,4)
  from public.creator_earning_entries e
  where public.ben_admin_miyim()
    and e.created_at >= date_trunc('month', now() - make_interval(months => least(greatest(coalesce(p_months, 12), 1), 36)))
  group by 1
  order by 1 desc;
$$;

grant execute on function public.admin_yayinci_kazanc_aylik(int) to authenticated;

create or replace function public.admin_yayinci_bekleyen(p_limit int default 100)
returns table (
  id uuid,
  creator_id uuid,
  creator_name text,
  created_at timestamptz,
  coins bigint,
  coin_source text,
  channel text,
  gross_usd numeric,
  creator_usd numeric,
  net_usd numeric,
  status text,
  hold_reason text,
  period_start date,
  period_end date
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select e.id, e.creator_id, coalesce(p.display_name, p.username)::text, e.created_at,
         e.coins, e.coin_source, e.channel, e.gross_usd, e.creator_usd, e.net_usd,
         public.yayinci_kazanc_durumu(e), e.hold_reason, e.period_start, e.period_end
  from public.creator_earning_entries e
  join public.profiles p on p.id = e.creator_id
  where public.ben_admin_miyim()
    and public.yayinci_kazanc_durumu(e) in ('pending', 'on_hold', 'available', 'in_payout')
  order by e.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 300);
$$;

grant execute on function public.admin_yayinci_bekleyen(int) to authenticated;

create or replace function public.admin_yayinci_odeme_listeleri()
returns setof public.payout_batches
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  return query
    select * from public.payout_batches
    order by period_month desc, created_at desc
    limit 60;
end;
$$;

grant execute on function public.admin_yayinci_odeme_listeleri() to authenticated;

create or replace function public.admin_yayinci_odeme_listesi_detay(p_batch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_batch public.payout_batches%rowtype;
  v_items jsonb;
  v_approvals jsonb;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  select * into v_batch from public.payout_batches where id = p_batch_id;
  if not found then raise exception 'Not found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'creator_id', i.creator_id,
    'creator_name', coalesce(p.display_name, p.username),
    'country_code', coalesce(cpa.country_code, upper(coalesce(p.country_code, ''))),
    'amount_usd', i.amount_usd,
    'fee_usd', i.fee_usd,
    'net_usd', i.net_usd,
    'currency', i.currency,
    'status', i.status,
    'iban_masked', coalesce(cpa.iban_masked, r.iban_masked),
    'external_reference', i.external_reference,
    'sent_at', i.sent_at,
    'paid_at', i.paid_at,
    'request_status', r.status
  ) order by i.created_at), '[]'::jsonb) into v_items
  from public.payout_batch_items i
  join public.profiles p on p.id = i.creator_id
  left join public.creator_payout_accounts cpa on cpa.id = i.payout_account_id
  left join public.creator_payout_requests r on r.id = i.payout_request_id
  where i.batch_id = p_batch_id;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb) into v_approvals
  from public.payout_approvals a where a.batch_id = p_batch_id;

  return jsonb_build_object(
    'batch', to_jsonb(v_batch),
    'items', v_items,
    'approvals', v_approvals
  );
end;
$$;

grant execute on function public.admin_yayinci_odeme_listesi_detay(uuid) to authenticated;

create or replace function public.admin_yayinci_iade_listesi()
returns table (
  gift_transaction_id uuid,
  created_at timestamptz,
  sender_id uuid,
  creator_id uuid,
  creator_name text,
  coins bigint,
  coin_source text,
  gross_usd numeric,
  creator_usd numeric,
  refund_status text,
  review_status text,
  eligible boolean,
  reason text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select g.gift_transaction_id, g.created_at, g.sender_id, g.creator_id,
         coalesce(p.display_name, p.username)::text,
         g.coins, g.coin_source, g.gross_usd, g.creator_usd,
         g.refund_status, g.review_status, g.eligible, g.reason
  from public.gift_revenue_eligibility g
  left join public.profiles p on p.id = g.creator_id
  where public.ben_admin_miyim()
    and (g.refund_status <> 'none' or g.review_status <> 'clear' or not g.eligible)
  order by g.created_at desc
  limit 200;
$$;

grant execute on function public.admin_yayinci_iade_listesi() to authenticated;

create or replace function public.admin_yayinci_risk_listesi()
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  kind text,
  severity text,
  status text,
  details jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select f.id, f.user_id, coalesce(p.display_name, p.username)::text,
         f.kind, f.severity, f.status, f.details, f.created_at
  from public.finance_risk_flags f
  left join public.profiles p on p.id = f.user_id
  where public.ben_admin_miyim()
  order by f.created_at desc
  limit 200;
$$;

grant execute on function public.admin_yayinci_risk_listesi() to authenticated;

create or replace function public.admin_yayinci_itiraz_listesi()
returns table (
  id uuid,
  user_id uuid,
  user_name text,
  kind text,
  subject text,
  body text,
  status text,
  created_at timestamptz,
  resolved_at timestamptz,
  resolution_note text
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select d.id, d.user_id, coalesce(p.display_name, p.username)::text,
         d.kind, d.subject, d.body, d.status, d.created_at, d.resolved_at, d.resolution_note
  from public.payout_disputes d
  left join public.profiles p on p.id = d.user_id
  where public.ben_admin_miyim()
  order by d.created_at desc
  limit 200;
$$;

grant execute on function public.admin_yayinci_itiraz_listesi() to authenticated;

create or replace function public.admin_yayinci_itiraz_coz(
  p_dispute_id uuid,
  p_status text,
  p_note text
)
returns public.payout_disputes
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row public.payout_disputes%rowtype;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  if p_status not in ('reviewing', 'resolved', 'rejected') then raise exception 'invalid_status'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'note_required'; end if;

  update public.payout_disputes set
    status = p_status,
    resolution_note = p_note,
    resolved_by = case when p_status in ('resolved', 'rejected') then auth.uid() else resolved_by end,
    resolved_at = case when p_status in ('resolved', 'rejected') then now() else resolved_at end,
    updated_at = now()
  where id = p_dispute_id
  returning * into v_row;
  if not found then raise exception 'Not found'; end if;

  perform public.finans_denetim_yaz(
    auth.uid(), 'payout_dispute_' || p_status, 'payout_dispute', v_row.id,
    null, null, to_jsonb(v_row), jsonb_build_object('note', p_note)
  );

  return v_row;
end;
$$;

grant execute on function public.admin_yayinci_itiraz_coz(uuid, text, text) to authenticated;

create or replace function public.admin_yayinci_rapor(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_month date := public.odeme_ay_bas(coalesce(p_month, (now() at time zone 'UTC')::date));
  v_summary jsonb;
  v_channels jsonb;
  v_batches jsonb;
  v_created_count int;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;

  select jsonb_build_object(
    'period_month', v_month,
    'period_start', v_month,
    'period_end', public.odeme_ay_bit(v_month),
    'gift_count', count(*),
    'eligible_gift_count', count(*) filter (where e.eligible),
    'ineligible_gift_count', count(*) filter (where not e.eligible),
    'coins', coalesce(sum(e.coins), 0),
    'gift_revenue_usd', coalesce(sum(e.gross_usd) filter (where e.eligible), 0),
    'creator_usd', coalesce(sum(e.creator_usd) filter (where e.eligible), 0),
    'platform_usd', coalesce(sum(e.platform_usd) filter (where e.eligible), 0),
    'agency_usd', coalesce(sum(e.agency_usd) filter (where e.eligible), 0),
    'on_hold_usd', coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'on_hold'), 0),
    'refunded_count', count(*) filter (where e.ineligible_reason like 'refunded%'),
    'chargeback_count', count(*) filter (where e.ineligible_reason like 'refunded_chargeback%')
  ) into v_summary
  from public.creator_earning_entries e
  where e.period_start = v_month;

  select coalesce(jsonb_object_agg(channel, total), '{}'::jsonb) into v_channels
  from (
    select e.channel, sum(e.creator_usd)::numeric(14,4) as total
    from public.creator_earning_entries e
    where e.period_start = v_month and e.eligible
    group by e.channel
  ) c;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at desc), '[]'::jsonb) into v_batches
  from public.payout_batches b where b.period_month = v_month;

  select count(*) into v_created_count from public.creator_earning_entries
  where period_start = v_month;

  return v_summary || jsonb_build_object(
    'channels', v_channels,
    'batches', v_batches,
    'generated_at', now(),
    'entry_count', v_created_count
  );
end;
$$;

grant execute on function public.admin_yayinci_rapor(date) to authenticated;

-- ---------------------------------------------------------------------------
-- 12) Admin ayarları (denetimli; geçmiş kayıtları etkilemez)
-- ---------------------------------------------------------------------------

create or replace function public.admin_yayinci_odeme_ayarlari_getir()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_cfg public.platform_economy_config%rowtype;
  v_countries jsonb;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  select * into v_cfg from public.platform_economy_config where id = 1;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.country_code, c.method), '[]'::jsonb) into v_countries
  from public.country_payout_methods c;

  return jsonb_build_object(
    'creator_share', coalesce(v_cfg.creator_share, 0.40),
    'platform_share', 1 - coalesce(v_cfg.creator_share, 0.40),
    'revenue_usd_per_coin', coalesce(v_cfg.revenue_usd_per_coin, 0.005),
    'payout_min_usd', coalesce(v_cfg.payout_min_usd, 25.00),
    'payout_day', coalesce(v_cfg.payout_day, 15),
    'payout_transfer_fee_usd', coalesce(v_cfg.payout_transfer_fee_usd, 0),
    'payout_auto_transfer_enabled', coalesce(v_cfg.payout_auto_transfer_enabled, false),
    'settlement_mode', coalesce(v_cfg.settlement_mode, 'monthly'),
    'updated_at', v_cfg.updated_at,
    'countries', v_countries,
    'holidays', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', h.id, 'country_code', h.country_code, 'holiday_date', h.holiday_date, 'name', h.name
      ) order by h.holiday_date), '[]'::jsonb)
      from public.bank_holidays h where h.holiday_date >= current_date
    )
  );
end;
$$;

grant execute on function public.admin_yayinci_odeme_ayarlari_getir() to authenticated;

create or replace function public.admin_yayinci_odeme_ayarlari_guncelle(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cfg public.platform_economy_config%rowtype;
  v_before jsonb;
  v_share numeric;
  v_min numeric;
  v_day int;
  v_fee numeric;
  v_auto boolean;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  select * into v_cfg from public.platform_economy_config where id = 1 for update;
  v_before := to_jsonb(v_cfg);

  v_share := coalesce((p_payload->>'creator_share')::numeric, v_cfg.creator_share);
  v_min := coalesce((p_payload->>'payout_min_usd')::numeric, v_cfg.payout_min_usd);
  v_day := coalesce((p_payload->>'payout_day')::int, v_cfg.payout_day, 15);
  v_fee := coalesce((p_payload->>'payout_transfer_fee_usd')::numeric, v_cfg.payout_transfer_fee_usd);
  v_auto := coalesce((p_payload->>'payout_auto_transfer_enabled')::boolean, v_cfg.payout_auto_transfer_enabled);

  if v_share is null or v_share <= 0 or v_share >= 1 then raise exception 'invalid_creator_share'; end if;
  if v_min is null or v_min <= 0 then raise exception 'invalid_minimum'; end if;
  if v_day < 1 or v_day > 28 then raise exception 'invalid_payout_day'; end if;
  if v_fee is null or v_fee < 0 or v_fee >= v_min then raise exception 'invalid_fee'; end if;
  if v_auto then
    -- Otomatik transfer yalnızca en az bir ülke için sağlayıcı + otomatik ödeme açıksa.
    if not exists (
      select 1 from public.country_payout_methods
      where is_enabled and auto_payout and coalesce(provider, '') <> ''
    ) then
      raise exception 'auto_transfer_provider_missing';
    end if;
  end if;

  update public.platform_economy_config set
    creator_share = v_share,
    payout_min_usd = v_min,
    payout_day = v_day::smallint,
    payout_transfer_fee_usd = v_fee,
    payout_auto_transfer_enabled = v_auto,
    updated_at = now()
  where id = 1;

  perform public.finans_denetim_yaz(
    auth.uid(), 'payout_settings_updated', 'platform_economy_config', null,
    null, v_before, (select to_jsonb(c) from public.platform_economy_config c where c.id = 1),
    jsonb_build_object('payload', p_payload)
  );

  return public.admin_yayinci_odeme_ayarlari_getir();
end;
$$;

grant execute on function public.admin_yayinci_odeme_ayarlari_guncelle(jsonb) to authenticated;

create or replace function public.admin_ulke_odeme_yontemi_kaydet(
  p_country_code text,
  p_method text,
  p_payload jsonb
)
returns public.country_payout_methods
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row public.country_payout_methods%rowtype;
  v_before jsonb;
  v_country text := upper(trim(p_country_code));
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  if v_country !~ '^[A-Z]{2}$' then raise exception 'invalid_country'; end if;
  if p_method not in ('bank_transfer', 'local_transfer', 'wallet_transfer') then
    raise exception 'invalid_method';
  end if;

  select to_jsonb(c) into v_before from public.country_payout_methods c
  where c.country_code = v_country and c.method = p_method;

  insert into public.country_payout_methods (
    country_code, method, provider, currency, min_payout_usd, is_enabled,
    auto_payout, requires_kyc, requires_tax_info, requirements, note
  ) values (
    v_country, p_method,
    nullif(trim(p_payload->>'provider'), ''),
    upper(coalesce(nullif(trim(p_payload->>'currency'), ''), 'USD')),
    coalesce((p_payload->>'min_payout_usd')::numeric, 25.00),
    coalesce((p_payload->>'is_enabled')::boolean, false),
    coalesce((p_payload->>'auto_payout')::boolean, false),
    coalesce((p_payload->>'requires_kyc')::boolean, true),
    coalesce((p_payload->>'requires_tax_info')::boolean, true),
    coalesce(p_payload->'requirements', '{}'::jsonb),
    nullif(trim(p_payload->>'note'), '')
  )
  on conflict (country_code, method) do update set
    provider = excluded.provider,
    currency = excluded.currency,
    min_payout_usd = excluded.min_payout_usd,
    is_enabled = excluded.is_enabled,
    auto_payout = excluded.auto_payout,
    requires_kyc = excluded.requires_kyc,
    requires_tax_info = excluded.requires_tax_info,
    requirements = excluded.requirements,
    note = excluded.note,
    updated_at = now()
  returning * into v_row;

  perform public.finans_denetim_yaz(
    auth.uid(), 'country_payout_method_updated', 'country_payout_method', v_row.id,
    v_row.min_payout_usd, v_before, to_jsonb(v_row), '{}'::jsonb
  );

  return v_row;
end;
$$;

grant execute on function public.admin_ulke_odeme_yontemi_kaydet(text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 13) Yayıncı kazanç düzeltmesi (gerekçeli, ters kayıt)
-- ---------------------------------------------------------------------------

create or replace function public.admin_yayinci_kazanc_duzelt(
  p_creator_id uuid,
  p_amount_usd numeric,
  p_kind text,
  p_reason text,
  p_earning_id uuid default null
)
returns public.creator_earning_adjustments
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row public.creator_earning_adjustments%rowtype;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  if p_amount_usd = 0 then raise exception 'invalid_amount'; end if;
  if p_kind not in ('correction', 'fee', 'dispute') then raise exception 'invalid_kind'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  if p_earning_id is not null and not exists (
    select 1 from public.creator_earning_entries where id = p_earning_id and creator_id = p_creator_id
  ) then
    raise exception 'Forbidden';
  end if;

  insert into public.creator_earning_adjustments (
    creator_id, earning_id, amount_usd, kind, reason, actor_id
  ) values (
    p_creator_id, p_earning_id, p_amount_usd, p_kind, p_reason, auth.uid()
  ) returning * into v_row;

  perform public.finans_denetim_yaz(
    auth.uid(), 'creator_earning_adjusted', 'creator_earning_adjustment', v_row.id,
    p_amount_usd, null, to_jsonb(v_row), jsonb_build_object('reason', p_reason)
  );

  return v_row;
end;
$$;

grant execute on function public.admin_yayinci_kazanc_duzelt(uuid, numeric, text, text, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 14) Yayıncı programa kabul / askı (admin)
-- ---------------------------------------------------------------------------

create or replace function public.admin_yayinci_program_durum(
  p_user_id uuid,
  p_status text,
  p_note text default null
)
returns public.creator_program_enrollments
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row public.creator_program_enrollments%rowtype;
  v_before jsonb;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  if p_status not in ('approved', 'suspended', 'rejected', 'applied', 'withdrawn') then
    raise exception 'invalid_status';
  end if;
  if p_status in ('suspended', 'rejected') and coalesce(trim(p_note), '') = '' then
    raise exception 'note_required';
  end if;

  select to_jsonb(e) into v_before from public.creator_program_enrollments e where e.user_id = p_user_id;
  if v_before is null then raise exception 'Not found'; end if;

  update public.creator_program_enrollments set
    status = p_status,
    approved_at = case when p_status = 'approved' then now() else approved_at end,
    approved_by = case when p_status = 'approved' then auth.uid() else approved_by end,
    rejection_reason = case when p_status = 'rejected' then p_note else rejection_reason end,
    suspended_reason = case when p_status = 'suspended' then p_note else suspended_reason end,
    updated_at = now()
  where user_id = p_user_id
  returning * into v_row;

  perform public.finans_denetim_yaz(
    auth.uid(), 'creator_program_' || p_status, 'creator_enrollment', p_user_id,
    null, v_before, to_jsonb(v_row), jsonb_build_object('note', p_note)
  );

  return v_row;
end;
$$;

grant execute on function public.admin_yayinci_program_durum(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 15) Ülke bazlı ödeme uygunluğu (mobil bilgilendirme)
-- ---------------------------------------------------------------------------

create or replace function public.yayinci_odeme_ulke_durumu(p_country_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_country text := upper(trim(coalesce(p_country_code, '')));
  v jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'method', c.method,
    'provider', c.provider,
    'currency', c.currency,
    'min_payout_usd', c.min_payout_usd,
    'is_enabled', c.is_enabled,
    'auto_payout', c.auto_payout
  ) order by c.method), '[]'::jsonb) into v
  from public.country_payout_methods c
  where c.country_code = v_country and c.is_enabled;

  return jsonb_build_object(
    'country_code', v_country,
    'supported', jsonb_array_length(v) > 0,
    'methods', v,
    'note', case when jsonb_array_length(v) = 0
      then 'Bu ülke için doğrulanmış ödeme kanalı bulunmuyor.'
      else null end
  );
end;
$$;

grant execute on function public.yayinci_odeme_ulke_durumu(text) to authenticated;
