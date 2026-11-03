-- =============================================================================
-- Yayıncı ödeme hesabı — ülke bazlı banka rehberi ve ayrıntılı alan kuralları
-- =============================================================================
-- Amaç: kullanıcı bir ülke seçtiğinde o ülkenin GERÇEK bankaları listeden
-- seçilir ve yalnızca o ülke/kanal için geçerli alanlar istenir.
--
--   * country_bank_directory  → ülke başına banka/cüzdan/ödeme ağı listesi
--   * country_payout_rules    → ülke başına para birimi ve IBAN kuralı
--   * country_payout_methods.requirements.fields → alan şeması (mevcut model)
--
-- Ödeme hâlâ manuel yapılır: bu dosya hiçbir ödeme sağlayıcısı çağırmaz.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Banka rehberi
-- ---------------------------------------------------------------------------
create table if not exists public.country_bank_directory (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null,
  code text not null,
  name text not null,
  short_name text,
  kind text not null default 'bank'
    check (kind in ('bank', 'wallet', 'network')),
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint country_bank_directory_code_check
    check (code ~ '^[a-z0-9_]{2,40}$'),
  constraint country_bank_directory_uniq unique (country_code, code)
);

create index if not exists country_bank_directory_lookup_idx
  on public.country_bank_directory (country_code, kind, sort_order, name)
  where is_active;

alter table public.country_bank_directory enable row level security;

drop policy if exists country_bank_directory_read on public.country_bank_directory;
create policy country_bank_directory_read on public.country_bank_directory
  for select to authenticated
  using (is_active or public.ben_admin_miyim());

drop policy if exists country_bank_directory_admin on public.country_bank_directory;
create policy country_bank_directory_admin on public.country_bank_directory
  for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

grant select on public.country_bank_directory to authenticated;

comment on table public.country_bank_directory is
  'Ülke bazlı banka/cüzdan listesi. Ödeme talimatı bu listeden seçilir; listede olmayan banka serbest metinle girilebilir.';

-- ---------------------------------------------------------------------------
-- 2) Ülke kuralları (para birimi + IBAN uzunluğu)
-- ---------------------------------------------------------------------------
create table if not exists public.country_payout_rules (
  country_code char(2) primary key,
  currency char(3) not null default 'USD',
  iban_length smallint,
  iban_example text,
  account_min_length smallint,
  account_max_length smallint,
  note text,
  updated_at timestamptz not null default now(),
  constraint country_payout_rules_iban_len_check
    check (iban_length is null or iban_length between 15 and 34)
);

alter table public.country_payout_rules enable row level security;

drop policy if exists country_payout_rules_read on public.country_payout_rules;
create policy country_payout_rules_read on public.country_payout_rules
  for select to authenticated using (true);

drop policy if exists country_payout_rules_admin on public.country_payout_rules;
create policy country_payout_rules_admin on public.country_payout_rules
  for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

grant select on public.country_payout_rules to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Yardımcılar
-- ---------------------------------------------------------------------------

/** Ülkenin IBAN uzunluğu (bilinmiyorsa null). */
create or replace function public.iban_ulke_uzunlugu(p_country text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select r.iban_length::int
  from public.country_payout_rules r
  where r.country_code = upper(trim(coalesce(p_country, '')));
$$;

grant execute on function public.iban_ulke_uzunlugu(text) to authenticated;

/**
 * IBAN'ı ülke kuralına göre doğrular.
 * Dönüş: null → geçerli, aksi halde hata kodu.
 */
create or replace function public.odeme_iban_dogrula(
  p_country text,
  p_iban text
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_ulke text := upper(trim(coalesce(p_country, '')));
  v_iban text := upper(regexp_replace(coalesce(p_iban, ''), '\s', '', 'g'));
  v_uzunluk int;
begin
  if v_iban = '' then
    return 'field_required:iban';
  end if;
  if v_iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then
    return 'invalid_iban';
  end if;
  if v_ulke ~ '^[A-Z]{2}$' and substr(v_iban, 1, 2) <> v_ulke then
    return 'iban_country_mismatch';
  end if;

  v_uzunluk := public.iban_ulke_uzunlugu(v_ulke);
  if v_uzunluk is not null and length(v_iban) <> v_uzunluk then
    return 'invalid_iban_length';
  end if;

  if not public.iban_gecerli_mi(v_iban) then
    return 'invalid_iban';
  end if;

  return null;
end;
$$;

grant execute on function public.odeme_iban_dogrula(text, text) to authenticated;

/** Banka kodunu rehbere göre çözer; bulunamazsa null. */
create or replace function public.odeme_banka_adi(
  p_country text,
  p_bank_code text,
  p_kind text default 'bank'
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select b.name
  from public.country_bank_directory b
  where b.country_code = upper(trim(coalesce(p_country, '')))
    and b.code = lower(trim(coalesce(p_bank_code, '')))
    and b.kind = coalesce(nullif(trim(p_kind), ''), 'bank')
    and b.is_active
  limit 1;
$$;

grant execute on function public.odeme_banka_adi(text, text, text) to authenticated;

/** Ülke + kanal için seçilebilir banka/cüzdan listesi (JSON). */
create or replace function public.odeme_banka_listesi(
  p_country text,
  p_kind text default 'bank'
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', b.code,
    'name', b.name,
    'short_name', b.short_name,
    'kind', b.kind
  ) order by b.sort_order, b.name), '[]'::jsonb)
  from public.country_bank_directory b
  where b.country_code = upper(trim(coalesce(p_country, '')))
    and b.kind = coalesce(nullif(trim(p_kind), ''), 'bank')
    and b.is_active;
$$;

grant execute on function public.odeme_banka_listesi(text, text) to authenticated;

-- Birincil hesap kimliği: maskeleme ve hash için kullanılır.
create or replace function public.odeme_detay_birincil_alan(p_details jsonb)
returns text
language sql
immutable
as $$
  select t.alan
  from unnest(array[
    'iban', 'account_number', 'clabe', 'cbu', 'cci', 'rib',
    'wallet_number', 'pix_key', 'account_id'
  ]) with ordinality as t(alan, sira)
  where coalesce(p_details ->> t.alan, '') <> ''
  order by t.sira
  limit 1;
$$;

-- Maskeleme listesine yeni hesap kimlikleri eklenir.
create or replace function public.odeme_detay_maskeli(p_details jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_object_agg(
      t.k,
      case
        when t.k in (
          'iban', 'account_number', 'wallet_number', 'clabe',
          'cbu', 'cci', 'rib', 'pix_key', 'account_id',
          'corr_account', 'routing_number', 'ifsc', 'transit_number'
        )
          then case when length(t.v) <= 4 then '****' else '****' || right(t.v, 4) end
        else t.v
      end
    ),
    '{}'::jsonb
  )
  from (
    select lower(e.k) as k, trim(e.v) as v
    from jsonb_each_text(coalesce(p_details, '{}'::jsonb)) as e(k, v)
    where trim(coalesce(e.v, '')) <> ''
  ) t;
$$;

-- ---------------------------------------------------------------------------
-- 4) Ülke / kanal alan şemaları
-- ---------------------------------------------------------------------------
insert into public.country_payout_methods (
  country_code, method, provider, currency, min_payout_usd, is_enabled,
  auto_payout, requires_kyc, requires_tax_info, requirements, note
)
select
  s.country_code,
  s.method,
  null,
  s.currency,
  25.00,
  s.is_enabled,
  false,
  true,
  true,
  jsonb_build_object(
    'scheme', s.scheme,
    'bank_name_required', s.bank_name_required,
    'fields', s.fields
  ),
  s.note
