-- Cuzdan / cekim duzeltmeleri:
-- 1) Cekim talebinde wallet_ledger kaydi
-- 2) host_earnings yoksa olustur; bakiye wallets ile uyumlu kontrol
-- 3) Reddedilen cekimlerde elmas iadesi
-- 4) Ajans komisyonu host elmasindan dusulsun
-- 5) withdrawals_enabled acik

update public.feature_flags
set enabled = true, updated_at = now()
where key = 'withdrawals_enabled' and enabled = false;

create or replace function public.cekim_talebi_olustur(
  p_diamonds bigint,
  p_method text default 'bank',
  p_details jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_host_bal bigint;
  v_wallet_bal bigint;
  v_row public.withdrawal_requests%rowtype;
  v_key text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if public.kill_switch_aktif_mi('kill_withdrawal') then
    raise exception 'Withdrawals temporarily disabled';
  end if;
  if not public.ozellik_bayragi_aktif_mi('withdrawals_enabled') then
    raise exception 'Withdrawals feature disabled';
  end if;

  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot withdraw'; end if;
  if p_diamonds is null or p_diamonds <= 0 then raise exception 'Invalid amount'; end if;

  v_key := coalesce(
    nullif(trim(p_idempotency_key), ''),
    'wd_' || v_uid::text || '_' || p_diamonds::text || '_' || extract(epoch from now())::bigint
  );

  select * into v_row from public.withdrawal_requests where idempotency_key = v_key;
  if found then return v_row; end if;

  insert into public.wallets (user_id, coins, diamonds)
  values (v_uid, 0, 0)
  on conflict (user_id) do nothing;

  insert into public.host_earnings (user_id, diamonds)
  select v_uid, coalesce(w.diamonds, 0)
  from public.wallets w
  where w.user_id = v_uid
  on conflict (user_id) do nothing;

  select diamonds into v_wallet_bal
  from public.wallets where user_id = v_uid for update;

  select diamonds into v_host_bal
  from public.host_earnings where user_id = v_uid for update;

  if least(coalesce(v_host_bal, 0), coalesce(v_wallet_bal, 0)) < p_diamonds then
    raise exception 'Insufficient diamonds';
  end if;

  update public.host_earnings
  set diamonds = diamonds - p_diamonds, updated_at = now()
  where user_id = v_uid;

  update public.wallets
  set diamonds = diamonds - p_diamonds, updated_at = now()
  where user_id = v_uid
  returning diamonds into v_wallet_bal;

  insert into public.host_earnings_ledger (user_id, delta, balance_after, reason, ref_type)
  values (
    v_uid, -p_diamonds,
    (select diamonds from public.host_earnings where user_id = v_uid),
    'withdrawal_hold', 'withdrawal'
  );

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type)
  values (
    v_uid, 'diamonds', -p_diamonds, v_wallet_bal, 'withdrawal_hold', 'withdrawal'
  );

  insert into public.withdrawal_requests (
    requester_type, user_id, diamonds, method, details, status, idempotency_key
  ) values (
    'host', v_uid, p_diamonds, coalesce(p_method, 'bank'), coalesce(p_details, '{}'::jsonb),
    'pending', v_key
  ) returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_cekim_durum_guncelle(
  p_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.withdrawal_requests%rowtype;
  v_row public.withdrawal_requests%rowtype;
  v_wallet_bal bigint;
  v_host_bal bigint;
  v_refunded boolean;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_status not in ('pending','under_review','approved','paid','rejected','frozen') then
    raise exception 'Gecersiz durum';
  end if;

  select * into v_old from public.withdrawal_requests where id = p_id for update;
  if not found then raise exception 'Cekim bulunamadi'; end if;

  v_refunded := coalesce((v_old.details->>'refunded')::boolean, false);

  -- Red: bloke elmaslari iade et (tek sefer)
  if p_status = 'rejected'
     and v_old.status not in ('rejected', 'paid')
     and not v_refunded then
    insert into public.wallets (user_id, coins, diamonds)
    values (v_old.user_id, 0, 0)
    on conflict (user_id) do nothing;

    insert into public.host_earnings (user_id, diamonds)
    values (v_old.user_id, 0)
    on conflict (user_id) do nothing;

    update public.wallets
    set diamonds = diamonds + v_old.diamonds, updated_at = now()
    where user_id = v_old.user_id
    returning diamonds into v_wallet_bal;

    update public.host_earnings
    set diamonds = diamonds + v_old.diamonds, updated_at = now()
    where user_id = v_old.user_id
    returning diamonds into v_host_bal;

    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
    values (
      v_old.user_id, 'diamonds', v_old.diamonds, v_wallet_bal,
      'withdrawal_refund', 'withdrawal', v_old.id
    );

    insert into public.host_earnings_ledger (user_id, delta, balance_after, reason, ref_type, ref_id)
    values (
      v_old.user_id, v_old.diamonds, v_host_bal,
      'withdrawal_refund', 'withdrawal', v_old.id
    );

    v_refunded := true;
  end if;

  update public.withdrawal_requests set
    status = p_status,
    processed_at = case
      when p_status in ('approved','paid','rejected') then now()
      else processed_at
    end,
    details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
      'admin_note', p_note,
      'admin_id', auth.uid(),
      'admin_at', now(),
      'refunded', v_refunded
    )
  where id = p_id
  returning * into v_row;

  perform public.admin_audit_yaz(
    v_row.user_id,
    'withdrawal_' || p_status,
    'Cekim ' || p_status || ': ' || v_row.diamonds::text || ' elmas',
    jsonb_build_object('withdrawal_id', p_id, 'note', p_note, 'refunded', v_refunded)
  );

  return jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status, 'refunded', v_refunded);
