-- =============================================================================
-- Tamuso Verify — kendi altyapımızda kimlik doğrulama çekirdek şeması
--
-- Tasarım ilkeleri:
--   * Harici KYC sağlayıcısı yok; tüm veri Supabase'de kalır.
--   * Belge/selfie görüntüleri veritabanı satırına gömülmez; özel (public=false)
--     bucket'ta tutulur, istemciye yol (path) yalnızca denetimli RPC ile verilir.
--   * İstemci hiçbir durum alanını doğrudan yazamaz: tüm yazmalar SECURITY DEFINER
--     RPC üzerinden ve sunucu doğrulaması ile yapılır.
--   * "Kesin canlılık doğrulandı" iddiası üretilmez. Sunucu yalnızca ön sinyal
--     (pre-check) kaydeder; nihai karar insan incelemesidir.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Ülke bazlı desteklenen belge türleri
--    country_code = 'ZZ' → genel varsayılan (ülke satırı yoksa bu kullanılır)
-- ---------------------------------------------------------------------------
create table if not exists public.identity_document_types (
  country_code char(2) not null,
  doc_type text not null
    check (doc_type in ('id_card', 'passport', 'drivers_license', 'residence_permit')),
  sides_required smallint not null default 2 check (sides_required in (1, 2)),
  mrz_supported boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (country_code, doc_type)
);

create index if not exists identity_document_types_country_idx
  on public.identity_document_types (country_code, sort_order);

insert into public.identity_document_types
  (country_code, doc_type, sides_required, mrz_supported, is_active, sort_order)
values
  -- Türkiye
  ('TR', 'id_card',         2, false, true, 10),
  ('TR', 'passport',        1, true,  true, 20),
  ('TR', 'drivers_license', 2, false, true, 30),
  ('TR', 'residence_permit',2, false, true, 40),
  -- Filipinler
  ('PH', 'id_card',         2, false, true, 10),
  ('PH', 'passport',        1, true,  true, 20),
  ('PH', 'drivers_license', 2, false, true, 30),
  -- Kolombiya (pasaport dışı belgelerde arka yüz zorunlu değil)
  ('CO', 'id_card',         1, false, true, 10),
  ('CO', 'passport',        1, true,  true, 20),
  ('CO', 'drivers_license', 1, false, true, 30),
  -- Venezuela
  ('VE', 'id_card',         1, false, true, 10),
  ('VE', 'passport',        1, true,  true, 20),
  -- Mısır
  ('EG', 'id_card',         2, false, true, 10),
  ('EG', 'passport',        1, true,  true, 20),
  ('EG', 'drivers_license', 2, false, true, 30),
  -- Genel varsayılan
  ('ZZ', 'id_card',         2, false, true, 10),
  ('ZZ', 'passport',        1, true,  true, 20),
  ('ZZ', 'drivers_license', 2, false, true, 30),
  ('ZZ', 'residence_permit',2, false, true, 40)
on conflict (country_code, doc_type) do update set
  sides_required = excluded.sides_required,
  mrz_supported = excluded.mrz_supported,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 1) Ayarlar (tek satır)
-- ---------------------------------------------------------------------------
create table if not exists public.identity_verify_settings (
  id smallint primary key default 1 check (id = 1),
  selfie_deneme_limiti smallint not null default 3 check (selfie_deneme_limiti between 1 and 10),
  selfie_oturum_saniye int not null default 180 check (selfie_oturum_saniye between 60 and 900),
  belge_saklama_gun int not null default 180 check (belge_saklama_gun between 30 and 3650),
  ikinci_onay_zorunlu boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.identity_verify_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2) Başvurular