from (values
  -- ----------------------------- Avrupa (IBAN) -----------------------------
  ('TR', 'bank_transfer', 'iban', 'TRY', true, false,
   '[{"key":"iban","required":true,"example":"TR33 0006 1005 1978 6457 8413 26"}]'::jsonb,
   'Banka havalesi (IBAN). Ödeme manuel yapılır.'),
  ('DE', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"DE89 3704 0044 0532 0130 00"}]'::jsonb,
   'SEPA havalesi (IBAN).'),
  ('FR', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"FR76 3000 6000 0112 3456 7890 189"}]'::jsonb,
   'SEPA havalesi (IBAN).'),
  ('NL', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"NL91 ABNA 0417 1643 00"}]'::jsonb,
   'SEPA havalesi (IBAN).'),
  ('BE', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"BE68 5390 0754 7034"}]'::jsonb,
   'SEPA havalesi (IBAN).'),
  ('ES', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"ES91 2100 0418 4502 0005 1332"}]'::jsonb,
   'SEPA havalesi (IBAN).'),
  ('IT', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"IT60 X054 2811 1010 0000 0123 456"}]'::jsonb,
   'SEPA havalesi (IBAN).'),
  ('PT', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"PT50 0002 0123 1234 5678 9015 4"}]'::jsonb,
   'SEPA havalesi (IBAN).'),
  ('IE', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"IE29 AIBK 9311 5212 3456 78"}]'::jsonb,
   'SEPA havalesi (IBAN).'),
  ('AT', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"AT61 1904 3002 3457 3201"}]'::jsonb,
   'SEPA havalesi (IBAN).'),
  ('CH', 'bank_transfer', 'iban', 'CHF', true, false,
   '[{"key":"iban","required":true,"example":"CH93 0076 2011 6238 5295 7"}]'::jsonb,
   'IBAN havalesi.'),
  ('SE', 'bank_transfer', 'iban', 'SEK', true, false,
   '[{"key":"iban","required":true,"example":"SE45 5000 0000 0583 9825 7466"}]'::jsonb,
   'IBAN havalesi.'),
  ('NO', 'bank_transfer', 'iban', 'NOK', true, false,
   '[{"key":"iban","required":true,"example":"NO93 8601 1117 947"}]'::jsonb,
   'IBAN havalesi.'),
  ('DK', 'bank_transfer', 'iban', 'DKK', true, false,
   '[{"key":"iban","required":true,"example":"DK50 0040 0440 1162 43"}]'::jsonb,
   'IBAN havalesi.'),
  ('FI', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"FI21 1234 5600 0007 85"}]'::jsonb,
   'IBAN havalesi.'),
  ('PL', 'bank_transfer', 'iban', 'PLN', true, false,
   '[{"key":"iban","required":true,"example":"PL61 1090 1014 0000 0712 1981 2874"}]'::jsonb,
   'IBAN havalesi.'),
  ('CZ', 'bank_transfer', 'iban', 'CZK', true, false,
   '[{"key":"iban","required":true,"example":"CZ65 0800 0000 1920 0014 5399"}]'::jsonb,
   'IBAN havalesi.'),
  ('HU', 'bank_transfer', 'iban', 'HUF', true, false,
   '[{"key":"iban","required":true,"example":"HU42 1177 3016 1111 1018 0000 0000"}]'::jsonb,
   'IBAN havalesi.'),
  ('RO', 'bank_transfer', 'iban', 'RON', true, false,
   '[{"key":"iban","required":true,"example":"RO49 AAAA 1B31 0075 9384 0000"}]'::jsonb,
   'IBAN havalesi.'),
  ('BG', 'bank_transfer', 'iban', 'BGN', true, false,
   '[{"key":"iban","required":true,"example":"BG80 BNBG 9661 1020 3456 78"}]'::jsonb,
   'IBAN havalesi.'),
  ('HR', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"HR12 1001 0051 8630 0016 0"}]'::jsonb,
   'IBAN havalesi.'),
  ('GR', 'bank_transfer', 'iban', 'EUR', true, false,
   '[{"key":"iban","required":true,"example":"GR16 0110 1250 0000 0001 2300 695"}]'::jsonb,
   'IBAN havalesi.'),
  ('RS', 'bank_transfer', 'iban', 'RSD', true, false,
   '[{"key":"iban","required":true,"example":"RS35 2600 0560 1001 6113 79"}]'::jsonb,
   'IBAN havalesi.'),
  ('UA', 'bank_transfer', 'iban', 'UAH', true, false,
   '[{"key":"iban","required":true,"example":"UA21 3223 1300 0002 6007 2335 6600 1"}]'::jsonb,
   'IBAN havalesi.'),
  ('KZ', 'bank_transfer', 'iban', 'KZT', true, false,
   '[{"key":"iban","required":true,"example":"KZ86 125K ZT50 0410 0100"}]'::jsonb,
   'IBAN havalesi.'),
  ('AZ', 'bank_transfer', 'iban', 'AZN', true, false,
   '[{"key":"iban","required":true,"example":"AZ21 NABZ 0000 0000 1370 1000 1944"}]'::jsonb,
   'IBAN havalesi.'),
  ('GE', 'bank_transfer', 'iban', 'GEL', true, false,
   '[{"key":"iban","required":true,"example":"GE29 NB00 0000 0101 9049 17"}]'::jsonb,
   'IBAN havalesi.'),

  -- ----------------------------- Orta Doğu / Körfez -----------------------------
  ('AE', 'bank_transfer', 'iban', 'AED', true, false,
   '[{"key":"iban","required":true,"example":"AE07 0331 2345 6789 0123 456"}]'::jsonb,
   'IBAN havalesi.'),
  ('SA', 'bank_transfer', 'iban', 'SAR', true, false,
   '[{"key":"iban","required":true,"example":"SA03 8000 0000 6080 1016 7519"}]'::jsonb,
   'IBAN havalesi.'),
  ('QA', 'bank_transfer', 'iban', 'QAR', true, false,
   '[{"key":"iban","required":true,"example":"QA58 DOHB 0000 1234 5678 90AB CDEF G"}]'::jsonb,
   'IBAN havalesi.'),
  ('KW', 'bank_transfer', 'iban', 'KWD', true, false,
   '[{"key":"iban","required":true,"example":"KW81 CBKU 0000 0000 0000 1234 5601 01"}]'::jsonb,
   'IBAN havalesi.'),
  ('IL', 'bank_transfer', 'iban', 'ILS', true, false,
   '[{"key":"iban","required":true,"example":"IL62 0108 0000 0009 9999 999"}]'::jsonb,
   'IBAN havalesi.'),
  ('EG', 'bank_transfer', 'iban', 'EGP', true, false,
   '[{"key":"iban","required":true,"example":"EG38 0019 0005 0000 0000 2631 8000 2"}]'::jsonb,
   'IBAN havalesi.'),
  ('MA', 'bank_transfer', 'iban', 'MAD', true, false,
   '[{"key":"iban","required":true,"example":"MA64 0111 0000 0000 0000 0000 001"}]'::jsonb,
   'IBAN havalesi.'),
  ('TN', 'bank_transfer', 'rib', 'TND', true, false,
   '[{"key":"rib","required":true,"pattern":"^[0-9]{20}$","max_length":20,"numeric":true,"example":"08001039154000663504"}]'::jsonb,
   'RIB (20 hane).'),
  ('DZ', 'bank_transfer', 'rib', 'DZD', true, false,
   '[{"key":"rib","required":true,"pattern":"^[0-9]{20}$","max_length":20,"numeric":true,"example":"00799999000000000001"}]'::jsonb,
   'RIB (20 hane).'),

  -- ----------------------------- Amerika -----------------------------
  ('US', 'bank_transfer', 'us_ach', 'USD', true, true,
   '[{"key":"routing_number","required":true,"pattern":"^[0-9]{9}$","max_length":9,"numeric":true,"example":"021000021"},
     {"key":"account_number","required":true,"pattern":"^[0-9]{4,17}$","max_length":17,"numeric":true},
     {"key":"account_type","required":true,"enum":["checking","savings"]},
     {"key":"swift_bic","required":false,"pattern":"^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$","max_length":11}]'::jsonb,
   'ACH / banka havalesi. Yurt dışı havalelerde SWIFT/BIC önerilir.'),
  ('CA', 'bank_transfer', 'local_account', 'CAD', true, true,
   '[{"key":"institution_number","required":true,"pattern":"^[0-9]{3}$","max_length":3,"numeric":true},
     {"key":"transit_number","required":true,"pattern":"^[0-9]{5}$","max_length":5,"numeric":true},
     {"key":"account_number","required":true,"pattern":"^[0-9]{5,16}$","max_length":16,"numeric":true},
     {"key":"account_type","required":true,"enum":["checking","savings"]}]'::jsonb,
   'EFT / banka havalesi.'),
  ('MX', 'bank_transfer', 'clabe', 'MXN', true, true,
   '[{"key":"clabe","required":true,"pattern":"^[0-9]{18}$","max_length":18,"numeric":true,"example":"032180000118359719"}]'::jsonb,
   'CLABE (18 hane).'),
  ('BR', 'bank_transfer', 'local_account', 'BRL', true, true,
   '[{"key":"agency","required":true,"pattern":"^[0-9]{3,6}$","max_length":6,"numeric":true},
     {"key":"account_number","required":true,"pattern":"^[0-9]{4,14}$","max_length":14,"numeric":true},
     {"key":"account_type","required":true,"enum":["checking","savings"]},
     {"key":"document_id","required":true,"max_length":20}]'::jsonb,
   'TED / banka havalesi (CPF/CNPJ gerekir).'),
  ('AR', 'bank_transfer', 'cbu', 'ARS', true, true,
   '[{"key":"cbu","required":true,"pattern":"^[0-9]{22}$","max_length":22,"numeric":true},
     {"key":"document_id","required":true,"max_length":20}]'::jsonb,
   'CBU/CVU (22 hane).'),
  ('CL', 'bank_transfer', 'local_account', 'CLP', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{6,20}$","max_length":20,"numeric":true},
     {"key":"account_type","required":true,"enum":["checking","savings","vista"]},
     {"key":"document_id","required":true,"max_length":20}]'::jsonb,
   'Banka havalesi (RUT gerekir).'),
  ('CO', 'bank_transfer', 'local_account', 'COP', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{6,20}$","max_length":20,"numeric":true},
     {"key":"account_type","required":true,"enum":["ahorros","corriente"]},
     {"key":"document_id","required":false,"max_length":20}]'::jsonb,
   'Yerel banka transferi.'),
  ('PE', 'bank_transfer', 'cci', 'PEN', true, true,
   '[{"key":"cci","required":true,"pattern":"^[0-9]{20}$","max_length":20,"numeric":true},
     {"key":"document_id","required":true,"max_length":20}]'::jsonb,
   'CCI (20 hane).'),
  ('VE', 'bank_transfer', 'local_account', 'VES', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{20}$","max_length":20,"numeric":true},
     {"key":"account_type","required":true,"enum":["corriente","ahorro"]},
     {"key":"document_id","required":true,"max_length":20}]'::jsonb,
   'Ödeme kısıtları olabilir; talimat inceleme ekibi tarafından doğrulanır.'),

  -- ----------------------------- Asya / Pasifik -----------------------------
  ('IN', 'bank_transfer', 'local_account', 'INR', true, true,
   '[{"key":"ifsc","required":true,"pattern":"^[A-Z]{4}0[A-Z0-9]{6}$","max_length":11,"example":"HDFC0001234"},
     {"key":"account_number","required":true,"pattern":"^[0-9]{9,18}$","max_length":18,"numeric":true}]'::jsonb,
   'NEFT/IMPS. IFSC kodu gerekir.'),
  ('PK', 'bank_transfer', 'iban', 'PKR', true, false,
   '[{"key":"iban","required":true,"example":"PK36 SCBL 0000 0011 2345 6702"}]'::jsonb,
   'IBAN havalesi.'),
  ('BD', 'bank_transfer', 'local_account', 'BDT', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{10,20}$","max_length":20,"numeric":true},
     {"key":"swift_bic","required":false,"pattern":"^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$","max_length":11}]'::jsonb,
   'Banka havalesi.'),
  ('LK', 'bank_transfer', 'local_account', 'LKR', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{8,20}$","max_length":20,"numeric":true},
     {"key":"swift_bic","required":false,"pattern":"^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$","max_length":11}]'::jsonb,
   'Banka havalesi.'),
  ('NP', 'bank_transfer', 'local_account', 'NPR', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{8,20}$","max_length":20,"numeric":true},
     {"key":"swift_bic","required":false,"pattern":"^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$","max_length":11}]'::jsonb,
   'Banka havalesi.'),
  ('ID', 'bank_transfer', 'local_account', 'IDR', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{6,20}$","max_length":20,"numeric":true}]'::jsonb,
   'BI-FAST / banka havalesi.'),
  ('MY', 'bank_transfer', 'local_account', 'MYR', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{6,20}$","max_length":20,"numeric":true}]'::jsonb,
   'DuitNow / banka havalesi.'),
  ('TH', 'bank_transfer', 'local_account', 'THB', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{10,15}$","max_length":15,"numeric":true}]'::jsonb,
   'PromptPay / banka havalesi.'),
  ('VN', 'bank_transfer', 'local_account', 'VND', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{6,20}$","max_length":20,"numeric":true}]'::jsonb,
   'NAPAS / banka havalesi.'),
  ('PH', 'bank_transfer', 'local_account', 'PHP', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{6,20}$","max_length":20,"numeric":true},
     {"key":"swift_bic","required":false,"pattern":"^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$","max_length":11}]'::jsonb,
   'InstaPay / PESONet / banka havalesi.'),
  ('JP', 'bank_transfer', 'local_account', 'JPY', true, true,
   '[{"key":"branch_code","required":true,"pattern":"^[0-9]{3}$","max_length":3,"numeric":true},
     {"key":"account_number","required":true,"pattern":"^[0-9]{7}$","max_length":7,"numeric":true},
     {"key":"account_type","required":true,"enum":["ordinary","checking"]}]'::jsonb,
   'Zengin (bank transfer). Şube kodu gerekir.'),
  ('KR', 'bank_transfer', 'local_account', 'KRW', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{8,16}$","max_length":16,"numeric":true}]'::jsonb,
   'Banka havalesi.'),
  ('AU', 'bank_transfer', 'local_account', 'AUD', true, true,
   '[{"key":"bsb","required":true,"pattern":"^[0-9]{6}$","max_length":6,"numeric":true,"example":"062000"},
     {"key":"account_number","required":true,"pattern":"^[0-9]{5,10}$","max_length":10,"numeric":true}]'::jsonb,
   'BSB + hesap numarası.'),
  ('NZ', 'bank_transfer', 'local_account', 'NZD', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{2}-?[0-9]{4}-?[0-9]{7}-?[0-9]{2,3}$","max_length":20}]'::jsonb,
   'Yerel hesap numarası (bank-şube-hesap-suffix).'),

  -- ----------------------------- Afrika -----------------------------
  ('NG', 'bank_transfer', 'local_account', 'NGN', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{10}$","max_length":10,"numeric":true,"example":"0123456789"}]'::jsonb,
   'NUBAN (10 hane).'),
  ('KE', 'bank_transfer', 'local_account', 'KES', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{6,20}$","max_length":20,"numeric":true}]'::jsonb,
   'Banka havalesi.'),
  ('GH', 'bank_transfer', 'local_account', 'GHS', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{10,20}$","max_length":20,"numeric":true}]'::jsonb,
   'Banka havalesi.'),
  ('ZA', 'bank_transfer', 'local_account', 'ZAR', true, true,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{6,13}$","max_length":13,"numeric":true},
     {"key":"account_type","required":true,"enum":["checking","savings"]}]'::jsonb,
   'EFT / banka havalesi.'),

  -- ----------------------------- Rusya / BDT -----------------------------
  ('RU', 'bank_transfer', 'local_account', 'RUB', true, true,
   '[{"key":"bic","required":true,"pattern":"^[0-9]{9}$","max_length":9,"numeric":true},
     {"key":"account_number","required":true,"pattern":"^[0-9]{20}$","max_length":20,"numeric":true},
     {"key":"corr_account","required":true,"pattern":"^[0-9]{20}$","max_length":20,"numeric":true}]'::jsonb,
   'БИК + hesap + muhabir hesap.'),

  -- ----------------------------- Cüzdan kanalları -----------------------------
  ('PH', 'wallet_transfer', 'wallet', 'PHP', false, true,
   '[{"key":"wallet_number","required":true,"pattern":"^[0-9]{10,13}$","max_length":13,"numeric":true}]'::jsonb,
   'Mobil cüzdan numarası (GCash, Maya, GrabPay...).'),
  ('ID', 'wallet_transfer', 'wallet', 'IDR', false, true,
   '[{"key":"wallet_number","required":true,"pattern":"^[0-9]{9,15}$","max_length":15,"numeric":true}]'::jsonb,
   'e-cüzdan numarası (GoPay, OVO, DANA...).'),
  ('MY', 'wallet_transfer', 'wallet', 'MYR', false, true,
   '[{"key":"wallet_number","required":true,"pattern":"^[0-9]{9,13}$","max_length":13,"numeric":true}]'::jsonb,
   'e-cüzdan numarası (Touch ''n Go, GrabPay...).'),
  ('TH', 'wallet_transfer', 'wallet', 'THB', false, true,
   '[{"key":"wallet_number","required":true,"pattern":"^[0-9]{9,13}$","max_length":13,"numeric":true}]'::jsonb,
   'e-cüzdan numarası (TrueMoney, ShopeePay...).'),
  ('VN', 'wallet_transfer', 'wallet', 'VND', false, true,
   '[{"key":"wallet_number","required":true,"pattern":"^[0-9]{9,13}$","max_length":13,"numeric":true}]'::jsonb,
   'e-cüzdan numarası (MoMo, ZaloPay...).'),
  ('IN', 'wallet_transfer', 'wallet', 'INR', false, true,
   '[{"key":"wallet_number","required":true,"pattern":"^[0-9]{10,13}$","max_length":13,"numeric":true}]'::jsonb,
   'UPI / cüzdan numarası.'),
  ('PK', 'wallet_transfer', 'wallet', 'PKR', false, true,
   '[{"key":"wallet_number","required":true,"pattern":"^[0-9]{10,13}$","max_length":13,"numeric":true}]'::jsonb,
   'Easypaisa / JazzCash numarası.'),
  ('KE', 'wallet_transfer', 'wallet', 'KES', false, true,
   '[{"key":"wallet_number","required":true,"pattern":"^[0-9]{9,13}$","max_length":13,"numeric":true}]'::jsonb,
   'M-Pesa / Airtel Money numarası.'),
  ('NG', 'wallet_transfer', 'wallet', 'NGN', false, true,
   '[{"key":"wallet_number","required":true,"pattern":"^[0-9]{10,13}$","max_length":13,"numeric":true}]'::jsonb,
   'OPay / PalmPay / Kuda numarası.'),
  ('BR', 'wallet_transfer', 'wallet', 'BRL', false, true,
   '[{"key":"pix_key","required":true,"max_length":77}]'::jsonb,
   'PIX anahtarı (CPF, e-posta, telefon veya rastgele anahtar).'),
  ('MX', 'wallet_transfer', 'wallet', 'MXN', false, true,
   '[{"key":"wallet_number","required":true,"pattern":"^[0-9]{10,13}$","max_length":13,"numeric":true}]'::jsonb,
   'Mercado Pago / Clip numarası.'),
  ('PE', 'wallet_transfer', 'wallet', 'PEN', false, true,
   '[{"key":"wallet_number","required":true,"pattern":"^[0-9]{9,13}$","max_length":13,"numeric":true}]'::jsonb,
   'Yape / Plin numarası.'),
  ('CO', 'wallet_transfer', 'wallet', 'COP', false, true,
   '[{"key":"wallet_number","required":true,"pattern":"^[0-9]{10,13}$","max_length":13,"numeric":true}]'::jsonb,
   'Nequi / Daviplata numarası.'),
  ('EG', 'wallet_transfer', 'wallet', 'EGP', false, true,
   '[{"key":"wallet_number","required":true,"pattern":"^[0-9]{10,13}$","max_length":13,"numeric":true}]'::jsonb,
   'Vodafone Cash / Etisalat Cash numarası.'),
  ('IL', 'wallet_transfer', 'wallet', 'ILS', false, true,
   '[{"key":"wallet_number","required":true,"pattern":"^[0-9]{9,13}$","max_length":13,"numeric":true}]'::jsonb,
   'Bit / PayBox numarası.'),
  ('JP', 'wallet_transfer', 'wallet', 'JPY', false, true,
   '[{"key":"wallet_number","required":true,"max_length":40}]'::jsonb,
   'PayPay / LINE Pay kimliği.'),
  ('BD', 'wallet_transfer', 'wallet', 'BDT', false, true,
   '[{"key":"wallet_number","required":true,"pattern":"^[0-9]{10,13}$","max_length":13,"numeric":true}]'::jsonb,
   'bKash / Nagad numarası.'),
  ('NP', 'wallet_transfer', 'wallet', 'NPR', false, true,
   '[{"key":"wallet_number","required":true,"pattern":"^[0-9]{9,13}$","max_length":13,"numeric":true}]'::jsonb,
   'eSewa / Khalti numarası.')
) as s(
  country_code, method, scheme, currency, bank_name_required, is_enabled, fields, note
)
on conflict (country_code, method) do update set
  provider = excluded.provider,
  currency = excluded.currency,
  is_enabled = excluded.is_enabled,
  requirements = excluded.requirements,
  note = excluded.note,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 5) Ülke kuralları (IBAN uzunluğu + para birimi)
