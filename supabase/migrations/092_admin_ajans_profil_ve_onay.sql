-- Admin ajans: onay hatasi (unlimited kolon), profil alanlari, basvuru/detay zenginlestirme

-- ---------------------------------------------------------------------------
-- Limit kolonu her ortamda olsun (067 kismen uygulanmissa "unlimited" hatasi)
-- ---------------------------------------------------------------------------
alter table public.agency_transfer_limits
  add column if not exists unlimited boolean not null default false;

-- Eski 5-arg limit_set kalintisi PostgREST'te p_unlimited cagrisini bozar
drop function if exists public.admin_ajans_limit_set(uuid, bigint, bigint, bigint, bigint);

create or replace function public.admin_ajans_limit_set(
  p_agency_id uuid,
  p_single bigint,
  p_daily bigint,
  p_monthly bigint,
  p_per_user bigint,
  p_unlimited boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.agency_transfer_limits%rowtype;
  v_unlimited boolean := coalesce(p_unlimited, false);
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  if not v_unlimited then
    if p_single is null or p_single < 100 then raise exception 'Tek sefer limit gecersiz'; end if;
    if p_daily is null or p_daily < 100 then raise exception 'Gunluk limit gecersiz'; end if;
    if p_monthly is null or p_monthly < 100 then raise exception 'Aylik limit gecersiz'; end if;
    if p_per_user is null or p_per_user < 100 then raise exception 'Kullanici limit gecersiz'; end if;
  end if;

  insert into public.agency_transfer_limits (agency_id, unlimited)
  values (p_agency_id, false)
  on conflict (agency_id) do nothing;

  update public.agency_transfer_limits set
    unlimited = v_unlimited,
    single_transfer_limit = case
      when v_unlimited then coalesce(nullif(p_single, 0), single_transfer_limit)
      else p_single
    end,
    daily_limit = case
      when v_unlimited then coalesce(nullif(p_daily, 0), daily_limit)
      else p_daily
    end,
    monthly_limit = case
      when v_unlimited then coalesce(nullif(p_monthly, 0), monthly_limit)
      else p_monthly
    end,
    per_user_limit = case
      when v_unlimited then coalesce(nullif(p_per_user, 0), per_user_limit)
      else p_per_user
    end,
    updated_at = now()
  where agency_id = p_agency_id
  returning * into v_row;

  if not found then
    raise exception 'Ajans limit kaydi olusturulamadi';
  end if;

  perform public.admin_audit_yaz(
    null,
    'agency_limits',
    case when v_unlimited then 'Ajans limitleri: sinirsiz' else 'Ajans limitleri guncellendi' end,
    jsonb_build_object(
      'agency_id', p_agency_id,
      'unlimited', v_unlimited,
      'single', v_row.single_transfer_limit,
      'daily', v_row.daily_limit,
      'monthly', v_row.monthly_limit,
      'per_user', v_row.per_user_limit
    )
  );

  return jsonb_build_object(
    'ok', true,
    'limits', jsonb_build_object(
      'single_transfer_limit', v_row.single_transfer_limit,
      'daily_limit', v_row.daily_limit,
      'monthly_limit', v_row.monthly_limit,
      'per_user_limit', v_row.per_user_limit,
      'unlimited', coalesce(v_row.unlimited, false)
    )
  );
end;
$$;

grant execute on function public.admin_ajans_limit_set(uuid, bigint, bigint, bigint, bigint, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Basvuru onay: logo kopyala, limit satiri (unlimited), sahibi uye yap
-- ---------------------------------------------------------------------------
create or replace function public.admin_ajans_basvuru_onayla(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.agency_applications%rowtype;
  v_agency public.agencies%rowtype;
  v_code text;
  v_prev_agency uuid;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  select * into v_app from public.agency_applications where id = p_application_id for update;
  if not found then raise exception 'Basvuru bulunamadi'; end if;
  if v_app.status not in ('pending', 'under_review') then
    raise exception 'Basvuru zaten islenmis';
  end if;

  if exists (
    select 1 from public.agencies
    where owner_id = v_app.applicant_id and status = 'active'
  ) then
    raise exception 'Basvuranin zaten aktif bir ajansi var';
  end if;

  v_code := upper(substr(md5(v_app.id::text || clock_timestamp()::text), 1, 8));

  insert into public.agencies (
    agency_public_id, name, country, description, logo_url,
    owner_id, invite_code, status, host_count
  ) values (
    public.yeni_ajans_public_id(),
    v_app.agency_name,
    v_app.country,
    v_app.description,
    nullif(trim(coalesce(v_app.logo_url, '')), ''),
    v_app.applicant_id,
    v_code,
    'active',
    1
  ) returning * into v_agency;

  insert into public.agency_wallets (agency_id) values (v_agency.id)
  on conflict do nothing;
  insert into public.agency_commission_rates (agency_id) values (v_agency.id)
  on conflict do nothing;
  insert into public.agency_transfer_limits (agency_id, unlimited)
  values (v_agency.id, false)
  on conflict (agency_id) do update set
    unlimited = coalesce(public.agency_transfer_limits.unlimited, false),
    updated_at = now();

  -- Sahip ajans uyesi olsun (profil / uye listesinde gorunsun)
  select agency_id into v_prev_agency
  from public.host_profiles where user_id = v_app.applicant_id;

  insert into public.host_profiles (user_id, agency_id, status, joined_agency_at)
  values (v_app.applicant_id, v_agency.id, 'agency', now())
  on conflict (user_id) do update set
    agency_id = excluded.agency_id,
    status = 'agency',
    joined_agency_at = coalesce(host_profiles.joined_agency_at, excluded.joined_agency_at),
    updated_at = now();

  update public.profiles
  set is_host = true, updated_at = now()
  where id = v_app.applicant_id;

  insert into public.user_profile_stats (user_id)
  values (v_app.applicant_id)
  on conflict (user_id) do nothing;

  update public.user_profile_stats set
    host_status = 'agency',
    agency_id = v_agency.id,
    updated_at = now()
  where user_id = v_app.applicant_id;

  if v_prev_agency is not null and v_prev_agency is distinct from v_agency.id then
    update public.agencies
    set host_count = greatest(0, host_count - 1), updated_at = now()
    where id = v_prev_agency;
  end if;

  update public.agency_applications set
    status = 'approved', reviewed_at = now()
  where id = p_application_id;

  perform public.bildirim_kuyruga_ekle(
    v_app.applicant_id,
    'system',
    'Ajansin onaylandi',
    v_agency.name || ' aktif. Coin paneline gidebilirsin.',
    '/ajans/' || v_agency.id::text,
    jsonb_build_object('agency_id', v_agency.id, 'type', 'agency_approved')
  );

  perform public.admin_audit_yaz(
    v_app.applicant_id,
    'agency_approve',
    'Ajans basvurusu onaylandi',
    jsonb_build_object('application_id', p_application_id, 'agency_id', v_agency.id)
  );

  return jsonb_build_object('ok', true, 'agency_id', v_agency.id);
end;
$$;

grant execute on function public.admin_ajans_basvuru_onayla(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin listesi: logo + sahip avatar
-- ---------------------------------------------------------------------------
create or replace function public.admin_ajans_listesi(p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lim int := least(greatest(coalesce(p_limit, 50), 1), 120);
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb order by x.created_at desc)
    from (
      select
        a.id,
        a.agency_public_id,
        a.name,
        a.logo_url,
        a.banner_url,
        a.slogan,
        a.country,
        a.description,
        a.status,
        a.trust_tier,
        a.level_code,
        a.is_coin_distributor,
        a.host_count,
        a.owner_id,
        a.invite_code,
        a.created_at,
        jsonb_build_object(
          'display_name', p.display_name,
          'username', p.username,
          'public_user_id', p.public_user_id,
          'avatar_url', p.avatar_url
        ) as owner,
        coalesce(w.distribution_balance, 0) as distribution_balance,
        coalesce(w.diamonds, 0) as diamonds,
        jsonb_build_object(
          'single_transfer_limit', coalesce(l.single_transfer_limit, 10000),
          'daily_limit', coalesce(l.daily_limit, 50000),
          'monthly_limit', coalesce(l.monthly_limit, 500000),
          'per_user_limit', coalesce(l.per_user_limit, 20000),
          'unlimited', coalesce(l.unlimited, false)
        ) as limits
      from public.agencies a
      left join public.profiles p on p.id = a.owner_id
      left join public.agency_wallets w on w.agency_id = a.id
      left join public.agency_transfer_limits l on l.agency_id = a.id
      where a.status <> 'closed'
      order by a.created_at desc
      limit v_lim
    ) x
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_ajans_listesi(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Bekleyen basvurular: basvuran avatar + logo
-- ---------------------------------------------------------------------------
create or replace function public.admin_ajans_basvuru_listesi(p_limit int default 40)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', ap.id,
      'agency_name', ap.agency_name,
      'country', ap.country,
      'email', ap.email,
      'phone', ap.phone,
      'experience', ap.experience,
      'status', ap.status,
      'created_at', ap.created_at,
      'applicant_id', ap.applicant_id,
      'applicant_name', coalesce(p.display_name, p.username),
      'applicant_username', p.username,
      'applicant_avatar_url', p.avatar_url,
      'applicant_public_id', p.public_user_id,
      'logo_url', ap.logo_url,
      'expected_hosts', ap.expected_hosts,
      'description', ap.description
    ) order by ap.created_at desc)
    from (
      select * from public.agency_applications
      where status in ('pending', 'under_review')
      order by created_at desc
      limit least(greatest(coalesce(p_limit, 40), 1), 100)
    ) ap
    left join public.profiles p on p.id = ap.applicant_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_ajans_basvuru_listesi(int) to authenticated;
