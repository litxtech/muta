-- ===========================================================================
-- Tamuso · Yayıncı ödeme hesabı — IBAN dışı ülkeler
-- ===========================================================================
-- Sorun: ödeme hesabı yalnızca IBAN kabul ediyordu. ABD (ABA routing +
-- account number), Filipinler (yerel hesap / GCash), Venezuela (cuenta
-- corriente/ahorro), Kolombiya ve Mısır'daki yayıncılar hesaplarını
-- kaydedemiyordu; admin de yalnızca maskeli IBAN gördüğü için ödeme
-- talimatını okuyamıyordu.
--
-- Çözüm: "ödeme talimatı" (payout destination) modeli.
--   * creator_payout_accounts.scheme  → iban | us_ach | local_account | wallet
--   * creator_payout_accounts.details → alan adı → değer (tam bilgi)
--   * details_masked                  → istemciye dönen maskeli kopya
--   * country_payout_methods.requirements → ülke/yöntem başına alan şeması
--
-- Tam hesap bilgisi yalnızca denetim kaydına yazan
-- admin_odeme_hesabi_detay RPC'siyle okunabilir; tablo kolon izinleri
-- details kolonunu API istemcilerine kapatır.
--
-- Not: bu dosya hiçbir ödeme sağlayıcısı çağırmaz. Ödemeler elle yapılır;
-- burada yalnızca doğru ve eksiksiz talimat kaydı tutulur.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Şema genişletmesi
-- ---------------------------------------------------------------------------

alter table public.creator_payout_accounts
  add column if not exists scheme text not null default 'iban'
    check (scheme in ('iban', 'us_ach', 'local_account', 'wallet'));

alter table public.creator_payout_accounts
  add column if not exists details jsonb not null default '{}'::jsonb;

alter table public.creator_payout_accounts
  add column if not exists details_masked jsonb not null default '{}'::jsonb;

comment on column public.creator_payout_accounts.scheme is
  'Ödeme talimatı türü: iban | us_ach | local_account | wallet';
comment on column public.creator_payout_accounts.details is
  'Tam ödeme talimatı (alan → değer). API istemcilerine kapalı; yalnızca admin_odeme_hesabi_detay ile okunur.';
comment on column public.creator_payout_accounts.details_masked is
  'İstemciye dönen maskeli talimat.';
comment on column public.creator_payout_accounts.iban_masked is
  'Birincil hesap kimliğinin maskeli gösterimi (geriye dönük uyumluluk).';
comment on column public.creator_payout_accounts.iban_hash is
  'Birincil hesap kimliğinin hash değeri; değişiklikte yeniden doğrulama tetikler.';

alter table public.creator_payout_requests
  add column if not exists payout_scheme text;

alter table public.creator_payout_requests
  add column if not exists payout_details_masked jsonb not null default '{}'::jsonb;

/* Talep yöntemi artık hesabın yöntemini yansıtabilir. */
alter table public.creator_payout_requests
  drop constraint if exists creator_payout_requests_method_check;
alter table public.creator_payout_requests
  add constraint creator_payout_requests_method_check
  check (method in ('bank_transfer', 'local_transfer', 'wallet_transfer'));

comment on column public.creator_payout_requests.payout_details_masked is
  'Talep oluşturulduğu andaki maskeli ödeme talimatı (snapshot).';

-- Eski IBAN kayıtları yalnızca maskeli tutuluyordu; tam değer
-- user_bank_accounts.iban içinde. Yeni modeli geriye dönük doldur.
update public.creator_payout_accounts a
   set details = jsonb_build_object('iban', upper(regexp_replace(u.iban, '\s', '', 'g'))),
       details_masked = jsonb_build_object('iban', a.iban_masked),
       scheme = 'iban'
  from public.user_bank_accounts u
 where u.user_id = a.user_id
   and a.details = '{}'::jsonb;

