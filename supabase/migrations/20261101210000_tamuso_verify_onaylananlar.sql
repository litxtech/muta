-- =============================================================================
-- Tamuso Verify — "Onaylanan Kullanıcılar" sayfası
--
--  1) Onay kararı artık gerekçe yazmayı zorunlu kılmaz. Ret ve ek belge /
--     selfie talepleri kullanıcıya gerekçe gösterilmesi gerektiği için not ister.
--  2) Onaylı başvuruları tüm yönetici bilgileriyle döndüren liste RPC'si.
--     Aynı yanıtta bekleyen (yeni) başvuru sayıları da döner; panel bu sayede
--     yeni başvuru var mı diye kendi kendine kontrol edebilir.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Karar uygulama — onay için gerekçe zorunluluğu kaldırıldı
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

  -- Onay gerekçesiz verilebilir (tek tıkla onay). Ret ve eksik belge/selfie
  -- taleplerinde kullanıcıya gösterilecek bir gerekçe zorunlu kalır.
  if p_action in ('reject', 'request_document', 'request_selfie', 'additional_verification')
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
-- 2) Onaylanan kullanıcılar listesi
-- ---------------------------------------------------------------------------
create or replace function public.admin_identity_onaylananlar(
  p_search text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_rows jsonb;
  v_total int;
  v_ozet jsonb;
begin
  if not public.identity_yetki('identity.view') then
    raise exception 'Forbidden';
  end if;

  with filtre as (
    select
      a.id,
      a.user_id,
      a.status,
      a.country_code,
      a.doc_type,
      a.declared_first_name,
      a.declared_last_name,
      a.declared_birth_date,
      a.submitted_at,
      a.decided_at,
      a.decision_reason,
      a.decision_note,
      a.last_review_note,
      a.reviewer_id,
      a.created_at,
      a.updated_at,
      p.display_name,
      p.username,
      p.public_user_id,
      p.avatar_url,
      p.phone_e164,
      p.country_code as profile_country_code,
      p.birth_date as profile_birth_date,
      p.is_guest,
      p.created_at as profile_created_at,
      u.email,
      w.wallet_number,
      w.wallet_brand_name as wallet_brand,
      w.legal_first_name,
      w.legal_last_name,
      w.kyc_status,
      d.decision,
      d.reason_code,
      d.reason,
      d.created_at as decision_at,
      d.reviewer_id as decision_reviewer_id,
      dr.display_name as decision_reviewer_name,
      pr.display_name as reviewer_name,
      coalesce(belge.toplam, 0) as document_count,
      coalesce(belge.on_yuz, false) as has_front,
      coalesce(belge.arka_yuz, false) as has_back,
      coalesce(belge.selfie, false) as has_selfie
    from public.identity_applications a
    join public.profiles p on p.id = a.user_id
    left join public.wallet_accounts w on w.user_id = a.user_id
    left join auth.users u on u.id = a.user_id
    left join public.profiles pr on pr.id = a.reviewer_id
    left join lateral (
      select d2.decision, d2.reason_code, d2.reason, d2.created_at, d2.reviewer_id
      from public.identity_verification_decisions d2
      where d2.application_id = a.id
      order by d2.created_at desc
      limit 1
    ) d on true
    left join public.profiles dr on dr.id = d.reviewer_id
    left join lateral (
      select
        count(*)::int as toplam,
        bool_or(doc.side = 'front') as on_yuz,
        bool_or(doc.side = 'back') as arka_yuz,
        bool_or(doc.side = 'selfie') as selfie
      from public.identity_documents doc
      where doc.application_id = a.id and doc.deleted_at is null
    ) belge on true
    where a.status = 'approved'
      and (
        v_search is null
        or a.id::text = v_search
        or coalesce(p.display_name, '') ilike '%' || v_search || '%'
        or coalesce(p.username, '') ilike '%' || v_search || '%'
        or coalesce(p.public_user_id, '') ilike '%' || v_search || '%'
        or coalesce(p.phone_e164, '') ilike '%' || v_search || '%'
        or coalesce(u.email, '') ilike '%' || v_search || '%'
        or coalesce(a.declared_first_name || ' ' || a.declared_last_name, '') ilike '%' || v_search || '%'
        or coalesce(w.wallet_number, '') ilike '%' || v_search || '%'
      )
  ),
  sayfa as (
    select f.*
    from filtre f
    order by coalesce(f.decision_at, f.decided_at, f.updated_at) desc nulls last,
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
      'declared_birth_date', s.declared_birth_date,
      'submitted_at', s.submitted_at,
      'decided_at', s.decided_at,
      'decision_reason', s.decision_reason,
      'decision_note', s.decision_note,
      'last_review_note', s.last_review_note,
      'reviewer_id', s.reviewer_id,
      'reviewer_name', s.reviewer_name,
      'created_at', s.created_at,
      'updated_at', s.updated_at,
      'display_name', s.display_name,
      'username', s.username,
      'public_user_id', s.public_user_id,
      'avatar_url', s.avatar_url,
      'phone_e164', s.phone_e164,
      'email', s.email,
      'profile_country_code', s.profile_country_code,
      'profile_birth_date', s.profile_birth_date,
      'is_guest', coalesce(s.is_guest, false),
      'profile_created_at', s.profile_created_at,
      'wallet_number', s.wallet_number,
      'wallet_brand', s.wallet_brand,
      'legal_first_name', s.legal_first_name,
      'legal_last_name', s.legal_last_name,
      'kyc_status', s.kyc_status,
      'decision', s.decision,
      'reason_code', s.reason_code,
      'reason', s.reason,
      'decision_at', s.decision_at,
      'decision_reviewer_id', s.decision_reviewer_id,
      'decision_reviewer_name', s.decision_reviewer_name,
      'document_count', s.document_count,
      'has_front', s.has_front,
      'has_back', s.has_back,
      'has_selfie', s.has_selfie
    ) order by coalesce(s.decision_at, s.decided_at, s.updated_at) desc nulls last,
               s.created_at desc), '[]'::jsonb),
    (select count(*) from filtre)
  into v_rows, v_total
  from sayfa s;

  select jsonb_build_object(
    'onayli_toplam', (select count(*) from public.identity_applications where status = 'approved'),
    'bugun_onay', (select count(*) from public.identity_applications
                    where status = 'approved'
                      and decided_at >= date_trunc('day', now())),
    'bu_hafta_onay', (select count(*) from public.identity_applications
                       where status = 'approved'
                         and decided_at >= date_trunc('week', now())),
    'bu_ay_onay', (select count(*) from public.identity_applications
                    where status = 'approved'
                      and decided_at >= date_trunc('month', now())),
    'yeni_basvuru', (select count(*) from public.identity_applications
                       where status in ('under_review', 'additional_verification',
                                        'awaiting_document', 'awaiting_selfie', 'appeal_review')),
    'inceleme_bekleyen', (select count(*) from public.identity_applications
                           where status = 'under_review'),
    'bugun_basvuru', (select count(*) from public.identity_applications
                        where submitted_at >= date_trunc('day', now())),
    'eksik_belge', (select count(*) from public.identity_applications
                     where status = 'awaiting_document'),
    'selfie_bekleyen', (select count(*) from public.identity_applications
                         where status = 'awaiting_selfie'),
    'ek_dogrulama', (select count(*) from public.identity_applications
                      where status = 'additional_verification'),
    'acik_itiraz', (select count(*) from public.identity_appeals
                     where status in ('open', 'reviewing'))
  ) into v_ozet;

  return jsonb_build_object(
    'toplam', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'kayitlar', v_rows,
    'ozet', v_ozet
  );
end;
$$;

grant execute on function public.admin_identity_onaylananlar(text, int, int) to authenticated;
