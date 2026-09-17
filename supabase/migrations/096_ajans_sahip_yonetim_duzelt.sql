-- Ajansım: sahip bayrağı + onay sonrası yönetim erişimi netleştirme
-- Not: coin dağıtımı (is_coin_distributor) hâlâ ayrı admin yetkisi gerektirir.

create or replace function public.ajans_panel_detay(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.agencies%rowtype;
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_daily bigint;
  v_monthly bigint;
  v_ledger_toplam bigint;
  v_ledger_aylik bigint;
  v_sahip boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  v_admin := public.ben_admin_miyim();

  select * into a from public.agencies where id = p_agency_id;
  if not found then raise exception 'Ajans bulunamadi'; end if;

  v_sahip := (a.owner_id = v_uid);
  if not v_admin and not v_sahip then
    raise exception 'Forbidden';
  end if;

  select coalesce(sum(coins), 0) into v_daily
  from public.agency_coin_transfers
  where agency_id = p_agency_id and status = 'completed'
    and created_at >= date_trunc('day', now());

  select coalesce(sum(coins), 0) into v_monthly
  from public.agency_coin_transfers
  where agency_id = p_agency_id and status = 'completed'
    and created_at >= date_trunc('month', now());

  select coalesce(sum(greatest(delta_diamonds, 0)), 0) into v_ledger_toplam
  from public.agency_earnings_ledger
  where agency_id = p_agency_id;

  select coalesce(sum(greatest(delta_diamonds, 0)), 0) into v_ledger_aylik
  from public.agency_earnings_ledger
  where agency_id = p_agency_id
    and created_at >= date_trunc('month', now());

  return jsonb_build_object(
    'ben_sahibiyim', v_sahip,
    'agency', jsonb_build_object(
      'id', a.id,
      'agency_public_id', a.agency_public_id,
      'name', a.name,
      'country', a.country,
      'status', a.status,
      'trust_tier', a.trust_tier,
      'level_code', a.level_code,
      'is_coin_distributor', a.is_coin_distributor,
      'host_count', a.host_count,
      'owner_id', a.owner_id,
      'invite_code', a.invite_code,
      'created_at', a.created_at,
      'description', a.description,
      'total_gifts', a.total_gifts,
      'monthly_score', a.monthly_score,
      'logo_url', a.logo_url,
      'banner_url', a.banner_url,
      'slogan', a.slogan,
      'website_url', a.website_url
    ),
    'owner', (
      select jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'username', p.username,
        'public_user_id', p.public_user_id,
        'avatar_url', p.avatar_url
      ) from public.profiles p where p.id = a.owner_id
    ),
    'wallet', (
      select jsonb_build_object(
        'distribution_balance', coalesce(w.distribution_balance, 0),
        'diamonds', coalesce(w.diamonds, 0),
        'updated_at', w.updated_at
      ) from public.agency_wallets w where w.agency_id = a.id
    ),
    'ciro', jsonb_build_object(
      'elmas_bakiye', coalesce((
        select w.diamonds from public.agency_wallets w where w.agency_id = a.id
      ), 0),
      'ledger_toplam', v_ledger_toplam,
      'ledger_aylik', v_ledger_aylik,
      'total_gifts', a.total_gifts,
      'monthly_score', a.monthly_score
    ),
    'limits', (
      select jsonb_build_object(
        'single_transfer_limit', l.single_transfer_limit,
        'daily_limit', l.daily_limit,
        'monthly_limit', l.monthly_limit,
        'per_user_limit', l.per_user_limit,
        'unlimited', coalesce(l.unlimited, false),
        'updated_at', l.updated_at
      ) from public.agency_transfer_limits l where l.agency_id = a.id
    ),
    'rules', (
      select jsonb_build_object(
        'body', coalesce(r.body, ''),
        'updated_at', r.updated_at
      ) from public.agency_rules r where r.agency_id = a.id
    ),
    'payment_template', (
      select jsonb_build_object(
        'account_holder', t.account_holder,
        'bank_name', t.bank_name,
        'iban', t.iban,
        'phone', t.phone,
        'note', t.note,
        'updated_at', t.updated_at
      ) from public.agency_payment_templates t where t.agency_id = a.id
    ),
    'kullanim', jsonb_build_object(
      'gunluk_transfer', v_daily,
      'aylik_transfer', v_monthly
    ),
    'uyeler', coalesce((
      select jsonb_agg(uye_row.obj order by uye_row.sort_name)
      from (
        select
          lower(coalesce(p.display_name, p.username, '')) as sort_name,
          jsonb_build_object(
            'user_id', hp.user_id,
            'display_name', p.display_name,
            'username', p.username,
            'public_user_id', p.public_user_id,
            'avatar_url', p.avatar_url,
            'status', hp.status,
            'joined_at', hp.joined_agency_at,
            'ses_dakika_toplam', coalesce((
              select floor(sum(
                extract(epoch from (
                  coalesce(r.ended_at, case when r.is_live then now() else r.created_at end)
                  - r.created_at
                )) / 60.0
              ))::bigint
              from public.rooms r where r.host_id = hp.user_id
            ), 0),
            'ses_dakika_ay', coalesce((
              select floor(sum(
                extract(epoch from (
                  coalesce(r.ended_at, case when r.is_live then now() else r.created_at end)
                  - r.created_at
                )) / 60.0
              ))::bigint
              from public.rooms r
              where r.host_id = hp.user_id
                and r.created_at >= date_trunc('month', now())
            ), 0),
            'yayin_dakika_toplam', coalesce((
              select floor(sum(
                extract(epoch from (
                  coalesce(ls.ended_at, case when ls.is_live then now() else ls.started_at end)
                  - ls.started_at
                )) / 60.0
              ))::bigint
              from public.live_sessions ls where ls.host_id = hp.user_id
            ), 0),
            'yayin_dakika_ay', coalesce((
              select floor(sum(
                extract(epoch from (
                  coalesce(ls.ended_at, case when ls.is_live then now() else ls.started_at end)
                  - ls.started_at
                )) / 60.0
              ))::bigint
              from public.live_sessions ls
              where ls.host_id = hp.user_id
                and ls.started_at >= date_trunc('month', now())
            ), 0),
            'yukleme_coin_toplam', coalesce((
              select sum(cp.coins_added)::bigint
              from public.coin_purchases cp
              where cp.user_id = hp.user_id and cp.status = 'completed'
            ), 0),
            'yukleme_coin_ay', coalesce((
              select sum(cp.coins_added)::bigint
              from public.coin_purchases cp
              where cp.user_id = hp.user_id and cp.status = 'completed'
                and cp.created_at >= date_trunc('month', now())
            ), 0),
            'kazanc_elmas_toplam', coalesce((
              select sum(gt.diamonds_earned)::bigint
              from public.gift_transactions gt where gt.receiver_id = hp.user_id
            ), coalesce(hp.gift_income_diamonds, 0)),
            'kazanc_elmas_ay', coalesce((
              select sum(gt.diamonds_earned)::bigint
              from public.gift_transactions gt
              where gt.receiver_id = hp.user_id
                and gt.created_at >= date_trunc('month', now())
            ), 0)
          ) as obj
        from public.host_profiles hp
        join public.profiles p on p.id = hp.user_id
        where hp.agency_id = p_agency_id and hp.status = 'agency'
      ) uye_row
    ), '[]'::jsonb),
    'bekleyen_host_basvurulari', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ha.id,
        'user_id', ha.user_id,
        'invite_code', ha.invite_code,
        'status', ha.status,
        'created_at', ha.created_at,
        'display_name', p.display_name,
        'username', p.username,
        'public_user_id', p.public_user_id,
        'avatar_url', p.avatar_url
      ) order by ha.created_at desc)
      from public.host_applications ha
      join public.profiles p on p.id = ha.user_id
      where ha.agency_id = p_agency_id and ha.status = 'agency_review'
    ), '[]'::jsonb),
    'son_transferler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'to_user_id', t.to_user_id,
        'coins', t.coins,
        'status', t.status,
        'created_at', t.created_at,
        'to_name', coalesce(tp.display_name, tp.username, left(t.to_user_id::text, 8)),
        'to_username', tp.username,
        'to_public_id', tp.public_user_id
      ) order by t.created_at desc)
      from (
        select * from public.agency_coin_transfers
        where agency_id = p_agency_id
        order by created_at desc
        limit 30
      ) t
      left join public.profiles tp on tp.id = t.to_user_id
    ), '[]'::jsonb),
    'bekleyen_basvurular', case when v_admin then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ap.id,
        'agency_name', ap.agency_name,
        'status', ap.status,
        'created_at', ap.created_at,
        'applicant_id', ap.applicant_id
      ) order by ap.created_at desc)
      from public.agency_applications ap
      where ap.status in ('pending', 'under_review')
      limit 20
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

grant execute on function public.ajans_panel_detay(uuid) to authenticated;

-- Onay bildirimi: coin paneli ayrı yetki; yönetim paneli her zaman açık
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
    v_agency.name || ' aktif. Ajansım’dan üyeleri, daveti, kuralları ve ciroyu yönetebilirsin. Coin yükleme için platform yetkisi gerekir.',
    '/ajans/yonetim',
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
