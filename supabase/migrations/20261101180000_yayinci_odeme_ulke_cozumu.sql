-- ===========================================================================
-- Yayıncı ödeme — ülke çözümü ve kimlik kapısı düzeltmesi
-- ===========================================================================
-- Sorun: ödeme kapısı ülkeyi yalnızca creator_program_enrollments.country_code
-- alanından okuyordu. Kullanıcı kayıtta ülke seçmediyse bu alan boş kalıyor ve
-- kimliğini doğrulamış, banka hesabını kaydetmiş yayıncı bile
-- "country_payout_not_supported" hatası alıyordu.
--
-- Çözüm: ülke sırayla şu kaynaklardan çözülür:
--   1) creator_program_enrollments.country_code
--   2) creator_payout_accounts.country_code   (banka hesabında seçilen ülke)
--   3) son identity_applications.country_code  (kimlikte beyan edilen ülke)
--   4) profiles.country_code
-- Böylece banka hesabı kaydedilmiş her kullanıcı için ülke kesin olarak bilinir.
--
-- Ayrıca ödeme talebi oluşturma, eski wallet_accounts.kyc_status alanı yerine
-- Tamuso Verify onayını da kabul eder.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Ülke çözümü
-- ---------------------------------------------------------------------------

create or replace function public.yayinci_odeme_ulke_coz(p_user uuid default null)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user, auth.uid());
  v_ulke text;
begin
  if v_uid is null then
    return null;
  end if;

  begin
    select nullif(btrim(upper(e.country_code)), '')
      into v_ulke
      from public.creator_program_enrollments e
     where e.user_id = v_uid;
  exception when others then
    v_ulke := null;
  end;

  if v_ulke is null or v_ulke !~ '^[A-Z]{2}$' then
    select nullif(btrim(upper(a.country_code)), '')
      into v_ulke
      from public.creator_payout_accounts a
     where a.user_id = v_uid;
  end if;

  if v_ulke is null or v_ulke !~ '^[A-Z]{2}$' then
    select nullif(btrim(upper(i.country_code)), '')
      into v_ulke
      from public.identity_applications i
     where i.user_id = v_uid
     order by i.created_at desc
     limit 1;
  end if;

  if v_ulke is null or v_ulke !~ '^[A-Z]{2}$' then
    select nullif(btrim(upper(p.country_code)), '')
      into v_ulke
      from public.profiles p
     where p.id = v_uid;
  end if;

  if v_ulke is null or v_ulke !~ '^[A-Z]{2}$' then
    return null;
  end if;

  return v_ulke;
end;
$$;

revoke all on function public.yayinci_odeme_ulke_coz(uuid) from public, anon;
grant execute on function public.yayinci_odeme_ulke_coz(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Kimlik + ödeme koşulları — çözülen ülke kullanılır
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
  v_ulke text;
  v_ulke_durum jsonb := '{}'::jsonb;
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

  -- Ülke: kayıt → banka hesabı → kimlik başvurusu → profil sırasıyla.
  v_ulke := public.yayinci_odeme_ulke_coz(v_uid);

  if v_ulke is null then
    v_ulke_ok := false;
  else
    begin
      v_ulke_durum := public.yayinci_odeme_ulke_durumu(v_ulke);
      v_ulke_ok := coalesce((v_ulke_durum ->> 'supported')::boolean, false);
    exception when others then
      v_ulke_ok := false;
      v_ulke_durum := '{}'::jsonb;
    end;
  end if;

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
    'identity_status', coalesce((select a.status from public.identity_applications a where a.user_id = v_uid order by a.created_at desc limit 1), 'not_started'),
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
    'country_code', v_ulke,
    'country_payout_ok', v_ulke_ok,
    'country_payout', v_ulke_durum
  );
end;
$$;

revoke all on function public.identity_odeme_kosullari(uuid) from public, anon;
grant execute on function public.identity_odeme_kosullari(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Ödeme talebi — Tamuso Verify onayı eski KYC yerine geçer
-- ---------------------------------------------------------------------------

create or replace function public.yayinci_odeme_talebi_olustur(p_idempotency_key text)
returns public.creator_payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cfg public.platform_economy_config%rowtype;
  v_req public.creator_payout_requests%rowtype;
  v_amount numeric(14,2);
  v_fee numeric(14,2);
  v_kyc text;
  v_kosul jsonb;
  v_kimlik_ok boolean := false;
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

  -- Eski cüzdan KYC'si ya da Tamuso Verify onayı yeterlidir.
  select kyc_status into v_kyc from public.wallet_accounts where user_id = v_uid;
  if coalesce(v_kyc, 'none') <> 'approved' then
    v_kosul := public.identity_odeme_kosullari(v_uid);
    v_kimlik_ok := coalesce((v_kosul ->> 'identity_approved')::boolean, false)
      and coalesce((v_kosul ->> 'document_level_ok')::boolean, false);
    if not v_kimlik_ok then
      raise exception 'kyc_required';
    end if;
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

revoke all on function public.yayinci_odeme_talebi_olustur(text) from public, anon;
grant execute on function public.yayinci_odeme_talebi_olustur(text) to authenticated;
