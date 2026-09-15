-- Ajans coin yukleme + limit yukseltme/indirme (admin + ajans paneli)

-- ---------------------------------------------------------------------------
-- Admin: ajans listesi
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
        a.country,
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
          'public_user_id', p.public_user_id
        ) as owner,
        coalesce(w.distribution_balance, 0) as distribution_balance,
        coalesce(w.diamonds, 0) as diamonds,
        jsonb_build_object(
          'single_transfer_limit', coalesce(l.single_transfer_limit, 10000),
          'daily_limit', coalesce(l.daily_limit, 50000),
          'monthly_limit', coalesce(l.monthly_limit, 500000),
          'per_user_limit', coalesce(l.per_user_limit, 20000)
        ) as limits
      from public.agencies a
      left join public.profiles p on p.id = a.owner_id
      left join public.agency_wallets w on w.agency_id = a.id
      left join public.agency_transfer_limits l on l.agency_id = a.id
      order by a.created_at desc
      limit v_lim
    ) x
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin / sahip: ajans detay paneli
-- ---------------------------------------------------------------------------
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
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  v_admin := public.ben_admin_miyim();

  select * into a from public.agencies where id = p_agency_id;
  if not found then raise exception 'Ajans bulunamadi'; end if;
  if not v_admin and a.owner_id <> v_uid then
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

  return jsonb_build_object(
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
      'created_at', a.created_at
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
    'limits', (
      select jsonb_build_object(
        'single_transfer_limit', l.single_transfer_limit,
        'daily_limit', l.daily_limit,
        'monthly_limit', l.monthly_limit,
        'per_user_limit', l.per_user_limit,
        'updated_at', l.updated_at
      ) from public.agency_transfer_limits l where l.agency_id = a.id
    ),
    'kullanim', jsonb_build_object(
      'gunluk_transfer', v_daily,
      'aylik_transfer', v_monthly
    ),
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

-- ---------------------------------------------------------------------------
-- Admin: ajans cuzdanina coin yukle / dusur
-- ---------------------------------------------------------------------------
create or replace function public.admin_ajans_coin_yukle(
  p_agency_id uuid,
  p_delta bigint,
  p_reason text default 'admin_agency_topup'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal bigint;
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'admin_agency_topup');
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'Delta 0 olamaz'; end if;

  insert into public.agency_wallets (agency_id, distribution_balance)
  values (p_agency_id, greatest(p_delta, 0))
  on conflict (agency_id) do nothing;

  update public.agency_wallets
  set
    distribution_balance = case
      when distribution_balance + p_delta < 0 then 0
      else distribution_balance + p_delta
    end,
    updated_at = now()
  where agency_id = p_agency_id
  returning distribution_balance into v_bal;

  if not found then raise exception 'Ajans cuzdani yok'; end if;

  perform public.admin_audit_yaz(
    null,
    'agency_coin_topup',
    'Ajans coin: ' || p_delta::text,
    jsonb_build_object(
      'agency_id', p_agency_id,
      'delta', p_delta,
      'balance_after', v_bal,
      'reason', v_reason
    )
  );

  return jsonb_build_object(
    'ok', true,
    'distribution_balance', v_bal,
    'delta', p_delta
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: limit set (mutlak degerler)
-- ---------------------------------------------------------------------------
create or replace function public.admin_ajans_limit_set(
  p_agency_id uuid,
  p_single bigint,
  p_daily bigint,
  p_monthly bigint,
  p_per_user bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.agency_transfer_limits%rowtype;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_single is null or p_single < 100 then raise exception 'Tek sefer limit gecersiz'; end if;
  if p_daily is null or p_daily < 100 then raise exception 'Gunluk limit gecersiz'; end if;
  if p_monthly is null or p_monthly < 100 then raise exception 'Aylik limit gecersiz'; end if;
  if p_per_user is null or p_per_user < 100 then raise exception 'Kullanici limit gecersiz'; end if;

  insert into public.agency_transfer_limits (agency_id)
  values (p_agency_id)
  on conflict (agency_id) do nothing;

  update public.agency_transfer_limits set
    single_transfer_limit = p_single,
    daily_limit = p_daily,
    monthly_limit = p_monthly,
    per_user_limit = p_per_user,
    updated_at = now()
  where agency_id = p_agency_id
  returning * into v_row;

  perform public.admin_audit_yaz(
    null,
    'agency_limits',
    'Ajans limitleri guncellendi',
    jsonb_build_object(
      'agency_id', p_agency_id,
      'single', p_single,
      'daily', p_daily,
      'monthly', p_monthly,
      'per_user', p_per_user
    )
  );

  return jsonb_build_object(
    'ok', true,
    'limits', jsonb_build_object(
      'single_transfer_limit', v_row.single_transfer_limit,
      'daily_limit', v_row.daily_limit,
      'monthly_limit', v_row.monthly_limit,
      'per_user_limit', v_row.per_user_limit
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: distributor ac/kapa + durum
-- ---------------------------------------------------------------------------
create or replace function public.admin_ajans_distributor_ayarla(
  p_agency_id uuid,
  p_enabled boolean,
  p_status text default null,
  p_trust_tier text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  update public.agencies set
    is_coin_distributor = coalesce(p_enabled, is_coin_distributor),
    status = case
      when p_status in ('active', 'suspended', 'closed') then p_status
      else status
    end,
    trust_tier = case
      when p_trust_tier in ('A', 'B', 'C', 'Restricted', 'Suspended') then p_trust_tier
      else trust_tier
    end,
    updated_at = now()
  where id = p_agency_id;

  if not found then raise exception 'Ajans bulunamadi'; end if;

  perform public.admin_audit_yaz(
    null,
    'agency_distributor',
    'Ajans distributor: ' || coalesce(p_enabled::text, 'same'),
    jsonb_build_object(
      'agency_id', p_agency_id,
      'enabled', p_enabled,
      'status', p_status,
      'trust_tier', p_trust_tier
    )
  );

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: basvuru onayla (ajans olustur)
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
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  select * into v_app from public.agency_applications where id = p_application_id for update;
  if not found then raise exception 'Basvuru bulunamadi'; end if;
  if v_app.status not in ('pending', 'under_review') then
    raise exception 'Basvuru zaten islenmis';
  end if;

  v_code := upper(substr(md5(v_app.id::text), 1, 8));

  insert into public.agencies (
    agency_public_id, name, country, description, owner_id, invite_code, status
  ) values (
    public.yeni_ajans_public_id(), v_app.agency_name, v_app.country, v_app.description,
    v_app.applicant_id, v_code, 'active'
  ) returning * into v_agency;

  insert into public.agency_wallets (agency_id) values (v_agency.id)
  on conflict do nothing;
  insert into public.agency_commission_rates (agency_id) values (v_agency.id)
  on conflict do nothing;
  insert into public.agency_transfer_limits (agency_id) values (v_agency.id)
  on conflict do nothing;

  update public.agency_applications set
    status = 'approved', reviewed_at = now()
  where id = p_application_id;

  perform public.bildirim_kuyruga_ekle(
    v_app.applicant_id,
    'system',
    'Ajansın onaylandı',
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

create or replace function public.admin_ajans_basvuru_reddet(
  p_application_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.agency_applications%rowtype;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  update public.agency_applications set
    status = 'rejected',
    reviewed_at = now(),
    review_note = coalesce(nullif(trim(coalesce(p_note, '')), ''), review_note)
  where id = p_application_id and status in ('pending', 'under_review')
  returning * into v_app;

  if not found then raise exception 'Basvuru bulunamadi veya islenemez'; end if;

  perform public.bildirim_kuyruga_ekle(
    v_app.applicant_id,
    'system',
    'Ajans başvurusu reddedildi',
    coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Başvurun incelendi ve reddedildi.'),
    '/ajans',
    jsonb_build_object('application_id', p_application_id, 'type', 'agency_rejected')
  );

  return jsonb_build_object('ok', true);
end;
$$;

-- Bekleyen basvurular (admin)
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
      'status', ap.status,
      'created_at', ap.created_at,
      'applicant_id', ap.applicant_id,
      'applicant_name', coalesce(p.display_name, p.username),
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

-- ---------------------------------------------------------------------------
-- Transfer: aylik limit kontrolu ekle
-- ---------------------------------------------------------------------------
create or replace function public.ajans_coin_transfer(
  p_agency_id uuid,
  p_to_user_id uuid,
  p_coins bigint,
  p_idempotency_key text
)
returns public.agency_coin_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_agency public.agencies%rowtype;
  v_limits public.agency_transfer_limits%rowtype;
  v_wallet public.agency_wallets%rowtype;
  v_tx public.agency_coin_transfers%rowtype;
  v_daily bigint;
  v_monthly bigint;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_agency_coin_transfer') then
    raise exception 'Agency transfers temporarily disabled';
  end if;
  if not public.ozellik_bayragi_aktif_mi('agency_enabled') then
    raise exception 'Agency feature disabled';
  end if;
  if p_coins is null or p_coins <= 0 then raise exception 'Invalid coins'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'idempotency_key required';
  end if;

  select * into v_tx from public.agency_coin_transfers where idempotency_key = p_idempotency_key;
  if found then return v_tx; end if;

  select * into v_agency from public.agencies where id = p_agency_id for update;
  if not found then raise exception 'Agency not found'; end if;
  if v_agency.owner_id <> v_uid and not public.ben_admin_miyim() then
    raise exception 'Not agency owner';
  end if;
  if not v_agency.is_coin_distributor then raise exception 'Not authorized distributor'; end if;
  if v_agency.trust_tier in ('Restricted','Suspended') or v_agency.status <> 'active' then
    raise exception 'Agency not allowed to transfer';
  end if;

  select * into v_limits from public.agency_transfer_limits where agency_id = p_agency_id;
  if not found then raise exception 'Limits missing'; end if;
  if p_coins > v_limits.single_transfer_limit then raise exception 'Tek sefer limit asildi'; end if;
  if p_coins > v_limits.per_user_limit then raise exception 'Kullanici limit asildi'; end if;

  select coalesce(sum(coins),0) into v_daily from public.agency_coin_transfers
  where agency_id = p_agency_id and status = 'completed'
    and created_at >= date_trunc('day', now());
  if v_daily + p_coins > v_limits.daily_limit then raise exception 'Gunluk limit asildi'; end if;

  select coalesce(sum(coins),0) into v_monthly from public.agency_coin_transfers
  where agency_id = p_agency_id and status = 'completed'
    and created_at >= date_trunc('month', now());
  if v_monthly + p_coins > v_limits.monthly_limit then raise exception 'Aylik limit asildi'; end if;

  select * into v_wallet from public.agency_wallets where agency_id = p_agency_id for update;
  if v_wallet.distribution_balance < p_coins then raise exception 'Yetersiz ajans bakiyesi'; end if;

  update public.agency_wallets set
    distribution_balance = distribution_balance - p_coins,
    updated_at = now()
  where agency_id = p_agency_id;

  insert into public.wallets (user_id, coins)
  values (p_to_user_id, 0)
  on conflict (user_id) do nothing;

  update public.wallets set coins = coins + p_coins, updated_at = now()
  where user_id = p_to_user_id;

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type)
  values (
    p_to_user_id, 'coins', p_coins,
    (select coins from public.wallets where user_id = p_to_user_id),
    'agency_distribution', 'agency_transfer'
  );

  insert into public.agency_coin_transfers (
    agency_id, from_user_id, to_user_id, coins, idempotency_key, status
  ) values (
    p_agency_id, v_uid, p_to_user_id, p_coins, p_idempotency_key, 'completed'
  ) returning * into v_tx;

  perform public.bildirim_kuyruga_ekle(
    p_to_user_id,
    'wallet',
    'Ajans coin yüklemesi',
    p_coins::text || ' coin hesabına eklendi',
    '/(tabs)/wallet',
    jsonb_build_object('agency_id', p_agency_id, 'coins', p_coins, 'type', 'agency_topup')
  );

  return v_tx;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant execute on function public.admin_ajans_listesi(int) to authenticated;
grant execute on function public.ajans_panel_detay(uuid) to authenticated;
grant execute on function public.admin_ajans_coin_yukle(uuid, bigint, text) to authenticated;
grant execute on function public.admin_ajans_limit_set(uuid, bigint, bigint, bigint, bigint) to authenticated;
grant execute on function public.admin_ajans_distributor_ayarla(uuid, boolean, text, text) to authenticated;
grant execute on function public.admin_ajans_basvuru_onayla(uuid) to authenticated;
grant execute on function public.admin_ajans_basvuru_reddet(uuid, text) to authenticated;
grant execute on function public.admin_ajans_basvuru_listesi(int) to authenticated;
grant execute on function public.ajans_coin_transfer(uuid, uuid, bigint, text) to authenticated;