--    Durumlar: not_started (kayıt yok) · in_progress · awaiting_document ·
--    awaiting_selfie · under_review · additional_verification · approved ·
--    rejected · appeal_review
-- ---------------------------------------------------------------------------
create table if not exists public.identity_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  country_code char(2) not null,
  doc_type text not null
    check (doc_type in ('id_card', 'passport', 'drivers_license', 'residence_permit')),
  status text not null default 'in_progress'
    check (status in (
      'in_progress', 'awaiting_document', 'awaiting_selfie', 'under_review',
      'additional_verification', 'approved', 'rejected', 'appeal_review'
    )),

  -- Aydınlatma / rıza (hukuki dayanak kaydı — serbest metin değil, sürüm tutulur)
  consent_version text,
  consent_accepted_at timestamptz,
  age_confirmed_at timestamptz,

  -- Kullanıcının beyan ettiği bilgiler (OCR başarısız olursa manuel)
  declared_first_name text,
  declared_last_name text,
  declared_birth_date date,

  -- OCR/MRZ ön okuma sonucu (onay değildir; yalnızca incelemeye yardımcı)
  ocr_fields jsonb not null default '{}'::jsonb,
  ocr_state text not null default 'not_attempted'
    check (ocr_state in ('not_attempted', 'failed', 'manual', 'read')),

  selfie_attempts smallint not null default 0,

  submitted_at timestamptz,
  reviewer_id uuid references public.profiles(id),
  reviewer_assigned_at timestamptz,
  decided_at timestamptz,
  decision_reason text,
  decision_note text,
  last_review_note text,

  -- İkinci yönetici onayı bekleyen riskli işlem
  pending_action text,
  pending_actor uuid references public.profiles(id),
  pending_reason text,
  pending_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bir kullanıcının aynı anda yalnızca bir aktif başvurusu olabilir.
create unique index if not exists identity_applications_one_active
  on public.identity_applications (user_id)
  where status in (
    'in_progress', 'awaiting_document', 'awaiting_selfie',
    'under_review', 'additional_verification', 'appeal_review'
  );

create index if not exists identity_applications_user_idx
  on public.identity_applications (user_id, created_at desc);
create index if not exists identity_applications_status_idx
  on public.identity_applications (status, created_at desc);

-- ---------------------------------------------------------------------------
-- 3) Belgeler (yalnızca meta veri; görüntü storage'da)
-- ---------------------------------------------------------------------------
create table if not exists public.identity_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.identity_applications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  side text not null check (side in ('front', 'back', 'selfie')),
  storage_bucket text not null default 'tamuso-verify-docs',
  storage_path text not null,
  mime text not null default 'image/jpeg',
  byte_size bigint,
  width int,
  height int,
  capture_source text not null default 'camera'
    check (capture_source in ('camera', 'library')),
  quality jsonb not null default '{}'::jsonb,
  quality_state text not null default 'unknown'
    check (quality_state in ('passed', 'warned', 'failed', 'unknown')),
  -- Belge yüzünde okunan/elle girilen alanlar (kimlik numarası toplanmaz)
  ocr_fields jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),
  delete_reason text,
  created_at timestamptz not null default now()
);

create unique index if not exists identity_documents_one_live_per_side
  on public.identity_documents (application_id, side)
  where deleted_at is null;

create index if not exists identity_documents_app_idx
  on public.identity_documents (application_id, created_at desc);
create index if not exists identity_documents_retention_idx
  on public.identity_documents (created_at)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 4) Canlı selfie yakalama oturumları (tek kullanımlık, kısa ömürlü)
-- ---------------------------------------------------------------------------
create table if not exists public.identity_capture_sessions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.identity_applications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'selfie' check (kind in ('selfie')),
  nonce_hash text not null,
  challenge_sequence text[] not null,
  state text not null default 'pending'
    check (state in ('pending', 'completed', 'expired', 'failed')),
  attempts smallint not null default 0,
  fraud_signals jsonb not null default '{}'::jsonb,
  device_meta jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists identity_capture_sessions_one_pending
  on public.identity_capture_sessions (application_id)
  where state = 'pending';
create index if not exists identity_capture_sessions_user_idx
  on public.identity_capture_sessions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5) İnceleme olayları (gerekçeli denetim kaydı)
