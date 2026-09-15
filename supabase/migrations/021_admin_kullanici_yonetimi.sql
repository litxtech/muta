-- Admin: kapsamli kullanici yonetimi
-- Dosya, ban, silme, ihtar, iade riski, audit log

-- ---------------------------------------------------------------------------
-- Ihtarlar
-- ---------------------------------------------------------------------------
create table if not exists public.user_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  issued_by uuid references public.profiles (id) on delete set null,
  reason text not null,
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  cleared_at timestamptz,
  cleared_by uuid references public.profiles (id) on delete set null
);

create index if not exists user_warnings_user_idx
  on public.user_warnings (user_id, created_at desc);

-- Admin islem kayitlari (anlasilir audit)
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  target_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_target_idx
  on public.admin_audit_logs (target_user_id, created_at desc);
create index if not exists admin_audit_logs_admin_idx
  on public.admin_audit_logs (admin_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.admin_audit_yaz(
  p_target uuid,
  p_action text,
  p_summary text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_audit_logs (admin_id, target_user_id, action, summary, details)
  values (auth.uid(), p_target, p_action, p_summary, coalesce(p_details, '{}'::jsonb));
end;
$$;

create or replace function public._sure_metni(p_seconds bigint)
returns text
language sql
immutable
as $$
  select case
    when p_seconds is null or p_seconds <= 0 then '0 dk'
    when p_seconds < 3600 then (p_seconds / 60)::text || ' dk'
    when p_seconds < 86400 then
      (p_seconds / 3600)::text || ' sa ' || ((p_seconds % 3600) / 60)::text || ' dk'
    else
      (p_seconds / 86400)::text || ' gun ' || ((p_seconds % 86400) / 3600)::text || ' sa'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Admin kullanici ara
-- ---------------------------------------------------------------------------
create or replace function public.admin_kullanici_ara(
  p_q text default null,
  p_limit int default 40
)
returns table (
  id uuid,
  username text,
  display_name text,
  public_user_id text,
  phone_e164 text,
  avatar_url text,
  is_admin boolean,
  is_guest boolean,
  is_host boolean,
  banned_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz,
  coins bigint,
  diamonds bigint,
  warning_count bigint,
  platform text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_lim int := least(greatest(coalesce(p_limit, 40), 1), 100);
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  return query
  select
    p.id,
    p.username,
    p.display_name,
    p.public_user_id::text,
    p.phone_e164,
    p.avatar_url,
    coalesce(p.is_admin, false),
    coalesce(p.is_guest, false),
    coalesce(p.is_host, false),
    p.banned_at,
    p.deleted_at,
    p.created_at,
    coalesce(w.coins, 0),
    coalesce(w.diamonds, 0),
    (
      select count(*)::bigint from public.user_warnings uw
      where uw.user_id = p.id and uw.is_active
    ),
    (
      select ds.platform from public.device_sessions ds
      where ds.user_id = p.id
      order by ds.last_seen_at desc nulls last
      limit 1
    )
  from public.profiles p
  left join public.wallets w on w.user_id = p.id
  where
    v_q is null
    or p.username ilike '%' || v_q || '%'
    or p.display_name ilike '%' || v_q || '%'
    or p.phone_e164 ilike '%' || v_q || '%'
    or p.public_user_id::text ilike '%' || v_q || '%'
    or p.id::text ilike v_q || '%'
  order by p.created_at desc
  limit v_lim;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin kullanici dosyasi (tam kapsam)
-- ---------------------------------------------------------------------------
create or replace function public.admin_kullanici_dosyasi(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.profiles%rowtype;
  v_wallet record;
  v_first_purchase record;
  v_total_load bigint;
  v_load_count bigint;
  v_gift_sent bigint;
  v_gift_recv bigint;
  v_gift_sent_coins bigint;
  v_gift_recv_diamonds bigint;
  v_active_sec bigint;
  v_warn_count bigint;
  v_report_count bigint;
  v_refund_count bigint;
  v_pending_withdraw bigint;
  v_risk int := 0;
  v_risk_seviye text := 'dusuk';
  v_risk_notlar text[] := array[]::text[];
  v_account_days numeric;
  v_platforms text;
  v_phone text;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  if p_user_id is null then raise exception 'user required'; end if;

  select * into v_p from public.profiles where id = p_user_id;
  if not found then
    return jsonb_build_object('ok', false, 'hata', 'Kullanici bulunamadi');
  end if;

  select * into v_wallet from public.wallets where user_id = p_user_id;

  select
    coalesce(sum(coins_added), 0)::bigint,
    count(*)::bigint
  into v_total_load, v_load_count
  from public.coin_purchases
  where user_id = p_user_id and status in ('completed', 'paid');

  -- paid status may not exist; also count completed only was enough; add refunded separately
  select
    cp.id, cp.created_at, cp.coins_added, cp.amount_usd, cp.provider, cp.store, cp.status
  into v_first_purchase
  from public.coin_purchases cp
  where cp.user_id = p_user_id
    and coalesce(cp.status, 'completed') in ('completed', 'paid')
  order by cp.created_at asc
  limit 1;

  select
    count(*)::bigint,
    coalesce(sum(coins_spent), 0)::bigint
  into v_gift_sent, v_gift_sent_coins
  from public.gift_transactions where sender_id = p_user_id;

  select
    count(*)::bigint,
    coalesce(sum(diamonds_earned), 0)::bigint
  into v_gift_recv, v_gift_recv_diamonds
  from public.gift_transactions where receiver_id = p_user_id;

  select coalesce(sum(
    greatest(extract(epoch from (ds.last_seen_at - ds.created_at)), 0)
  ), 0)::bigint
  into v_active_sec
  from public.device_sessions ds
  where ds.user_id = p_user_id;

  select count(*)::bigint into v_warn_count
  from public.user_warnings where user_id = p_user_id and is_active;

  select count(*)::bigint into v_report_count
  from public.user_reports
  where target_user_id = p_user_id and status in ('open', 'reviewing');

  select count(*)::bigint into v_refund_count
  from public.coin_purchases
  where user_id = p_user_id and status = 'refunded';

  select coalesce(sum(diamonds), 0)::bigint into v_pending_withdraw
  from public.withdrawal_requests
  where user_id = p_user_id and status in ('pending', 'under_review', 'frozen');

  select string_agg(distinct coalesce(platform, 'unknown'), ', ')
  into v_platforms
  from public.device_sessions where user_id = p_user_id;

  v_phone := v_p.phone_e164;
  v_account_days := extract(epoch from (now() - v_p.created_at)) / 86400.0;

  -- Iade risk skoru (0-100)
  if v_refund_count > 0 then
    v_risk := v_risk + least(40, v_refund_count * 15);
    v_risk_notlar := array_append(v_risk_notlar, 'Onceki iade kaydi var');
  end if;
  if v_warn_count > 0 then
    v_risk := v_risk + least(25, v_warn_count * 8);
    v_risk_notlar := array_append(v_risk_notlar, 'Aktif ihtar mevcut');
  end if;
  if v_report_count > 0 then
    v_risk := v_risk + least(20, v_report_count * 7);
    v_risk_notlar := array_append(v_risk_notlar, 'Acik kullanici raporu');
  end if;
  if v_pending_withdraw > 0 and v_account_days < 7 then
    v_risk := v_risk + 20;
    v_risk_notlar := array_append(v_risk_notlar, 'Yeni hesap + bekleyen cekim');
  end if;
  if v_total_load > 0 and v_account_days < 2 then
    v_risk := v_risk + 15;
    v_risk_notlar := array_append(v_risk_notlar, 'Ilk 48 saatte yukleme');
  end if;
  if v_p.banned_at is not null then
    v_risk := v_risk + 10;
    v_risk_notlar := array_append(v_risk_notlar, 'Hesap banli');
  end if;
  if v_risk = 0 then
    v_risk_notlar := array_append(v_risk_notlar, 'Belirgin risk sinyali yok');
  end if;
  v_risk := least(100, v_risk);
  v_risk_seviye := case
    when v_risk >= 70 then 'yuksek'
    when v_risk >= 35 then 'orta'
    else 'dusuk'
  end;

  return jsonb_build_object(
    'ok', true,
    'profil', jsonb_build_object(
      'id', v_p.id,
      'username', v_p.username,
      'display_name', v_p.display_name,
      'public_user_id', v_p.public_user_id,
      'phone_e164', v_phone,
      'avatar_url', v_p.avatar_url,
      'bio', v_p.bio,
      'country', v_p.country,
      'language', v_p.language,
      'is_admin', coalesce(v_p.is_admin, false),
      'is_guest', coalesce(v_p.is_guest, false),
      'is_host', coalesce(v_p.is_host, false),
      'is_verified', coalesce(v_p.is_verified, false),
      'level', v_p.level,
      'xp', v_p.xp,
      'created_at', v_p.created_at,
      'banned_at', v_p.banned_at,
      'ban_reason', v_p.ban_reason,
      'deleted_at', v_p.deleted_at
    ),
    'cuzdan', jsonb_build_object(
      'coins', coalesce(v_wallet.coins, 0),
      'diamonds', coalesce(v_wallet.diamonds, 0)
    ),
    'yukleme', jsonb_build_object(
      'toplam_coin', coalesce(v_total_load, 0),
      'adet', coalesce(v_load_count, 0),
      'ilk', case when v_first_purchase.id is null then null else jsonb_build_object(
        'id', v_first_purchase.id,
        'tarih', v_first_purchase.created_at,
        'coin', v_first_purchase.coins_added,
        'tutar_usd', v_first_purchase.amount_usd,
        'provider', v_first_purchase.provider,
        'store', v_first_purchase.store,
        'kaynak', case
          when v_first_purchase.store = 'apple' then 'App Store (iOS)'
          when v_first_purchase.store = 'google' then 'Google Play (Android)'
          when v_first_purchase.store = 'manual' then 'Manuel'
          when v_first_purchase.store = 'admin' then 'Admin'
          when v_first_purchase.provider = 'stripe' then 'Kart / Stripe'
          else coalesce(v_first_purchase.store, v_first_purchase.provider, 'Bilinmiyor')
        end
      ) end
    ),
    'hediye', jsonb_build_object(
      'gonderilen_adet', coalesce(v_gift_sent, 0),
      'gonderilen_coin', coalesce(v_gift_sent_coins, 0),
      'alinan_adet', coalesce(v_gift_recv, 0),
      'alinan_elmas', coalesce(v_gift_recv_diamonds, 0)
    ),
    'oturum', jsonb_build_object(
      'tahmini_aktif_saniye', coalesce(v_active_sec, 0),
      'tahmini_aktif_metin', public._sure_metni(coalesce(v_active_sec, 0)),
      'platformlar', coalesce(v_platforms, 'Kayit yok'),
      'cihazlar', coalesce((
        select jsonb_agg(x order by x->>'son_gorulme' desc)
        from (
          select jsonb_build_object(
            'device_id', ds.device_id,
            'platform', ds.platform,
            'model', ds.device_model,
            'app_version', ds.app_version,
            'olusturma', ds.created_at,
            'son_gorulme', ds.last_seen_at,
            'iptal', ds.revoked_at is not null,
            'sure_metin', public._sure_metni(
              greatest(extract(epoch from (ds.last_seen_at - ds.created_at)), 0)::bigint
            )
          ) as x
          from public.device_sessions ds
          where ds.user_id = p_user_id
          order by ds.last_seen_at desc
          limit 20
        ) q
      ), '[]'::jsonb)
    ),
    'ihtar', jsonb_build_object(
      'aktif_adet', coalesce(v_warn_count, 0),
      'liste', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', uw.id,
          'reason', uw.reason,
          'severity', uw.severity,
          'notes', uw.notes,
          'is_active', uw.is_active,
          'created_at', uw.created_at,
          'issued_by', uw.issued_by
        ) order by uw.created_at desc)
        from public.user_warnings uw
        where uw.user_id = p_user_id
      ), '[]'::jsonb)
    ),
    'risk', jsonb_build_object(
      'skor', v_risk,
      'seviye', v_risk_seviye,
      'iade_riski_var', v_risk >= 35,
      'notlar', to_jsonb(v_risk_notlar),
      'acik_rapor', coalesce(v_report_count, 0),
      'iade_adet', coalesce(v_refund_count, 0),
      'bekleyen_cekim_elmas', coalesce(v_pending_withdraw, 0)
    ),
    'hareketler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'currency', l.currency,
        'delta', l.delta,
        'balance_after', l.balance_after,
        'reason', l.reason,
        'ref_type', l.ref_type,
        'created_at', l.created_at
      ) order by l.created_at desc)
      from (
        select * from public.wallet_ledger
        where user_id = p_user_id
        order by created_at desc
        limit 80
      ) l
    ), '[]'::jsonb),
    'hediye_akis', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'yon', case when g.sender_id = p_user_id then 'gonderilen' else 'alinan' end,
        'karsi_id', case when g.sender_id = p_user_id then g.receiver_id else g.sender_id end,
        'karsi_ad', (
          select coalesce(pr.display_name, pr.username, 'Kullanici')
          from public.profiles pr
          where pr.id = case when g.sender_id = p_user_id then g.receiver_id else g.sender_id end
        ),
        'coins_spent', g.coins_spent,
        'diamonds_earned', g.diamonds_earned,
        'quantity', g.quantity,
        'created_at', g.created_at
      ) order by g.created_at desc)
      from (
        select * from public.gift_transactions gt
        where gt.sender_id = p_user_id or gt.receiver_id = p_user_id
        order by gt.created_at desc
        limit 40
      ) g
    ), '[]'::jsonb),
    'guvenlik_olaylari', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', se.id,
        'event_type', se.event_type,
        'severity', se.severity,
        'risk_score', se.risk_score,
        'status', se.status,
        'created_at', se.created_at,
        'metadata', se.metadata
      ) order by se.created_at desc)
      from (
        select * from public.security_events
        where user_id = p_user_id
        order by created_at desc
        limit 40
      ) se
    ), '[]'::jsonb),
    'admin_loglari', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'action', a.action,
        'summary', a.summary,
        'details', a.details,
        'admin_id', a.admin_id,
        'created_at', a.created_at
      ) order by a.created_at desc)
      from (
        select * from public.admin_audit_logs
        where target_user_id = p_user_id
        order by created_at desc
        limit 40
      ) a
    ), '[]'::jsonb),
    'yuklemeler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cp.id,
        'tarih', cp.created_at,
        'coin', cp.coins_added,
        'tutar_usd', cp.amount_usd,
        'store', cp.store,
        'provider', cp.provider,
        'status', cp.status
      ) order by cp.created_at desc)
      from (
        select * from public.coin_purchases
        where user_id = p_user_id
        order by created_at desc
        limit 30
      ) cp
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Ban / unban / soft delete / ihtar (admin)
-- ---------------------------------------------------------------------------
create or replace function public.admin_kullanici_banla(
  p_user_id uuid,
  p_reason text default 'policy_violation'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'policy_violation');
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_user_id = auth.uid() then raise exception 'Kendini banlayamazsin'; end if;

  update public.profiles set
    banned_at = now(),
    ban_reason = v_reason,
    updated_at = now()
  where id = p_user_id;

  update public.device_sessions
    set revoked_at = now()
  where user_id = p_user_id and revoked_at is null;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    p_user_id, 'account_banned', 'high',
    jsonb_build_object('reason', v_reason, 'by', auth.uid())
  );

  perform public.admin_audit_yaz(
    p_user_id, 'ban',
    'Kullanici banlandi: ' || v_reason,
    jsonb_build_object('reason', v_reason)
  );

  return jsonb_build_object('ok', true, 'kod', 'banned');