update public.creator_payout_accounts
   set details_masked = jsonb_build_object('iban', iban_masked)
 where details_masked = '{}'::jsonb
   and iban_masked is not null;

update public.creator_payout_requests
   set payout_scheme = 'iban',
       payout_details_masked = jsonb_build_object('iban', iban_masked)
 where payout_scheme is null
   and iban_masked is not null;

-- Eski tablo IBAN uzunluğuna (15–34) kilitliydi; ABD hesap numarası
-- 8–17 hane olabildiği için kısıt gevşetilir.
alter table public.user_bank_accounts
  drop constraint if exists user_bank_accounts_iban_len;

alter table public.user_bank_accounts
  add constraint user_bank_accounts_iban_len
  check (char_length(replace(iban, ' ', '')) between 3 and 64);

-- ---------------------------------------------------------------------------
-- 2) Yardımcı fonksiyonlar
-- ---------------------------------------------------------------------------

create or replace function public.odeme_detay_normallestir(p_details jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_object_agg(
      lower(t.k),
      case
        when lower(t.k) in (
          'iban', 'account_number', 'routing_number', 'swift_bic',
          'wallet_number', 'clabe', 'document_id'
        ) then upper(regexp_replace(t.v, '\s', '', 'g'))
        else trim(t.v)
      end
    ),
    '{}'::jsonb
  )
  from (
    select e.k, e.v
    from jsonb_each_text(coalesce(p_details, '{}'::jsonb)) as e(k, v)
    where trim(coalesce(e.v, '')) <> ''
  ) t;
$$;

