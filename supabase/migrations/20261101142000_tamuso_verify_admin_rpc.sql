-- =============================================================================
-- Tamuso Verify — yönetici (Tamuso Verify Merkezi) RPC'leri
--
-- İlkeler:
--   * Genel admin yetkisi belge görüntüleme izni VERMEZ. Ham belge için ayrı
--     "identity.document.read" izni gerekir.
--   * Belge tablosu istemciye kapalıdır; yöneticiye de yalnızca denetim kaydı
--     üreten RPC ile açılır. İmzalı URL (kısa ömürlü) storage API'den alınır,
--     yol istemciye bu RPC ile verilir.
--   * Riskli işlemlerde (onay/red) ikinci yönetici onayı zorunlu kılınabilit.
--   * "Kesin canlılık doğrulandı" iddiası üretilmez: karar daima insan kararıdır
--     ve decision kaydında liveness_claim='precheck_only' olarak işaretlenir.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) İzin kataloğu + roller
-- ---------------------------------------------------------------------------
insert into public.admin_permission_catalog
  (permission_key, label, description, category, risk, module_href, sort_order)
values
  ('identity.view', 'Kimlik doğrulama merkezi', 'Verify dashboard ve kuyruk', 'VERIFICATION', 'MEDIUM', '/admin/kimlik-dogrulama', 200),
  ('identity.review', 'Kimlik başvurusu incele', 'İncelemeye al, ek belge/selfie iste', 'VERIFICATION', 'HIGH', '/admin/kimlik-dogrulama', 210),
  ('identity.document.read', 'Kimlik belgesi görüntüle', 'Ham belge ve selfie görüntüsü', 'VERIFICATION', 'CRITICAL', '/admin/kimlik-dogrulama', 220),
  ('identity.approve', 'Kimlik başvurusu onayla', 'Onay kararı', 'VERIFICATION', 'CRITICAL', '/admin/kimlik-dogrulama', 230),
  ('identity.reject', 'Kimlik başvurusu reddet', 'Ret kararı', 'VERIFICATION', 'CRITICAL', '/admin/kimlik-dogrulama', 240),
  ('identity.appeal.review', 'Kimlik itirazı değerlendir', 'İtiraz kararı', 'VERIFICATION', 'HIGH', '/admin/kimlik-dogrulama', 250),
  ('identity.audit.view', 'Kimlik denetim kaydı', 'Erişim ve karar kayıtları', 'VERIFICATION', 'HIGH', '/admin/kimlik-dogrulama', 260),
  ('identity.settings.manage', 'Kimlik doğrulama ayarları', 'Saklama, deneme limiti, ikinci onay', 'VERIFICATION', 'CRITICAL', '/admin/kimlik-dogrulama', 270)
on conflict (permission_key) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  risk = excluded.risk,
  module_href = excluded.module_href,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.admin_roles (role_code, name, description, is_system, is_super, sort_order)
values
  ('IDENTITY_REVIEWER', 'Kimlik inceleme personeli', 'Tamuso Verify inceleme ve karar yetkisi', true, false, 70),
  ('IDENTITY_LEAD', 'Kimlik inceleme lideri', 'İnceleme + ayar ve denetim yetkisi', true, false, 71)
on conflict (role_code) do nothing;

insert into public.admin_role_permissions (role_code, permission_code)
select 'IDENTITY_REVIEWER', x from unnest(array[
  'dashboard.view',
  'identity.view','identity.review','identity.document.read',
  'identity.approve','identity.reject','identity.appeal.review',
  'users.view','users.detail.view','finance.view','payout.view'
]) as x
on conflict do nothing;

insert into public.admin_role_permissions (role_code, permission_code)
select 'IDENTITY_LEAD', x from unnest(array[
  'dashboard.view',
  'identity.view','identity.review','identity.document.read',
  'identity.approve','identity.reject','identity.appeal.review',
  'identity.audit.view','identity.settings.manage',
  'users.view','users.detail.read','users.detail.view','finance.view','payout.view'
]) as x
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 1) Yardımcılar
-- ---------------------------------------------------------------------------
create or replace function public.identity_yetki(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.admin_has_permission(p_permission), false);
$$;

grant execute on function public.identity_yetki(text) to authenticated;