-- ---------------------------------------------------------------------------
create table if not exists public.identity_review_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.identity_applications(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  from_status text,
  to_status text,
  reason text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists identity_review_events_app_idx
  on public.identity_review_events (application_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 6) Kararlar
-- ---------------------------------------------------------------------------
create table if not exists public.identity_verification_decisions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.identity_applications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null
    check (decision in ('approved', 'rejected', 'additional_verification')),
  reason_code text,
  reason text,
  reviewer_id uuid references public.profiles(id),
  second_reviewer_id uuid references public.profiles(id),
  -- Otomatik/biyometrik doğrulama iddiası yok: bu sürümde daima insan kararı.
  decided_by_human boolean not null default true,
  liveness_claim text not null default 'precheck_only'
    check (liveness_claim in ('precheck_only', 'manually_reviewed')),
  face_match_performed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists identity_decisions_app_idx
  on public.identity_verification_decisions (application_id, created_at desc);
create index if not exists identity_decisions_user_idx
  on public.identity_verification_decisions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 7) İtirazlar
-- ---------------------------------------------------------------------------
create table if not exists public.identity_appeals (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.identity_applications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'rejected')),
  resolution_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Aynı başvuru için aynı anda tek açık itiraz
create unique index if not exists identity_appeals_one_open
  on public.identity_appeals (application_id)
  where status in ('open', 'reviewing');

create index if not exists identity_appeals_user_idx
  on public.identity_appeals (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 8) Belge erişim denetimi
-- ---------------------------------------------------------------------------
create table if not exists public.identity_access_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  actor_role text,
  application_id uuid references public.identity_applications(id) on delete set null,
  document_id uuid references public.identity_documents(id) on delete set null,
  action text not null,
  purpose text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists identity_access_audit_actor_idx
  on public.identity_access_audit (actor_id, created_at desc);
create index if not exists identity_access_audit_app_idx
  on public.identity_access_audit (application_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 9) Özel depolama alanı (public = false)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tamuso-verify-docs',
  'tamuso-verify-docs',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Kullanıcı yalnızca kendi klasörüne yükleyebilir: <uid>/<application_id>/<dosya>
drop policy if exists tamuso_verify_own_insert on storage.objects;
create policy tamuso_verify_own_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'tamuso-verify-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists tamuso_verify_own_delete on storage.objects;
create policy tamuso_verify_own_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'tamuso-verify-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Kullanıcı kendi belgesini okuyamaz (yol yalnızca sunucu RPC'si ile açılır).
-- İnceleme personeli yalnızca özel izinle okuyabilir.
drop policy if exists tamuso_verify_reviewer_select on storage.objects;
create policy tamuso_verify_reviewer_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'tamuso-verify-docs'
    and public.admin_has_permission('identity.document.read')
  );

drop policy if exists tamuso_verify_reviewer_delete on storage.objects;
create policy tamuso_verify_reviewer_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'tamuso-verify-docs'
    and public.admin_has_permission('identity.document.read')
  );

-- ---------------------------------------------------------------------------
-- 10) RLS — istemci yalnızca kendi başvurusunu okuyabilir
-- ---------------------------------------------------------------------------
alter table public.identity_applications enable row level security;
alter table public.identity_documents enable row level security;
alter table public.identity_capture_sessions enable row level security;
alter table public.identity_review_events enable row level security;
alter table public.identity_verification_decisions enable row level security;
alter table public.identity_appeals enable row level security;
alter table public.identity_access_audit enable row level security;
alter table public.identity_document_types enable row level security;
alter table public.identity_verify_settings enable row level security;

drop policy if exists identity_applications_own_read on public.identity_applications;
create policy identity_applications_own_read on public.identity_applications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists identity_appeals_own_read on public.identity_appeals;
create policy identity_appeals_own_read on public.identity_appeals
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists identity_document_types_read on public.identity_document_types;
create policy identity_document_types_read on public.identity_document_types
  for select to authenticated
  using (is_active);

