-- ===========================================================================
-- Tamuso · Yayıncı ödeme profili (tek yer) + şirket / vergi belgeleri
-- ===========================================================================
-- Amaç: yayıncı programına giren kullanıcıdan istenen her şey tek ekranda ve
-- tek kayıtta toplansın:
--
--   * ülke, ad, soyad, telefon
--   * vergi numarası + vergi dairesi
--   * şirket beyanı: "şirketim var" / "şirketim yok"
--   * şirket varsa unvan + şirket vergi numarası
--   * banka/ödeme talimatı (mevcut creator_payout_accounts)
--   * vergi levhası ve şirket evrakları (özel kova, sürümlü)
--
-- Belgeler SİLİNEMEZ. Yeni belge yüklemek eskisinin üzerine yazmaz; aynı tür
-- için version = max + 1 ile yeni satır açılır. Böylece kullanıcı her ödemede
-- evrakı yeniden yüklemek zorunda kalmaz, geçmiş de denetimde korunur.
--
-- Bu dosya hiçbir ödeme sağlayıcısı çağırmaz. Tüm durum geçişleri
-- SECURITY DEFINER RPC'lerindedir; istemci yalnızca form ve yükleme yapar.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Profil tablosu
-- ---------------------------------------------------------------------------

create table if not exists public.creator_payout_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  legal_first_name text not null,
  legal_last_name text not null,
  phone_country_code text,
  phone text not null,
  tax_number text,
  tax_office text,
  has_company boolean not null default false,
  company_name text,
  company_tax_number text,
  company_country_code text,
  status text not null default 'incomplete'
    check (status in ('incomplete', 'submitted', 'verified', 'rejected')),
  submitted_at timestamptz,
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_payout_profiles_company_chk check (
    not has_company
    or (
      coalesce(length(btrim(company_name)), 0) >= 2
      and coalesce(length(btrim(company_tax_number)), 0) >= 4
    )
  )
);

comment on table public.creator_payout_profiles is
  'Yayıncı ödeme profili: ülke, ad, telefon, vergi ve şirket beyanı tek kayıtta.';
comment on column public.creator_payout_profiles.has_company is
  'false → "şirketim yok" beyanı. Şirket evrakları istenmez.';
comment on column public.creator_payout_profiles.status is
  'incomplete | submitted | verified | rejected — yalnızca sunucu RPC değiştirir.';

drop trigger if exists creator_payout_profiles_updated_at on public.creator_payout_profiles;
create trigger creator_payout_profiles_updated_at
  before update on public.creator_payout_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2) Belge tablosu (sürümlü + silinemez)
-- ---------------------------------------------------------------------------

create table if not exists public.creator_payout_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  doc_type text not null check (doc_type in (
    'personal_id',
    'tax_certificate',
    'company_registration',
    'company_signature',
    'bank_letter',
    'address_proof',
    'other'
  )),
  version int not null default 0 check (version >= 0),
  storage_path text not null unique,
  mime text not null,
  file_name text,
  byte_size bigint check (byte_size is null or byte_size between 1 and 10485760),
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, doc_type, version)
);

comment on table public.creator_payout_documents is
  'Vergi/şirket evrakları. Satırlar silinemez; yeni yükleme yeni version açar.';
comment on column public.creator_payout_documents.storage_path is
  'creator-payout-docs kovasındaki özel yol: <uid>/<doc_type>-<zaman>.<uzantı>';

create index if not exists creator_payout_documents_user_idx
  on public.creator_payout_documents (user_id, doc_type, version desc);

-- Sürüm numarası sunucuda atanır; istemci gönderse bile yok sayılır.
create or replace function public.creator_payout_documents_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_son int;
begin
  if new.version is null or new.version <= 0 then
    select coalesce(max(d.version), 0) + 1
      into v_son
      from public.creator_payout_documents d
     where d.user_id = new.user_id
       and d.doc_type = new.doc_type;
    new.version := v_son;
  end if;
  new.created_at := coalesce(new.created_at, now());
  return new;
end;
$$;

drop trigger if exists creator_payout_documents_version_bi on public.creator_payout_documents;
create trigger creator_payout_documents_version_bi
  before insert on public.creator_payout_documents
  for each row execute function public.creator_payout_documents_version();