-- ---------------------------------------------------------------------------
insert into public.country_payout_rules
  (country_code, currency, iban_length, iban_example)
values
  ('TR', 'TRY', 26, 'TR330006100519786457841326'),
  ('DE', 'EUR', 22, 'DE89370400440532013000'),
  ('FR', 'EUR', 27, 'FR7630006000011234567890189'),
  ('NL', 'EUR', 18, 'NL91ABNA0417164300'),
  ('BE', 'EUR', 16, 'BE68539007547034'),
  ('ES', 'EUR', 24, 'ES9121000418450200051332'),
  ('IT', 'EUR', 27, 'IT60X0542811101000000123456'),
  ('PT', 'EUR', 25, 'PT50000201231234567890154'),
  ('IE', 'EUR', 22, 'IE29AIBK93115212345678'),
  ('AT', 'EUR', 20, 'AT611904300234573201'),
  ('CH', 'CHF', 21, 'CH9300762011623852957'),
  ('SE', 'SEK', 24, 'SE4550000000058398257466'),
  ('NO', 'NOK', 15, 'NO9386011117947'),
  ('DK', 'DKK', 18, 'DK5000400440116243'),
  ('FI', 'EUR', 18, 'FI2112345600000785'),
  ('PL', 'PLN', 28, 'PL61109010140000071219812874'),
  ('CZ', 'CZK', 24, 'CZ6508000000192000145399'),
  ('HU', 'HUF', 28, 'HU42117730161111101800000000'),
  ('RO', 'RON', 24, 'RO49AAAA1B31007593840000'),
  ('BG', 'BGN', 22, 'BG80BNBG96611020345678'),
  ('HR', 'EUR', 21, 'HR1210010051863000160'),
  ('GR', 'EUR', 27, 'GR1601101250000000012300695'),
  ('RS', 'RSD', 22, 'RS35260005601001611379'),
  ('UA', 'UAH', 29, 'UA213223130000026007233566001'),
  ('KZ', 'KZT', 20, 'KZ86125KZT5004100100'),
  ('AZ', 'AZN', 28, 'AZ21NABZ00000000137010001944'),
  ('GE', 'GEL', 22, 'GE29NB0000000101904917'),
  ('AE', 'AED', 23, 'AE070331234567890123456'),
  ('SA', 'SAR', 24, 'SA0380000000608010167519'),
  ('QA', 'QAR', 29, 'QA58DOHB00001234567890ABCDEFG'),
  ('KW', 'KWD', 30, 'KW81CBKU0000000000001234560101'),
  ('IL', 'ILS', 23, 'IL620108000000099999999'),
  ('EG', 'EGP', 29, 'EG38001900050000000000263180002'),
  ('MA', 'MAD', 28, 'MA6401110000000000000000001'),
  ('PK', 'PKR', 24, 'PK36SCBL0000001123456702'),
  ('TN', 'TND', null, null),
  ('DZ', 'DZD', null, null),
  ('US', 'USD', null, null),
  ('CA', 'CAD', null, null),
  ('MX', 'MXN', null, null),
  ('BR', 'BRL', null, null),
  ('AR', 'ARS', null, null),
  ('CL', 'CLP', null, null),
  ('CO', 'COP', null, null),
  ('PE', 'PEN', null, null),
  ('VE', 'VES', null, null),
  ('IN', 'INR', null, null),
  ('BD', 'BDT', null, null),
  ('LK', 'LKR', null, null),
  ('NP', 'NPR', null, null),
  ('ID', 'IDR', null, null),
  ('MY', 'MYR', null, null),
  ('TH', 'THB', null, null),
  ('VN', 'VND', null, null),
  ('PH', 'PHP', null, null),
  ('JP', 'JPY', null, null),
  ('KR', 'KRW', null, null),
  ('AU', 'AUD', null, null),
  ('NZ', 'NZD', null, null),
  ('NG', 'NGN', null, null),
  ('KE', 'KES', null, null),
  ('GH', 'GHS', null, null),
  ('ZA', 'ZAR', null, null),
  ('RU', 'RUB', null, null)
