-- =============================================================================
-- Tamuso Verify — ödeme kapısı, uygunluk, saklama/imha
--
-- Kural: yayıncı kazancı ve cüzdan bakiyesi korunur; ancak GERÇEK para transferi
-- (payout talebi) Tamuso Verify onayı olmadan açılmaz. Kontrol hem uygunluk
-- fonksiyonunda hem de creator_payout_requests tablo tetikleyicisinde tekrarlanır
-- (tek yol değil, savunma katmanı).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Belge seviyesi
-- ---------------------------------------------------------------------------
create or replace function public.identity_belge_seviyesi(p_application_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_app public.identity_applications%rowtype;
  v_gerek jsonb;
  v_front boolean;
  v_back boolean;
  v_selfie boolean;
begin
  select * into v_app from public.identity_applications where id = p_application_id;
  if not found then return 'none'; end if;

  v_gerek := public.identity_belge_gereksinimi(v_app.country_code, v_app.doc_type);

  select
    exists (select 1 from public.identity_documents d
            where d.application_id = p_application_id and d.side = 'front'
              and d.deleted_at is null and d.quality_state <> 'failed'),
    exists (select 1 from public.identity_documents d
            where d.application_id = p_application_id and d.side = 'back'
              and d.deleted_at is null and d.quality_state <> 'failed'),
    exists (select 1 from public.identity_documents d
            where d.application_id = p_application_id and d.side = 'selfie'
              and d.deleted_at is null and d.quality_state <> 'failed')
  into v_front, v_back, v_selfie;

  if not v_front then return 'none'; end if;
  if coalesce((v_gerek ->> 'sides_required')::int, 1) >= 2 and not v_back then return 'partial'; end if;
  if not v_selfie then return 'basic'; end if;
  return 'complete';
end;
$$;

revoke all on function public.identity_belge_seviyesi(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Ödeme koşulları (8 madde, sunucu tarafı tek kaynak)
-- ---------------------------------------------------------------------------
create or replace function public.identity_odeme_kosullari(p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user, auth.uid());
  v_birth date;
  v_enr public.creator_program_enrollments%rowtype;
  v_bank text;
  v_wallet_kyc text;
  v_adult boolean := false;
  v_kimlik boolean := false;
  v_seviye text := 'none';
  v_belge_ok boolean := false;
  v_bank_ok boolean := false;
  v_sozlesme boolean := false;
  v_bakiye numeric := 0;
  v_min numeric := 25;
  v_risk_ok boolean := true;
  v_ulke_ok boolean := true;
  v_ulke jsonb := '{}'::jsonb;
  v_app_id uuid;
  v_kodlar jsonb := '[]'::jsonb;
  v_ok boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select birth_date into v_birth from public.profiles where id = v_uid;
  select kyc_status into v_wallet_kyc from public.wallet_accounts where user_id = v_uid;

  select * into v_enr from public.creator_program_enrollments where user_id = v_uid;

  select status into v_bank from public.creator_payout_accounts where user_id = v_uid;

  select id into v_app_id
  from public.identity_applications
  where user_id = v_uid and status = 'approved'
  order by decided_at desc nulls last, created_at desc
  limit 1;

  v_adult := v_birth is not null and v_birth <= (current_date - interval '18 years');
  v_kimlik := public.identity_dogrulanmis_mi(v_uid);

  if v_app_id is not null then
    v_seviye := public.identity_belge_seviyesi(v_app_id);
  end if;
  v_belge_ok := v_kimlik and v_seviye in ('basic', 'complete');

  v_bank_ok := coalesce(v_bank, '') = 'verified';
  v_sozlesme := v_enr.user_id is not null
    and v_enr.status = 'approved'
    and v_enr.contract_accepted_at is not null;

  begin
    select coalesce(c.payout_min_usd, 25.00) into v_min
    from public.platform_economy_config c where c.id = 1;
    v_min := coalesce(v_min, 25.00);

    select coalesce(sum(e.net_usd), 0) into v_bakiye
    from public.creator_earning_entries e
    where e.creator_id = v_uid and public.yayinci_kazanc_durumu(e) = 'available';
  exception when others then
    v_bakiye := 0;
  end;

  v_risk_ok := not exists (
    select 1 from public.finance_risk_flags
    where user_id = v_uid and status = 'open' and severity = 'high'
  );

  begin
    v_ulke := public.yayinci_odeme_ulke_durumu(v_enr.country_code);
    v_ulke_ok := coalesce((v_ulke ->> 'supported')::boolean, false);
  exception when others then
    v_ulke_ok := false;
    v_ulke := '{}'::jsonb;
  end;

  v_ok := v_adult and v_kimlik and v_belge_ok and v_bank_ok
          and v_sozlesme and v_bakiye >= v_min and v_risk_ok and v_ulke_ok;

  v_kodlar := (
    select coalesce(jsonb_agg(k), '[]'::jsonb)
    from (
      select 'adult_required' as k where not v_adult
      union all select 'identity_required' where not v_kimlik
      union all select 'identity_document_level_insufficient' where v_kimlik and not v_belge_ok
      union all select 'bank_account_required' where not v_bank_ok
      union all select 'program_contract_required' where not v_sozlesme
      union all select 'below_minimum' where v_bakiye < v_min
      union all select 'security_review' where not v_risk_ok
      union all select 'country_payout_not_supported' where not v_ulke_ok
    ) t
  );

  return jsonb_build_object(
    'user_id', v_uid,
    'ok', v_ok,
    'kodlar', v_kodlar,
    'is_adult', v_adult,
    'identity_approved', v_kimlik,
    'identity_application_id', v_app_id,
    'identity_status', coalesce((select a.status from public.identity_applications a
                                 where a.user_id = v_uid
                                 order by a.created_at desc limit 1), 'not_started'),
    'document_level', v_seviye,
    'document_level_ok', v_belge_ok,
    'legacy_kyc_status', coalesce(v_wallet_kyc, 'none'),
    'payout_account_status', coalesce(v_bank, 'none'),
    'payout_account_verified', v_bank_ok,
    'contract_accepted', v_sozlesme,
    'program_status', coalesce(v_enr.status, 'none'),
    'available_usd', round(v_bakiye::numeric, 2),
    'minimum_usd', v_min,
    'min_balance_ok', v_bakiye >= v_min,
    'risk_ok', v_risk_ok,
    'country_code', v_enr.country_code,
    'country_payout_ok', v_ulke_ok,
    'country_payout', v_ulke
  );
end;
$$;

revoke all on function public.identity_odeme_kosullari(uuid) from public, anon;
grant execute on function public.identity_odeme_kosullari(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Yayıncı uygunluk durumu — Tamuso Verify tek kaynak olur
-- ---------------------------------------------------------------------------
create or replace function public.yayinci_uygunluk_durumu(p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
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
  v_kimlik boolean;
  v_kyc_ok boolean;
  v_bank_ok boolean;
  v_tax_ok boolean;
  v_ok boolean;
  v_kosul jsonb;
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

  -- Kimlik doğrulama artık yalnızca Tamuso Verify kararından gelir.
  v_kimlik := public.identity_dogrulanmis_mi(v_uid);
  v_kyc_ok := v_kimlik;

  v_bank_ok := coalesce(v_bank_status, '') = 'verified';
  v_tax_ok := v_enr.tax_status in ('complete', 'not_required');
  v_high_risk := exists (
    select 1 from public.finance_risk_flags
    where user_id = v_uid and status = 'open' and severity = 'high'
  );

  begin
    v_kosul := public.identity_odeme_kosullari(v_uid);
  exception when others then
    v_kosul := '{}'::jsonb;
  end;

  v_ok := v_adult and v_program and v_kyc_ok and v_bank_ok and v_tax_ok and not v_high_risk;

  return jsonb_build_object(
    'user_id', v_uid,
    'is_adult', v_adult,
    'program_status', coalesce(v_enr.status, 'none'),
    'program_approved', v_program,
    'kyc_status', case when v_kimlik then 'approved' else coalesce(v_kyc, 'none') end,
    'kyc_source', 'tamuso_verify',
    'kyc_verified', v_kyc_ok,
    'payout_account_status', coalesce(v_bank_status, 'none'),
    'payout_account_verified', v_bank_ok,
    'tax_status', coalesce(v_enr.tax_status, 'pending'),
    'tax_complete', v_tax_ok,
    'open_high_risk', v_high_risk,
    'eligible', v_ok,
    'verify', jsonb_build_object(
      'identity_status', v_kosul ->> 'identity_status',
      'document_level', v_kosul ->> 'document_level',
      'document_level_ok', v_kosul -> 'document_level_ok',
      'kodlar', coalesce(v_kosul -> 'kodlar', '[]'::jsonb)
    )
  );
end;
$$;

grant execute on function public.yayinci_uygunluk_durumu(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Payout talebi kapısı (tablo tetikleyicisi — tüm yollar için)
-- ---------------------------------------------------------------------------
create or replace function public.creator_payout_identity_gate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kosul jsonb;
begin
  v_kosul := public.identity_odeme_kosullari(new.user_id);

  if not coalesce((v_kosul ->> 'is_adult')::boolean, false) then
    raise exception 'adult_required';
  end if;

  if not coalesce((v_kosul ->> 'identity_approved')::boolean, false) then
    raise exception 'identity_required';
  end if;

  if not coalesce((v_kosul ->> 'document_level_ok')::boolean, false) then
    raise exception 'identity_document_level_insufficient';
  end if;

  if not coalesce((v_kosul ->> 'risk_ok')::boolean, false) then
    raise exception 'security_review';
  end if;

  if not coalesce((v_kosul ->> 'country_payout_ok')::boolean, false) then
    raise exception 'country_payout_not_supported';
  end if;

  return new;
end;
$$;

drop trigger if exists creator_payout_requests_identity_gate on public.creator_payout_requests;
create trigger creator_payout_requests_identity_gate
  before insert on public.creator_payout_requests
  for each row execute function public.creator_payout_identity_gate();

-- ---------------------------------------------------------------------------
-- 5) Saklama süresi ve imha
-- ---------------------------------------------------------------------------
create or replace function public.identity_saklama_calistir(p_limit int default 500)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 500), 1), 5000);
  v_saklama int := 180;
  v_oturum int := 0;
  v_isaret int := 0;
  v_imha int := 0;
  v_obje int := 0;
  v_satir int := 0;
  r record;
begin
  select belge_saklama_gun into v_saklama
  from public.identity_verify_settings where id = 1;
  v_saklama := coalesce(v_saklama, 180);

  -- Süresi geçmiş tek kullanımlık selfie oturumları
  update public.identity_capture_sessions
  set state = 'expired'
  where state = 'pending' and expires_at < now();
  get diagnostics v_oturum = row_count;

  -- Karara bağlanmış başvurularda saklama süresi dolan ham görüntüleri işaretle
  update public.identity_documents d
  set deleted_at = now(), delete_reason = 'retention'
  from public.identity_applications a
  where d.application_id = a.id
    and d.deleted_at is null
    and a.status in ('approved', 'rejected')
    and coalesce(a.decided_at, a.updated_at) < now() - make_interval(days => v_saklama);
  get diagnostics v_isaret = row_count;

  -- İşaretlenmiş kayıtları depodan ve tablodan kalıcı sil (30 gün bekleme)
  for r in
    select d.id, d.storage_bucket, d.storage_path, d.application_id
    from public.identity_documents d
    where d.deleted_at is not null
      and d.deleted_at < now() - interval '30 days'
    order by d.deleted_at
    limit v_limit
  loop
    begin
      delete from storage.objects
      where bucket_id = r.storage_bucket and name = r.storage_path;
      get diagnostics v_satir = row_count;
      v_obje := v_obje + v_satir;
    exception when others then
      null;
    end;

    delete from public.identity_documents where id = r.id;
    v_imha := v_imha + 1;
  end loop;

  insert into public.identity_access_audit (actor_id, actor_role, action, purpose, metadata)
  values (
    null, 'system', 'retention_run', 'retention',
    jsonb_build_object('oturum', v_oturum, 'isaret', v_isaret, 'imha', v_imha,
                       'obje', v_obje, 'saklama_gun', v_saklama)
  );

  return jsonb_build_object(
    'ok', true,
    'suresi_gecen_oturum', v_oturum,
    'isaretlenen_belge', v_isaret,
    'imha_edilen_belge', v_imha,
    'silinen_obje', v_obje,
    'saklama_gun', v_saklama
  );
end;
$$;

revoke all on function public.identity_saklama_calistir(int) from public, anon, authenticated;
grant execute on function public.identity_saklama_calistir(int) to service_role;

-- ---------------------------------------------------------------------------
-- 6) Kullanıcı veri talebi durumu (KVKK başvuru takibi)
-- ---------------------------------------------------------------------------
create or replace function public.identity_veri_talebi_durumu()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_toplam int;
  v_silinmis int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select count(*), count(*) filter (where d.deleted_at is not null)
  into v_toplam, v_silinmis
  from public.identity_documents d
  where d.user_id = v_uid;

  return jsonb_build_object(
    'toplam_kayit', v_toplam,
    'silinmis_kayit', v_silinmis,
    'aktif_kayit', v_toplam - v_silinmis
  );
end;
$$;

grant execute on function public.identity_veri_talebi_durumu() to authenticated;