-- Silme yasak; güncellemede yalnızca inceleme alanları değişebilir.
-- Platform rolleri hesap silme / saklama imhası için muaftır.
create or replace function public.creator_payout_documents_koru()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_imha boolean := coalesce(current_setting('tamuso.belge_imha', true), '') = 'on';
begin
  if tg_op = 'DELETE' then
    -- Hesap silme (FK cascade) ve saklama imhası dışında silme yoktur.
    if v_imha or pg_trigger_depth() > 1 then
      return old;
    end if;
    raise exception 'document_immutable';
  end if;

  if v_imha then
    return new;
  end if;

  if new.user_id <> old.user_id
     or new.doc_type <> old.doc_type
     or new.version <> old.version
     or new.storage_path <> old.storage_path
     or new.mime <> old.mime
     or coalesce(new.file_name, '') <> coalesce(old.file_name, '')
     or coalesce(new.byte_size, -1) <> coalesce(old.byte_size, -1)
     or new.created_at <> old.created_at then
    raise exception 'document_immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists creator_payout_documents_koru_bu on public.creator_payout_documents;
create trigger creator_payout_documents_koru_bu
  before update or delete on public.creator_payout_documents
  for each row execute function public.creator_payout_documents_koru();

-- ---------------------------------------------------------------------------
-- 3) RLS — istemci tabloları doğrudan okuyamaz/yazamaz; RPC kullanır
-- ---------------------------------------------------------------------------

alter table public.creator_payout_profiles enable row level security;
alter table public.creator_payout_documents enable row level security;

drop policy if exists creator_payout_profiles_deny on public.creator_payout_profiles;
create policy creator_payout_profiles_deny on public.creator_payout_profiles
  for all to authenticated using (false) with check (false);

drop policy if exists creator_payout_documents_deny on public.creator_payout_documents;
create policy creator_payout_documents_deny on public.creator_payout_documents
  for all to authenticated using (false) with check (false);

revoke all on public.creator_payout_profiles from public, anon, authenticated;
revoke all on public.creator_payout_documents from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Özel kova — kullanıcı yalnızca kendi klasörüne yükler, silemez
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creator-payout-docs',
  'creator-payout-docs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists creator_payout_docs_own_insert on storage.objects;
create policy creator_payout_docs_own_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'creator-payout-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Kullanıcı kendi belgesini geri okuyamaz ve silemez (belgeler kalıcıdır).
drop policy if exists creator_payout_docs_reviewer_select on storage.objects;
create policy creator_payout_docs_reviewer_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'creator-payout-docs'
    and public.admin_has_permission('finance.view')
  );

-- ---------------------------------------------------------------------------
-- 5) Yardımcılar — zorunlu belgeler ve eksik listesi
-- ---------------------------------------------------------------------------

create or replace function public.yayinci_odeme_belge_gerekli(p_has_company boolean)
returns jsonb
language sql
immutable
as $$
  select case
    when coalesce(p_has_company, false)
      then '["tax_certificate","company_registration"]'::jsonb
    else '["tax_certificate"]'::jsonb
  end;
$$;

/**
 * Profil eksik kodları. Boş dizi → ödeme profili tamam.
 * Kodlar istemcide i18n anahtarına eşlenir; sıra form sırasıdır.
 */
create or replace function public.yayinci_odeme_profil_eksikleri(p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user, auth.uid());
  v_pr public.creator_payout_profiles%rowtype;
  v_vergi boolean := false;
  v_sirket boolean := false;
begin
  if v_uid is null then
    return '["profil"]'::jsonb;
  end if;

  select * into v_pr from public.creator_payout_profiles where user_id = v_uid;
  if not found then
    return '["profil"]'::jsonb;
  end if;

  v_vergi := exists (
    select 1 from public.creator_payout_documents d
    where d.user_id = v_uid and d.doc_type = 'tax_certificate' and d.status <> 'rejected'
  );
  v_sirket := exists (
    select 1 from public.creator_payout_documents d
    where d.user_id = v_uid and d.doc_type = 'company_registration' and d.status <> 'rejected'
  );

  return (
    select coalesce(jsonb_agg(k order by sira), '[]'::jsonb)
    from (
      select 'ad' as k, 1 as sira
        where coalesce(length(btrim(v_pr.legal_first_name)), 0) < 2
      union all select 'soyad', 2
        where coalesce(length(btrim(v_pr.legal_last_name)), 0) < 2
      union all select 'telefon', 3
        where coalesce(length(regexp_replace(v_pr.phone, '\D', '', 'g')), 0) < 6
      union all select 'ulke', 4
        where v_pr.country_code !~ '^[A-Z]{2}$'
      union all select 'vergi_no', 5
        where coalesce(btrim(v_pr.tax_number), '') = ''
          and coalesce(btrim(v_pr.company_tax_number), '') = ''
      union all select 'sirket_adi', 6
        where v_pr.has_company and coalesce(length(btrim(v_pr.company_name)), 0) < 2
      union all select 'sirket_vergi_no', 7
        where v_pr.has_company and coalesce(btrim(v_pr.company_tax_number), '') = ''
      union all select 'vergi_belgesi', 8
        where not v_vergi
      union all select 'sirket_belgesi', 9
        where v_pr.has_company and not v_sirket
    ) t
  );