on conflict (country_code) do update set
  currency = excluded.currency,
  iban_length = excluded.iban_length,
  iban_example = excluded.iban_example,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 6) Banka / cüzdan rehberi tohum verisi
-- ---------------------------------------------------------------------------
insert into public.country_bank_directory (country_code, code, name, short_name, kind, sort_order)
values
  -- Türkiye
  ('TR','ziraat','Ziraat Bankası','Ziraat','bank',10),
  ('TR','isbank','Türkiye İş Bankası','İş Bankası','bank',20),
  ('TR','garanti','Garanti BBVA','Garanti','bank',30),
  ('TR','yapikredi','Yapı ve Kredi Bankası','Yapı Kredi','bank',40),
  ('TR','akbank','Akbank','Akbank','bank',50),
  ('TR','halkbank','Türkiye Halk Bankası','Halkbank','bank',60),
  ('TR','vakifbank','Türkiye Vakıflar Bankası','Vakıfbank','bank',70),
  ('TR','qnb','QNB Finansbank','QNB','bank',80),
  ('TR','denizbank','DenizBank','DenizBank','bank',90),
  ('TR','teb','Türk Ekonomi Bankası','TEB','bank',100),
  ('TR','ing','ING Türkiye','ING','bank',110),
  ('TR','hsbc','HSBC Türkiye','HSBC','bank',120),
  ('TR','kuveytturk','Kuveyt Türk Katılım Bankası','Kuveyt Türk','bank',130),
  ('TR','albaraka','Albaraka Türk Katılım Bankası','Albaraka','bank',140),
  ('TR','ziraatkatilim','Ziraat Katılım Bankası','Ziraat Katılım','bank',150),
  ('TR','papara','Papara','Papara','wallet',200),
  -- Almanya
  ('DE','deutschebank','Deutsche Bank','Deutsche Bank','bank',10),
  ('DE','commerzbank','Commerzbank','Commerzbank','bank',20),
  ('DE','postbank','Postbank','Postbank','bank',30),
  ('DE','hypovereinsbank','HypoVereinsbank','HVB','bank',40),
  ('DE','ing','ING-DiBa','ING','bank',50),
  ('DE','n26','N26','N26','bank',60),
  ('DE','dkb','Deutsche Kreditbank (DKB)','DKB','bank',70),
  ('DE','comdirect','comdirect bank','comdirect','bank',80),
  ('DE','targobank','TARGOBANK','TARGOBANK','bank',90),
  ('DE','sparkasse','Sparkasse (yerel)','Sparkasse','bank',100),
  ('DE','volksbank','Volksbank / Raiffeisenbank (yerel)','Volksbank','bank',110),
  -- Fransa
  ('FR','bnp','BNP Paribas','BNP','bank',10),
  ('FR','societegenerale','Société Générale','Société Générale','bank',20),
  ('FR','creditagricole','Crédit Agricole','Crédit Agricole','bank',30),
  ('FR','creditmutuel','Crédit Mutuel','Crédit Mutuel','bank',40),
  ('FR','bpce','Banque Populaire / Caisse d''Épargne','BPCE','bank',50),
  ('FR','laposte','La Banque Postale','La Banque Postale','bank',60),
  ('FR','lcl','LCL','LCL','bank',70),
  ('FR','cic','CIC','CIC','bank',80),
  ('FR','boursorama','BoursoBank','BoursoBank','bank',90),
  ('FR','hello','Hello bank!','Hello bank','bank',100),
  -- Hollanda
  ('NL','ing','ING','ING','bank',10),
  ('NL','rabobank','Rabobank','Rabobank','bank',20),
  ('NL','abnamro','ABN AMRO','ABN AMRO','bank',30),
  ('NL','sns','SNS Bank','SNS','bank',40),
  ('NL','asn','ASN Bank','ASN','bank',50),
  ('NL','triodos','Triodos Bank','Triodos','bank',60),
  ('NL','bunq','bunq','bunq','bank',70),
  ('NL','knab','Knab','Knab','bank',80),
  ('NL','vanlanschot','Van Lanschot Kempen','Van Lanschot','bank',90),
  -- Belçika
  ('BE','belfius','Belfius Bank','Belfius','bank',10),
  ('BE','kbc','KBC Bank','KBC','bank',20),
  ('BE','bnpafortis','BNP Paribas Fortis','BNP Fortis','bank',30),
  ('BE','ing','ING België','ING','bank',40),
  ('BE','argenta','Argenta','Argenta','bank',50),
  ('BE','crelan','Crelan','Crelan','bank',60),
  ('BE','axa','AXA Bank Belgium','AXA Bank','bank',70),
  ('BE','beobank','Beobank','Beobank','bank',80),
  -- İspanya
  ('ES','santander','Banco Santander','Santander','bank',10),
  ('ES','bbva','BBVA','BBVA','bank',20),
  ('ES','caixabank','CaixaBank','CaixaBank','bank',30),
  ('ES','sabadell','Banco Sabadell','Sabadell','bank',40),
  ('ES','bankinter','Bankinter','Bankinter','bank',50),
  ('ES','abanca','Abanca','Abanca','bank',60),
  ('ES','kutxabank','Kutxabank','Kutxabank','bank',70),
  ('ES','unicaja','Unicaja Banco','Unicaja','bank',80),
  ('ES','ing','ING España','ING','bank',90),
  ('ES','openbank','Openbank','Openbank','bank',100),
  -- İtalya
  ('IT','intesa','Intesa Sanpaolo','Intesa','bank',10),
  ('IT','unicredit','UniCredit','UniCredit','bank',20),
  ('IT','bpm','Banco BPM','BPM','bank',30),
  ('IT','bper','BPER Banca','BPER','bank',40),
  ('IT','mps','Banca Monte dei Paschi di Siena','MPS','bank',50),
  ('IT','creditagricole','Crédit Agricole Italia','Crédit Agricole','bank',60),
  ('IT','poste','Poste Italiane (BancoPosta)','BancoPosta','bank',70),
  ('IT','mediolanum','Banca Mediolanum','Mediolanum','bank',80),
  ('IT','fineco','FinecoBank','Fineco','bank',90),
  -- Portekiz
  ('PT','caixa','Caixa Geral de Depósitos','CGD','bank',10),
  ('PT','millennium','Banco Millennium BCP','Millennium','bank',20),
  ('PT','novobanco','Novo Banco','Novo Banco','bank',30),
  ('PT','santander','Santander Totta','Santander','bank',40),
  ('PT','bpi','Banco BPI','BPI','bank',50),
  ('PT','montepio','Banco Montepio','Montepio','bank',60),
  -- Polonya
  ('PL','pkobp','PKO Bank Polski','PKO BP','bank',10),
  ('PL','pekao','Bank Pekao','Pekao','bank',20),
  ('PL','santander','Santander Bank Polska','Santander','bank',30),
  ('PL','mbank','mBank','mBank','bank',40),
  ('PL','ing','ING Bank Śląski','ING','bank',50),
  ('PL','bnpparibas','BNP Paribas Bank Polska','BNP Paribas','bank',60),
  ('PL','alior','Alior Bank','Alior','bank',70),
  ('PL','millennium','Bank Millennium','Millennium','bank',80),
  -- Romanya
  ('RO','bcr','Banca Comercială Română','BCR','bank',10),
  ('RO','brd','BRD - Groupe Société Générale','BRD','bank',20),
  ('RO','btl','Banca Transilvania','BT','bank',30),
  ('RO','raiffeisen','Raiffeisen Bank România','Raiffeisen','bank',40),
  ('RO','ing','ING Bank România','ING','bank',50),
  ('RO','unicredit','UniCredit Bank România','UniCredit','bank',60),
  ('RO','cec','CEC Bank','CEC','bank',70),
  -- İsveç
  ('SE','swedbank','Swedbank','Swedbank','bank',10),
  ('SE','handelsbanken','Svenska Handelsbanken','Handelsbanken','bank',20),
  ('SE','seb','Skandinaviska Enskilda Banken (SEB)','SEB','bank',30),
  ('SE','nordea','Nordea','Nordea','bank',40),
  ('SE','lansforsakringar','Länsförsäkringar Bank','Länsförsäkringar','bank',50),
  ('SE','ica','ICA Banken','ICA Banken','bank',60),
  ('SE','klarna','Klarna','Klarna','bank',70),
  -- İsviçre
  ('CH','ubs','UBS','UBS','bank',10),
  ('CH','zkb','Zürcher Kantonalbank','ZKB','bank',20),
  ('CH','postfinance','PostFinance','PostFinance','bank',30),
  ('CH','raiffeisen','Raiffeisen Schweiz','Raiffeisen','bank',40),
  ('CH','migros','Migros Bank','Migros Bank','bank',50),
  ('CH','neon','neon','neon','bank',60),
  -- Avusturya
  ('AT','erstebank','Erste Bank','Erste','bank',10),
  ('AT','raiffeisen','Raiffeisen Bank International','Raiffeisen','bank',20),
  ('AT','bankaustria','Bank Austria','Bank Austria','bank',30),
  ('AT','bawag','BAWAG Group','BAWAG','bank',40),
  ('AT','oberbank','Oberbank','Oberbank','bank',50),
  -- İrlanda
  ('IE','aib','Allied Irish Banks (AIB)','AIB','bank',10),
  ('IE','boi','Bank of Ireland','Bank of Ireland','bank',20),
  ('IE','ptsb','Permanent TSB','PTSB','bank',30),
  ('IE','avant','Avant Money','Avant','bank',40),
  -- Danimarka
  ('DK','danskebank','Danske Bank','Danske','bank',10),
  ('DK','nordea','Nordea Danmark','Nordea','bank',20),
  ('DK','jyske','Jyske Bank','Jyske','bank',30),
  ('DK','sydbank','Sydbank','Sydbank','bank',40),
  ('DK','nykredit','Nykredit','Nykredit','bank',50),
  ('DK','lunar','Lunar','Lunar','bank',60),
  -- Norveç
  ('NO','dnb','DNB','DNB','bank',10),
  ('NO','nordea','Nordea Norge','Nordea','bank',20),
  ('NO','sbanken','Sbanken','Sbanken','bank',30),
  ('NO','danskebank','Danske Bank Norge','Danske','bank',40),
  ('NO','sparebank1','SpareBank 1 (yerel)','SpareBank 1','bank',50),
  -- Finlandiya
  ('FI','op','Osuuspankki (OP)','OP','bank',10),
  ('FI','nordea','Nordea Suomi','Nordea','bank',20),
  ('FI','danskebank','Danske Bank Suomi','Danske','bank',30),
  ('FI','aktia','Aktia','Aktia','bank',40),
  ('FI','saastopankki','Säästöpankki','Säästöpankki','bank',50),
  -- Çekya
  ('CZ','ceska','Česká spořitelna','Spořitelna','bank',10),
  ('CZ','kb','Komerční banka','KB','bank',20),
  ('CZ','csob','ČSOB','ČSOB','bank',30),
  ('CZ','moneta','Moneta Money Bank','Moneta','bank',40),
  ('CZ','rb','Raiffeisenbank','Raiffeisen','bank',50),
  ('CZ','airbank','Air Bank','Air Bank','bank',60),
  ('CZ','fio','Fio banka','Fio','bank',70),
  -- Macaristan
  ('HU','otp','OTP Bank','OTP','bank',10),
  ('HU','kh','K&H Bank','K&H','bank',20),
  ('HU','erste','Erste Bank Hungary','Erste','bank',30),
  ('HU','raiffeisen','Raiffeisen Bank','Raiffeisen','bank',40),
  ('HU','unicredit','UniCredit Bank Hungary','UniCredit','bank',50),
  ('HU','cib','CIB Bank','CIB','bank',60),
  ('HU','mbh','MBH Bank','MBH','bank',70),
  -- Bulgaristan
  ('BG','unicredit','UniCredit Bulbank','Bulbank','bank',10),
  ('BG','dsb','DSK Bank','DSK','bank',20),
  ('BG','fibank','Bulgarian Fibank','Fibank','bank',30),
  ('BG','raiffeisen','Raiffeisenbank Bulgaria','Raiffeisen','bank',40),
  ('BG','postbank','Postbank Bulgaria','Postbank','bank',50),
  -- Hırvatistan
  ('HR','zaba','Zagrebačka banka','ZABA','bank',10),
  ('HR','pbz','Privredna banka Zagreb','PBZ','bank',20),
  ('HR','otp','OTP banka Hrvatska','OTP','bank',30),
  ('HR','erste','Erste & Steiermärkische Bank','Erste','bank',40),
  ('HR','rba','Raiffeisenbank Austria','RBA','bank',50),
  ('HR','hpb','Hrvatska poštanska banka','HPB','bank',60),
  -- Sırbistan
  ('RS','intesa','Banca Intesa Beograd','Intesa','bank',10),
  ('RS','unicredit','UniCredit Bank Srbija','UniCredit','bank',20),
  ('RS','nlb','NLB Komercijalna banka','NLB','bank',30),
  ('RS','raiffeisen','Raiffeisen banka','Raiffeisen','bank',40),
  ('RS','otp','OTP banka Srbija','OTP','bank',50),
  ('RS','halkbank','Halkbank Srbija','Halkbank','bank',60),
  -- Yunanistan
  ('GR','nbg','National Bank of Greece','NBG','bank',10),
  ('GR','alpha','Alpha Bank','Alpha','bank',20),
  ('GR','eurobank','Eurobank','Eurobank','bank',30),
  ('GR','piraeus','Piraeus Bank','Piraeus','bank',40),
  ('GR','attica','Attica Bank','Attica','bank',50),
  -- Ukrayna
  ('UA','privatbank','PrivatBank','PrivatBank','bank',10),
  ('UA','oschadbank','Oschadbank','Oschad','bank',20),
  ('UA','ukreximbank','Ukreximbank','Ukrexim','bank',30),
  ('UA','raiffeisen','Raiffeisen Bank','Raiffeisen','bank',40),
  ('UA','ukrgasbank','Ukrgasbank','Ukrgasbank','bank',50),
  ('UA','pumb','First Ukrainian International Bank (PUMB)','PUMB','bank',60),
  ('UA','monobank','monobank','monobank','bank',70),
  -- Kazakistan
  ('KZ','kaspi','Kaspi Bank','Kaspi','bank',10),
  ('KZ','halyk','Halyk Bank','Halyk','bank',20),
  ('KZ','forte','ForteBank','ForteBank','bank',30),
  ('KZ','jusan','Jusan Bank','Jusan','bank',40),
  ('KZ','bereke','Bereke Bank','Bereke','bank',50),
  ('KZ','freedom','Freedom Bank','Freedom','bank',60),
  -- Azerbaycan
  ('AZ','kapital','Kapital Bank','Kapital','bank',10),
  ('AZ','pasha','PASHA Bank','PASHA','bank',20),
  ('AZ','abb','International Bank of Azerbaijan','ABB','bank',30),
  ('AZ','respublika','Bank Respublika','Respublika','bank',40),
  ('AZ','xalq','Xalq Bank','Xalq','bank',50),
  ('AZ','unibank','Unibank','Unibank','bank',60),
  -- Gürcistan
  ('GE','tbc','TBC Bank','TBC','bank',10),
  ('GE','bog','Bank of Georgia','BoG','bank',20),
  ('GE','liberty','Liberty Bank','Liberty','bank',30),
  ('GE','basis','Basisbank','Basisbank','bank',40),
  ('GE','tera','TeraBank','TeraBank','bank',50),
  -- Rusya
  ('RU','sberbank','Sberbank','Sber','bank',10),
  ('RU','vtb','VTB','VTB','bank',20),
  ('RU','alfa','Alfa-Bank','Alfa','bank',30),
  ('RU','gazprombank','Gazprombank','GPB','bank',40),
  ('RU','tbank','T-Bank (Tinkoff)','T-Bank','bank',50),
  ('RU','rosselkhozbank','Rosselkhozbank','RSHB','bank',60),
  ('RU','raiffeisen','Raiffeisenbank Russia','Raiffeisen','bank',70),
  ('RU','sovcombank','Sovcombank','Sovcom','bank',80),
  -- BAE
  ('AE','enbd','Emirates NBD','ENBD','bank',10),
  ('AE','fab','First Abu Dhabi Bank','FAB','bank',20),
  ('AE','adcb','Abu Dhabi Commercial Bank','ADCB','bank',30),
  ('AE','mashreq','Mashreq Bank','Mashreq','bank',40),
  ('AE','dib','Dubai Islamic Bank','DIB','bank',50),
  ('AE','rakbank','RAKBANK','RAKBANK','bank',60),
  ('AE','hsbc','HSBC UAE','HSBC','bank',70),
  ('AE','adib','Abu Dhabi Islamic Bank','ADIB','bank',80),
  ('AE','wio','Wio Bank','Wio','bank',90),
  -- Suudi Arabistan
  ('SA','snb','Saudi National Bank (SNB)','SNB','bank',10),
  ('SA','alrajhi','Al Rajhi Bank','Al Rajhi','bank',20),
  ('SA','riyad','Riyad Bank','Riyad','bank',30),
  ('SA','sabb','SABB','SABB','bank',40),
  ('SA','alinma','Alinma Bank','Alinma','bank',50),
  ('SA','bsf','Banque Saudi Fransi','BSF','bank',60),
  ('SA','albilad','Bank Albilad','Albilad','bank',70),
  ('SA','anb','Arab National Bank','ANB','bank',80),
  -- Katar
  ('QA','qnb','QNB','QNB','bank',10),
  ('QA','cbq','Commercial Bank of Qatar','CBQ','bank',20),
  ('QA','doha','Doha Bank','Doha Bank','bank',30),
  ('QA','qib','Qatar Islamic Bank','QIB','bank',40),
  ('QA','ahli','Ahli Bank','Ahli','bank',50),
  ('QA','rayyan','Masraf Al Rayan','Al Rayan','bank',60),
  -- Kuveyt
  ('KW','nbk','National Bank of Kuwait','NBK','bank',10),
  ('KW','kfh','Kuwait Finance House','KFH','bank',20),
  ('KW','burgan','Burgan Bank','Burgan','bank',30),
  ('KW','gulf','Gulf Bank','Gulf Bank','bank',40),
  ('KW','cbk','Commercial Bank of Kuwait','CBK','bank',50),
  ('KW','ahli','Al Ahli Bank of Kuwait','ABK','bank',60),
  -- İsrail
  ('IL','leumi','Bank Leumi','Leumi','bank',10),
  ('IL','poalim','Bank Hapoalim','Hapoalim','bank',20),
  ('IL','discount','Israel Discount Bank','Discount','bank',30),
  ('IL','mizrahi','Mizrahi Tefahot Bank','Mizrahi','bank',40),
  ('IL','fibi','First International Bank of Israel','FIBI','bank',50),
  ('IL','bit','Bit','Bit','wallet',200),
  ('IL','paybox','PayBox','PayBox','wallet',210),
  -- Mısır
  ('EG','nbe','National Bank of Egypt','NBE','bank',10),
  ('EG','misr','Banque Misr','Banque Misr','bank',20),
  ('EG','cib','Commercial International Bank (CIB)','CIB','bank',30),
  ('EG','qnb','QNB Alahli','QNB Alahli','bank',40),
  ('EG','cairo','Banque du Caire','Banque du Caire','bank',50),
  ('EG','alex','AlexBank','AlexBank','bank',60),
  ('EG','hsbc','HSBC Egypt','HSBC','bank',70),
  ('EG','aaib','Arab African International Bank','AAIB','bank',80),
  ('EG','vodafonecash','Vodafone Cash','Vodafone Cash','wallet',200),
  ('EG','etisalatcash','Etisalat Cash','Etisalat Cash','wallet',210),
  -- Fas
  ('MA','attijari','Attijariwafa Bank','Attijariwafa','bank',10),
  ('MA','bcp','Banque Centrale Populaire','BCP','bank',20),
  ('MA','boa','Bank of Africa','BOA','bank',30),
  ('MA','sgmb','Société Générale Maroc','SGMB','bank',40),
  ('MA','cih','CIH Bank','CIH','bank',50),
  ('MA','bmci','BMCI','BMCI','bank',60),
  -- Tunus
  ('TN','biat','BIAT','BIAT','bank',10),
  ('TN','amen','Amen Bank','Amen','bank',20),
  ('TN','stb','STB Bank','STB','bank',30),
  ('TN','bna','Banque Nationale Agricole','BNA','bank',40),
  ('TN','uib','UIB','UIB','bank',50),
  ('TN','attijari','Attijari Bank','Attijari','bank',60),
  -- Cezayir
  ('DZ','bna','Banque Nationale d''Algérie','BNA','bank',10),
  ('DZ','cpa','Crédit Populaire d''Algérie','CPA','bank',20),
  ('DZ','bea','Banque Extérieure d''Algérie','BEA','bank',30),
  ('DZ','badr','BADR Bank','BADR','bank',40),
  ('DZ','sga','Société Générale Algérie','SGA','bank',50),
  ('DZ','cib','CIB Algérie','CIB','bank',60),
  -- Hindistan
  ('IN','sbi','State Bank of India','SBI','bank',10),
  ('IN','hdfc','HDFC Bank','HDFC','bank',20),
  ('IN','icici','ICICI Bank','ICICI','bank',30),
  ('IN','axis','Axis Bank','Axis','bank',40),
  ('IN','kotak','Kotak Mahindra Bank','Kotak','bank',50),
  ('IN','pnb','Punjab National Bank','PNB','bank',60),
  ('IN','bob','Bank of Baroda','BoB','bank',70),
  ('IN','canara','Canara Bank','Canara','bank',80),
  ('IN','idfc','IDFC FIRST Bank','IDFC FIRST','bank',90),
  ('IN','yes','Yes Bank','Yes Bank','bank',100),
  ('IN','paytm','Paytm','Paytm','wallet',200),
  ('IN','phonepe','PhonePe','PhonePe','wallet',210),
  ('IN','gpay','Google Pay (UPI)','Google Pay','wallet',220),
  ('IN','amazonpay','Amazon Pay (UPI)','Amazon Pay','wallet',230),
  -- Pakistan
  ('PK','hbl','Habib Bank Limited (HBL)','HBL','bank',10),
  ('PK','ubl','United Bank Limited (UBL)','UBL','bank',20),
  ('PK','meezan','Meezan Bank','Meezan','bank',30),
  ('PK','mcb','MCB Bank','MCB','bank',40),
  ('PK','allied','Bank AL Habib','AL Habib','bank',50),
  ('PK','alfalah','Bank Alfalah','Alfalah','bank',60),
  ('PK','faysal','Faysal Bank','Faysal','bank',70),
  ('PK','scb','Standard Chartered Pakistan','SCB','bank',80),
  ('PK','askari','Askari Bank','Askari','bank',90),
  ('PK','easypaisa','Easypaisa','Easypaisa','wallet',200),
  ('PK','jazzcash','JazzCash','JazzCash','wallet',210),
  -- Bangladeş
  ('BD','dbbl','Dutch-Bangla Bank','DBBL','bank',10),
  ('BD','brac','BRAC Bank','BRAC','bank',20),
  ('BD','city','City Bank','City Bank','bank',30),
  ('BD','prime','Prime Bank','Prime','bank',40),
  ('BD','ific','IFIC Bank','IFIC','bank',50),
  ('BD','islami','Islami Bank Bangladesh','IBBL','bank',60),
  ('BD','sonali','Sonali Bank','Sonali','bank',70),
  ('BD','bkash','bKash','bKash','wallet',200),
  ('BD','nagad','Nagad','Nagad','wallet',210),
  ('BD','rocket','Rocket','Rocket','wallet',220),
  -- Sri Lanka
  ('LK','boc','Bank of Ceylon','BOC','bank',10),
  ('LK','peoples','People''s Bank','People''s','bank',20),
  ('LK','commercial','Commercial Bank of Ceylon','ComBank','bank',30),
  ('LK','sampath','Sampath Bank','Sampath','bank',40),
  ('LK','ndb','National Development Bank','NDB','bank',50),
  ('LK','seylan','Seylan Bank','Seylan','bank',60),
  -- Nepal
  ('NP','nabil','Nabil Bank','Nabil','bank',10),
  ('NP','rastriya','Rastriya Banijya Bank','RBB','bank',20),
  ('NP','stanchart','Standard Chartered Nepal','SCB','bank',30),
  ('NP','globalime','Global IME Bank','Global IME','bank',40),
  ('NP','nic','NIC Asia Bank','NIC Asia','bank',50),
  ('NP','esewa','eSewa','eSewa','wallet',200),
  ('NP','khalti','Khalti','Khalti','wallet',210),
  -- Endonezya
  ('ID','bca','Bank Central Asia (BCA)','BCA','bank',10),
  ('ID','mandiri','Bank Mandiri','Mandiri','bank',20),
  ('ID','bni','Bank Negara Indonesia (BNI)','BNI','bank',30),
  ('ID','bri','Bank Rakyat Indonesia (BRI)','BRI','bank',40),
  ('ID','cimb','CIMB Niaga','CIMB Niaga','bank',50),
  ('ID','permata','Permata Bank','Permata','bank',60),
  ('ID','danamon','Bank Danamon','Danamon','bank',70),
  ('ID','btn','Bank Tabungan Negara (BTN)','BTN','bank',80),
  ('ID','ocbc','OCBC NISP','OCBC','bank',90),
  ('ID','gopay','GoPay','GoPay','wallet',200),
  ('ID','ovo','OVO','OVO','wallet',210),
  ('ID','dana','DANA','DANA','wallet',220),
  ('ID','shopeepay','ShopeePay','ShopeePay','wallet',230),
  -- Malezya
  ('MY','maybank','Maybank','Maybank','bank',10),
  ('MY','cimb','CIMB Bank','CIMB','bank',20),
  ('MY','pbb','Public Bank','Public Bank','bank',30),
  ('MY','rhb','RHB Bank','RHB','bank',40),
  ('MY','hlb','Hong Leong Bank','Hong Leong','bank',50),
  ('MY','ambank','AmBank','AmBank','bank',60),
  ('MY','islam','Bank Islam','Bank Islam','bank',70),
  ('MY','alliance','Alliance Bank','Alliance','bank',80),
  ('MY','rakyat','Bank Rakyat','Bank Rakyat','bank',90),
  ('MY','tng','Touch ''n Go eWallet','Touch ''n Go','wallet',200),
  ('MY','grabpay','GrabPay','GrabPay','wallet',210),
  ('MY','boost','Boost','Boost','wallet',220),
  -- Tayland
  ('TH','bbl','Bangkok Bank','BBL','bank',10),
  ('TH','kbank','Kasikornbank (KBank)','KBank','bank',20),
  ('TH','scb','Siam Commercial Bank (SCB)','SCB','bank',30),
  ('TH','ktb','Krungthai Bank','KTB','bank',40),
  ('TH','ttb','TMBThanachart Bank (ttb)','ttb','bank',50),
  ('TH','bay','Bank of Ayudhya (Krungsri)','Krungsri','bank',60),
  ('TH','gsb','Government Savings Bank','GSB','bank',70),
  ('TH','uob','UOB Thailand','UOB','bank',80),
  ('TH','truemoney','TrueMoney Wallet','TrueMoney','wallet',200),
  ('TH','promptpay','PromptPay','PromptPay','wallet',210),
  -- Vietnam
  ('VN','vcb','Vietcombank','Vietcombank','bank',10),
  ('VN','ctg','VietinBank','VietinBank','bank',20),
  ('VN','bidv','BIDV','BIDV','bank',30),
  ('VN','agri','Agribank','Agribank','bank',40),
  ('VN','tcb','Techcombank','Techcombank','bank',50),
  ('VN','mbbank','MB Bank','MB Bank','bank',60),
  ('VN','acb','ACB','ACB','bank',70),
  ('VN','vpbank','VPBank','VPBank','bank',80),
  ('VN','stb','Sacombank','Sacombank','bank',90),
  ('VN','tpb','TPBank','TPBank','bank',100),
  ('VN','momo','MoMo','MoMo','wallet',200),
  ('VN','zalopay','ZaloPay','ZaloPay','wallet',210),
  ('VN','vnpay','VNPay','VNPay','wallet',220),
  -- Filipinler
  ('PH','bdo','BDO Unibank','BDO','bank',10),
  ('PH','bpi','Bank of the Philippine Islands (BPI)','BPI','bank',20),
  ('PH','metrobank','Metropolitan Bank (Metrobank)','Metrobank','bank',30),
  ('PH','landbank','Land Bank of the Philippines','LandBank','bank',40),
  ('PH','pnb','Philippine National Bank (PNB)','PNB','bank',50),
  ('PH','security','Security Bank','Security Bank','bank',60),
  ('PH','unionbank','UnionBank','UnionBank','bank',70),
  ('PH','rcbc','RCBC','RCBC','bank',80),
  ('PH','chinabank','China Bank','China Bank','bank',90),
  ('PH','eastwest','EastWest Bank','EastWest','bank',100),
  ('PH','gcash','GCash','GCash','wallet',200),
  ('PH','maya','Maya','Maya','wallet',210),
  ('PH','grabpay','GrabPay','GrabPay','wallet',220),
  -- Kolombiya
  ('CO','bancolombia','Bancolombia','Bancolombia','bank',10),
  ('CO','davivienda','Davivienda','Davivienda','bank',20),
  ('CO','bbva','BBVA Colombia','BBVA','bank',30),
  ('CO','bogota','Banco de Bogotá','Bogotá','bank',40),
  ('CO','occidente','Banco de Occidente','Occidente','bank',50),
  ('CO','colpatria','Scotiabank Colpatria','Colpatria','bank',60),
  ('CO','agrario','Banco Agrario','Agrario','bank',70),
  ('CO','cajasocial','Banco Caja Social','Caja Social','bank',80),
  ('CO','nequi','Nequi','Nequi','wallet',200),
  ('CO','daviplata','Daviplata','Daviplata','wallet',210),
  -- Venezuela
  ('VE','bdv','Banco de Venezuela','BDV','bank',10),
  ('VE','banesco','Banesco','Banesco','bank',20),
  ('VE','mercantil','Banco Mercantil','Mercantil','bank',30),
  ('VE','provincial','BBVA Provincial','Provincial','bank',40),
  ('VE','bnc','Banco Nacional de Crédito','BNC','bank',50),
  ('VE','banplus','Banplus','Banplus','bank',60),
  ('VE','bod','BOD','BOD','bank',70),
  ('VE','tesoro','Banco del Tesoro','Tesoro','bank',80),
  -- Peru
  ('PE','bcp','Banco de Crédito del Perú (BCP)','BCP','bank',10),
  ('PE','bbva','BBVA Perú','BBVA','bank',20),
  ('PE','interbank','Interbank','Interbank','bank',30),
  ('PE','scotiabank','Scotiabank Perú','Scotiabank','bank',40),
  ('PE','nacion','Banco de la Nación','BN','bank',50),
  ('PE','banbif','BanBif','BanBif','bank',60),
  ('PE','yape','Yape','Yape','wallet',200),
  ('PE','plin','Plin','Plin','wallet',210),
  -- Brezilya
  ('BR','itau','Itaú Unibanco','Itaú','bank',10),
  ('BR','bradesco','Bradesco','Bradesco','bank',20),
  ('BR','bb','Banco do Brasil','BB','bank',30),
  ('BR','santander','Santander Brasil','Santander','bank',40),
  ('BR','caixa','Caixa Econômica Federal','Caixa','bank',50),
  ('BR','nubank','Nubank','Nubank','bank',60),
  ('BR','inter','Banco Inter','Inter','bank',70),
  ('BR','c6','C6 Bank','C6','bank',80),
  ('BR','btg','BTG Pactual','BTG','bank',90),
  ('BR','picpay','PicPay','PicPay','wallet',200),
  ('BR','mercadopago','Mercado Pago','Mercado Pago','wallet',210),
  -- Meksika
  ('MX','bbva','BBVA México','BBVA','bank',10),
  ('MX','banorte','Banorte','Banorte','bank',20),
  ('MX','santander','Santander México','Santander','bank',30),
  ('MX','banamex','Banamex (Citibanamex)','Banamex','bank',40),
  ('MX','hsbc','HSBC México','HSBC','bank',50),
  ('MX','scotiabank','Scotiabank México','Scotiabank','bank',60),
  ('MX','inbursa','Banco Inbursa','Inbursa','bank',70),
  ('MX','bancoppel','BanCoppel','BanCoppel','bank',80),
  ('MX','mercadopago','Mercado Pago','Mercado Pago','wallet',200),
  -- Arjantin
  ('AR','nacion','Banco de la Nación Argentina','Nación','bank',10),
  ('AR','galicia','Banco Galicia','Galicia','bank',20),
  ('AR','santander','Santander Argentina','Santander','bank',30),
  ('AR','bbva','BBVA Argentina','BBVA','bank',40),
  ('AR','provincia','Banco Provincia','Provincia','bank',50),
  ('AR','hsbc','HSBC Argentina','HSBC','bank',60),
  ('AR','brubank','Brubank','Brubank','bank',70),
  ('AR','uala','Ualá','Ualá','bank',80),
  ('AR','mercadopago','Mercado Pago','Mercado Pago','wallet',200),
  -- Şili
  ('CL','chile','Banco de Chile','Banco de Chile','bank',10),
  ('CL','estado','BancoEstado','BancoEstado','bank',20),
  ('CL','santander','Santander Chile','Santander','bank',30),
  ('CL','bci','Banco BCI','BCI','bank',40),
  ('CL','itau','Itaú Chile','Itaú','bank',50),
  ('CL','scotiabank','Scotiabank Chile','Scotiabank','bank',60),
  ('CL','falabella','Banco Falabella','Falabella','bank',70),
  ('CL','tenpo','Tenpo','Tenpo','bank',80),
  ('CL','mach','MACH','MACH','wallet',200),
  -- Kanada
  ('CA','rbc','RBC Royal Bank','RBC','bank',10),
  ('CA','td','TD Canada Trust','TD','bank',20),
  ('CA','scotiabank','Scotiabank','Scotiabank','bank',30),
  ('CA','bmo','BMO Bank of Montreal','BMO','bank',40),
  ('CA','cibc','CIBC','CIBC','bank',50),
  ('CA','nbc','National Bank of Canada','NBC','bank',60),
  ('CA','desjardins','Desjardins','Desjardins','bank',70),
  ('CA','tangerine','Tangerine','Tangerine','bank',80),
  ('CA','eq','EQ Bank','EQ Bank','bank',90),
  -- Avustralya
  ('AU','cba','Commonwealth Bank','CommBank','bank',10),
  ('AU','westpac','Westpac','Westpac','bank',20),
  ('AU','anz','ANZ','ANZ','bank',30),
  ('AU','nab','NAB','NAB','bank',40),
  ('AU','macquarie','Macquarie Bank','Macquarie','bank',50),
  ('AU','bendigo','Bendigo Bank','Bendigo','bank',60),
  ('AU','ing','ING Australia','ING','bank',70),
  ('AU','suncorp','Suncorp Bank','Suncorp','bank',80),
  -- Yeni Zelanda
  ('NZ','anz','ANZ New Zealand','ANZ','bank',10),
  ('NZ','asb','ASB Bank','ASB','bank',20),
  ('NZ','bnz','Bank of New Zealand','BNZ','bank',30),
  ('NZ','westpac','Westpac New Zealand','Westpac','bank',40),
  ('NZ','kiwibank','Kiwibank','Kiwibank','bank',50),
  -- Japonya
  ('JP','mufg','MUFG Bank','MUFG','bank',10),
  ('JP','smbc','Sumitomo Mitsui Banking Corporation','SMBC','bank',20),
  ('JP','mizuho','Mizuho Bank','Mizuho','bank',30),
  ('JP','japanpost','Japan Post Bank','Yucho','bank',40),
  ('JP','resona','Resona Bank','Resona','bank',50),
  ('JP','rakuten','Rakuten Bank','Rakuten','bank',60),
  ('JP','paypay','PayPay','PayPay','wallet',200),
  ('JP','linepay','LINE Pay','LINE Pay','wallet',210),
  -- Güney Kore
  ('KR','kb','KB Kookmin Bank','KB','bank',10),
  ('KR','shinhan','Shinhan Bank','Shinhan','bank',20),
  ('KR','woori','Woori Bank','Woori','bank',30),
  ('KR','hana','Hana Bank','Hana','bank',40),
  ('KR','nh','NH Nonghyup Bank','NH','bank',50),
  ('KR','ibk','IBK Industrial Bank of Korea','IBK','bank',60),
  ('KR','kakao','KakaoBank','KakaoBank','bank',70),
  ('KR','toss','Toss Bank','Toss','bank',80),
  -- Nijerya
  ('NG','access','Access Bank','Access','bank',10),
  ('NG','gtbank','Guaranty Trust Bank (GTBank)','GTBank','bank',20),
  ('NG','zenith','Zenith Bank','Zenith','bank',30),
  ('NG','uba','United Bank for Africa (UBA)','UBA','bank',40),
  ('NG','firstbank','First Bank of Nigeria','First Bank','bank',50),
  ('NG','union','Union Bank of Nigeria','Union','bank',60),
  ('NG','stanbic','Stanbic IBTC Bank','Stanbic IBTC','bank',70),
  ('NG','fidelity','Fidelity Bank','Fidelity','bank',80),
  ('NG','kuda','Kuda Bank','Kuda','bank',90),
  ('NG','opay','OPay','OPay','wallet',200),
  ('NG','palmpay','PalmPay','PalmPay','wallet',210),
  -- Kenya
  ('KE','kcb','KCB Bank','KCB','bank',10),
  ('KE','equity','Equity Bank','Equity','bank',20),
  ('KE','coop','Co-operative Bank','Co-op','bank',30),
  ('KE','absa','Absa Bank Kenya','Absa','bank',40),
  ('KE','ncba','NCBA Bank','NCBA','bank',50),
  ('KE','stanbic','Stanbic Bank Kenya','Stanbic','bank',60),
  ('KE','dtb','Diamond Trust Bank (DTB)','DTB','bank',70),
  ('KE','mpesa','M-Pesa','M-Pesa','wallet',200),
  ('KE','airtel','Airtel Money','Airtel Money','wallet',210),
  -- Gana
  ('GH','gcb','GCB Bank','GCB','bank',10),
  ('GH','ecobank','Ecobank Ghana','Ecobank','bank',20),
  ('GH','stanbic','Stanbic Bank Ghana','Stanbic','bank',30),
  ('GH','absa','Absa Bank Ghana','Absa','bank',40),
  ('GH','fidelity','Fidelity Bank Ghana','Fidelity','bank',50),
  ('GH','calbank','CalBank','CalBank','bank',60),
  -- Güney Afrika
  ('ZA','standardbank','Standard Bank','Standard Bank','bank',10),
  ('ZA','fnb','First National Bank (FNB)','FNB','bank',20),
  ('ZA','absa','Absa Bank','Absa','bank',30),
  ('ZA','nedbank','Nedbank','Nedbank','bank',40),
  ('ZA','capitec','Capitec Bank','Capitec','bank',50),
  ('ZA','investec','Investec','Investec','bank',60),
  ('ZA','tymebank','TymeBank','TymeBank','bank',70)
