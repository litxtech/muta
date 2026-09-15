-- Admin: yeni kayit anlik bildirimi + 23:59 gunluk toplam kayit ozeti

-- ---------------------------------------------------------------------------
-- Gunluk ozet log (idempotent)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_daily_registration_digest (
  digest_date date primary key,
  total_count int not null default 0,
  member_count int not null default 0,
  guest_count int not null default 0,
  sent_at timestamptz not null default now()
);

alter table public.admin_daily_registration_digest enable row level security;

drop policy if exists "Admin digest read" on public.admin_daily_registration_digest;
create policy "Admin digest read"
  on public.admin_daily_registration_digest for select to authenticated
  using (public.ben_admin_miyim());

grant select on public.admin_daily_registration_digest to authenticated;

-- ---------------------------------------------------------------------------
-- Tum adminlere zorunlu sistem bildirimi (tercih atlanmaz)
-- ---------------------------------------------------------------------------
create or replace function public.admin_operasyon_bildirimi(
  p_title text,
  p_body text default null,
  p_deep_link text default '/admin/kullanicilar',
  p_payload jsonb default '{}'::jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_n int := 0;
begin
  if p_title is null or length(trim(p_title)) = 0 then
    return 0;
  end if;

  for v_admin in
    select p.id
    from public.profiles p
    where coalesce(p.is_admin, false) = true
      and p.deleted_at is null
      and p.banned_at is null
  loop
    begin
      insert into public.notification_outbox (
        user_id, category, title, body, deep_link, payload, status
      ) values (
        v_admin,
        'system',
        left(trim(p_title), 120),
        case when p_body is null then null else left(trim(p_body), 400) end,
        coalesce(p_deep_link, '/admin/kullanicilar'),
        coalesce(p_payload, '{}'::jsonb),
        'pending'
      );
      v_n := v_n + 1;
    exception when others then
      null;
    end;
  end loop;

  return v_n;
end;
$$;

grant execute on function public.admin_operasyon_bildirimi(text, text, text, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Kayit tetikleyicisi: yeni kullanici → admin bildirimi
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
  is_guest_meta boolean;
  pid text;
  v_display text;
begin
  is_guest_meta := coalesce((new.raw_user_meta_data->>'is_guest')::boolean, false);
  uname := coalesce(
    new.raw_user_meta_data->>'username',
    case when is_guest_meta then 'guest_' || substr(replace(new.id::text, '-', ''), 1, 8)
         else 'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
    end
  );
  pid := public.yeni_public_kullanici_id();
  v_display := coalesce(new.raw_user_meta_data->>'display_name', uname);

  insert into public.profiles (
    id, username, display_name, gender, public_user_id, is_guest, language
  ) values (
    new.id,
    uname,
    v_display,
    coalesce(new.raw_user_meta_data->>'gender', null),
    pid,
    is_guest_meta,
    coalesce(new.raw_user_meta_data->>'language', 'tr')
  );

  insert into public.wallets (user_id, coins, diamonds)
  values (new.id, case when is_guest_meta then 0 else 100 end, 0);

  if not is_guest_meta then
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason)
    values (new.id, 'coins', 100, 100, 'welcome_bonus');
  end if;

  -- Admin hesabina anlik yeni kayit bildirimi
  begin
    perform public.admin_operasyon_bildirimi(
      case when is_guest_meta then 'Yeni misafir kayıt' else 'Yeni kullanıcı kayıt' end,
      trim(
        coalesce(v_display, uname)
        || case when uname is not null then ' · @' || uname else '' end
        || ' · ID ' || coalesce(pid, left(new.id::text, 8))
        || case when new.email is not null then ' · ' || new.email else '' end
      ),
      '/admin/kullanicilar/' || new.id::text,
      jsonb_build_object(
        'type', 'admin_new_registration',
        'user_id', new.id,
        'is_guest', is_guest_meta,
        'public_user_id', pid,
        'username', uname,
        'display_name', v_display
      )
    );
  exception when others then
    null;
  end;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 23:59 TR: gunluk toplam kayit ozeti
-- ---------------------------------------------------------------------------
create or replace function public.admin_gunluk_kayit_ozeti_gonder(
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (timezone('Europe/Istanbul', now()))::date;
  v_hour int := extract(hour from timezone('Europe/Istanbul', now()))::int;
  v_minute int := extract(minute from timezone('Europe/Istanbul', now()))::int;
  v_start timestamptz;
  v_end timestamptz;
  v_total int;
  v_member int;
  v_guest int;
  v_sent int;
begin
  -- Sadece 23:55–23:59 penceresi (veya force)
  if not p_force then
    if v_hour <> 23 or v_minute < 55 then
      return jsonb_build_object(
        'ok', true,
        'skipped', true,
        'reason', 'not_2359_window',
        'istanbul_time', timezone('Europe/Istanbul', now())
      );
    end if;
  end if;

  if not p_force and exists (
    select 1 from public.admin_daily_registration_digest where digest_date = v_today
  ) then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'already_sent',
      'digest_date', v_today
    );
  end if;

  v_start := (v_today::timestamp) at time zone 'Europe/Istanbul';
  v_end := ((v_today + 1)::timestamp) at time zone 'Europe/Istanbul';

  select
    count(*)::int,
    count(*) filter (where coalesce(is_guest, false) = false)::int,
    count(*) filter (where coalesce(is_guest, false) = true)::int
  into v_total, v_member, v_guest
  from public.profiles
  where created_at >= v_start
    and created_at < v_end;

  v_sent := public.admin_operasyon_bildirimi(
    'Günlük kayıt özeti',
    'Bugün toplam '
      || v_total::text
      || ' yeni kayıt · '
      || v_member::text
      || ' üye · '
      || v_guest::text
      || ' misafir ('
      || to_char(v_today, 'DD.MM.YYYY')
      || ')',
    '/admin/kullanicilar',
    jsonb_build_object(
      'type', 'admin_daily_registrations',
      'digest_date', v_today,
      'total', v_total,
      'members', v_member,
      'guests', v_guest
    )
  );

  insert into public.admin_daily_registration_digest (
    digest_date, total_count, member_count, guest_count, sent_at
  ) values (
    v_today, v_total, v_member, v_guest, now()
  )
  on conflict (digest_date) do update set
    total_count = excluded.total_count,
    member_count = excluded.member_count,
    guest_count = excluded.guest_count,
    sent_at = excluded.sent_at;

  return jsonb_build_object(
    'ok', true,
    'digest_date', v_today,
    'total', v_total,
    'members', v_member,
    'guests', v_guest,
    'admins_notified', v_sent
  );
end;
$$;

grant execute on function public.admin_gunluk_kayit_ozeti_gonder(boolean)
  to service_role;

-- Admin panelinden manuel tetik (test)
create or replace function public.admin_gunluk_kayit_ozeti_manuel()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  return public.admin_gunluk_kayit_ozeti_gonder(true);
end;
$$;

grant execute on function public.admin_gunluk_kayit_ozeti_manuel() to authenticated;

-- ---------------------------------------------------------------------------
-- pg_cron: her saat xx:59 — fonksiyon kendi TR 23:55–59 penceresini kontrol eder
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron yok — edge cron kullanin';
    return;
  end;

  begin
    perform cron.unschedule('admin-gunluk-kayit-ozeti');
  exception when others then
    null;
  end;

  begin
    perform cron.schedule(
      'admin-gunluk-kayit-ozeti',
      '59 * * * *',
      $cron$ select public.admin_gunluk_kayit_ozeti_gonder(false); $cron$
    );
  exception when others then
    raise notice 'pg_cron schedule basarisiz: %', SQLERRM;
  end;
end $$;
