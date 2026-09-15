-- FAZ 10: Sertifikasyon — mutabakat genisletme, saglik ozeti,
-- checklist, load/security sinyalleri, graceful degradation bayraklari
-- Run after 001–010

insert into public.feature_flags (key, enabled, description) values
  ('certification_hub_enabled', false, 'Sertifikasyon hub ekrani'),
  ('low_end_mode_enabled', false, 'Dusuk cihaz performans modu'),
  ('graceful_degradation_enabled', true, 'Ag hatasinda yumusak dusus'),
  ('stress_tools_enabled', false, 'Canli/hediye stres araclari (dev)')
on conflict (key) do nothing;

insert into public.kill_switches (key, active, reason) values
  ('kill_heavy_animations', false, null),
  ('kill_livekit_reconnect', false, null)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Certification checklist (admin/ops seed; client read-only)
-- ---------------------------------------------------------------------------
create table if not exists public.certification_checks (
  code text primary key,
  title text not null,
  category text not null
    check (category in (
      'load','security','reconciliation','livekit','gift','network','android'
    )),
  status text not null default 'pending'
    check (status in ('pending','pass','fail','skip')),
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.certification_checks (code, title, category, status) values
  ('rec_wallet_ledger', 'Cuzdan coin vs wallet_ledger', 'reconciliation', 'pending'),
  ('rec_host_diamonds', 'Host elmas vs host_earnings_ledger', 'reconciliation', 'pending'),
  ('sec_kill_switches', 'Kritik kill switch okunabilir', 'security', 'pending'),
  ('sec_rls_finance', 'Finans tablolari RLS acik', 'security', 'pending'),
  ('load_gift_queue', 'Hediye animasyon kuyrugu stres', 'load', 'pending'),
  ('livekit_token', 'livekit-token edge smoke', 'livekit', 'pending'),
  ('livekit_reconnect', 'LiveKit baglanti / reconnect izolasyonu', 'livekit', 'pending'),
  ('gift_stress', 'Hediye animasyon stress (low-end)', 'gift', 'pending'),
  ('net_offline', 'Offline graceful degradation', 'network', 'pending'),
  ('android_low_end', 'Dusuk cihaz animasyon kisitlama', 'android', 'pending')
on conflict (code) do nothing;

alter table public.certification_checks enable row level security;

drop policy if exists "Certification checks read" on public.certification_checks;
create policy "Certification checks read"
  on public.certification_checks for select to authenticated
  using (true);

grant select on public.certification_checks to authenticated;

-- Authenticated: son mutabakat ozetleri (detay sayilari, tutar yok)
drop policy if exists "Reconciliation runs read auth" on public.reconciliation_runs;
create policy "Reconciliation runs read auth"
  on public.reconciliation_runs for select to authenticated
  using (true);

grant select on public.reconciliation_runs to authenticated;

-- ---------------------------------------------------------------------------
-- Host diamonds reconciliation
-- ---------------------------------------------------------------------------
create or replace function public.host_elmas_mutabakat_calistir()
returns public.reconciliation_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mismatch int;
  v_run public.reconciliation_runs%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  select count(*) into v_mismatch
  from public.host_earnings h
  left join (
    select user_id, coalesce(sum(delta), 0) as s
    from public.host_earnings_ledger
    group by user_id
  ) l on l.user_id = h.user_id
  where h.diamonds <> coalesce(l.s, 0);

  insert into public.reconciliation_runs (kind, status, details)
  values (
    'host_diamonds_vs_ledger',
    case when v_mismatch = 0 then 'ok' else 'mismatch' end,
    jsonb_build_object('mismatch_users', v_mismatch)
  ) returning * into v_run;

  update public.certification_checks
  set status = case when v_mismatch = 0 then 'pass' else 'fail' end,
      details = jsonb_build_object('run_id', v_run.id, 'mismatch_users', v_mismatch),
      updated_at = now()
  where code = 'rec_host_diamonds';

  return v_run;
end;
$$;

-- Full package (service_role)
create or replace function public.mutabakat_paketi_calistir()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.reconciliation_runs%rowtype;
  v_host public.reconciliation_runs%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;

  v_wallet := public.cuzdan_mutabakat_calistir();

  update public.certification_checks
  set status = case when v_wallet.status = 'ok' then 'pass' else 'fail' end,
      details = coalesce(v_wallet.details, '{}'::jsonb) || jsonb_build_object('run_id', v_wallet.id),
      updated_at = now()
  where code = 'rec_wallet_ledger';

  v_host := public.host_elmas_mutabakat_calistir();

  return jsonb_build_object(
    'wallet', to_jsonb(v_wallet),
    'host', to_jsonb(v_host)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Platform health (authenticated, no secrets / balances)
-- ---------------------------------------------------------------------------
create or replace function public.platform_saglik_ozeti()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_last jsonb;
  v_flags jsonb;
  v_kills jsonb;
  v_checks jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
  into v_last
  from (
    select id, kind, status, details, created_at
    from public.reconciliation_runs
    order by created_at desc
    limit 5
  ) r;

  select coalesce(jsonb_object_agg(key, enabled), '{}'::jsonb)
  into v_flags
  from public.feature_flags
  where key in (
    'certification_hub_enabled',
    'low_end_mode_enabled',
    'graceful_degradation_enabled',
    'stress_tools_enabled',
    'gifts_enabled',
    'live_enabled',
    'analytics_enabled'
  );

  select coalesce(jsonb_object_agg(key, active), '{}'::jsonb)
  into v_kills
  from public.kill_switches
  where key in (
    'kill_coin_purchase',
    'kill_gift_send',
    'kill_live',
    'kill_heavy_animations',
    'kill_livekit_reconnect',
    'kill_moderation'
  );

  -- Side-effect free: mark kill-switch readability via separate client tool
  select coalesce(jsonb_agg(to_jsonb(c) order by c.category, c.code), '[]'::jsonb)
  into v_checks
  from public.certification_checks c;

  return jsonb_build_object(
    'ok', true,
    'reconciliation_recent', v_last,
    'feature_flags', v_flags,
    'kill_switches', v_kills,
    'certification_checks', v_checks,
    'generated_at', now()
  );
end;
$$;

-- Client may update own stress-tool checklist rows only (dev)
create or replace function public.sertifikasyon_kontrol_guncelle(
  p_code text,
  p_status text,
  p_details jsonb default '{}'::jsonb
)
returns public.certification_checks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.certification_checks%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_status is null or p_status not in ('pending','pass','fail','skip') then
    raise exception 'invalid status';
  end if;
  if p_code not in (
    'load_gift_queue','livekit_reconnect','gift_stress','net_offline',
    'android_low_end','livekit_token','sec_kill_switches'
  ) then
    raise exception 'code not client-updatable';
  end if;
  if not public.ozellik_bayragi_aktif_mi('stress_tools_enabled')
     and not public.ozellik_bayragi_aktif_mi('certification_hub_enabled') then
    raise exception 'certification tools disabled';
  end if;

  update public.certification_checks
  set status = p_status,
      details = coalesce(p_details, '{}'::jsonb),
      updated_at = now()
  where code = p_code
  returning * into v_row;

  if v_row.code is null then
    raise exception 'unknown code';
  end if;
  return v_row;
end;
$$;

-- Light flood / load signal (rate-limited by client; backend stores signal)
create or replace function public.yuk_sinyali_kaydet(
  p_kind text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_uid uuid := auth.uid();
  v_recent int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_kind is null or length(trim(p_kind)) = 0 then
    raise exception 'kind required';
  end if;

  select count(*) into v_recent
  from public.security_events
  where user_id = v_uid
    and event_type = 'load_signal'
    and created_at > now() - interval '60 seconds';

  if v_recent >= 20 then
    raise exception 'rate_limited';
  end if;

  insert into public.security_events (
    user_id, event_type, risk_score, severity, metadata
  ) values (
    v_uid,
    'load_signal',
    case when v_recent > 10 then 25 else 5 end,
    case when v_recent > 10 then 'medium' else 'low' end,
    jsonb_build_object('kind', left(p_kind, 64)) || coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.platform_saglik_ozeti() to authenticated;
grant execute on function public.sertifikasyon_kontrol_guncelle(text, text, jsonb) to authenticated;
grant execute on function public.yuk_sinyali_kaydet(text, jsonb) to authenticated;
