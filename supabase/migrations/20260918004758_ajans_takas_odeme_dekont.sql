-- Ajans coin teklifi: ödeme formu + 1 gün dekont + süre aşımı uyarısı + admin
-- Ayrıca: pending_buyer → (ajans kabul) pending_payment_info → pending_receipt
--         → (dekont) pending_platform → completed
--         → (1 gün yok) receipt_overdue + uyarı → admin

-- ---------------------------------------------------------------------------
-- 1) Durum + ödeme/dekont alanları
-- ---------------------------------------------------------------------------
alter table public.coin_trade_offers
  drop constraint if exists coin_trade_offers_status_check;

alter table public.coin_trade_offers
  add constraint coin_trade_offers_status_check
  check (status in (
    'pending_buyer',
    'pending_seller',
    'pending_payment_info',
    'pending_receipt',
    'receipt_overdue',
    'pending_platform',
    'completed',
    'cancelled',
    'rejected',
    'expired'
  ));

alter table public.coin_trade_offers
  add column if not exists payment_coins_bought bigint,
  add column if not exists payment_source text,
  add column if not exists payment_info_at timestamptz,
  add column if not exists receipt_path text,
  add column if not exists receipt_uploaded_at timestamptz,
  add column if not exists receipt_deadline_at timestamptz,
  add column if not exists receipt_warning_sent_at timestamptz,
  add column if not exists escalated_to_admin_at timestamptz;

comment on column public.coin_trade_offers.payment_coins_bought is 'Ajansın bildirdiği satın alınan coin';
comment on column public.coin_trade_offers.payment_source is 'Paranın gönderileceği kaynak / hesap';
comment on column public.coin_trade_offers.receipt_deadline_at is 'Dekont yükleme son tarihi (1 gün)';

-- ---------------------------------------------------------------------------
-- 2) Storage: trade-receipts
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trade-receipts',
  'trade-receipts',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "trade_receipts_own" on storage.objects;
create policy "trade_receipts_own" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'trade-receipts'
    and (
      public.ben_admin_miyim()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  )
  with check (
    bucket_id = 'trade-receipts'
    and (
      public.ben_admin_miyim()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Yetki yardımcısı
-- ---------------------------------------------------------------------------
create or replace function public.coin_takas_ajans_yetkili_mi(
  p_agency_id uuid,
  p_uid uuid default auth.uid()
)
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
        a.owner_id = p_uid
        or exists (
          select 1 from public.host_profiles h
          where h.agency_id = a.id
            and h.user_id = p_uid
            and h.status = 'agency'
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 4) Teklif oluşturunca ajans sahibine bildirim
-- ---------------------------------------------------------------------------
create or replace function public.coin_takas_teklif_olustur(
  p_buyer_type text,
  p_buyer_user_id uuid default null,
  p_buyer_agency_id uuid default null,
  p_coins bigint default null,
  p_note text default null
)
returns public.coin_trade_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bal bigint;
  v_row public.coin_trade_offers%rowtype;
  v_kyc text;
  v_owner uuid;
  v_agency_name text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_coins is null or p_coins <= 0 then raise exception 'Invalid amount'; end if;
  if p_buyer_type not in ('user','agency') then raise exception 'Invalid buyer type'; end if;

  select kyc_status into v_kyc from public.wallet_accounts where user_id = v_uid;
  if coalesce(v_kyc, 'none') <> 'approved' then
    raise exception 'KYC required to trade';
  end if;

  if p_buyer_type = 'user' then
    if p_buyer_user_id is null then raise exception 'Buyer user required'; end if;
    if p_buyer_user_id = v_uid then raise exception 'Cannot trade with self'; end if;
  else
    if p_buyer_agency_id is null then raise exception 'Buyer agency required'; end if;
    select owner_id, name into v_owner, v_agency_name
    from public.agencies
    where id = p_buyer_agency_id and status = 'active';
    if not found then
      raise exception 'Agency not found';
    end if;
  end if;

  select coins into v_bal from public.wallets where user_id = v_uid for update;
  if coalesce(v_bal, 0) < p_coins then raise exception 'Insufficient coins'; end if;

  update public.wallets set coins = coins - p_coins, updated_at = now() where user_id = v_uid;
  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, meta)
  values (
    v_uid, 'coins', -p_coins,
    (select coins from public.wallets where user_id = v_uid),
    'trade_hold', 'coin_trade',
    jsonb_build_object('coins', p_coins)
  );

  insert into public.coin_trade_offers (
    seller_id, buyer_type, buyer_user_id, buyer_agency_id, coins, note,
    status, seller_approved_at
  ) values (
    v_uid, p_buyer_type,
    case when p_buyer_type = 'user' then p_buyer_user_id end,
    case when p_buyer_type = 'agency' then p_buyer_agency_id end,
    p_coins, nullif(trim(coalesce(p_note,'')), ''),
    'pending_buyer', now()
  ) returning * into v_row;

  if p_buyer_type = 'agency' and v_owner is not null then
    perform public.bildirim_kuyruga_ekle(
      v_owner,
      'system',
      'Yeni coin teklifi',
      coalesce(v_agency_name, 'Ajans') || ' için '
        || p_coins::text || ' coin teklifi geldi. Ajans panelinden yanıtlayın.',
      '/ajans/teklifler',
      jsonb_build_object('offer_id', v_row.id, 'agency_id', p_buyer_agency_id)
    );
  elsif p_buyer_type = 'user' and p_buyer_user_id is not null then
    perform public.bildirim_kuyruga_ekle(
      p_buyer_user_id,
      'system',
      'Yeni coin teklifi',
      p_coins::text || ' coin teklifi aldınız. Takas ekranından yanıtlayın.',
      '/cuzdan/takas',
      jsonb_build_object('offer_id', v_row.id)
    );
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Alıcı yanıt: ajans → ödeme formu; kullanıcı → platform
-- ---------------------------------------------------------------------------
create or replace function public.coin_takas_alici_yanit(
  p_offer_id uuid,
  p_accept boolean
)
returns public.coin_trade_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.coin_trade_offers%rowtype;
  v_ok boolean := false;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_row from public.coin_trade_offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  if v_row.status <> 'pending_buyer' then raise exception 'Offer not awaiting buyer'; end if;

  if v_row.buyer_type = 'user' then
    v_ok := v_row.buyer_user_id = v_uid;
  else
    v_ok := public.coin_takas_ajans_yetkili_mi(v_row.buyer_agency_id, v_uid);
  end if;
  if not v_ok then raise exception 'Forbidden'; end if;

  if not p_accept then
    update public.wallets set coins = coins + v_row.coins, updated_at = now()
    where user_id = v_row.seller_id;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, meta)
    values (
      v_row.seller_id, 'coins', v_row.coins,
      (select coins from public.wallets where user_id = v_row.seller_id),
      'trade_hold_refund', 'coin_trade', jsonb_build_object('offer_id', p_offer_id)
    );
    update public.coin_trade_offers set
      status = 'rejected', updated_at = now()
    where id = p_offer_id
    returning * into v_row;
    return v_row;
  end if;

  if v_row.buyer_type = 'agency' then
    update public.coin_trade_offers set
      status = 'pending_payment_info',
      buyer_approved_at = now(),
      updated_at = now()
    where id = p_offer_id
    returning * into v_row;
  else
    update public.coin_trade_offers set
      status = 'pending_platform',
      buyer_approved_at = now(),
      updated_at = now()
    where id = p_offer_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) Ödeme bilgisi formu
