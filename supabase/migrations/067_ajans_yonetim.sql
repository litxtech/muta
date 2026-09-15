-- Ajans yonetim: kurallar, odeme sablonu, sinirsiz limit, silme

-- ---------------------------------------------------------------------------
-- Limit: sinirsiz bayragi
-- ---------------------------------------------------------------------------
alter table public.agency_transfer_limits
  add column if not exists unlimited boolean not null default false;

-- ---------------------------------------------------------------------------
-- Ajans kurallari
-- ---------------------------------------------------------------------------
create table if not exists public.agency_rules (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  body text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_rules_body_len check (char_length(body) <= 8000)
);

drop trigger if exists agency_rules_updated_at on public.agency_rules;
create trigger agency_rules_updated_at
  before update on public.agency_rules
  for each row execute function public.set_updated_at();

alter table public.agency_rules enable row level security;

drop policy if exists "Agency rules select" on public.agency_rules;
create policy "Agency rules select"
  on public.agency_rules for select to authenticated
  using (true);

drop policy if exists "Agency rules owner write" on public.agency_rules;
create policy "Agency rules owner write"
  on public.agency_rules for all to authenticated
  using (
    exists (
      select 1 from public.agencies a
      where a.id = agency_id and (a.owner_id = auth.uid() or public.ben_admin_miyim())
    )
  )
  with check (
    exists (
      select 1 from public.agencies a
      where a.id = agency_id and (a.owner_id = auth.uid() or public.ben_admin_miyim())
    )
  );

grant select, insert, update, delete on public.agency_rules to authenticated;

-- ---------------------------------------------------------------------------
-- Ajans odeme sablonu (IBAN tek tik mesaj)
-- ---------------------------------------------------------------------------
create table if not exists public.agency_payment_templates (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  account_holder text not null default '',
  bank_name text not null default '',
  iban text not null default '',
  phone text not null default '',
  note text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_payment_iban_len check (
    iban = '' or char_length(replace(iban, ' ', '')) between 15 and 34
  ),
  constraint agency_payment_note_len check (char_length(note) <= 1000)
);

drop trigger if exists agency_payment_templates_updated_at on public.agency_payment_templates;
create trigger agency_payment_templates_updated_at
  before update on public.agency_payment_templates
  for each row execute function public.set_updated_at();

alter table public.agency_payment_templates enable row level security;

drop policy if exists "Agency payment select owner" on public.agency_payment_templates;
create policy "Agency payment select owner"
  on public.agency_payment_templates for select to authenticated
  using (
    exists (
      select 1 from public.agencies a
      where a.id = agency_id and (a.owner_id = auth.uid() or public.ben_admin_miyim())
    )
  );

drop policy if exists "Agency payment owner write" on public.agency_payment_templates;
create policy "Agency payment owner write"
  on public.agency_payment_templates for all to authenticated
  using (
    exists (
      select 1 from public.agencies a
      where a.id = agency_id and (a.owner_id = auth.uid() or public.ben_admin_miyim())
    )
  )
  with check (
    exists (
      select 1 from public.agencies a
      where a.id = agency_id and (a.owner_id = auth.uid() or public.ben_admin_miyim())
    )
  );

grant select, insert, update, delete on public.agency_payment_templates to authenticated;