create or replace function public.odeme_detay_maskeli(p_details jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_object_agg(
      t.k,
      case
        when t.k in ('iban', 'account_number', 'wallet_number', 'clabe', 'document_id')
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

create or replace function public.odeme_detay_birincil_alan(p_details jsonb)
returns text
language sql
immutable
as $$
  select t.alan
  from unnest(array['iban', 'account_number', 'wallet_number', 'clabe'])
    with ordinality as t(alan, sira)
  where coalesce(p_details ->> t.alan, '') <> ''
  order by t.sira
  limit 1;
$$;

-- IBAN mod-97 doğrulaması (ISO 13616).
create or replace function public.iban_gecerli_mi(p_iban text)
returns boolean
language plpgsql
immutable
as $$
declare
  v text := upper(regexp_replace(coalesce(p_iban, ''), '\s', '', 'g'));
  v_rearr text;
  v_num text := '';
  v_char text;
  i int;
begin
  if v !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then
    return false;
  end if;
  v_rearr := substr(v, 5) || substr(v, 1, 4);
  for i in 1..length(v_rearr) loop
    v_char := substr(v_rearr, i, 1);
    if v_char ~ '[0-9]' then
      v_num := v_num || v_char;
    else
      v_num := v_num || (ascii(v_char) - 55)::text;
    end if;
  end loop;
  return (v_num::numeric % 97) = 1;
end;
$$;

-- Ülke/yöntem şemasına göre alan doğrulaması.
-- Dönüş: null → geçerli, aksi halde hata kodu.
create or replace function public.odeme_detay_dogrula(
  p_spec jsonb,
  p_details jsonb
)
returns text
language plpgsql
immutable
as $$
declare
  v_fields jsonb := coalesce(p_spec -> 'fields', '[]'::jsonb);
  f jsonb;
  k text;
  v text;
begin
  if jsonb_typeof(v_fields) <> 'array' then
    return 'invalid_spec';
  end if;

  for f in select e.oge from jsonb_array_elements(v_fields) as e(oge) loop
    k := lower(coalesce(f ->> 'key', ''));
    if k = '' then
      return 'invalid_spec';
    end if;
    v := p_details ->> k;

    if coalesce((f ->> 'required')::boolean, true) and coalesce(trim(v), '') = '' then
      return 'field_required:' || k;
    end if;

    if coalesce(trim(v), '') <> '' then
      if f ? 'pattern' and v !~ (f ->> 'pattern') then
        return 'field_invalid:' || k;
      end if;
      if f ? 'enum' and not exists (
        select 1
        from jsonb_array_elements_text(f -> 'enum') as el(deger)
        where lower(el.deger) = lower(v)
      ) then
        return 'field_invalid:' || k;
      end if;
      if f ? 'max_length' and length(v) > (f ->> 'max_length')::int then
        return 'field_invalid:' || k;
      end if;
      if f ? 'min_length' and length(v) < (f ->> 'min_length')::int then
        return 'field_invalid:' || k;
      end if;
      if coalesce((f ->> 'numeric')::boolean, false) and v !~ '^[0-9]+$' then
        return 'field_invalid:' || k;
      end if;
    end if;
  end loop;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Ülke / yöntem alan şemaları
-- ---------------------------------------------------------------------------
-- requirements.fields → form alanları ve sunucu doğrulaması.
-- Etiketler istemcide i18n anahtarıyla eşlenir; sunucu yalnızca teknik
-- kuralları taşır.

insert into public.country_payout_methods (
  country_code, method, provider, currency, is_enabled, auto_payout, requirements, note
)
select
  s.country_code, s.method, null, 'USD', s.is_enabled, false,
  jsonb_build_object('scheme', s.scheme, 'bank_name_required', s.bank_name_required, 'fields', s.fields),
  s.note
from (values
  -- Türkiye: IBAN
  ('TR', 'bank_transfer', 'iban', false, true,
   '[{"key":"iban","required":true,"pattern":"^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$","max_length":34}]'::jsonb,
   'Banka havalesi (IBAN). Ödeme manuel yapılır.'),

  -- ABD: ABA routing + account number (+ opsiyonel SWIFT/BIC)
  ('US', 'bank_transfer', 'us_ach', true, true,
   '[{"key":"routing_number","required":true,"pattern":"^[0-9]{9}$","max_length":9,"numeric":true},
     {"key":"account_number","required":true,"pattern":"^[0-9]{4,17}$","max_length":17,"numeric":true},
     {"key":"account_type","required":true,"enum":["checking","savings"]},
     {"key":"swift_bic","required":false,"pattern":"^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$","max_length":11}]'::jsonb,
   'ACH / banka havalesi. Ödeme manuel yapılır.'),

  -- Filipinler: yerel banka hesabı
  ('PH', 'local_transfer', 'local_account', true, true,
   '[{"key":"account_number","required":true,"min_length":6,"max_length":20},
     {"key":"swift_bic","required":false,"pattern":"^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$","max_length":11}]'::jsonb,
   'Yerel banka transferi. Ödeme manuel yapılır.'),

  -- Filipinler: cüzdan (GCash / Maya)
  ('PH', 'wallet_transfer', 'wallet', false, true,
   '[{"key":"wallet_provider","required":true,"enum":["gcash","maya","other"]},
     {"key":"wallet_number","required":true,"pattern":"^[0-9]{10,13}$","max_length":13,"numeric":true}]'::jsonb,
   'Mobil cüzdan numarası. Ödeme manuel yapılır.'),

  -- Kolombiya: cuenta de ahorros / corriente
  ('CO', 'local_transfer', 'local_account', true, true,
   '[{"key":"account_number","required":true,"min_length":6,"max_length":20},
     {"key":"account_type","required":true,"enum":["ahorros","corriente"]},
     {"key":"document_id","required":false,"max_length":20}]'::jsonb,
   'Yerel banka transferi. Ödeme manuel yapılır.'),

  -- Venezuela: 20 haneli hesap + RIF / cédula
  ('VE', 'local_transfer', 'local_account', true, false,
   '[{"key":"account_number","required":true,"pattern":"^[0-9]{20}$","max_length":20,"numeric":true},
     {"key":"account_type","required":true,"enum":["corriente","ahorro"]},
     {"key":"document_id","required":true,"max_length":20}]'::jsonb,
   'Ödeme kısıtları nedeniyle kanal kapalı. Alan şeması hazır; kanal açıldığında etkinleştirilir.'),

  -- Mısır: IBAN
  ('EG', 'local_transfer', 'iban', true, true,
   '[{"key":"iban","required":true,"pattern":"^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$","max_length":34}]'::jsonb,
   'Yerel banka transferi (IBAN). Ödeme manuel yapılır.')
) as s(country_code, method, scheme, bank_name_required, is_enabled, fields, note)
on conflict (country_code, method) do update set
  requirements = excluded.requirements,
  note = excluded.note,
  is_enabled = excluded.is_enabled,
  updated_at = now();