-- ---------------------------------------------------------------------------
create or replace function public.coin_takas_odeme_bilgisi_kaydet(
  p_offer_id uuid,
  p_coins_bought bigint,
  p_payment_source text
)
returns public.coin_trade_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.coin_trade_offers%rowtype;
  v_src text := nullif(trim(coalesce(p_payment_source, '')), '');
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_coins_bought is null or p_coins_bought <= 0 then
    raise exception 'Satin alinan coin pozitif olmali';
  end if;
  if v_src is null or length(v_src) < 3 then
    raise exception 'Odeme kaynagi gerekli';
  end if;

  select * into v_row from public.coin_trade_offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  if v_row.buyer_type <> 'agency' then raise exception 'Only agency offers'; end if;
  if v_row.status <> 'pending_payment_info' then
    raise exception 'Offer not awaiting payment info';
  end if;
  if not public.coin_takas_ajans_yetkili_mi(v_row.buyer_agency_id, v_uid) then
    raise exception 'Forbidden';
  end if;

  update public.coin_trade_offers set
    payment_coins_bought = p_coins_bought,
    payment_source = left(v_src, 500),
    payment_info_at = now(),
    receipt_deadline_at = now() + interval '1 day',
    status = 'pending_receipt',
    updated_at = now()
  where id = p_offer_id
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) Dekont yükle → platform kuyruğu
-- ---------------------------------------------------------------------------
create or replace function public.coin_takas_dekont_yukle(
  p_offer_id uuid,
  p_receipt_path text
)
returns public.coin_trade_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.coin_trade_offers%rowtype;
  v_path text := nullif(trim(coalesce(p_receipt_path, '')), '');
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if v_path is null then raise exception 'Dekont yolu gerekli'; end if;

  select * into v_row from public.coin_trade_offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  if v_row.buyer_type <> 'agency' then raise exception 'Only agency offers'; end if;
  if v_row.status not in ('pending_receipt', 'receipt_overdue') then
    raise exception 'Offer not awaiting receipt';
  end if;
  if not public.coin_takas_ajans_yetkili_mi(v_row.buyer_agency_id, v_uid) then
    raise exception 'Forbidden';
  end if;

  update public.coin_trade_offers set
    receipt_path = v_path,
    receipt_uploaded_at = now(),
    status = 'pending_platform',
    updated_at = now()
  where id = p_offer_id
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8) Süre aşımı: ciddi uyarı + admin kuyruğu
-- ---------------------------------------------------------------------------
create or replace function public.coin_takas_dekont_suresi_kontrol()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_owner uuid;
  v_name text;
  v_n int := 0;