-- ---------------------------------------------------------------------------
-- Yardimci: ajans sahibi veya admin mi?
-- ---------------------------------------------------------------------------
create or replace function public.ajans_sahibi_veya_admin(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agencies a
    where a.id = p_agency_id
      and (
        a.owner_id = auth.uid()
        or public.ben_admin_miyim()
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Sahip olunan aktif ajanslar (menu gorunurlugu)
-- ---------------------------------------------------------------------------
create or replace function public.ajans_yonetim_ajanslarim()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'agency_public_id', a.agency_public_id,
      'name', a.name,
      'status', a.status,
      'is_coin_distributor', a.is_coin_distributor,
      'invite_code', a.invite_code,
      'host_count', a.host_count,
      'level_code', a.level_code
    ) order by a.created_at desc)
    from public.agencies a
    where a.owner_id = v_uid
      and a.status in ('active', 'suspended')
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Kurallari kaydet
-- ---------------------------------------------------------------------------
create or replace function public.ajans_kurallari_kaydet(
  p_agency_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := coalesce(p_body, '');
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ajans_sahibi_veya_admin(p_agency_id) then
    raise exception 'Forbidden';
  end if;
  if char_length(v_body) > 8000 then
    raise exception 'Kurallar en fazla 8000 karakter';
  end if;

  insert into public.agency_rules (agency_id, body, updated_by)
  values (p_agency_id, v_body, v_uid)
  on conflict (agency_id) do update set
    body = excluded.body,
    updated_by = v_uid,
    updated_at = now();

  return jsonb_build_object('ok', true, 'body', v_body);
end;
$$;

-- ---------------------------------------------------------------------------
-- Odeme sablonu kaydet
-- ---------------------------------------------------------------------------
create or replace function public.ajans_odeme_sablonu_kaydet(
  p_agency_id uuid,
  p_account_holder text,
  p_bank_name text,
  p_iban text,
  p_phone text default '',
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_holder text := trim(coalesce(p_account_holder, ''));
  v_bank text := trim(coalesce(p_bank_name, ''));
  v_iban text := upper(replace(trim(coalesce(p_iban, '')), ' ', ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_note text := trim(coalesce(p_note, ''));
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ajans_sahibi_veya_admin(p_agency_id) then
    raise exception 'Forbidden';
  end if;
  if v_holder = '' then raise exception 'Hesap sahibi zorunlu'; end if;
  if v_bank = '' then raise exception 'Banka adi zorunlu'; end if;
  if v_iban = '' then raise exception 'IBAN zorunlu'; end if;
  if char_length(v_iban) < 15 or char_length(v_iban) > 34 then
    raise exception 'IBAN gecersiz';
  end if;
  if char_length(v_note) > 1000 then raise exception 'Not cok uzun'; end if;

  insert into public.agency_payment_templates (
    agency_id, account_holder, bank_name, iban, phone, note, updated_by
  ) values (
    p_agency_id, v_holder, v_bank, v_iban, v_phone, v_note, v_uid
  )
  on conflict (agency_id) do update set
    account_holder = excluded.account_holder,
    bank_name = excluded.bank_name,
    iban = excluded.iban,
    phone = excluded.phone,
    note = excluded.note,
    updated_by = v_uid,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'template', jsonb_build_object(
      'account_holder', v_holder,
      'bank_name', v_bank,
      'iban', v_iban,
      'phone', v_phone,
      'note', v_note
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Ajans sil (kapat) — sahip veya admin
-- ---------------------------------------------------------------------------
create or replace function public.ajans_sil(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_agency public.agencies%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ajans_sahibi_veya_admin(p_agency_id) then
    raise exception 'Forbidden';
  end if;

  select * into v_agency from public.agencies where id = p_agency_id for update;
  if not found then raise exception 'Ajans bulunamadi'; end if;
  if v_agency.status = 'closed' then
    return jsonb_build_object('ok', true, 'status', 'closed');
  end if;

  update public.agencies set
    status = 'closed',
    is_coin_distributor = false,
    updated_at = now()
  where id = p_agency_id;

  update public.host_profiles set
    agency_id = null,
    status = 'independent',
    updated_at = now()
  where agency_id = p_agency_id;

  perform public.bildirim_kuyruga_ekle(
    v_agency.owner_id,
    'system',
    'Ajans kapatıldı',
    v_agency.name || ' kapatıldı. Coin dağıtımı durdu.',
    '/ajans',
    jsonb_build_object('agency_id', p_agency_id, 'type', 'agency_closed')
  );

  perform public.admin_audit_yaz(
    v_agency.owner_id,
    'agency_close',
    'Ajans kapatildi',
    jsonb_build_object('agency_id', p_agency_id, 'by', v_uid)
  );

  return jsonb_build_object('ok', true, 'status', 'closed');
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin limit set: sinirsiz destek (eski 5-arg imzayi kaldir)
-- ---------------------------------------------------------------------------
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

  insert into public.agency_transfer_limits (agency_id)
  values (p_agency_id)
  on conflict (agency_id) do nothing;

  update public.agency_transfer_limits set
    unlimited = v_unlimited,
    single_transfer_limit = case when v_unlimited then coalesce(nullif(p_single, 0), single_transfer_limit) else p_single end,
    daily_limit = case when v_unlimited then coalesce(nullif(p_daily, 0), daily_limit) else p_daily end,
    monthly_limit = case when v_unlimited then coalesce(nullif(p_monthly, 0), monthly_limit) else p_monthly end,
    per_user_limit = case when v_unlimited then coalesce(nullif(p_per_user, 0), per_user_limit) else p_per_user end,
    updated_at = now()
  where agency_id = p_agency_id
  returning * into v_row;

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
      'unlimited', v_row.unlimited
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Panel detay: kurallar + odeme + unlimited
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
      'created_at', a.created_at,
      'description', a.description
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
-- Coin transfer: sinirsiz destek
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
  v_unlimited boolean := false;
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
  v_unlimited := coalesce(v_limits.unlimited, false);

  if not v_unlimited then
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
  end if;

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

-- Admin listesinde unlimited
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

grant execute on function public.ajans_sahibi_veya_admin(uuid) to authenticated;
grant execute on function public.ajans_yonetim_ajanslarim() to authenticated;
grant execute on function public.ajans_kurallari_kaydet(uuid, text) to authenticated;
grant execute on function public.ajans_odeme_sablonu_kaydet(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.ajans_sil(uuid) to authenticated;
grant execute on function public.admin_ajans_limit_set(uuid, bigint, bigint, bigint, bigint, boolean) to authenticated;