-- Admin panelindeki ülke kanalı formu requirements göndermiyor; kaydetme
-- sırasında mevcut alan şemasının silinmemesi gerekir.
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
    requirements = case
      when excluded.requirements is null or excluded.requirements = '{}'::jsonb
        then public.country_payout_methods.requirements
      else excluded.requirements
    end,
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
-- 4) Yayıncı RPC'leri
-- ---------------------------------------------------------------------------

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
    'scheme', v_acc.scheme,
    'country_code', v_acc.country_code,
    'currency', v_acc.currency,
    'account_holder', v_acc.account_holder,
    'bank_name', v_acc.bank_name,
    'iban_masked', v_acc.iban_masked,
    'details_masked', v_acc.details_masked,
    'status', v_acc.status,
    'verified_at', v_acc.verified_at,
    'last_changed_at', v_acc.last_changed_at
  );
end;
$$;

grant execute on function public.yayinci_odeme_hesabi_getir() to authenticated;

drop function if exists public.yayinci_odeme_hesabi_kaydet(text, text, text, text, text, text);

create or replace function public.yayinci_odeme_hesabi_kaydet(
  p_account_holder text,
  p_bank_name text,
  p_iban text,
  p_country_code text,
  p_currency text default 'USD',
  p_method text default 'bank_transfer',
  p_scheme text default null,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
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
  v_old public.creator_payout_accounts%rowtype;
  v_row public.creator_payout_accounts%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if coalesce(trim(p_account_holder), '') = '' then raise exception 'account_holder_required'; end if;
  if v_country !~ '^[A-Z]{2}$' then raise exception 'invalid_country'; end if;
  if p_method not in ('bank_transfer', 'local_transfer', 'wallet_transfer') then
    raise exception 'invalid_method';
  end if;

  select c.requirements into v_spec
  from public.country_payout_methods c
  where c.country_code = v_country and c.method = p_method;

  -- Ülke için tanım yoksa eski davranış (yalnızca IBAN) korunur.
  if v_spec is null or jsonb_typeof(v_spec -> 'fields') is distinct from 'array' then
    v_spec := jsonb_build_object(
      'scheme', 'iban',
      'bank_name_required', false,
      'fields', '[{"key":"iban","required":true,"pattern":"^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$","max_length":34}]'::jsonb
    );
  end if;

  v_details := public.odeme_detay_normallestir(p_details);
  v_scheme := lower(nullif(trim(coalesce(p_scheme, v_spec ->> 'scheme')), ''));

  -- Eski istemci yalnızca p_iban gönderir.
  if v_details = '{}'::jsonb and coalesce(trim(p_iban), '') <> '' then
    v_scheme := 'iban';
    v_details := jsonb_build_object('iban', upper(regexp_replace(trim(p_iban), '\s', '', 'g')));
  end if;

  if v_scheme is null then
    v_scheme := 'iban';
  end if;
  if v_details = '{}'::jsonb then
    raise exception 'invalid_details';
  end if;

  if coalesce((v_spec ->> 'bank_name_required')::boolean, false)
     and coalesce(trim(p_bank_name), '') = '' then
    raise exception 'bank_name_required';
  end if;

  v_hata := public.odeme_detay_dogrula(v_spec, v_details);
  if v_hata is not null then
    raise exception '%', v_hata;
  end if;

  if v_scheme = 'iban' and not public.iban_gecerli_mi(v_details ->> 'iban') then
    raise exception 'invalid_iban';
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
    coalesce(nullif(trim(p_bank_name), ''), '—'),
    v_deger
  )
  on conflict (user_id) do update set
    account_holder = excluded.account_holder,
    bank_name = excluded.bank_name,
    iban = excluded.iban,
    updated_at = now();

  insert into public.creator_payout_accounts (
    user_id, method, scheme, country_code, currency, account_holder, bank_name,
    iban_masked, iban_hash, details, details_masked, status, verified_at, last_changed_at
  ) values (
    v_uid, p_method, v_scheme, v_country,
    upper(coalesce(nullif(trim(p_currency), ''), 'USD')),
    trim(p_account_holder), nullif(trim(p_bank_name), ''),
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
    'iban_masked', v_row.iban_masked,
    'details_masked', v_row.details_masked,
    'status', v_row.status,
    'verified_at', v_row.verified_at,
    'last_changed_at', v_row.last_changed_at
  );