on conflict (country_code, code) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  kind = excluded.kind,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 7) Ülke durumu: banka listesi + kurallar
-- ---------------------------------------------------------------------------
create or replace function public.yayinci_odeme_ulke_durumu(p_country_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_country text := upper(trim(coalesce(p_country_code, '')));
  v_methods jsonb;
  v_enabled int;
  v_schema jsonb;
  v_rules jsonb;
  v_genel_fields jsonb := jsonb_build_array(
    jsonb_build_object('key', 'account_number', 'required', true,
      'min_length', 4, 'max_length', 34),
    jsonb_build_object('key', 'swift_bic', 'required', false,
      'pattern', '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$', 'max_length', 11)
  );
  v_genel jsonb;
begin
  if v_country !~ '^[A-Z]{2}$' then
    return jsonb_build_object(
      'country_code', v_country,
      'supported', false,
      'methods', '[]'::jsonb,
      'field_schemas', '{}'::jsonb,
      'banks', '{}'::jsonb,
      'rules', '{}'::jsonb,
      'note', 'Geçerli bir ülke kodu seçin.'
    );
  end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'method', c.method,
      'provider', c.provider,
      'currency', c.currency,
      'min_payout_usd', c.min_payout_usd,
      'is_enabled', c.is_enabled,
      'auto_payout', c.auto_payout,
      'scheme', c.requirements ->> 'scheme',
      'fields', coalesce(c.requirements -> 'fields', '[]'::jsonb),
      'requirements', c.requirements,
      'banks', public.odeme_banka_listesi(
        v_country,
        case when c.method = 'wallet_transfer' then 'wallet'
             else 'bank' end
      )
    ) order by c.is_enabled desc, c.method), '[]'::jsonb),
    count(*) filter (where c.is_enabled),
    coalesce(jsonb_object_agg(
      c.method,
      coalesce(c.requirements -> 'fields', '[]'::jsonb)
    ) filter (where c.is_enabled), '{}'::jsonb)
  into v_methods, v_enabled, v_schema
  from public.country_payout_methods c
  where c.country_code = v_country;

  select to_jsonb(r) - 'updated_at'
  into v_rules
  from public.country_payout_rules r
  where r.country_code = v_country;

  -- Tanımlı kanal yoksa tüm ülkeler için genel havale şeması.
  if coalesce(v_enabled, 0) = 0 then
    v_genel := jsonb_build_object(
      'method', 'bank_transfer',
      'provider', null,
      'currency', coalesce(v_rules ->> 'currency', 'USD'),
      'min_payout_usd', 25.00,
      'is_enabled', true,
      'auto_payout', false,
      'scheme', 'local_account',
      'fields', v_genel_fields,
      'requirements', jsonb_build_object(
        'scheme', 'local_account',
        'bank_name_required', true,
        'fields', v_genel_fields
      ),
      'banks', public.odeme_banka_listesi(v_country, 'bank')
    );

    return jsonb_build_object(
      'country_code', v_country,
      'supported', true,
      'generic', true,
      'methods', jsonb_build_array(v_genel),
      'field_schemas', jsonb_build_object('bank_transfer', v_genel -> 'fields'),
      'banks', jsonb_build_object(
        'bank', v_genel -> 'banks',
        'wallet', public.odeme_banka_listesi(v_country, 'wallet')
      ),
      'rules', coalesce(v_rules, '{}'::jsonb),
      'note', 'Bu ülke için özel kanal tanımı yok; standart banka havalesi kullanılır.'
    );
  end if;

  return jsonb_build_object(
    'country_code', v_country,
    'supported', true,
    'generic', false,
    'methods', v_methods,
    'field_schemas', v_schema,
    'banks', jsonb_build_object(
      'bank', public.odeme_banka_listesi(v_country, 'bank'),
      'wallet', public.odeme_banka_listesi(v_country, 'wallet')
    ),
    'rules', coalesce(v_rules, '{}'::jsonb),
    'note', null
  );