/** Bir başvurunun yönetici tarafından görülebilir özeti (belge yolu içermez). */
create or replace function public.identity_yonetici_ozet(p_application_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_app public.identity_applications%rowtype;
  v_profil jsonb;
  v_cuzdan jsonb;
  v_belgeler jsonb;
  v_oturum jsonb;
  v_karar jsonb;
  v_itiraz jsonb;
  v_gerek jsonb;
begin
  select * into v_app from public.identity_applications where id = p_application_id;
  if not found then return null; end if;

  select jsonb_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'username', p.username,
    'public_user_id', p.public_user_id,
    'avatar_url', p.avatar_url,
    'birth_date', p.birth_date,
    'is_guest', coalesce(p.is_guest, false),
    'created_at', p.created_at
  ) into v_profil
  from public.profiles p where p.id = v_app.user_id;

  select jsonb_build_object(
    'wallet_number', w.wallet_number,
    'brand', w.wallet_brand_name,
    'legal_first_name', w.legal_first_name,
    'legal_last_name', w.legal_last_name,
    'kyc_status', w.kyc_status
  ) into v_cuzdan
  from public.wallet_accounts w where w.user_id = v_app.user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'side', d.side,
    'mime', d.mime,
    'byte_size', d.byte_size,
    'width', d.width,
    'height', d.height,
    'capture_source', d.capture_source,
    'quality_state', d.quality_state,
    'quality', d.quality,
    'ocr_fields', d.ocr_fields,
    'created_at', d.created_at
  ) order by d.side), '[]'::jsonb)
  into v_belgeler
  from public.identity_documents d
  where d.application_id = p_application_id and d.deleted_at is null;

  select jsonb_build_object(
    'id', s.id,
    'state', s.state,
    'challenge_sequence', to_jsonb(s.challenge_sequence),
    'attempts', s.attempts,
    'fraud_signals', s.fraud_signals,
    'device_meta', s.device_meta,
    'expires_at', s.expires_at,
    'consumed_at', s.consumed_at,
    'created_at', s.created_at
  ) into v_oturum
  from public.identity_capture_sessions s
  where s.application_id = p_application_id
  order by s.created_at desc
  limit 1;

  select to_jsonb(x) into v_karar from (
    select d.decision, d.reason_code, d.reason, d.liveness_claim,
           d.face_match_performed, d.decided_by_human, d.created_at
    from public.identity_verification_decisions d
    where d.application_id = p_application_id
    order by d.created_at desc limit 1
  ) x;

  select to_jsonb(x) into v_itiraz from (
    select a.id, a.status, a.message, a.resolution_note, a.created_at, a.reviewed_at
    from public.identity_appeals a
    where a.application_id = p_application_id
    order by a.created_at desc limit 1
  ) x;

  v_gerek := public.identity_belge_gereksinimi(v_app.country_code, v_app.doc_type);

  return jsonb_build_object(
    'application', jsonb_build_object(
      'id', v_app.id,
      'user_id', v_app.user_id,
      'status', v_app.status,
      'country_code', v_app.country_code,
      'doc_type', v_app.doc_type,
      'sides_required', coalesce((v_gerek ->> 'sides_required')::int, 1),
      'declared_first_name', v_app.declared_first_name,
      'declared_last_name', v_app.declared_last_name,
      'declared_birth_date', v_app.declared_birth_date,
      'ocr_state', v_app.ocr_state,
      'selfie_attempts', v_app.selfie_attempts,
      'consent_version', v_app.consent_version,
      'consent_accepted_at', v_app.consent_accepted_at,
      'age_confirmed_at', v_app.age_confirmed_at,
      'submitted_at', v_app.submitted_at,
      'reviewer_id', v_app.reviewer_id,
      'reviewer_assigned_at', v_app.reviewer_assigned_at,
      'decided_at', v_app.decided_at,
      'decision_reason', v_app.decision_reason,
      'decision_note', v_app.decision_note,
      'last_review_note', v_app.last_review_note,
      'pending_action', v_app.pending_action,
      'pending_actor', v_app.pending_actor,
      'pending_reason', v_app.pending_reason,
      'pending_at', v_app.pending_at,
      'created_at', v_app.created_at,
      'updated_at', v_app.updated_at
    ),
    'profile', coalesce(v_profil, '{}'::jsonb),
    'wallet', coalesce(v_cuzdan, 'null'::jsonb),
    'documents', coalesce(v_belgeler, '[]'::jsonb),
    'session', coalesce(v_oturum, 'null'::jsonb),
    'decision', coalesce(v_karar, 'null'::jsonb),
    'appeal', coalesce(v_itiraz, 'null'::jsonb)
  );