drop policy if exists identity_verify_settings_read on public.identity_verify_settings;
create policy identity_verify_settings_read on public.identity_verify_settings
  for select to authenticated
  using (true);

-- documents / sessions / review events / decisions / audit: istemciye kapalı.
drop policy if exists identity_documents_deny on public.identity_documents;
create policy identity_documents_deny on public.identity_documents
  for all to authenticated using (false) with check (false);

drop policy if exists identity_capture_sessions_deny on public.identity_capture_sessions;
create policy identity_capture_sessions_deny on public.identity_capture_sessions
  for all to authenticated using (false) with check (false);

drop policy if exists identity_review_events_deny on public.identity_review_events;
create policy identity_review_events_deny on public.identity_review_events
  for all to authenticated using (false) with check (false);

drop policy if exists identity_decisions_deny on public.identity_verification_decisions;
create policy identity_decisions_deny on public.identity_verification_decisions
  for all to authenticated using (false) with check (false);

drop policy if exists identity_access_audit_deny on public.identity_access_audit;
create policy identity_access_audit_deny on public.identity_access_audit
  for all to authenticated using (false) with check (false);

grant select on public.identity_applications to authenticated;
grant select on public.identity_appeals to authenticated;
grant select on public.identity_document_types to authenticated;
grant select on public.identity_verify_settings to authenticated;

-- ---------------------------------------------------------------------------
-- 11) Yardımcılar
-- ---------------------------------------------------------------------------

/** Ülke için geçerli belge türleri (ülke yoksa ZZ varsayılanı). */
create or replace function public.identity_belge_turleri(p_country_code text)
returns table (
  doc_type text,
  sides_required smallint,
  mrz_supported boolean,
  sort_order int
)
language sql
stable
security definer
set search_path = public
as $$
  with c as (
    select case
      when upper(trim(coalesce(p_country_code, ''))) ~ '^[A-Z]{2}$'
        then upper(trim(p_country_code))
      else 'ZZ'
    end as kod
  ),
  secili as (
    select d.*
    from public.identity_document_types d, c
    where d.country_code = c.kod and d.is_active
  )
  select s.doc_type, s.sides_required, s.mrz_supported, s.sort_order
  from secili s
  union all
  select z.doc_type, z.sides_required, z.mrz_supported, z.sort_order
  from public.identity_document_types z, c
  where z.country_code = 'ZZ'
    and z.is_active
    and not exists (select 1 from secili)
  order by 4, 1;
$$;

grant execute on function public.identity_belge_turleri(text) to authenticated;

/** Etkin başvuru (varsa) — durum sorgularında tek kaynak. */
create or replace function public.identity_aktif_basvuru(p_user uuid)
returns public.identity_applications
language sql
stable
security definer
set search_path = public
as $$
  select a.*
  from public.identity_applications a
  where a.user_id = p_user
    and a.status in (
      'in_progress', 'awaiting_document', 'awaiting_selfie',
      'under_review', 'additional_verification', 'appeal_review'
    )
  order by a.created_at desc
  limit 1;
$$;

/** Onaylı kimlik doğrulama var mı? (ödeme kapısı için) */
create or replace function public.identity_dogrulanmis_mi(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.identity_applications a
    where a.user_id = p_user
      and a.status = 'approved'
      and a.decided_at is not null
  );
$$;

grant execute on function public.identity_dogrulanmis_mi(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 12) updated_at tetikleyicileri
-- ---------------------------------------------------------------------------
create or replace function public.identity_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists identity_applications_touch on public.identity_applications;
create trigger identity_applications_touch
  before update on public.identity_applications
  for each row execute function public.identity_touch_updated_at();

drop trigger if exists identity_appeals_touch on public.identity_appeals;
create trigger identity_appeals_touch
  before update on public.identity_appeals
  for each row execute function public.identity_touch_updated_at();

drop trigger if exists identity_document_types_touch on public.identity_document_types;
create trigger identity_document_types_touch
  before update on public.identity_document_types
  for each row execute function public.identity_touch_updated_at();