end;
$$;

create or replace function public.admin_kullanici_ban_kaldir(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  update public.profiles set
    banned_at = null,
    ban_reason = null,
    updated_at = now()
  where id = p_user_id;

  perform public.admin_audit_yaz(p_user_id, 'unban', 'Ban kaldirildi', '{}'::jsonb);
  return jsonb_build_object('ok', true, 'kod', 'unbanned');
end;
$$;

create or replace function public.admin_kullanici_sil(
  p_user_id uuid,
  p_reason text default 'admin_delete'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'admin_delete');
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_user_id = auth.uid() then raise exception 'Kendini silemezsin'; end if;

  update public.profiles set
    deleted_at = now(),
    deletion_requested_at = now(),
    banned_at = coalesce(banned_at, now()),
    ban_reason = coalesce(ban_reason, v_reason),
    display_name = 'Silinmis hesap',
    username = 'deleted_' || replace(id::text, '-', ''),
    avatar_url = null,
    bio = '',
    phone_e164 = null,
    updated_at = now()
  where id = p_user_id and deleted_at is null;

  update public.device_sessions
    set revoked_at = now()
  where user_id = p_user_id and revoked_at is null;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    p_user_id, 'account_admin_deleted', 'critical',
    jsonb_build_object('reason', v_reason, 'by', auth.uid())
  );

  perform public.admin_audit_yaz(
    p_user_id, 'delete',
    'Hesap admin tarafindan silindi',
    jsonb_build_object('reason', v_reason)
  );

  return jsonb_build_object('ok', true, 'kod', 'deleted');