end;
$$;

/** Eksik listesine göre durumu tazeler (verified durumu korunur). */
create or replace function public.yayinci_odeme_profil_durum_yenile(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eksik jsonb;
  v_yeni text;
begin
  v_eksik := public.yayinci_odeme_profil_eksikleri(p_user);

  update public.creator_payout_profiles
     set status = case
         when status = 'verified' then 'verified'
         when jsonb_array_length(v_eksik) = 0 then 'submitted'
         else 'incomplete'
       end,
       submitted_at = case
         when status <> 'verified' and jsonb_array_length(v_eksik) = 0
           then coalesce(submitted_at, now())
         else submitted_at
       end
   where user_id = p_user
     and status in ('incomplete', 'submitted')
  returning status into v_yeni;

  return coalesce(v_yeni, '' );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) Kullanıcı RPC'leri
-- ---------------------------------------------------------------------------

/** Profil + belgeler + banka özeti + eksikler tek çağrıda. */
create or replace function public.yayinci_odeme_profilim()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pr public.creator_payout_profiles%rowtype;
  v_var boolean := false;
  v_acc public.creator_payout_accounts%rowtype;
  v_banka boolean := false;
  v_belgeler jsonb;
  v_eksik jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_pr from public.creator_payout_profiles where user_id = v_uid;
  v_var := found;

  select * into v_acc from public.creator_payout_accounts where user_id = v_uid;
  v_banka := found;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id,
           'doc_type', d.doc_type,
           'version', d.version,
           'status', d.status,
           'file_name', d.file_name,
           'mime', d.mime,
           'byte_size', d.byte_size,
           'created_at', d.created_at,
           'review_note', d.review_note,
           'reviewed_at', d.reviewed_at
         ) order by d.doc_type, d.version desc), '[]'::jsonb)
    into v_belgeler
    from public.creator_payout_documents d
   where d.user_id = v_uid;

  v_eksik := public.yayinci_odeme_profil_eksikleri(v_uid);

  return jsonb_build_object(
    'exists', v_var,
    'status', case when v_var then v_pr.status else 'incomplete' end,
    'tamam', jsonb_array_length(v_eksik) = 0,
    'eksikler', v_eksik,
    'sirket_yok', case when v_var then not v_pr.has_company else false end,
    'has_company', case when v_var then v_pr.has_company else false end,
    'belge_gerekli', public.yayinci_odeme_belge_gerekli(
      case when v_var then v_pr.has_company else false end
    ),
    'profile', case when v_var then jsonb_build_object(
      'country_code', v_pr.country_code,
      'legal_first_name', v_pr.legal_first_name,
      'legal_last_name', v_pr.legal_last_name,
      'phone_country_code', v_pr.phone_country_code,
      'phone', v_pr.phone,
      'tax_number', v_pr.tax_number,
      'tax_office', v_pr.tax_office,
      'has_company', v_pr.has_company,
      'company_name', v_pr.company_name,
      'company_tax_number', v_pr.company_tax_number,
      'company_country_code', v_pr.company_country_code,
      'status', v_pr.status,
      'submitted_at', v_pr.submitted_at,
      'verified_at', v_pr.verified_at,
      'rejection_reason', v_pr.rejection_reason,
      'updated_at', v_pr.updated_at
    ) else null end,
    'documents', v_belgeler,
    'banka', jsonb_build_object(
      'exists', v_banka,
      'status', case when v_banka then v_acc.status else 'none' end,
      'country_code', case when v_banka then v_acc.country_code else null end,
      'account_holder', case when v_banka then v_acc.account_holder else null end,
      'bank_name', case when v_banka then v_acc.bank_name else null end,
      'scheme', case when v_banka then v_acc.scheme else null end,
      'currency', case when v_banka then v_acc.currency else null end,
      'masked', case when v_banka then v_acc.details_masked else '{}'::jsonb end
    )
  );