end;
$$;

grant execute on function public.yayinci_odeme_ulke_durumu(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) Hesap kaydı — banka kodu + ülke IBAN kuralı
-- ---------------------------------------------------------------------------
drop function if exists public.yayinci_odeme_hesabi_kaydet(
  text, text, text, text, text, text, text, jsonb
);

create or replace function public.yayinci_odeme_hesabi_kaydet(
  p_account_holder text,
  p_bank_name text,
  p_iban text,
  p_country_code text,
  p_currency text default 'USD',
  p_method text default 'bank_transfer',
  p_scheme text default null,
  p_details jsonb default '{}'::jsonb,
  p_bank_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_country text := upper(trim(coalesce(p_country_code, '')));
  v_spec jsonb;
  v_scheme text;
  v_details jsonb;
  v_hata text;
  v_birincil text;
  v_deger text;
  v_masked jsonb;
  v_bank_code text := lower(trim(coalesce(p_bank_code, '')));
  v_kind text;
  v_banka_adi text;
  v_rules public.country_payout_rules%rowtype;
  v_para text;
  v_old public.creator_payout_accounts%rowtype;
  v_row public.creator_payout_accounts%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if coalesce(trim(p_account_holder), '') = '' then raise exception 'account_holder_required'; end if;
  if v_country !~ '^[A-Z]{2}$' then raise exception 'invalid_country'; end if;
  if p_method not in ('bank_transfer', 'local_transfer', 'wallet_transfer') then
    raise exception 'invalid_method';
  end if;

  select * into v_rules from public.country_payout_rules where country_code = v_country;

  v_kind := case when p_method = 'wallet_transfer' then 'wallet' else 'bank' end;

  -- Banka kodunu rehberden çöz (varsa).
  if v_bank_code <> '' then
    v_banka_adi := public.odeme_banka_adi(v_country, v_bank_code, v_kind);
    if v_banka_adi is null then
      raise exception 'invalid_bank';
    end if;
  end if;

  select c.requirements into v_spec
  from public.country_payout_methods c
  where c.country_code = v_country and c.method = p_method;

  v_details := public.odeme_detay_normallestir(p_details);

  -- Eski istemci yalnızca p_iban gönderir.
  if v_details = '{}'::jsonb and coalesce(trim(p_iban), '') <> '' then
    v_details := jsonb_build_object('iban', upper(regexp_replace(trim(p_iban), '\s', '', 'g')));
  end if;

  -- Ülke için tanım yoksa: IBAN varsa IBAN, yoksa genel havale.
  if v_spec is null or jsonb_typeof(v_spec -> 'fields') is distinct from 'array' then
    if v_details ? 'iban' then
      v_spec := jsonb_build_object(
        'scheme', 'iban',
        'bank_name_required', false,
        'fields', '[{"key":"iban","required":true}]'::jsonb
      );
    else
      v_spec := jsonb_build_object(
        'scheme', 'local_account',
        'bank_name_required', true,
        'fields', jsonb_build_array(
          jsonb_build_object('key', 'account_number', 'required', true,
            'min_length', 4, 'max_length', 34),
          jsonb_build_object('key', 'swift_bic', 'required', false,
            'pattern', '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$', 'max_length', 11)
        )
      );
    end if;
  end if;

  v_scheme := lower(nullif(trim(coalesce(p_scheme, v_spec ->> 'scheme')), ''));

  if v_scheme is null then
    v_scheme := case when v_details ? 'iban' then 'iban' else 'local_account' end;
  end if;
  if v_details = '{}'::jsonb then
    raise exception 'invalid_details';
  end if;

  -- Banka adı: rehberden gelen ad her zaman kazanır.
  if v_banka_adi is not null then
    v_details := v_details || jsonb_build_object('bank_code', v_bank_code);
  end if;

  if coalesce(trim(p_bank_name), '') = '' and v_banka_adi is null
     and coalesce((v_spec ->> 'bank_name_required')::boolean, false) then
    raise exception 'bank_name_required';
  end if;

  if v_details ? 'bank_code' and not v_details ? 'provider_name' then
    v_details := v_details || jsonb_build_object('provider_name', v_banka_adi);
  end if;

  v_hata := public.odeme_detay_dogrula(v_spec, v_details);
  if v_hata is not null then
    raise exception '%', v_hata;
  end if;

  -- IBAN: ülke uzunluğu + ülke öneki + mod-97.
  if (v_scheme = 'iban' or v_details ? 'iban')
     and coalesce(v_details ->> 'iban', '') <> '' then
    v_hata := public.odeme_iban_dogrula(v_country, v_details ->> 'iban');
    if v_hata is not null then
      raise exception '%', v_hata;
    end if;
  end if;

  v_birincil := public.odeme_detay_birincil_alan(v_details);
  if v_birincil is null then
    raise exception 'invalid_details';
  end if;
  v_deger := v_details ->> v_birincil;
  v_masked := public.odeme_detay_maskeli(v_details);

  select * into v_old from public.creator_payout_accounts where user_id = v_uid;

  -- Mobil uyumluluk için eski tablo güncel tutulur.
  insert into public.user_bank_accounts (user_id, account_holder, bank_name, iban)
  values (
    v_uid,
    trim(p_account_holder),
    coalesce(v_banka_adi, nullif(trim(p_bank_name), ''), '—'),
    v_deger
  )
  on conflict (user_id) do update set
    account_holder = excluded.account_holder,
    bank_name = excluded.bank_name,
    iban = excluded.iban,
    updated_at = now();

  v_para := upper(coalesce(
    nullif(trim(p_currency), ''),
    nullif(v_rules.currency::text, ''),
    'USD'
  ));

  insert into public.creator_payout_accounts (
    user_id, method, scheme, country_code, currency, account_holder, bank_name,
    iban_masked, iban_hash, details, details_masked, status, verified_at, last_changed_at
  ) values (
    v_uid, p_method, v_scheme, v_country, v_para,
    trim(p_account_holder),
    coalesce(v_banka_adi, nullif(trim(p_bank_name), '')),
    '****' || right(v_deger, 4), md5(v_deger),
    v_details, v_masked,
    'pending_verification', null, now()
  )
  on conflict (user_id) do update set
    method = excluded.method,
    scheme = excluded.scheme,
    country_code = excluded.country_code,
    currency = excluded.currency,
    account_holder = excluded.account_holder,
    bank_name = excluded.bank_name,
    iban_masked = excluded.iban_masked,
    iban_hash = excluded.iban_hash,
    details = excluded.details,
    details_masked = excluded.details_masked,
    status = case
      when public.creator_payout_accounts.iban_hash = excluded.iban_hash
       and public.creator_payout_accounts.scheme = excluded.scheme
        then public.creator_payout_accounts.status
      else 'pending_verification'
    end,
    verified_at = case
      when public.creator_payout_accounts.iban_hash = excluded.iban_hash
       and public.creator_payout_accounts.scheme = excluded.scheme
        then public.creator_payout_accounts.verified_at
      else null
    end,
    last_changed_at = now(),
    updated_at = now()
  returning * into v_row;

  insert into public.financial_audit_events (
    actor_id, action, entity_type, entity_id, details
  ) values (
    v_uid,
    case when v_old.id is null then 'payout_account_created' else 'payout_account_updated' end,
    'creator_payout_account', v_row.id,
    jsonb_build_object(
      'scheme', v_row.scheme,
      'country_code', v_row.country_code,
      'bank_code', v_row.details ->> 'bank_code',
      'iban_masked', v_row.iban_masked,
      'details_masked', v_row.details_masked,
      'verification_required', v_row.status = 'pending_verification'
    )
  );

  return jsonb_build_object(
    'exists', true,
    'id', v_row.id,
    'method', v_row.method,
    'scheme', v_row.scheme,
    'country_code', v_row.country_code,
    'currency', v_row.currency,
    'account_holder', v_row.account_holder,
    'bank_name', v_row.bank_name,
    'bank_code', v_row.details ->> 'bank_code',
    'iban_masked', v_row.iban_masked,
    'details_masked', v_row.details_masked,
    'status', v_row.status,
    'verified_at', v_row.verified_at,
    'last_changed_at', v_row.last_changed_at
  );
end;
$$;

grant execute on function public.yayinci_odeme_hesabi_kaydet(
  text, text, text, text, text, text, text, jsonb, text
) to authenticated;

-- Hesap özeti banka kodunu da döndürsün.
create or replace function public.yayinci_odeme_hesabi_getir()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
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
    'scheme', v_acc.scheme,
    'country_code', v_acc.country_code,
    'currency', v_acc.currency,
    'account_holder', v_acc.account_holder,
    'bank_name', v_acc.bank_name,
    'bank_code', v_acc.details ->> 'bank_code',
    'iban_masked', v_acc.iban_masked,
    'details_masked', v_acc.details_masked,
    'status', v_acc.status,
    'verified_at', v_acc.verified_at,
    'last_changed_at', v_acc.last_changed_at
  );
end;
$$;

grant execute on function public.yayinci_odeme_hesabi_getir() to authenticated;