end;
$$;

grant execute on function public.yayinci_odeme_hesabi_kaydet(
  text, text, text, text, text, text, text, jsonb
) to authenticated;

create or replace function public.yayinci_odeme_ulke_durumu(p_country_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_country text := upper(trim(coalesce(p_country_code, '')));
  v_methods jsonb;
  v_enabled int;
  v_schema jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'method', c.method,
    'provider', c.provider,
    'currency', c.currency,
    'min_payout_usd', c.min_payout_usd,
    'is_enabled', c.is_enabled,
    'auto_payout', c.auto_payout,
    'scheme', c.requirements ->> 'scheme',
    'fields', coalesce(c.requirements -> 'fields', '[]'::jsonb),
    'requirements', c.requirements
  ) order by c.is_enabled desc, c.method), '[]'::jsonb),
  count(*) filter (where c.is_enabled),
  -- İstemci etiketleri için alan şeması özeti (key → tip bilgisi)
  coalesce(jsonb_object_agg(
    c.method,
    coalesce(c.requirements -> 'fields', '[]'::jsonb)
  ) filter (where c.is_enabled), '{}'::jsonb)
  into v_methods, v_enabled, v_schema
  from public.country_payout_methods c
  where c.country_code = v_country;

  return jsonb_build_object(
    'country_code', v_country,
    'supported', v_enabled > 0,
    'methods', v_methods,
    'field_schemas', v_schema,
    'note', case when v_enabled = 0
      then 'Bu ülke için doğrulanmış ödeme kanalı bulunmuyor.'
      else null end
  );
end;
$$;