end;
$$;

/**
 * Profil kaydı. Tüm alanlar sunucuda doğrulanır; istemci yalnızca form gönderir.
 * Şirket yoksa yalnızca has_company = false gönderilir.
 */
create or replace function public.yayinci_odeme_profili_kaydet(
  p_country_code text,
  p_legal_first_name text,
  p_legal_last_name text,
  p_phone text,
  p_tax_number text default null,
  p_tax_office text default null,
  p_has_company boolean default false,
  p_company_name text default null,
  p_company_tax_number text default null,
  p_company_country_code text default null,
  p_phone_country_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ulke text := upper(btrim(coalesce(p_country_code, '')));
  v_ad text := btrim(coalesce(p_legal_first_name, ''));
  v_soyad text := btrim(coalesce(p_legal_last_name, ''));
  v_telefon text := btrim(coalesce(p_phone, ''));
  v_vergino text := upper(btrim(coalesce(p_tax_number, '')));
  v_sirket text := btrim(coalesce(p_company_name, ''));
  v_sirket_vergino text := upper(btrim(coalesce(p_company_tax_number, '')));
  v_sirket_ulke text := upper(btrim(coalesce(p_company_country_code, '')));
  v_eski jsonb;
  v_yeni jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if v_ulke !~ '^[A-Z]{2}$' then raise exception 'invalid_country'; end if;
  if length(v_ad) < 2 then raise exception 'invalid_first_name'; end if;
  if length(v_soyad) < 2 then raise exception 'invalid_last_name'; end if;
  if length(regexp_replace(v_telefon, '\D', '', 'g')) < 6
     or length(regexp_replace(v_telefon, '\D', '', 'g')) > 15 then
    raise exception 'invalid_phone';
  end if;

  if v_vergino <> '' and v_vergino !~ '^[A-Z0-9][A-Z0-9.\-]{3,23}$' then
    raise exception 'invalid_tax_number';
  end if;

  if coalesce(p_has_company, false) then
    if length(v_sirket) < 2 then raise exception 'company_name_required'; end if;
    if length(v_sirket_vergino) < 4 then raise exception 'company_tax_number_required'; end if;
    if v_sirket_vergino !~ '^[A-Z0-9][A-Z0-9.\-]{3,23}$' then
      raise exception 'invalid_company_tax_number';
    end if;
    if v_sirket_ulke <> '' and v_sirket_ulke !~ '^[A-Z]{2}$' then
      raise exception 'invalid_country';
    end if;
  end if;

  select to_jsonb(p) into v_eski
    from public.creator_payout_profiles p where p.user_id = v_uid;

  insert into public.creator_payout_profiles (
    user_id, country_code, legal_first_name, legal_last_name,
    phone_country_code, phone, tax_number, tax_office,
    has_company, company_name, company_tax_number, company_country_code,
    status
  ) values (
    v_uid, v_ulke, v_ad, v_soyad,
    nullif(btrim(coalesce(p_phone_country_code, '')), ''), v_telefon,
    nullif(v_vergino, ''), nullif(btrim(coalesce(p_tax_office, '')), ''),
    coalesce(p_has_company, false),
    case when coalesce(p_has_company, false) then v_sirket else null end,
    case when coalesce(p_has_company, false) then v_sirket_vergino else null end,
    case when coalesce(p_has_company, false) then nullif(v_sirket_ulke, '') else null end,
    'incomplete'
  )
  on conflict (user_id) do update set
    country_code = excluded.country_code,
    legal_first_name = excluded.legal_first_name,
    legal_last_name = excluded.legal_last_name,
    phone_country_code = excluded.phone_country_code,
    phone = excluded.phone,
    tax_number = excluded.tax_number,
    tax_office = excluded.tax_office,
    has_company = excluded.has_company,
    company_name = excluded.company_name,
    company_tax_number = excluded.company_tax_number,
    company_country_code = excluded.company_country_code,
    -- Doğrulanmış profil, içerik değişirse yeniden incelemeye döner.
    status = case
      when public.creator_payout_profiles.status = 'verified'
       and (public.creator_payout_profiles.country_code is distinct from excluded.country_code
         or public.creator_payout_profiles.legal_first_name is distinct from excluded.legal_first_name
         or public.creator_payout_profiles.legal_last_name is distinct from excluded.legal_last_name
         or public.creator_payout_profiles.tax_number is distinct from excluded.tax_number
         or public.creator_payout_profiles.has_company is distinct from excluded.has_company
         or public.creator_payout_profiles.company_name is distinct from excluded.company_name
         or public.creator_payout_profiles.company_tax_number is distinct from excluded.company_tax_number)
        then 'incomplete'
      else public.creator_payout_profiles.status
    end,
    verified_at = case
      when public.creator_payout_profiles.status = 'verified'
       and (public.creator_payout_profiles.country_code is distinct from excluded.country_code
         or public.creator_payout_profiles.legal_first_name is distinct from excluded.legal_first_name
         or public.creator_payout_profiles.legal_last_name is distinct from excluded.legal_last_name
         or public.creator_payout_profiles.tax_number is distinct from excluded.tax_number
         or public.creator_payout_profiles.has_company is distinct from excluded.has_company
         or public.creator_payout_profiles.company_name is distinct from excluded.company_name
         or public.creator_payout_profiles.company_tax_number is distinct from excluded.company_tax_number)
        then null
      else public.creator_payout_profiles.verified_at
    end;

  perform public.yayinci_odeme_profil_durum_yenile(v_uid);

  select to_jsonb(p) into v_yeni
    from public.creator_payout_profiles p where p.user_id = v_uid;

  begin
    perform public.finans_denetim_yaz(
      v_uid, 'payout_profile_saved', 'creator_payout_profile', v_uid,
      null, v_eski, v_yeni, '{}'::jsonb
    );
  exception when others then
    null;
  end;

  return public.yayinci_odeme_profilim();
end;
$$;

/**
 * Yeni belge sürümü kaydı. storage_path istemciden gelir ama sunucu
 * <uid>/ önekini ve tür/mime sınırlarını doğrular. Aynı yol iki kez kaydedilemez.
 */
create or replace function public.yayinci_odeme_belgesi_kaydet(
  p_doc_type text,
  p_storage_path text,
  p_mime text,
  p_file_name text default null,
  p_byte_size bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tur text := lower(btrim(coalesce(p_doc_type, '')));
  v_yol text := btrim(coalesce(p_storage_path, ''));
  v_mime text := lower(btrim(coalesce(p_mime, '')));
  v_pr public.creator_payout_profiles%rowtype;
  v_row public.creator_payout_documents%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if v_tur not in (
    'personal_id', 'tax_certificate', 'company_registration',
    'company_signature', 'bank_letter', 'address_proof', 'other'
  ) then
    raise exception 'invalid_doc_type';
  end if;

  if v_yol = '' or v_yol !~ ('^' || v_uid::text || '/[A-Za-z0-9._-]{3,160}$') then
    raise exception 'invalid_storage_path';
  end if;

  if v_mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf') then
    raise exception 'invalid_mime';
  end if;

  if p_byte_size is not null and (p_byte_size < 1 or p_byte_size > 10485760) then
    raise exception 'invalid_file_size';
  end if;

  select * into v_pr from public.creator_payout_profiles where user_id = v_uid;
  if not found then
    raise exception 'profile_required';
  end if;

  -- Şirket beyanı yokken şirket evrakı istenmez; yüklenmesi de kabul edilmez.
  if v_tur in ('company_registration', 'company_signature') and not v_pr.has_company then
    raise exception 'company_not_declared';
  end if;

  if exists (
    select 1 from public.creator_payout_documents d
    where d.user_id = v_uid and d.doc_type = v_tur and d.status = 'approved'
  ) then
    -- Onaylı belge korunur; yeni yükleme "submitted" olarak yeni sürüm açar.
    null;
  end if;

  insert into public.creator_payout_documents (
    user_id, doc_type, storage_path, mime, file_name, byte_size, status
  ) values (
    v_uid, v_tur, v_yol, v_mime,
    nullif(left(btrim(coalesce(p_file_name, '')), 160), ''),
    p_byte_size, 'submitted'
  )
  returning * into v_row;

  perform public.yayinci_odeme_profil_durum_yenile(v_uid);

  begin
    perform public.finans_denetim_yaz(
      v_uid, 'payout_document_uploaded', 'creator_payout_document', v_row.id,
      null, null,
      jsonb_build_object(
        'doc_type', v_row.doc_type, 'version', v_row.version,
        'mime', v_row.mime, 'byte_size', v_row.byte_size
      ),
      '{}'::jsonb
    );
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'doc_type', v_row.doc_type,
    'version', v_row.version,
    'status', v_row.status
  );
end;
$$;

/** Belge sürümlerim — yol Paylaşılmaz, yalnızca meta veri. */
create or replace function public.yayinci_odeme_belgelerim()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_liste jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id,
           'doc_type', d.doc_type,
           'version', d.version,
           'status', d.status,
           'file_name', d.file_name,
           'mime', d.mime,
           'byte_size', d.byte_size,
           'created_at', d.created_at,
           'review_note', d.review_note,
           'reviewed_at', d.reviewed_at
         ) order by d.doc_type, d.version desc), '[]'::jsonb)
    into v_liste
    from public.creator_payout_documents d
   where d.user_id = v_uid;

  return v_liste;