end;
$$;

create or replace function public.admin_ihtar_ver(
  p_user_id uuid,
  p_reason text,
  p_severity text default 'medium',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_sev text := coalesce(nullif(trim(p_severity), ''), 'medium');
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Sebep gerekli'; end if;
  if v_sev not in ('low', 'medium', 'high', 'critical') then
    v_sev := 'medium';
  end if;

  insert into public.user_warnings (user_id, issued_by, reason, severity, notes)
  values (p_user_id, auth.uid(), trim(p_reason), v_sev, nullif(trim(p_notes), ''))
  returning id into v_id;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    p_user_id, 'user_warning', v_sev,
    jsonb_build_object('warning_id', v_id, 'reason', p_reason, 'by', auth.uid())
  );

  perform public.admin_audit_yaz(
    p_user_id, 'warning',
    'Ihtar verildi: ' || trim(p_reason),
    jsonb_build_object('warning_id', v_id, 'severity', v_sev)
  );

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.admin_ihtar_kaldir(p_warning_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  update public.user_warnings set
    is_active = false,
    cleared_at = now(),
    cleared_by = auth.uid()
  where id = p_warning_id and is_active
  returning user_id into v_uid;

  if v_uid is not null then
    perform public.admin_audit_yaz(
      v_uid, 'warning_clear',
      'Ihtar kaldirildi',
      jsonb_build_object('warning_id', p_warning_id)
    );
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.user_warnings enable row level security;
alter table public.admin_audit_logs enable row level security;

drop policy if exists "Warnings admin all" on public.user_warnings;
create policy "Warnings admin all"
  on public.user_warnings for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

drop policy if exists "Own warnings read" on public.user_warnings;
create policy "Own warnings read"
  on public.user_warnings for select to authenticated
  using (auth.uid() = user_id or public.ben_admin_miyim());

drop policy if exists "Audit admin read" on public.admin_audit_logs;
create policy "Audit admin read"
  on public.admin_audit_logs for select to authenticated
  using (public.ben_admin_miyim());

grant select on public.user_warnings to authenticated;
grant select on public.admin_audit_logs to authenticated;

grant execute on function public.admin_kullanici_ara(text, int) to authenticated;
grant execute on function public.admin_kullanici_dosyasi(uuid) to authenticated;
grant execute on function public.admin_kullanici_banla(uuid, text) to authenticated;
grant execute on function public.admin_kullanici_ban_kaldir(uuid) to authenticated;
grant execute on function public.admin_kullanici_sil(uuid, text) to authenticated;
grant execute on function public.admin_ihtar_ver(uuid, text, text, text) to authenticated;
grant execute on function public.admin_ihtar_kaldir(uuid) to authenticated;