grant execute on function public.yayinci_odeme_ulke_durumu(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Talep oluşturma (yeni hesap modeline geçiş)
-- ---------------------------------------------------------------------------

create or replace function public.yayinci_odeme_talebi_olustur(p_idempotency_key text)
returns public.creator_payout_requests
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_cfg public.platform_economy_config%rowtype;
  v_req public.creator_payout_requests%rowtype;
  v_amount numeric(14,2);
  v_fee numeric(14,2);
  v_kyc text;
  v_acc public.creator_payout_accounts%rowtype;
  v_period_end date;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'Invalid idempotency key';
  end if;

  select * into v_req from public.creator_payout_requests
  where idempotency_key = p_idempotency_key and user_id = v_uid;
  if found then return v_req; end if;

  if not public.yayinci_cekim_aktif_mi() then
    raise exception 'withdrawals_unavailable';
  end if;

  if exists (
    select 1 from public.creator_payout_requests
    where user_id = v_uid and status in ('pending', 'under_review', 'approved', 'sent_to_bank', 'on_hold')
  ) then
    raise exception 'open_request_exists';
  end if;

  select kyc_status into v_kyc from public.wallet_accounts where user_id = v_uid;
  if coalesce(v_kyc, 'none') <> 'approved' then
    raise exception 'kyc_required';
  end if;

  select * into v_acc from public.creator_payout_accounts where user_id = v_uid;
  if not found or v_acc.status = 'disabled' or v_acc.details = '{}'::jsonb then
    raise exception 'bank_account_required';
  end if;

  if exists (
    select 1 from public.finance_risk_flags
    where user_id = v_uid and status = 'open' and severity = 'high'
  ) then
    raise exception 'security_review';
  end if;

  select * into v_cfg from public.platform_economy_config where id = 1;
  v_period_end := public.odeme_donemi_bas(now()) - 1;

  perform 1 from public.creator_earning_entries
  where creator_id = v_uid for update;

  select coalesce(sum(e.net_usd), 0) into v_amount
  from public.creator_earning_entries e
  where e.creator_id = v_uid and public.yayinci_kazanc_durumu(e) = 'available';

  v_amount := floor(v_amount * 100) / 100;
  if v_amount < coalesce(v_cfg.payout_min_usd, 25.00) then
    raise exception 'below_minimum';
  end if;

  v_fee := least(coalesce(v_cfg.payout_transfer_fee_usd, 0), v_amount);

  insert into public.creator_payout_requests (
    user_id, amount_usd, fee_usd, net_usd, method, account_holder, bank_name, iban_masked,
    payout_scheme, payout_details_masked, idempotency_key, period_end
  ) values (
    v_uid, v_amount, v_fee, v_amount - v_fee, v_acc.method,
    v_acc.account_holder, v_acc.bank_name, v_acc.iban_masked,
    v_acc.scheme, v_acc.details_masked,
    p_idempotency_key, v_period_end
  ) returning * into v_req;

  update public.creator_earning_entries e
    set payout_request_id = v_req.id
  where e.creator_id = v_uid and public.yayinci_kazanc_durumu(e) = 'available';

  insert into public.creator_payout_events (request_id, actor_id, from_status, to_status)
  values (v_req.id, v_uid, null, 'pending');

  return v_req;
end;
$$;

grant execute on function public.yayinci_odeme_talebi_olustur(text) to authenticated;

-- Parti oluşturma gibi diğer yollar da talep anındaki talimatı taşısın.
create or replace function public.creator_payout_requests_snapshot()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_acc public.creator_payout_accounts%rowtype;
begin
  if new.payout_scheme is null or new.payout_details_masked = '{}'::jsonb then
    select * into v_acc from public.creator_payout_accounts where user_id = new.user_id;
    if found then
      new.payout_scheme := coalesce(new.payout_scheme, v_acc.scheme);
      if new.payout_details_masked = '{}'::jsonb then
        new.payout_details_masked := v_acc.details_masked;
      end if;
      new.iban_masked := coalesce(new.iban_masked, v_acc.iban_masked);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists creator_payout_requests_snapshot_bi on public.creator_payout_requests;
create trigger creator_payout_requests_snapshot_bi
  before insert on public.creator_payout_requests
  for each row execute function public.creator_payout_requests_snapshot();

-- ---------------------------------------------------------------------------
-- 6) Admin: tam ödeme talimatı (denetim kayıtlı)
-- ---------------------------------------------------------------------------