end;
$$;

revoke all on function public.yayinci_odeme_profilim() from public, anon;
revoke all on function public.yayinci_odeme_profili_kaydet(
  text, text, text, text, text, text, boolean, text, text, text, text
) from public, anon;
revoke all on function public.yayinci_odeme_belgesi_kaydet(text, text, text, text, bigint) from public, anon;
revoke all on function public.yayinci_odeme_belgelerim() from public, anon;
revoke all on function public.yayinci_odeme_profil_eksikleri(uuid) from public, anon;

grant execute on function public.yayinci_odeme_profilim() to authenticated;
grant execute on function public.yayinci_odeme_profili_kaydet(
  text, text, text, text, text, text, boolean, text, text, text, text
) to authenticated;
grant execute on function public.yayinci_odeme_belgesi_kaydet(text, text, text, text, bigint) to authenticated;
grant execute on function public.yayinci_odeme_belgelerim() to authenticated;
grant execute on function public.yayinci_odeme_profil_eksikleri(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Admin RPC'leri — finans izni + denetim kaydı
-- ---------------------------------------------------------------------------

create or replace function public.admin_yayinci_odeme_profili_getir(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pr public.creator_payout_profiles%rowtype;
  v_belgeler jsonb;
begin
  if not public.admin_has_permission('finance.view') then
    raise exception 'Forbidden';
  end if;

  select * into v_pr from public.creator_payout_profiles where user_id = p_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id,
           'doc_type', d.doc_type,
           'version', d.version,
           'status', d.status,
           'file_name', d.file_name,
           'mime', d.mime,
           'byte_size', d.byte_size,
           'created_at', d.created_at,
           'review_note', d.review_note,
           'reviewed_at', d.reviewed_at
         ) order by d.doc_type, d.version desc), '[]'::jsonb)
    into v_belgeler
    from public.creator_payout_documents d
   where d.user_id = p_user_id;

  perform public.finans_denetim_yaz(
    auth.uid(), 'payout_profile_viewed', 'creator_payout_profile', p_user_id,
    null, null, jsonb_build_object('documents', jsonb_array_length(v_belgeler)),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'exists', v_pr.user_id is not null,
    'profile', case when v_pr.user_id is null then null else jsonb_build_object(
      'user_id', v_pr.user_id,
      'country_code', v_pr.country_code,
      'legal_first_name', v_pr.legal_first_name,
      'legal_last_name', v_pr.legal_last_name,
      'phone_country_code', v_pr.phone_country_code,
      'phone', v_pr.phone,
      'tax_number', v_pr.tax_number,
      'tax_office', v_pr.tax_office,
      'has_company', v_pr.has_company,
      'company_name', v_pr.company_name,
      'company_tax_number', v_pr.company_tax_number,
      'company_country_code', v_pr.company_country_code,
      'status', v_pr.status,
      'submitted_at', v_pr.submitted_at,
      'verified_at', v_pr.verified_at,
      'rejection_reason', v_pr.rejection_reason,
      'updated_at', v_pr.updated_at
    ) end,
    'documents', v_belgeler,
    'eksikler', public.yayinci_odeme_profil_eksikleri(p_user_id)
  );