end;
$$;

revoke all on function public.identity_yonetici_ozet(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Dashboard
-- ---------------------------------------------------------------------------
create or replace function public.admin_identity_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sonuc jsonb;
begin
  if not public.identity_yetki('identity.view') then
    raise exception 'Forbidden';
  end if;

  with a as (select * from public.identity_applications)
  select jsonb_build_object(
    'toplam', count(*),
    'bugun', count(*) filter (where created_at >= date_trunc('day', now())),
    'inceleme_bekleyen', count(*) filter (where status = 'under_review'),
    'eksik_belge', count(*) filter (where status = 'awaiting_document'),
    'selfie_bekleyen', count(*) filter (where status = 'awaiting_selfie'),
    'ek_dogrulama', count(*) filter (where status = 'additional_verification'),
    'onaylanan', count(*) filter (where status = 'approved'),
    'reddedilen', count(*) filter (where status = 'rejected'),
    'itiraz', count(*) filter (where status = 'appeal_review'),
    'ikinci_onay_bekleyen', count(*) filter (where pending_action is not null),
    'bugun_karar', count(*) filter (where decided_at >= date_trunc('day', now())),
    'ortalama_inceleme_saat', round(coalesce(avg(
       extract(epoch from (decided_at - submitted_at)) / 3600.0
     ) filter (where decided_at is not null and submitted_at is not null), 0)::numeric, 1)
  ) into v_sonuc
  from a;

  return v_sonuc || jsonb_build_object(
    'acik_itiraz', (select count(*) from public.identity_appeals where status in ('open', 'reviewing')),
    'bugun_yukleme', (select count(*) from public.identity_documents
                      where deleted_at is null and created_at >= date_trunc('day', now())),
    'saklama_gun', (select belge_saklama_gun from public.identity_verify_settings where id = 1),
    'ikinci_onay_zorunlu', (select ikinci_onay_zorunlu from public.identity_verify_settings where id = 1),
    'belge_goruntuleme_yetkisi', public.identity_yetki('identity.document.read'),
    'onay_yetkisi', public.identity_yetki('identity.approve'),
    'red_yetkisi', public.identity_yetki('identity.reject'),
    'ayar_yetkisi', public.identity_yetki('identity.settings.manage')
  );
end;
$$;

grant execute on function public.admin_identity_dashboard() to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Kuyruk
-- ---------------------------------------------------------------------------
create or replace function public.admin_identity_basvurular(
  p_status text default null,
  p_search text default null,
  p_limit int default 40,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 40), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_rows jsonb;
  v_total int;
begin
  if not public.identity_yetki('identity.view') then
    raise exception 'Forbidden';
  end if;

  with filtre as (
    select a.*, p.display_name, p.username, p.public_user_id
    from public.identity_applications a
    left join public.profiles p on p.id = a.user_id
    where (v_status is null or a.status = v_status)
      and (
        v_search is null
        or a.id::text = v_search
        or coalesce(p.display_name, '') ilike '%' || v_search || '%'
        or coalesce(p.username, '') ilike '%' || v_search || '%'
        or coalesce(p.public_user_id, '') ilike '%' || v_search || '%'
        or coalesce(a.declared_first_name || ' ' || a.declared_last_name, '') ilike '%' || v_search || '%'
      )
  ),
  sayfa as (
    select f.*
    from filtre f
    order by
      case f.status
        when 'under_review' then 0
        when 'appeal_review' then 1
        when 'additional_verification' then 2
        when 'awaiting_document' then 3
        when 'awaiting_selfie' then 4
        else 9
      end,
      f.created_at desc
    limit v_limit offset v_offset
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'user_id', s.user_id,
      'status', s.status,
      'country_code', s.country_code,
      'doc_type', s.doc_type,
      'declared_first_name', s.declared_first_name,
      'declared_last_name', s.declared_last_name,
      'selfie_attempts', s.selfie_attempts,
      'submitted_at', s.submitted_at,
      'decided_at', s.decided_at,
      'pending_action', s.pending_action,
      'created_at', s.created_at,
      'updated_at', s.updated_at,
      'display_name', s.display_name,
      'username', s.username,
      'public_user_id', s.public_user_id
    )), '[]'::jsonb),
    (select count(*) from filtre)
  into v_rows, v_total
  from sayfa s;

  return jsonb_build_object('toplam', v_total, 'limit', v_limit, 'offset', v_offset,
                            'kayitlar', v_rows);