begin
  for r in
    select *
    from public.coin_trade_offers
    where status = 'pending_receipt'
      and receipt_deadline_at is not null
      and receipt_deadline_at < now()
      and receipt_path is null
    for update skip locked
  loop
    update public.coin_trade_offers set
      status = 'receipt_overdue',
      receipt_warning_sent_at = now(),
      escalated_to_admin_at = now(),
      updated_at = now()
    where id = r.id;

    select owner_id, name into v_owner, v_name
    from public.agencies where id = r.buyer_agency_id;

    if v_owner is not null then
      perform public.bildirim_kuyruga_ekle(
        v_owner,
        'system',
        'Ciddi uyarı: dekont yüklenmedi',
        coalesce(v_name, 'Ajans') || ' — coin teklifi için 1 gün içinde dekont yüklenmedi. '
          || 'Ajans kapatılma riski vardır. Hemen dekont yükleyin; işlem admin paneline düştü.',
        '/ajans/teklifler',
        jsonb_build_object(
          'offer_id', r.id,
          'agency_id', r.buyer_agency_id,
          'severity', 'critical',
          'warning', 'receipt_overdue'
        )
      );

      insert into public.user_warnings (user_id, issued_by, reason, severity, notes)
      values (
        v_owner,
        null,
        'Coin takas dekont süresi aşıldı — ajans kapatılma riski',
        'high',
        'offer_id:' || r.id::text
      );
    end if;

    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9) Liste RPC (satıcı + kullanıcı alıcı + ajans yetkilisi)
-- ---------------------------------------------------------------------------
create or replace function public.takas_tekliflerimi_listele(p_limit int default 40)
returns setof public.coin_trade_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  -- Süre aşımı kontrolü (hafif)
  perform public.coin_takas_dekont_suresi_kontrol();

  return query
  select o.*
  from public.coin_trade_offers o
  where o.seller_id = v_uid
     or o.buyer_user_id = v_uid
     or (
       o.buyer_type = 'agency'
       and o.buyer_agency_id is not null
       and public.coin_takas_ajans_yetkili_mi(o.buyer_agency_id, v_uid)
     )
  order by o.created_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
end;
$$;

-- ---------------------------------------------------------------------------
-- 10) Platform onay: receipt_overdue da kabul
-- ---------------------------------------------------------------------------
create or replace function public.admin_coin_takas_platform_onay(
  p_offer_id uuid,
  p_accept boolean
)
returns public.coin_trade_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.coin_trade_offers%rowtype;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  select * into v_row from public.coin_trade_offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  if v_row.status not in ('pending_platform', 'receipt_overdue') then
    raise exception 'Offer not awaiting platform';
  end if;

  if not p_accept then
    update public.wallets set coins = coins + v_row.coins, updated_at = now()
    where user_id = v_row.seller_id;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, meta)
    values (
      v_row.seller_id, 'coins', v_row.coins,
      (select coins from public.wallets where user_id = v_row.seller_id),
      'trade_hold_refund', 'coin_trade', jsonb_build_object('offer_id', p_offer_id)
    );
    update public.coin_trade_offers set
      status = 'cancelled',
      platform_approved_by = auth.uid(),
      updated_at = now()
    where id = p_offer_id
    returning * into v_row;
    return v_row;
  end if;

  if v_row.buyer_type = 'user' then
    insert into public.wallets (user_id, coins, diamonds)
    values (v_row.buyer_user_id, 0, 0)
    on conflict (user_id) do nothing;
    update public.wallets set coins = coins + v_row.coins, updated_at = now()
    where user_id = v_row.buyer_user_id;
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type, meta)
    values (
      v_row.buyer_user_id, 'coins', v_row.coins,
      (select coins from public.wallets where user_id = v_row.buyer_user_id),
      'trade_receive', 'coin_trade', jsonb_build_object('offer_id', p_offer_id)
    );
  else
    insert into public.agency_wallets (agency_id, diamonds, coins)
    values (v_row.buyer_agency_id, 0, 0)
    on conflict (agency_id) do nothing;
    begin
      update public.agency_wallets set
        coins = coalesce(coins, 0) + v_row.coins,
        updated_at = now()
      where agency_id = v_row.buyer_agency_id;
    exception when undefined_column then
      null;
    end;
  end if;

  update public.coin_trade_offers set
    status = 'completed',
    platform_approved_at = now(),
    platform_approved_by = auth.uid(),
    completed_at = now(),
    updated_at = now()
  where id = p_offer_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.coin_takas_ajans_yetkili_mi(uuid, uuid) to authenticated;
grant execute on function public.coin_takas_odeme_bilgisi_kaydet(uuid, bigint, text) to authenticated;
grant execute on function public.coin_takas_dekont_yukle(uuid, text) to authenticated;
grant execute on function public.coin_takas_dekont_suresi_kontrol() to authenticated;
grant execute on function public.takas_tekliflerimi_listele(int) to authenticated;
grant execute on function public.admin_coin_takas_platform_onay(uuid, boolean) to authenticated;
grant execute on function public.coin_takas_teklif_olustur(text, uuid, uuid, bigint, text) to authenticated;
grant execute on function public.coin_takas_alici_yanit(uuid, boolean) to authenticated;