end;
$$;

-- Ajans komisyonu: host elmasindan dus, ajansa aktar
create or replace function public.hediye_ajans_komisyon()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host public.host_profiles%rowtype;
  v_rate public.agency_commission_rates%rowtype;
  v_agency_cut bigint;
  v_bal bigint;
  v_host_wallet bigint;
  v_host_earn bigint;
begin
  select * into v_host from public.host_profiles
  where user_id = new.receiver_id and status = 'agency' and agency_id is not null;
  if not found then return new; end if;

  select * into v_rate from public.agency_commission_rates where agency_id = v_host.agency_id;
  if not found then return new; end if;

  v_agency_cut := floor(new.diamonds_earned * v_rate.agency_share)::bigint;
  if v_agency_cut <= 0 then return new; end if;

  update public.gift_transactions set
    agency_id = v_host.agency_id,
    agency_commission_snapshot = v_rate.agency_share
  where id = new.id;

  -- Host payindan dus
  update public.wallets
  set diamonds = greatest(diamonds - v_agency_cut, 0), updated_at = now()
  where user_id = new.receiver_id
  returning diamonds into v_host_wallet;

  update public.host_earnings
  set diamonds = greatest(diamonds - v_agency_cut, 0), updated_at = now()
  where user_id = new.receiver_id
  returning diamonds into v_host_earn;

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, ref_id)
  values (
    new.receiver_id, 'diamonds', -v_agency_cut, coalesce(v_host_wallet, 0),
    'agency_commission', 'gift', new.id
  );

  insert into public.host_earnings_ledger (user_id, delta, balance_after, reason, ref_type, ref_id)
  values (
    new.receiver_id, -v_agency_cut, coalesce(v_host_earn, 0),
    'agency_commission', 'gift', new.id
  );

  insert into public.agency_wallets (agency_id, diamonds)
  values (v_host.agency_id, 0)
  on conflict do nothing;

  update public.agency_wallets set
    diamonds = diamonds + v_agency_cut,
    updated_at = now()
  where agency_id = v_host.agency_id
  returning diamonds into v_bal;

  insert into public.agency_earnings_ledger (
    agency_id, delta_diamonds, balance_after, reason, commission_snapshot, ref_type, ref_id
  ) values (
    v_host.agency_id, v_agency_cut, v_bal, 'gift_commission', v_rate.agency_share, 'gift', new.id
  );

  update public.agencies set total_gifts = total_gifts + new.coins_spent where id = v_host.agency_id;

  return new;
end;
$$;