create or replace function public.admin_odeme_hesabi_detay(p_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_acc public.creator_payout_accounts%rowtype;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  if p_account_id is null then raise exception 'account_required'; end if;

  select * into v_acc from public.creator_payout_accounts where id = p_account_id;
  if not found then raise exception 'Not found'; end if;

  perform public.finans_denetim_yaz(
    auth.uid(), 'payout_account_details_viewed', 'creator_payout_account', v_acc.id,
    null, null, null,
    jsonb_build_object('user_id', v_acc.user_id, 'scheme', v_acc.scheme)
  );

  return jsonb_build_object(
    'id', v_acc.id,
    'user_id', v_acc.user_id,
    'method', v_acc.method,
    'scheme', v_acc.scheme,
    'country_code', v_acc.country_code,
    'currency', v_acc.currency,
    'account_holder', v_acc.account_holder,
    'bank_name', v_acc.bank_name,
    'iban_masked', v_acc.iban_masked,
    'details', v_acc.details,
    'status', v_acc.status
  );
end;
$$;

grant execute on function public.admin_odeme_hesabi_detay(uuid) to authenticated;

-- Doğrulama RPC'si artık satırın tamamını (details dahil) döndürmesin.
drop function if exists public.admin_odeme_hesabi_dogrula(uuid, text, text);

create or replace function public.admin_odeme_hesabi_dogrula(
  p_account_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_before jsonb;
  v_row public.creator_payout_accounts%rowtype;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  if p_status not in ('verified', 'rejected', 'disabled', 'pending_verification') then
    raise exception 'invalid_status';
  end if;

  select * into v_row from public.creator_payout_accounts
  where id = p_account_id for update;
  if not found then raise exception 'Not found'; end if;

  v_before := jsonb_build_object(
    'id', v_row.id, 'status', v_row.status, 'scheme', v_row.scheme,
    'iban_masked', v_row.iban_masked, 'details_masked', v_row.details_masked
  );

  update public.creator_payout_accounts set
    status = p_status,
    verified_at = case when p_status = 'verified' then now() else verified_at end,
    verified_by = case when p_status = 'verified' then auth.uid() else verified_by end,
    updated_at = now()
  where id = p_account_id
  returning * into v_row;

  perform public.finans_denetim_yaz(
    auth.uid(), 'payout_account_verified', 'creator_payout_account', v_row.id,
    null, v_before,
    jsonb_build_object(
      'id', v_row.id, 'status', v_row.status, 'scheme', v_row.scheme,
      'iban_masked', v_row.iban_masked, 'details_masked', v_row.details_masked
    ),
    jsonb_build_object('note', p_note)
  );

  return jsonb_build_object(
    'id', v_row.id,
    'method', v_row.method,
    'scheme', v_row.scheme,
    'country_code', v_row.country_code,
    'currency', v_row.currency,
    'account_holder', v_row.account_holder,
    'bank_name', v_row.bank_name,
    'iban_masked', v_row.iban_masked,
    'details_masked', v_row.details_masked,
    'status', v_row.status,
    'verified_at', v_row.verified_at,
    'last_changed_at', v_row.last_changed_at
  );
end;
$$;

grant execute on function public.admin_odeme_hesabi_dogrula(uuid, text, text) to authenticated;

-- Admin yayıncı detayı: maskeli talimat da dönsün.
create or replace function public.admin_yayinci_detay(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_profile jsonb;
  v_enr jsonb;
  v_acc jsonb;
  v_elig jsonb;
  v_totals jsonb;
  v_entries jsonb;
  v_payouts jsonb;
  v_adj numeric(14,4) := 0;
  v_diamonds numeric(20,0) := 0;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden'; end if;
  if p_user_id is null then raise exception 'user_required'; end if;

  select jsonb_build_object(
    'user_id', p.id,
    'display_name', p.display_name,
    'username', p.username,
    'country_code', p.country_code,
    'birth_date', p.birth_date
  ) into v_profile
  from public.profiles p
  where p.id = p_user_id;

  if v_profile is null then raise exception 'user_not_found'; end if;

  select to_jsonb(e) - 'user_id' into v_enr
  from public.creator_program_enrollments e
  where e.user_id = p_user_id;

  -- Ödeme hesabı: yalnızca maskeli talimat ve durum bilgisi döner.
  select jsonb_build_object(
    'id', a.id,
    'method', a.method,
    'scheme', a.scheme,
    'account_holder', a.account_holder,
    'bank_name', a.bank_name,
    'iban_masked', a.iban_masked,
    'details_masked', a.details_masked,
    'country_code', a.country_code,
    'currency', a.currency,
    'status', a.status,
    'verified_at', a.verified_at,
    'last_changed_at', a.last_changed_at
  ) into v_acc
  from public.creator_payout_accounts a
  where a.user_id = p_user_id;

  v_elig := public.yayinci_uygunluk_durumu(p_user_id);

  select coalesce(sum(a.amount_usd), 0) into v_adj
  from public.creator_earning_adjustments a
  where a.creator_id = p_user_id and a.applied = false;

  select coalesce(sum(d.amount), 0) into v_diamonds
  from public.creator_reward_diamonds d
  where d.creator_id = p_user_id;

  select jsonb_build_object(
    'pending_usd', coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'pending'), 0),
    'available_usd', coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'available'), 0),
    'on_hold_usd', coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'on_hold'), 0),
    'in_payout_usd', coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'in_payout'), 0),
    'paid_usd', coalesce(sum(e.net_usd) filter (where public.yayinci_kazanc_durumu(e) = 'paid'), 0),
    'lifetime_creator_usd', coalesce(sum(e.creator_usd) filter (where e.eligible), 0),
    'lifetime_gross_usd', coalesce(sum(e.gross_usd) filter (where e.eligible), 0),
    'lifetime_platform_usd', coalesce(sum(e.platform_usd) filter (where e.eligible), 0),
    'created_count', count(*),
    'ineligible_count', count(*) filter (where not e.eligible)
  ) into v_totals
  from public.creator_earning_entries e
  where e.creator_id = p_user_id;

  v_totals := coalesce(v_totals, '{}'::jsonb) || jsonb_build_object(
    'adjustments_usd', v_adj,
    'diamonds', v_diamonds
  );

  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) into v_entries
  from (
    select e.id, e.created_at, e.source_type, e.channel, e.coin_source, e.coins,
           e.gross_usd, e.creator_usd, e.platform_usd, e.deductions_usd, e.net_usd,
           e.eligible, e.ineligible_reason, public.yayinci_kazanc_durumu(e) as status,
           e.period_start, e.period_end
    from public.creator_earning_entries e
    where e.creator_id = p_user_id
    order by e.created_at desc
    limit 30
  ) x;

  select coalesce(jsonb_agg(y order by y.created_at desc), '[]'::jsonb) into v_payouts
  from (
    select i.id, i.batch_id, i.amount_usd, i.fee_usd, i.net_usd, i.status,
           i.external_reference, i.failure_reason, i.sent_at, i.paid_at,
           i.created_at, b.period_month, b.payout_date, b.status as batch_status,
           i.payout_account_id
    from public.payout_batch_items i
    join public.payout_batches b on b.id = i.batch_id
    where i.creator_id = p_user_id
    order by i.created_at desc
    limit 10
  ) y;

  return jsonb_build_object(
    'profile', v_profile,
    'enrollment', v_enr,
    'payout_account', v_acc,
    'eligibility', v_elig,
    'totals', v_totals,
    'entries', v_entries,
    'payouts', v_payouts,
    'currency', 'USD'
  );
end;
$$;

grant execute on function public.admin_yayinci_detay(uuid) to authenticated;

-- Parti kalemlerinde de talimat türü ve maskeli özet görünsün.
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
    'payout_account_id', coalesce(i.payout_account_id, cpa.id),
    'scheme', coalesce(cpa.scheme, r.payout_scheme),
    'details_masked', coalesce(cpa.details_masked, r.payout_details_masked, '{}'::jsonb),
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

-- ---------------------------------------------------------------------------
-- 7) Kolon düzeyi yetki: tam talimat yalnızca denetimli RPC ile okunur
-- ---------------------------------------------------------------------------

revoke select on public.creator_payout_accounts from anon, authenticated;

grant select (
  id, user_id, method, scheme, country_code, currency, account_holder,
  bank_name, iban_masked, details_masked, status, verified_at, verified_by,
  last_changed_at, created_at, updated_at
) on public.creator_payout_accounts to authenticated;