end;
$$;

/** Kısa ömürlü imzalı görüntüleme yolu; her çağrı denetime yazılır. */
create or replace function public.admin_yayinci_odeme_belgesi_erisim(
  p_document_id uuid,
  p_purpose text default 'review'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.creator_payout_documents%rowtype;
begin
  if not public.admin_has_permission('finance.view') then
    raise exception 'Forbidden';
  end if;

  select * into v_row from public.creator_payout_documents where id = p_document_id;
  if not found then raise exception 'Not found'; end if;

  perform public.finans_denetim_yaz(
    auth.uid(), 'payout_document_accessed', 'creator_payout_document', v_row.id,
    null, null,
    jsonb_build_object('purpose', coalesce(p_purpose, 'review'), 'doc_type', v_row.doc_type),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'bucket', 'creator-payout-docs',
    'path', v_row.storage_path,
    'doc_type', v_row.doc_type,
    'version', v_row.version,
    'expires_in', 300
  );
end;
$$;

create or replace function public.admin_yayinci_odeme_belgesi_karar(
  p_document_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.creator_payout_documents%rowtype;
  v_status text := lower(btrim(coalesce(p_status, '')));
begin
  if not public.admin_has_permission('finance.view') then
    raise exception 'Forbidden';
  end if;
  if v_status not in ('under_review', 'approved', 'rejected') then
    raise exception 'invalid_status';
  end if;
  if v_status = 'rejected' and coalesce(btrim(p_note), '') = '' then
    raise exception 'note_required';
  end if;

  update public.creator_payout_documents
     set status = v_status,
         review_note = nullif(left(btrim(coalesce(p_note, '')), 500), ''),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_document_id
  returning * into v_row;

  if v_row.id is null then raise exception 'Not found'; end if;

  begin
    perform public.bildirim_kuyruga_ekle(
      v_row.user_id, 'wallet',
      case when v_status = 'approved'
        then 'Ödeme belgeniz onaylandı'
        else 'Ödeme belgeniz güncellenmeli' end,
      case when v_status = 'approved'
        then 'Yayıncı ödeme evrakınız onaylandı.'
        else coalesce(left(p_note, 300), 'Ödeme evrakınız için yeni bir belge yükleyin.') end,
      '/cuzdan/yayinci-kazanclari/odeme-profili',
      jsonb_build_object('type', 'payout_document', 'document_id', v_row.id, 'status', v_status)
    );
  exception when others then
    null;
  end;

  return jsonb_build_object('ok', true, 'status', v_row.status, 'version', v_row.version);
end;
$$;

create or replace function public.admin_yayinci_odeme_profili_karar(
  p_user_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_row public.creator_payout_profiles%rowtype;
begin
  if not public.admin_has_permission('finance.view') then
    raise exception 'Forbidden';
  end if;
  if v_status not in ('verified', 'rejected') then
    raise exception 'invalid_status';
  end if;
  if v_status = 'rejected' and coalesce(btrim(p_note), '') = '' then
    raise exception 'note_required';
  end if;

  update public.creator_payout_profiles
     set status = v_status,
         verified_at = case when v_status = 'verified' then now() else null end,
         rejection_reason = case when v_status = 'rejected'
           then nullif(left(btrim(coalesce(p_note, '')), 500), '') else null end
   where user_id = p_user_id
  returning * into v_row;

  if v_row.user_id is null then raise exception 'Not found'; end if;

  perform public.finans_denetim_yaz(
    auth.uid(), 'payout_profile_' || v_status, 'creator_payout_profile', p_user_id,
    null, null,
    jsonb_build_object('note', nullif(left(btrim(coalesce(p_note, '')), 500), '')),
    '{}'::jsonb
  );

  begin
    perform public.bildirim_kuyruga_ekle(
      p_user_id, 'wallet',
      case when v_status = 'verified'
        then 'Ödeme profiliniz doğrulandı'
        else 'Ödeme profiliniz güncellenmeli' end,
      case when v_status = 'verified'
        then 'Vergi ve ödeme bilgileriniz doğrulandı.'
        else coalesce(left(p_note, 300), 'Ödeme profilinizde düzeltme gerekiyor.') end,
      '/cuzdan/yayinci-kazanclari/odeme-profili',
      jsonb_build_object('type', 'payout_profile', 'status', v_status)
    );
  exception when others then
    null;
  end;

  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

revoke all on function public.admin_yayinci_odeme_profili_getir(uuid) from public, anon;
revoke all on function public.admin_yayinci_odeme_belgesi_erisim(uuid, text) from public, anon;
revoke all on function public.admin_yayinci_odeme_belgesi_karar(uuid, text, text) from public, anon;
revoke all on function public.admin_yayinci_odeme_profili_karar(uuid, text, text) from public, anon;

grant execute on function public.admin_yayinci_odeme_profili_getir(uuid) to authenticated;
grant execute on function public.admin_yayinci_odeme_belgesi_erisim(uuid, text) to authenticated;
grant execute on function public.admin_yayinci_odeme_belgesi_karar(uuid, text, text) to authenticated;
grant execute on function public.admin_yayinci_odeme_profili_karar(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) Tüm ülkeler — tanımlı kanalı olmayan ülke için genel şema
-- ---------------------------------------------------------------------------
-- Ülke/yöntem tablosunda satırı olmayan ülkeler artık "desteklenmiyor" diye
-- kapanmaz: SWIFT + hesap numarası ile uluslararası havale şeması döner.
-- Kayıt alınır, ödeme finans incelemesinden sonra elle yapılır.

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
  v_genel jsonb := jsonb_build_object(
    'method', 'bank_transfer',
    'provider', null,
    'currency', 'USD',
    'min_payout_usd', 25.00,
    'is_enabled', true,
    'auto_payout', false,
    'scheme', 'local_account',
    'fields', jsonb_build_array(
      jsonb_build_object('key', 'account_number', 'required', true,
        'min_length', 4, 'max_length', 34),
      jsonb_build_object('key', 'swift_bic', 'required', false,
        'pattern', '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$', 'max_length', 11)
    ),
    'requirements', jsonb_build_object(
      'scheme', 'local_account',
      'bank_name_required', true,
      'fields', jsonb_build_array(
        jsonb_build_object('key', 'account_number', 'required', true,
          'min_length', 4, 'max_length', 34),
        jsonb_build_object('key', 'swift_bic', 'required', false,
          'pattern', '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$', 'max_length', 11)
      )
    )
  );
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
  coalesce(jsonb_object_agg(
    c.method,
    coalesce(c.requirements -> 'fields', '[]'::jsonb)
  ) filter (where c.is_enabled), '{}'::jsonb)
  into v_methods, v_enabled, v_schema
  from public.country_payout_methods c
  where c.country_code = v_country;

  if v_country !~ '^[A-Z]{2}$' then
    return jsonb_build_object(
      'country_code', v_country,
      'supported', false,
      'methods', '[]'::jsonb,
      'field_schemas', '{}'::jsonb,
      'note', 'Geçerli bir ülke kodu seçin.'
    );
  end if;

  -- Tanımlı kanal yoksa tüm ülkeler için genel havale şeması.
  if coalesce(v_enabled, 0) = 0 then
    return jsonb_build_object(
      'country_code', v_country,
      'supported', true,
      'generic', true,
      'methods', jsonb_build_array(v_genel),
      'field_schemas', jsonb_build_object('bank_transfer', v_genel -> 'fields'),
      'note',
        'Bu ülke için tanımlı yerel kanal yok. Uluslararası havale bilgilerinizi kaydedin; ödeme finans incelemesinden sonra elle yapılır.'
    );
  end if;

  return jsonb_build_object(
    'country_code', v_country,
    'supported', true,
    'generic', false,
    'methods', v_methods,
    'field_schemas', v_schema,
    'note', null
  );
end;
$$;

grant execute on function public.yayinci_odeme_ulke_durumu(text) to authenticated;


-- ---------------------------------------------------------------------------
-- 9) �deme hesab� kayd� � her �lke i�in genel havale �emas�
-- ---------------------------------------------------------------------------
-- Tan�ml� �lke �emas� yoksa art�k IBAN zorlanmaz: SWIFT + hesap numaras�
-- kabul edilir. Eski istemci yaln�zca IBAN g�nderirse IBAN �emas� kullan�l�r.

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

  v_details := public.odeme_detay_normallestir(p_details);

  -- Eski istemci yaln�zca p_iban g�nderir.
  if v_details = '{}'::jsonb and coalesce(trim(p_iban), '') <> '' then
    v_details := jsonb_build_object('iban', upper(regexp_replace(trim(p_iban), '\s', '', 'g')));
  end if;

  -- �lke i�in tan�m yoksa: IBAN g�nderildiyse IBAN, aksi halde genel havale.
  if v_spec is null or jsonb_typeof(v_spec -> 'fields') is distinct from 'array' then
    if v_details ? 'iban' then
      v_spec := jsonb_build_object(
        'scheme', 'iban',
        'bank_name_required', false,
        'fields', '[{"key":"iban","required":true,"pattern":"^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$","max_length":34}]'::jsonb
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

  -- Mobil uyumluluk i�in eski tablo g�ncel tutulur.
  insert into public.user_bank_accounts (user_id, account_holder, bank_name, iban)
  values (
    v_uid,
    trim(p_account_holder),
    coalesce(nullif(trim(p_bank_name), ''), '�'),
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
