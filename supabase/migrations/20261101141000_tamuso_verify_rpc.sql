-- =============================================================================
-- Tamuso Verify — kullanıcı ve yönetici RPC'leri
--
-- Kural: istemci hiçbir durum alanını doğrudan yazamaz. Tüm geçişler buradadır.
-- Belge yolları (storage path) istemciye yalnızca denetimli RPC ile verilir.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Yardımcı: OCR/MRZ çıktısını beyaz listeye indirger.
-- Belge numarası, TCKN, MRZ satırı gibi alanlar veritabanına hiç yazılmaz.
-- ---------------------------------------------------------------------------
create or replace function public.identity_ocr_temizle(p jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case
    when p is null or jsonb_typeof(p) <> 'object' then '{}'::jsonb
    else coalesce(jsonb_strip_nulls(jsonb_build_object(
      'first_name',   nullif(btrim(p ->> 'first_name'), ''),
      'last_name',    nullif(btrim(p ->> 'last_name'), ''),
      'birth_date',   nullif(btrim(p ->> 'birth_date'), ''),
      'expiry_date',  nullif(btrim(p ->> 'expiry_date'), ''),
      'doc_type',     nullif(btrim(p ->> 'doc_type'), ''),
      'mrz_valid',    case when jsonb_typeof(p -> 'mrz_valid') = 'boolean'
                           then (p ->> 'mrz_valid')::boolean end,
      'mrz_checksum_ok', case when jsonb_typeof(p -> 'mrz_checksum_ok') = 'boolean'
                              then (p ->> 'mrz_checksum_ok')::boolean end,
      'confidence',   case when (p ->> 'confidence') ~ '^[0-9.]+$'
                           then least(greatest((p ->> 'confidence')::numeric, 0), 1) end
    )), '{}'::jsonb)
  end;
$$;

revoke all on function public.identity_ocr_temizle(jsonb) from public, anon;
grant execute on function public.identity_ocr_temizle(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Yardımcı: belge türü gereksinimleri
-- ---------------------------------------------------------------------------
create or replace function public.identity_belge_gereksinimi(
  p_country_code text,
  p_doc_type text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  select t.* into v_row
  from public.identity_belge_turleri(p_country_code) t
  where t.doc_type = p_doc_type
  limit 1;

  if not found then
    return jsonb_build_object('supported', false);
  end if;

  return jsonb_build_object(
    'supported', true,
    'doc_type', v_row.doc_type,
    'sides_required', v_row.sides_required,
    'mrz_supported', v_row.mrz_supported
  );
end;
$$;

grant execute on function public.identity_belge_gereksinimi(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Durum sorgusu (kullanıcı)
-- ---------------------------------------------------------------------------
create or replace function public.identity_durumum()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.identity_applications%rowtype;
  v_son public.identity_applications%rowtype;
  v_limit int := 3;
  v_saklama int := 180;
  v_belge jsonb := '{}'::jsonb;
  v_karar jsonb;
  v_itiraz jsonb;
  v_turler jsonb;
  v_kalan int;
  v_odeme jsonb := '{}'::jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select s.selfie_deneme_limiti, s.belge_saklama_gun
  into v_limit, v_saklama
  from public.identity_verify_settings s
  where s.id = 1;

  v_limit := coalesce(v_limit, 3);
  v_saklama := coalesce(v_saklama, 180);

  select * into v_app from public.identity_aktif_basvuru(v_uid);

  if v_app.id is null then
    select * into v_son
    from public.identity_applications
    where user_id = v_uid
    order by created_at desc
    limit 1;
  else
    v_son := v_app;
  end if;

  select coalesce(jsonb_object_agg(d.side, true), '{}'::jsonb)
  into v_belge
  from public.identity_documents d
  where d.application_id = v_son.id and d.deleted_at is null;

  v_kalan := greatest(0, v_limit - coalesce(v_son.selfie_attempts, 0));

  select to_jsonb(x) into v_karar
  from (
    select d.decision, d.reason_code, d.reason, d.created_at
    from public.identity_verification_decisions d
    where d.application_id = v_son.id
    order by d.created_at desc
    limit 1
  ) x;

  select to_jsonb(x) into v_itiraz
  from (
    select a.id, a.status, a.message, a.resolution_note, a.created_at, a.reviewed_at
    from public.identity_appeals a
    where a.user_id = v_uid
    order by a.created_at desc
    limit 1
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'doc_type', t.doc_type,
    'sides_required', t.sides_required,
    'mrz_supported', t.mrz_supported
  ) order by t.sort_order, t.doc_type), '[]'::jsonb)
  into v_turler
  from public.identity_belge_turleri(
    case when v_son.id is null then null else v_son.country_code end
  ) t;

  begin
    v_odeme := public.identity_odeme_kosullari(v_uid);
  exception when others then
    v_odeme := '{}'::jsonb;
  end;

  return jsonb_build_object(
    'status', coalesce(v_son.status, 'not_started'),
    'application', case when v_son.id is null then null else
      jsonb_build_object(
        'id', v_son.id,
        'country_code', v_son.country_code,
        'doc_type', v_son.doc_type,
        'status', v_son.status,
        'submitted_at', v_son.submitted_at,
        'created_at', v_son.created_at,
        'updated_at', v_son.updated_at,
        'decided_at', v_son.decided_at,
        'decision_reason', v_son.decision_reason,
        'last_review_note', v_son.last_review_note,
        'declared_first_name', v_son.declared_first_name,
        'declared_last_name', v_son.declared_last_name,
        'declared_birth_date', v_son.declared_birth_date,
        'ocr_state', v_son.ocr_state,
        'selfie_attempts', v_son.selfie_attempts
      )
    end,
    'documents', coalesce(v_belge, '{}'::jsonb),
    'belge_turleri', v_turler,
    'selfie_kalan_deneme', v_kalan,
    'selfie_deneme_limiti', v_limit,
    'saklama_gun', v_saklama,
    'son_karar', coalesce(v_karar, 'null'::jsonb),
    'itiraz', coalesce(v_itiraz, 'null'::jsonb),
    'odeme', v_odeme
  );
end;
$$;

grant execute on function public.identity_durumum() to authenticated;

-- ---------------------------------------------------------------------------
-- Başvuru başlat
-- ---------------------------------------------------------------------------
create or replace function public.identity_basvuru_baslat(
  p_country_code text,
  p_doc_type text,
  p_consent_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ulke text := upper(trim(coalesce(p_country_code, '')));
  v_tur text := lower(trim(coalesce(p_doc_type, '')));
  v_gerek jsonb;
  v_app public.identity_applications%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_uid and coalesce(is_guest, false)) then
    raise exception 'guest_not_allowed';
  end if;
  if v_ulke !~ '^[A-Z]{2}$' then
    raise exception 'invalid_country';
  end if;

  v_gerek := public.identity_belge_gereksinimi(v_ulke, v_tur);
  if coalesce((v_gerek ->> 'supported')::boolean, false) is not true then
    raise exception 'document_type_not_supported';
  end if;

  select * into v_app from public.identity_aktif_basvuru(v_uid);
  if v_app.id is not null then
    return jsonb_build_object('ok', true, 'created', false, 'application', to_jsonb(v_app));
  end if;

  if public.identity_dogrulanmis_mi(v_uid) then
    raise exception 'already_verified';
  end if;

  insert into public.identity_applications (
    user_id, country_code, doc_type, status,
    consent_version, consent_accepted_at
  ) values (
    v_uid, v_ulke, v_tur, 'awaiting_document',
    nullif(trim(coalesce(p_consent_version, '')), ''), now()
  )
  returning * into v_app;

  insert into public.identity_review_events
    (application_id, actor_id, action, from_status, to_status, metadata)
  values (
    v_app.id, v_uid, 'application_started', null, 'awaiting_document',
    jsonb_build_object('country_code', v_ulke, 'doc_type', v_tur)
  );

  return jsonb_build_object('ok', true, 'created', true, 'application', to_jsonb(v_app));
end;
$$;

grant execute on function public.identity_basvuru_baslat(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Belge kaydı (yükleme sonrası meta veri)
-- ---------------------------------------------------------------------------
create or replace function public.identity_belge_kaydet(
  p_application_id uuid,
  p_side text,
  p_storage_path text,
  p_quality jsonb default '{}'::jsonb,
  p_capture_source text default 'camera',
  p_width int default null,
  p_height int default null,
  p_byte_size bigint default null,
  p_mime text default 'image/jpeg',
  p_ocr jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.identity_applications%rowtype;
  v_gerek jsonb;
  v_side text := lower(trim(coalesce(p_side, '')));
  v_path text := btrim(coalesce(p_storage_path, ''));
  v_mime text := lower(trim(coalesce(p_mime, 'image/jpeg')));
  v_doc_id uuid;
  v_front boolean;
  v_back boolean;
  v_status text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_app from public.identity_applications where id = p_application_id for update;
  if not found or v_app.user_id <> v_uid then raise exception 'Not found'; end if;
  if v_app.status not in ('in_progress', 'awaiting_document', 'additional_verification') then
    raise exception 'application_not_editable';
  end if;

  if v_side not in ('front', 'back') then raise exception 'invalid_side'; end if;

  v_gerek := public.identity_belge_gereksinimi(v_app.country_code, v_app.doc_type);
  if v_side = 'back' and coalesce((v_gerek ->> 'sides_required')::int, 1) < 2 then
    raise exception 'back_side_not_supported';
  end if;

  if v_path = ''
     or v_path like '%..%'
     or v_path not like (v_uid::text || '/' || p_application_id::text || '/%') then
    raise exception 'invalid_storage_path';
  end if;

  if v_mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/heic') then
    raise exception 'invalid_mime';
  end if;
  if p_byte_size is not null and (p_byte_size <= 0 or p_byte_size > 8388608) then
    raise exception 'invalid_file_size';
  end if;
  if coalesce(p_capture_source, 'camera') not in ('camera', 'library') then
    raise exception 'invalid_capture_source';
  end if;
  if p_quality is not null and jsonb_typeof(p_quality) <> 'object' then
    raise exception 'invalid_quality_payload';
  end if;

  -- Aynı yüzün önceki canlı kaydı geçersiz kılınır (yeniden çekim).
  update public.identity_documents
  set deleted_at = now(), deleted_by = v_uid, delete_reason = 'replace'
  where application_id = p_application_id and side = v_side and deleted_at is null;

  insert into public.identity_documents (
    application_id, user_id, side, storage_path, mime, byte_size,
    width, height, capture_source, quality, quality_state, ocr_fields
  ) values (
    p_application_id, v_uid, v_side, v_path, v_mime, p_byte_size,
    p_width, p_height, coalesce(p_capture_source, 'camera'),
    coalesce(p_quality, '{}'::jsonb),
    coalesce(nullif(p_quality ->> 'state', ''), 'unknown'),
    public.identity_ocr_temizle(p_ocr)
  )
  returning id into v_doc_id;

  select
    exists (select 1 from public.identity_documents d
            where d.application_id = p_application_id and d.side = 'front' and d.deleted_at is null),
    exists (select 1 from public.identity_documents d
            where d.application_id = p_application_id and d.side = 'back' and d.deleted_at is null)
  into v_front, v_back;

  v_status := case
    when v_front
      and (coalesce((v_gerek ->> 'sides_required')::int, 1) < 2 or v_back)
      then 'awaiting_selfie'
    else 'awaiting_document'
  end;

  update public.identity_applications
  set status = v_status, updated_at = now()
  where id = p_application_id;

  return jsonb_build_object(
    'ok', true,
    'document_id', v_doc_id,
    'status', v_status,
    'belgeler', jsonb_build_object('front', v_front, 'back', v_back)
  );
end;
$$;

grant execute on function public.identity_belge_kaydet(
  uuid, text, text, jsonb, text, int, int, bigint, text, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- Kullanıcı kendi yüklediği belgeyi kaldırabilir (yeniden çekim)
-- ---------------------------------------------------------------------------
create or replace function public.identity_belge_kaldir(p_document_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_doc public.identity_documents%rowtype;
  v_app public.identity_applications%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_doc from public.identity_documents where id = p_document_id for update;
  if not found or v_doc.user_id <> v_uid or v_doc.deleted_at is not null then
    raise exception 'Not found';
  end if;

  select * into v_app from public.identity_applications where id = v_doc.application_id for update;
  if not found or v_app.status not in ('in_progress', 'awaiting_document', 'awaiting_selfie', 'additional_verification') then
    raise exception 'application_not_editable';
  end if;

  update public.identity_documents
  set deleted_at = now(), deleted_by = v_uid, delete_reason = 'user_retake'
  where id = p_document_id;

  if v_doc.side = 'selfie' then
    update public.identity_applications
    set status = 'awaiting_selfie', updated_at = now()
    where id = v_doc.application_id;
  else
    update public.identity_applications
    set status = 'awaiting_document', updated_at = now()
    where id = v_doc.application_id;
  end if;

  return jsonb_build_object('ok', true, 'side', v_doc.side);
end;
$$;

grant execute on function public.identity_belge_kaldir(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Canlı selfie oturumu (tek kullanımlık, kısa ömürlü, rastgele hareket sırası)
-- ---------------------------------------------------------------------------
create or replace function public.identity_selfie_oturumu_baslat(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.identity_applications%rowtype;
  v_limit int := 3;
  v_oturum_saniye int := 180;
  v_nonce text;
  v_secim text[];
  v_sira text[];
  v_expires timestamptz;
  v_session public.identity_capture_sessions%rowtype;
  v_kalan int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_app from public.identity_applications where id = p_application_id for update;
  if not found or v_app.user_id <> v_uid then raise exception 'Not found'; end if;
  if v_app.status not in ('awaiting_selfie', 'in_progress', 'additional_verification') then
    raise exception 'selfie_not_allowed';
  end if;

  select s.selfie_deneme_limiti, s.selfie_oturum_saniye
  into v_limit, v_oturum_saniye
  from public.identity_verify_settings s
  where s.id = 1;

  v_limit := coalesce(v_limit, 3);
  v_oturum_saniye := coalesce(v_oturum_saniye, 180);

  v_kalan := greatest(0, v_limit - coalesce(v_app.selfie_attempts, 0));
  if v_kalan <= 0 then
    raise exception 'selfie_attempts_exhausted';
  end if;

  -- Önceki bekleyen oturumlar geçersiz
  update public.identity_capture_sessions
  set state = 'expired'
  where application_id = p_application_id and state = 'pending';

  -- 256 bit rastgele tek kullanımlık nonce (istemcide tutulur, sunucuda hash'i)
  v_nonce := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  -- Rastgele 3 farklı hareket; ilk adım daima "center"
  select array_agg(x order by random()) into v_secim
  from unnest(array['right', 'left', 'blink', 'smile']) x;
  v_sira := array['center'] || v_secim[1:3];

  v_expires := now() + make_interval(secs => v_oturum_saniye);

  insert into public.identity_capture_sessions (
    application_id, user_id, nonce_hash, challenge_sequence, expires_at
  ) values (
    p_application_id, v_uid, encode(sha256(convert_to(v_nonce, 'UTF8')), 'hex'), v_sira, v_expires
  )
  returning * into v_session;

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session.id,
    'nonce', v_nonce,
    'challenge_sequence', to_jsonb(v_sira),
    'expires_at', v_expires,
    'kalan_deneme', v_kalan,
    'sure_saniye', v_oturum_saniye
  );
end;
$$;

grant execute on function public.identity_selfie_oturumu_baslat(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Canlı selfie tamamlama
-- ---------------------------------------------------------------------------
create or replace function public.identity_selfie_tamamla(
  p_session_id uuid,
  p_nonce text,
  p_storage_path text,
  p_challenges jsonb default '[]'::jsonb,
  p_quality jsonb default '{}'::jsonb,
  p_device_meta jsonb default '{}'::jsonb,
  p_width int default null,
  p_height int default null,
  p_byte_size bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_uid uuid := auth.uid();
  v_s public.identity_capture_sessions%rowtype;
  v_app public.identity_applications%rowtype;
  v_path text := btrim(coalesce(p_storage_path, ''));
  v_gelen text[];
  v_beklenen int;
  v_limit int := 3;
  v_kalan int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_s from public.identity_capture_sessions where id = p_session_id for update;
  if not found or v_s.user_id <> v_uid then raise exception 'Not found'; end if;
  if v_s.state <> 'pending' then raise exception 'session_not_pending'; end if;
  if v_s.expires_at < now() then
    update public.identity_capture_sessions set state = 'expired' where id = p_session_id;
    raise exception 'session_expired';
  end if;
  if encode(sha256(convert_to(btrim(coalesce(p_nonce, '')), 'UTF8')), 'hex') <> v_s.nonce_hash then
    raise exception 'invalid_session_token';
  end if;

  -- Hareket sırası birebir ve eksiksiz olmalı
  v_beklenen := array_length(v_s.challenge_sequence, 1);
  if p_challenges is null
     or jsonb_typeof(p_challenges) <> 'array'
     or jsonb_array_length(p_challenges) <> v_beklenen then
    raise exception 'challenge_sequence_incomplete';
  end if;

  select array_agg(e ->> 'adim' order by ord) into v_gelen
  from jsonb_array_elements(p_challenges) with ordinality as t(e, ord);

  if v_gelen is distinct from v_s.challenge_sequence then
    raise exception 'challenge_sequence_mismatch';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_challenges) e
    where coalesce((e ->> 'tamamlandi')::boolean, false) is not true
  ) then
    raise exception 'challenge_not_completed';
  end if;

  if v_path = ''
     or v_path like '%..%'
     or v_path not like (v_uid::text || '/' || v_s.application_id::text || '/%') then
    raise exception 'invalid_storage_path';
  end if;
  if p_byte_size is not null and (p_byte_size <= 0 or p_byte_size > 8388608) then
    raise exception 'invalid_file_size';
  end if;

  select * into v_app from public.identity_applications where id = v_s.application_id for update;
  if not found then raise exception 'Not found'; end if;

  update public.identity_documents
  set deleted_at = now(), deleted_by = v_uid, delete_reason = 'replace'
  where application_id = v_s.application_id and side = 'selfie' and deleted_at is null;

  insert into public.identity_documents (
    application_id, user_id, side, storage_path, mime, byte_size,
    width, height, capture_source, quality, quality_state
  ) values (
    v_s.application_id, v_uid, 'selfie', v_path, 'image/jpeg', p_byte_size,
    p_width, p_height, 'camera',
    coalesce(p_quality, '{}'::jsonb),
    coalesce(nullif(p_quality ->> 'state', ''), 'unknown')
  );

  update public.identity_capture_sessions
  set state = 'completed',
      consumed_at = now(),
      attempts = attempts + 1,
      device_meta = coalesce(p_device_meta, '{}'::jsonb),
      fraud_signals = coalesce(p_device_meta -> 'fraud', '{}'::jsonb)
  where id = p_session_id;

  update public.identity_applications
  set selfie_attempts = selfie_attempts + 1,
      status = 'in_progress',
      updated_at = now()
  where id = v_s.application_id;

  select s.selfie_deneme_limiti into v_limit
  from public.identity_verify_settings s where s.id = 1;

  v_kalan := greatest(0, coalesce(v_limit, 3) - (v_app.selfie_attempts + 1));

  return jsonb_build_object(
    'ok', true,
    'status', 'in_progress',
    'kalan_deneme', v_kalan,
    -- Ön sinyal kaydıdır; canlılık "kesin doğrulandı" olarak işaretlenmez.
    'liveness', 'precheck_only'
  );
end;
$$;

grant execute on function public.identity_selfie_tamamla(
  uuid, text, text, jsonb, jsonb, jsonb, int, int, bigint
) to authenticated;

-- ---------------------------------------------------------------------------
-- Başvuruyu gönder
-- ---------------------------------------------------------------------------
create or replace function public.identity_basvuru_gonder(
  p_application_id uuid,
  p_first_name text,
  p_last_name text,
  p_birth_date date,
  p_ocr jsonb default null,
  p_ocr_state text default 'not_attempted'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.identity_applications%rowtype;
  v_gerek jsonb;
  v_front boolean;
  v_back boolean;
  v_selfie boolean;
  v_ad text := btrim(coalesce(p_first_name, ''));
  v_soyad text := btrim(coalesce(p_last_name, ''));
  v_yas int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_app from public.identity_applications where id = p_application_id for update;
  if not found or v_app.user_id <> v_uid then raise exception 'Not found'; end if;
  if v_app.status not in ('in_progress', 'awaiting_selfie', 'additional_verification') then
    raise exception 'application_not_submittable';
  end if;

  select
    exists (select 1 from public.identity_documents d
            where d.application_id = p_application_id and d.side = 'front' and d.deleted_at is null),
    exists (select 1 from public.identity_documents d
            where d.application_id = p_application_id and d.side = 'back' and d.deleted_at is null),
    exists (select 1 from public.identity_documents d
            where d.application_id = p_application_id and d.side = 'selfie' and d.deleted_at is null)
  into v_front, v_back, v_selfie;

  v_gerek := public.identity_belge_gereksinimi(v_app.country_code, v_app.doc_type);

  if not v_front then raise exception 'document_required'; end if;
  if coalesce((v_gerek ->> 'sides_required')::int, 1) >= 2 and not v_back then
    raise exception 'document_back_required';
  end if;
  if not v_selfie then raise exception 'selfie_required'; end if;

  if length(v_ad) < 2 then raise exception 'invalid_first_name'; end if;
  if length(v_soyad) < 2 then raise exception 'invalid_last_name'; end if;
  if p_birth_date is null then raise exception 'birth_date_required'; end if;

  v_yas := date_part('year', age(current_date, p_birth_date))::int;
  if v_yas < 18 then raise exception 'adult_required'; end if;
  if p_birth_date < date '1900-01-01' then raise exception 'invalid_birth_date'; end if;

  update public.identity_applications
  set declared_first_name = v_ad,
      declared_last_name = v_soyad,
      declared_birth_date = p_birth_date,
      age_confirmed_at = now(),
      ocr_fields = case
        when p_ocr is null then ocr_fields
        else public.identity_ocr_temizle(p_ocr)
      end,
      ocr_state = case
        when coalesce(p_ocr_state, 'not_attempted') in ('not_attempted', 'failed', 'manual', 'read')
          then coalesce(p_ocr_state, 'not_attempted')
        else 'manual'
      end,
      status = 'under_review',
      submitted_at = now(),
      updated_at = now()
  where id = p_application_id
  returning * into v_app;

  insert into public.identity_review_events
    (application_id, actor_id, action, from_status, to_status, metadata)
  values (
    p_application_id, v_uid, 'submitted', null, 'under_review',
    jsonb_build_object('doc_type', v_app.doc_type, 'country_code', v_app.country_code)
  );

  begin
    perform public.bildirim_kuyruga_ekle(
      v_uid,
      'wallet',
      'Kimlik başvurusu alındı',
      'Tamuso Verify başvurunuz incelemeye alındı.',
      '/cuzdan/yayinci-kazanclari/kimlik-dogrula',
      jsonb_build_object('type', 'identity_submitted', 'application_id', p_application_id)
    );
  exception when others then
    null;
  end;

  return jsonb_build_object('ok', true, 'status', 'under_review');
end;
$$;

grant execute on function public.identity_basvuru_gonder(uuid, text, text, date, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- İtiraz
-- ---------------------------------------------------------------------------
create or replace function public.identity_itiraz_olustur(
  p_application_id uuid,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.identity_applications%rowtype;
  v_msg text := btrim(coalesce(p_message, ''));
  v_appeal public.identity_appeals%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_app from public.identity_applications where id = p_application_id for update;
  if not found or v_app.user_id <> v_uid then raise exception 'Not found'; end if;
  if v_app.status <> 'rejected' then raise exception 'appeal_not_allowed'; end if;

  if length(v_msg) < 10 then raise exception 'appeal_message_too_short'; end if;
  if length(v_msg) > 4000 then raise exception 'appeal_message_too_long'; end if;

  if exists (
    select 1 from public.identity_appeals
    where application_id = p_application_id and status in ('open', 'reviewing')
  ) then
    raise exception 'appeal_already_open';
  end if;

  insert into public.identity_appeals (application_id, user_id, message)
  values (p_application_id, v_uid, v_msg)
  returning * into v_appeal;

  update public.identity_applications
  set status = 'appeal_review', updated_at = now()
  where id = p_application_id;

  insert into public.identity_review_events
    (application_id, actor_id, action, from_status, to_status, note)
  values (
    p_application_id, v_uid, 'appeal_created', 'rejected', 'appeal_review', v_msg
  );

  return jsonb_build_object('ok', true, 'appeal_id', v_appeal.id, 'status', 'appeal_review');
end;
$$;

grant execute on function public.identity_itiraz_olustur(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Kullanıcı veri talebi: ham görüntülerin silinmesi (§11 veri silme hakkı)
-- ---------------------------------------------------------------------------
create or replace function public.identity_ham_belge_silme_talebi(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.identity_applications%rowtype;
  v_adet int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_app from public.identity_applications where id = p_application_id for update;
  if not found or v_app.user_id <> v_uid then raise exception 'Not found'; end if;

  update public.identity_documents
  set deleted_at = now(), deleted_by = v_uid, delete_reason = 'user_data_request'
  where application_id = p_application_id and deleted_at is null;
  get diagnostics v_adet = row_count;

  insert into public.identity_access_audit
    (actor_id, actor_role, application_id, action, purpose)
  values (v_uid, 'user', p_application_id, 'data_deletion_requested', 'kvkk');

  insert into public.identity_review_events
    (application_id, actor_id, action, from_status, to_status, metadata)
  values (
    p_application_id, v_uid, 'data_deletion_requested', v_app.status, v_app.status,
    jsonb_build_object('documents', v_adet)
  );

  return jsonb_build_object('ok', true, 'silinen_kayit', v_adet);
end;
$$;

grant execute on function public.identity_ham_belge_silme_talebi(uuid) to authenticated;
