-- Takas teklif mesajı (TL + USD), push metni, arama: ad/soyad + ajans owner

drop function if exists public.takas_kullanici_ara(text);
drop function if exists public.takas_ajans_ara(text);

-- ---------------------------------------------------------------------------
-- Kullanıcı arama: KYC ad soyad
-- ---------------------------------------------------------------------------
create or replace function public.takas_kullanici_ara(p_q text)
returns table (
  id uuid,
  display_name text,
  username text,
  wallet_number char(18),
  avatar_url text,
  legal_first_name text,
  legal_last_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_num text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if v_q is null or length(v_q) < 2 then return; end if;
  v_num := regexp_replace(v_q, '\D', '', 'g');

  return query
  select
    p.id,
    p.display_name,
    p.username,
    w.wallet_number,
    p.avatar_url,
    w.legal_first_name,
    w.legal_last_name
  from public.profiles p
  join public.wallet_accounts w on w.user_id = p.id
  where p.id <> auth.uid()
    and (
      (length(v_num) >= 6 and w.wallet_number like '%' || v_num || '%')
      or p.username ilike '%' || v_q || '%'
      or p.display_name ilike '%' || v_q || '%'
      or coalesce(p.public_user_id::text, '') like '%' || v_q || '%'
      or coalesce(w.legal_first_name, '') ilike '%' || v_q || '%'
      or coalesce(w.legal_last_name, '') ilike '%' || v_q || '%'
    )
  limit 30;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ajans arama: owner_id (mesaj için)
-- ---------------------------------------------------------------------------
create or replace function public.takas_ajans_ara(p_q text default null)
returns table (
  id uuid,
  name text,
  agency_public_id text,
  logo_url text,
  status text,
  owner_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := nullif(trim(coalesce(p_q, '')), '');
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  return query
  select a.id, a.name, a.agency_public_id, a.logo_url, a.status, a.owner_id
  from public.agencies a
  where a.status = 'active'
    and (
      v_q is null
      or a.name ilike '%' || v_q || '%'
      or coalesce(a.agency_public_id, '') ilike '%' || v_q || '%'
      or a.id::text ilike '%' || v_q || '%'
    )
  order by a.name
  limit 50;
end;
$$;

-- ---------------------------------------------------------------------------
-- Teklif oluştur: otomatik note + zengin push
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
  v_seller_ad text;
  v_katalog numeric(14,2);
  v_satici numeric(14,2);
  v_platform numeric(14,2);
  v_pencere text;
  v_iap_kilit bigint;
  v_takas_edilebilir bigint;
  v_note text;
  v_usd numeric;
  v_push text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_coins is null or p_coins <= 0 then raise exception 'Invalid amount'; end if;
  if p_buyer_type not in ('user','agency') then raise exception 'Invalid buyer type'; end if;

  select kyc_status into v_kyc from public.wallet_accounts where user_id = v_uid;
  if coalesce(v_kyc, 'none') <> 'approved' then
    raise exception 'KYC required to trade';
  end if;

  if public.coin_takas_iade_riski_var(v_uid) then
    raise exception 'Refund risk: trade blocked. Contact support.';
  end if;

  perform public.cuzdan_aylik_limit_kontrol(v_uid, 'trade', p_coins);

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

  select coins into v_bal from public.wallets where user_id = v_uid;
  if coalesce(v_bal, 0) < p_coins then raise exception 'Insufficient coins'; end if;

  v_iap_kilit := public.coin_takas_iap_kilitli_coin(v_uid);
  v_takas_edilebilir := greatest(coalesce(v_bal, 0) - coalesce(v_iap_kilit, 0), 0);
  if p_coins > v_takas_edilebilir then
    raise exception
      'IAP cooling: % coins locked for 14 days after store purchase. Tradable: %',
      v_iap_kilit, v_takas_edilebilir;
  end if;

  select t.katalog_tl, t.satici_net_tl, t.platform_pay_tl
    into v_katalog, v_satici, v_platform
  from public.coin_takas_tl_hesapla(p_coins) t;

  v_pencere := public.coin_takas_odeme_pencere(now());
  v_usd := greatest(1, round(v_satici / 35.0));

  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is null then
    v_note :=
      'Merhaba, benim ' || trim(to_char(p_coins, 'FM999G999G999')) ||
      ' coinim var; bunu sana ' || trim(to_char(v_satici, 'FM999G999G990D00')) ||
      ' ₺ veya yaklaşık ' || trim(to_char(v_usd, 'FM999G999G999')) ||
      ' $''a satmak istiyorum. Kabul edersen işlemleri başlatalım.';
  end if;

  insert into public.coin_trade_offers (
    seller_id, buyer_type, buyer_user_id, buyer_agency_id, coins, note,
    status, seller_approved_at, coins_held,
    katalog_tl, satici_net_tl, platform_pay_tl, odeme_pencere
  ) values (
    v_uid, p_buyer_type,
    case when p_buyer_type = 'user' then p_buyer_user_id end,
    case when p_buyer_type = 'agency' then p_buyer_agency_id end,
    p_coins, v_note,
    'pending_buyer', now(), false,
    v_katalog, v_satici, v_platform, v_pencere
  ) returning * into v_row;

  v_seller_ad := public.profil_gosterim_adi(v_uid);
  v_push :=
    v_seller_ad || ': Merhaba, benim ' || trim(to_char(p_coins, 'FM999G999G999')) ||
    ' coinim var; bunu sana ' || trim(to_char(v_satici, 'FM999G999G990D00')) ||
    ' ₺ veya yaklaşık ' || trim(to_char(v_usd, 'FM999G999G999')) ||
    ' $''a satmak istiyorum. Kabul edersen işlemleri başlatalım.';

  if p_buyer_type = 'agency' and v_owner is not null then
    perform public.bildirim_kuyruga_ekle(
      v_owner,
      'wallet',
      'Yeni coin teklifi',
      v_push || ' · ' || coalesce(v_agency_name, 'Ajans'),
      '/ajans/teklifler',
      jsonb_build_object(
        'type', 'trade_offer_new',
        'offer_id', v_row.id,
        'agency_id', p_buyer_agency_id,
        'coins', p_coins,
        'katalog_tl', v_katalog,
        'satici_net_tl', v_satici,
        'from_user_id', v_uid
      )
    );
  elsif p_buyer_type = 'user' and p_buyer_user_id is not null then
    perform public.bildirim_kuyruga_ekle(
      p_buyer_user_id,
      'wallet',
      'Yeni coin teklifi',
      v_push,
      '/cuzdan/takas?sekme=teklifler',
      jsonb_build_object(
        'type', 'trade_offer_new',
        'offer_id', v_row.id,
        'coins', p_coins,
        'katalog_tl', v_katalog,
        'satici_net_tl', v_satici,
        'from_user_id', v_uid,
        'sekme', 'teklifler'
      )
    );
  end if;

  return v_row;
end;
$$;

grant execute on function public.takas_ajans_ara(text) to authenticated;
grant execute on function public.takas_kullanici_ara(text) to authenticated;
grant execute on function public.coin_takas_teklif_olustur(text, uuid, uuid, bigint, text) to authenticated;