end;
$$;

grant execute on function public.admin_identity_basvurular(text, text, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Detay
-- ---------------------------------------------------------------------------
create or replace function public.admin_identity_basvuru_detay(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ozet jsonb;
  v_olaylar jsonb;
  v_uygunluk jsonb;
begin
  if not public.identity_yetki('identity.view') then
    raise exception 'Forbidden';
  end if;

  v_ozet := public.identity_yonetici_ozet(p_application_id);
  if v_ozet is null then raise exception 'Not found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'action', e.action,
    'from_status', e.from_status,
    'to_status', e.to_status,
    'reason', e.reason,
    'note', e.note,
    'metadata', e.metadata,
    'actor_id', e.actor_id,
    'actor_name', p.display_name,
    'created_at', e.created_at
  ) order by e.created_at desc), '[]'::jsonb)
  into v_olaylar
  from public.identity_review_events e
  left join public.profiles p on p.id = e.actor_id
  where e.application_id = p_application_id;

  begin
    v_uygunluk := public.identity_odeme_kosullari((v_ozet #>> '{application,user_id}')::uuid);
  exception when others then
    v_uygunluk := '{}'::jsonb;
  end;

  insert into public.identity_access_audit
    (actor_id, actor_role, application_id, action, purpose)
  values (v_uid, 'reviewer', p_application_id, 'application_viewed', 'review');

  return v_ozet || jsonb_build_object(
    'events', v_olaylar,
    'odeme_uygunluk', coalesce(v_uygunluk, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.admin_identity_basvuru_detay(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Belge erişimi (denetimli)
--    Dönen yol ile istemci storage API'den KISA ÖMÜRLÜ imzalı URL üretir.
-- ---------------------------------------------------------------------------
create or replace function public.admin_identity_belge_erisim(
  p_document_id uuid,
  p_purpose text default 'review'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_doc public.identity_documents%rowtype;
  v_purpose text := left(coalesce(nullif(btrim(p_purpose), ''), 'review'), 40);
begin
  if not public.identity_yetki('identity.document.read') then
    raise exception 'Forbidden';
  end if;

  select * into v_doc from public.identity_documents where id = p_document_id;
  if not found or v_doc.deleted_at is not null then raise exception 'Not found'; end if;

  insert into public.identity_access_audit
    (actor_id, actor_role, application_id, document_id, action, purpose, metadata)
  values (
    v_uid, 'reviewer', v_doc.application_id, v_doc.id, 'document_viewed', v_purpose,
    jsonb_build_object('side', v_doc.side, 'expires_in', 300)
  );

  return jsonb_build_object(
    'ok', true,
    'bucket', v_doc.storage_bucket,
    'path', v_doc.storage_path,
    'side', v_doc.side,
    'expires_in', 300
  );
end;
$$;

grant execute on function public.admin_identity_belge_erisim(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Karar uygulama (iç kullanım)
-- ---------------------------------------------------------------------------
create or replace function public.identity_karar_uygula(
  p_application_id uuid,
  p_actor uuid,
  p_action text,
  p_reason_code text,
  p_reason text,
  p_note text,
  p_ikinci uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.identity_applications%rowtype;
  v_yeni text;
  v_karar text;
  v_gerek jsonb;
  v_front boolean;
  v_back boolean;
  v_selfie boolean;
begin
  select * into v_app from public.identity_applications where id = p_application_id for update;
  if not found then raise exception 'Not found'; end if;

  if v_app.status in ('approved', 'rejected') then
    raise exception 'already_decided';
  end if;

  if p_action in ('approve', 'reject') then
    if v_app.status not in ('under_review', 'additional_verification', 'appeal_review') then
      raise exception 'invalid_state';
    end if;
  elsif p_action in ('request_document', 'request_selfie', 'additional_verification') then
    if v_app.status not in ('awaiting_document', 'awaiting_selfie', 'under_review',
                            'additional_verification', 'appeal_review') then
      raise exception 'invalid_state';
    end if;
  elsif p_action = 'start_review' then
    if v_app.status not in ('under_review', 'additional_verification', 'appeal_review') then
      raise exception 'not_submitted_yet';
    end if;
  end if;

  v_yeni := case p_action
    when 'approve' then 'approved'
    when 'reject' then 'rejected'
    when 'request_document' then 'awaiting_document'
    when 'request_selfie' then 'awaiting_selfie'
    when 'additional_verification' then 'additional_verification'
    when 'start_review' then 'under_review'
    else null
  end;
  if v_yeni is null then raise exception 'invalid_action'; end if;

  if p_action in ('approve', 'reject', 'request_document', 'request_selfie', 'additional_verification')
     and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason_required';
  end if;

  if p_action = 'approve' then
    v_gerek := public.identity_belge_gereksinimi(v_app.country_code, v_app.doc_type);
    select
      exists (select 1 from public.identity_documents d
              where d.application_id = p_application_id and d.side = 'front' and d.deleted_at is null),
      exists (select 1 from public.identity_documents d
              where d.application_id = p_application_id and d.side = 'back' and d.deleted_at is null),
      exists (select 1 from public.identity_documents d
              where d.application_id = p_application_id and d.side = 'selfie' and d.deleted_at is null)
    into v_front, v_back, v_selfie;

    if not v_front then raise exception 'document_required'; end if;
    if coalesce((v_gerek ->> 'sides_required')::int, 1) >= 2 and not v_back then
      raise exception 'document_back_required';
    end if;
    if not v_selfie then raise exception 'selfie_required'; end if;
  end if;

  update public.identity_applications
  set status = v_yeni,
      reviewer_id = coalesce(reviewer_id, p_actor),
      reviewer_assigned_at = coalesce(reviewer_assigned_at, now()),
      last_review_note = coalesce(p_note, last_review_note),
      decided_at = case when p_action in ('approve', 'reject') then now() else decided_at end,
      decision_reason = case when p_action in ('approve', 'reject')
                             then left(coalesce(p_reason, ''), 500) else decision_reason end,
      decision_note = case when p_action in ('approve', 'reject')
                           then left(coalesce(p_note, ''), 2000) else decision_note end,
      selfie_attempts = case when p_action = 'request_selfie' then 0 else selfie_attempts end,
      pending_action = null,
      pending_actor = null,
      pending_reason = null,
      pending_at = null,
      updated_at = now()
  where id = p_application_id
  returning * into v_app;

  if p_action in ('approve', 'reject') then
    v_karar := case p_action when 'approve' then 'approved' else 'rejected' end;

    insert into public.identity_verification_decisions (
      application_id, user_id, decision, reason_code, reason, reviewer_id,
      second_reviewer_id, decided_by_human, liveness_claim, face_match_performed
    ) values (
      p_application_id, v_app.user_id, v_karar,
      nullif(left(btrim(coalesce(p_reason_code, '')), 60), ''),
      left(coalesce(p_reason, ''), 500),
      p_actor, p_ikinci, true, 'precheck_only', false
    );

    -- Eski cüzdan/KYC alanlarıyla uyumluluk (yayıncı kazanç kapısı bunları okur)
    begin
      update public.wallet_accounts
      set kyc_status = case when p_action = 'approve' then 'approved' else 'rejected' end,
          legal_first_name = coalesce(legal_first_name, v_app.declared_first_name),
          legal_last_name = coalesce(legal_last_name, v_app.declared_last_name),
          updated_at = now()
      where user_id = v_app.user_id;
    exception when others then
      null;
    end;

    begin
      perform public.bildirim_kuyruga_ekle(
        v_app.user_id,
        'wallet',
        case when p_action = 'approve'
          then 'Kimlik doğrulamanız onaylandı'
          else 'Kimlik doğrulama başvurunuz reddedildi'
        end,
        case when p_action = 'approve'
          then 'Tamuso Verify başvurunuz onaylandı. Ödeme için diğer koşulların da tamamlanması gerekir.'
          else coalesce(left(p_reason, 300), 'Başvurunuz reddedildi. İtiraz oluşturabilirsiniz.')
        end,
        '/cuzdan/yayinci-kazanclari/kimlik-dogrula',
        jsonb_build_object('type', 'identity_decision', 'application_id', p_application_id,
                           'decision', v_karar)
      );
    exception when others then
      null;
    end;
  end if;

  insert into public.identity_review_events
    (application_id, actor_id, action, from_status, to_status, reason, note, metadata)
  values (
    p_application_id, p_actor, p_action, null, v_yeni,
    left(coalesce(p_reason, ''), 500), left(coalesce(p_note, ''), 2000),
    jsonb_build_object('reason_code', p_reason_code, 'second_reviewer', p_ikinci)
  );

  return jsonb_build_object('ok', true, 'status', v_yeni, 'action', p_action);
end;
$$;

revoke all on function public.identity_karar_uygula(uuid, uuid, text, text, text, text, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7) Yönetici işlemi (ikinci onay gerekiyorsa bekletir)
-- ---------------------------------------------------------------------------
create or replace function public.admin_identity_islem(
  p_application_id uuid,
  p_action text,
  p_reason_code text default null,
  p_reason text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_izin text;
  v_app public.identity_applications%rowtype;
  v_ikinci boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  v_izin := case v_action
    when 'start_review' then 'identity.review'
    when 'request_document' then 'identity.review'
    when 'request_selfie' then 'identity.review'
    when 'additional_verification' then 'identity.review'
    when 'approve' then 'identity.approve'
    when 'reject' then 'identity.reject'
    else null
  end;
  if v_izin is null then raise exception 'invalid_action'; end if;
  if not public.identity_yetki(v_izin) then raise exception 'Forbidden'; end if;

  select * into v_app from public.identity_applications where id = p_application_id for update;
  if not found then raise exception 'Not found'; end if;

  select coalesce(s.ikinci_onay_zorunlu, false) into v_ikinci
  from public.identity_verify_settings s where s.id = 1;
  v_ikinci := coalesce(v_ikinci, false);

  -- Yükseltilmiş bir kararı geri alma riski: ikinci onay zorunlu.
  if v_action = 'reject' and v_app.status = 'appeal_review' then
    v_ikinci := true;
  end if;

  -- Bekleyen bir ikinci onay varsa: aynı işlem → teyit, farklı işlem → engel.
  if v_app.pending_action is not null then
    if v_app.pending_actor = v_uid then
      raise exception 'second_approval_self';
    end if;
    if v_app.pending_action <> v_action then
      raise exception 'pending_action_exists';
    end if;

    return public.identity_karar_uygula(
      p_application_id, v_uid, v_app.pending_action,
      p_reason_code, v_app.pending_reason, p_note, v_uid
    );
  end if;

  if v_ikinci and v_action in ('approve', 'reject') then
    update public.identity_applications
    set pending_action = v_action,
        pending_actor = v_uid,
        pending_reason = left(coalesce(p_reason, '') || case when p_reason_code is not null
                              then ' [' || p_reason_code || ']' else '' end, 700),
        pending_at = now(),
        updated_at = now()
    where id = p_application_id;

    insert into public.identity_review_events
      (application_id, actor_id, action, from_status, to_status, reason, note, metadata)
    values (
      p_application_id, v_uid, 'second_approval_requested', v_app.status, v_app.status,
      left(coalesce(p_reason, ''), 500), left(coalesce(p_note, ''), 2000),
      jsonb_build_object('action', v_action, 'reason_code', p_reason_code)
    );

    return jsonb_build_object('ok', true, 'bekliyor', true, 'action', v_action,
                              'mesaj', 'second_approval_required');
  end if;

  -- Aynı yönetici kendi talebini onaylayamaz
  if v_app.pending_action is not null and v_app.pending_actor = v_uid then
    raise exception 'second_approval_self';
  end if;

  return public.identity_karar_uygula(
    p_application_id, v_uid, v_action,
    p_reason_code, p_reason, p_note, null
  );
end;
$$;

grant execute on function public.admin_identity_islem(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8) İkinci onay kararı
-- ---------------------------------------------------------------------------
create or replace function public.admin_identity_ikinci_onay(
  p_application_id uuid,
  p_onay boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.identity_applications%rowtype;
  v_izin text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_app from public.identity_applications where id = p_application_id for update;
  if not found then raise exception 'Not found'; end if;
  if v_app.pending_action is null then raise exception 'no_pending_action'; end if;
  if v_app.pending_actor = v_uid then raise exception 'second_approval_self'; end if;

  v_izin := case v_app.pending_action
    when 'approve' then 'identity.approve'
    when 'reject' then 'identity.reject'
    else null
  end;
  if v_izin is null or not public.identity_yetki(v_izin) then raise exception 'Forbidden'; end if;

  if not coalesce(p_onay, false) then
    update public.identity_applications
    set pending_action = null, pending_actor = null, pending_reason = null,
        pending_at = null, updated_at = now()
    where id = p_application_id;

    insert into public.identity_review_events
      (application_id, actor_id, action, from_status, to_status, note)
    values (p_application_id, v_uid, 'second_approval_denied', v_app.status, v_app.status,
            'İkinci yönetici işlemi onaylamadı');

    return jsonb_build_object('ok', true, 'bekliyor', false, 'status', v_app.status);
  end if;

  return public.identity_karar_uygula(
    p_application_id, v_uid, v_app.pending_action,
    null, v_app.pending_reason, 'İkinci yönetici onayı', v_uid
  );
end;
$$;

grant execute on function public.admin_identity_ikinci_onay(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 9) İtirazlar
-- ---------------------------------------------------------------------------
create or replace function public.admin_identity_itirazlar(
  p_status text default null,
  p_limit int default 40
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 40), 1), 200);
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_rows jsonb;
begin
  if not public.identity_yetki('identity.appeal.review') then
    raise exception 'Forbidden';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'application_id', a.application_id,
    'message', a.message,
    'status', a.status,
    'resolution_note', a.resolution_note,
    'created_at', a.created_at,
    'reviewed_at', a.reviewed_at,
    'user_id', a.user_id,
    'display_name', p.display_name,
    'username', p.username,
    'country_code', ap.country_code,
    'doc_type', ap.doc_type,
    'application_status', ap.status
  ) order by a.created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select * from public.identity_appeals
    where v_status is null or status = v_status
    order by created_at desc
    limit v_limit
  ) a
  left join public.profiles p on p.id = a.user_id
  left join public.identity_applications ap on ap.id = a.application_id;

  return jsonb_build_object('kayitlar', coalesce(v_rows, '[]'::jsonb));
end;
$$;

grant execute on function public.admin_identity_itirazlar(text, int) to authenticated;

create or replace function public.admin_identity_itiraz_karar(
  p_appeal_id uuid,
  p_decision text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_karar text := lower(btrim(coalesce(p_decision, '')));
  v_appeal public.identity_appeals%rowtype;
  v_app public.identity_applications%rowtype;
  v_not text := left(btrim(coalesce(p_note, '')), 2000);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.identity_yetki('identity.appeal.review') then raise exception 'Forbidden'; end if;
  if v_karar not in ('reopen', 'uphold', 'rejected') then raise exception 'invalid_decision'; end if;
  if length(v_not) < 5 then raise exception 'note_required'; end if;

  select * into v_appeal from public.identity_appeals where id = p_appeal_id for update;
  if not found then raise exception 'Not found'; end if;
  if v_appeal.status not in ('open', 'reviewing') then raise exception 'appeal_closed'; end if;

  select * into v_app from public.identity_applications where id = v_appeal.application_id for update;
  if not found then raise exception 'Not found'; end if;

  if v_karar = 'reopen' then
    update public.identity_appeals
    set status = 'resolved', resolution_note = v_not, reviewed_by = v_uid,
        reviewed_at = now(), updated_at = now()
    where id = p_appeal_id;

    update public.identity_applications
    set status = 'additional_verification', decided_at = null,
        decision_reason = 'appeal_reopened', updated_at = now()
    where id = v_app.id;

    insert into public.identity_review_events
      (application_id, actor_id, action, from_status, to_status, note)
    values (v_app.id, v_uid, 'appeal_reopened', v_app.status, 'additional_verification', v_not);

    return jsonb_build_object('ok', true, 'appeal_status', 'resolved',
                              'application_status', 'additional_verification');
  end if;

  update public.identity_appeals
  set status = 'rejected',
      resolution_note = v_not, reviewed_by = v_uid, reviewed_at = now(), updated_at = now()
  where id = p_appeal_id;

  update public.identity_applications
  set status = 'rejected', last_review_note = v_not, updated_at = now()
  where id = v_app.id;

  insert into public.identity_verification_decisions (
    application_id, user_id, decision, reason_code, reason, reviewer_id,
    decided_by_human, liveness_claim, face_match_performed
  ) values (
    v_app.id, v_app.user_id, 'rejected', 'appeal_uphold', v_not, v_uid,
    true, 'precheck_only', false
  );

  insert into public.identity_review_events
    (application_id, actor_id, action, from_status, to_status, note)
  values (v_app.id, v_uid, 'appeal_rejected', v_app.status, 'rejected', v_not);

  return jsonb_build_object('ok', true, 'appeal_status', 'rejected',
                            'application_status', 'rejected');
end;
$$;

grant execute on function public.admin_identity_itiraz_karar(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 10) Denetim kayıtları
-- ---------------------------------------------------------------------------
create or replace function public.admin_identity_denetim(
  p_application_id uuid default null,
  p_limit int default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_rows jsonb;
begin
  if not public.identity_yetki('identity.audit.view')
     and not public.identity_yetki('identity.view') then
    raise exception 'Forbidden';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'actor_id', a.actor_id,
    'actor_role', a.actor_role,
    'actor_name', p.display_name,
    'application_id', a.application_id,
    'document_id', a.document_id,
    'action', a.action,
    'purpose', a.purpose,
    'metadata', a.metadata,
    'created_at', a.created_at
  ) order by a.created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select * from public.identity_access_audit
    where p_application_id is null or application_id = p_application_id
    order by created_at desc
    limit v_limit
  ) a
  left join public.profiles p on p.id = a.actor_id;

  return jsonb_build_object('kayitlar', coalesce(v_rows, '[]'::jsonb));
end;
$$;

grant execute on function public.admin_identity_denetim(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 11) Ayarlar
-- ---------------------------------------------------------------------------
create or replace function public.admin_identity_ayarlar()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'selfie_deneme_limiti', s.selfie_deneme_limiti,
    'selfie_oturum_saniye', s.selfie_oturum_saniye,
    'belge_saklama_gun', s.belge_saklama_gun,
    'ikinci_onay_zorunlu', s.ikinci_onay_zorunlu,
    'updated_at', s.updated_at
  )
  from public.identity_verify_settings s
  where s.id = 1
    and (public.identity_yetki('identity.settings.manage') or public.identity_yetki('identity.view'));
$$;

grant execute on function public.admin_identity_ayarlar() to authenticated;

create or replace function public.admin_identity_ayar_guncelle(
  p_selfie_deneme_limiti int default null,
  p_selfie_oturum_saniye int default null,
  p_belge_saklama_gun int default null,
  p_ikinci_onay_zorunlu boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_eski jsonb;
  v_yeni jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.identity_yetki('identity.settings.manage') then raise exception 'Forbidden'; end if;

  select to_jsonb(s) into v_eski from public.identity_verify_settings s where s.id = 1;

  update public.identity_verify_settings
  set selfie_deneme_limiti = coalesce(p_selfie_deneme_limiti, selfie_deneme_limiti),
      selfie_oturum_saniye = coalesce(p_selfie_oturum_saniye, selfie_oturum_saniye),
      belge_saklama_gun = coalesce(p_belge_saklama_gun, belge_saklama_gun),
      ikinci_onay_zorunlu = coalesce(p_ikinci_onay_zorunlu, ikinci_onay_zorunlu),
      updated_at = now(),
      updated_by = v_uid
  where id = 1;

  select to_jsonb(s) into v_yeni from public.identity_verify_settings s where s.id = 1;

  insert into public.identity_access_audit
    (actor_id, actor_role, application_id, action, purpose, metadata)
  values (v_uid, 'admin', null, 'settings_updated', 'operations',
          jsonb_build_object('old', v_eski, 'new', v_yeni));

  return public.admin_identity_ayarlar();
end;
$$;

grant execute on function public.admin_identity_ayar_guncelle(int, int, int, boolean) to authenticated;
