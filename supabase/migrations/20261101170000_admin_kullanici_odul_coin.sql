-- =============================================================================
-- ADMIN · ÖDÜL COIN İŞLEMLERİ, KOVA AYRIMI VE CÜZDAN ÖZETİ
-- =============================================================================
--
-- Amaç
--   1. Admin, satın alınan coin (wallets.coins) ile ödül/promosyon coin
--      (wallets.bonus_coins) bakiyelerini AYRI AYRI eksiltebilsin.
--   2. Eksiltme sırasında kullanıcının coin / ödül coin bakiyesi görünsün.
--   3. Ödül coin işlemleri ayrı yetkiyle (coins.bonus.adjust) korunsun.
--
-- Politika (değişmiyor)
--   Satın alınan kova yalnızca gerçek ödeme ile dolar. Admin eklemeleri ödül
--   kovasına yazılır. Bu nedenle "coins" kovasına topup istenirse işlem açıkça
--   ödül kovasına yönlendirilir ve yanıt bunu bildirir (sessiz taşıma yok).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Yetki: ödül coin ayarlama
-- -----------------------------------------------------------------------------
insert into public.admin_permission_catalog
  (permission_key, label, description, category, risk, module_href, sort_order)
values
  ('coins.bonus.adjust', 'Ödül coin ayarla', 'Ödül / promosyon coin ekle · eksilt',
   'COINS', 'CRITICAL', '/admin/coin', 55)
on conflict (permission_key) do update
  set label = excluded.label,
      description = excluded.description,
      category = excluded.category,
      risk = excluded.risk,
      module_href = excluded.module_href,
      sort_order = excluded.sort_order,
      is_active = true;

-- coins.adjust yetkisi olan her rol ödül coin de ayarlayabilsin.
insert into public.admin_role_permissions (role_code, permission_code)
select distinct role_code, 'coins.bonus.adjust'
from public.admin_role_permissions
where permission_code = 'coins.adjust'
on conflict do nothing;

insert into public.admin_role_permissions (role_code, permission_code)
values ('SUPER_ADMIN', 'coins.bonus.adjust')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 2) Kullanıcı referansı çözümü (uuid / public_user_id / username)
-- -----------------------------------------------------------------------------
create or replace function public.admin_kullanici_ref_coz(p_ref text)
returns uuid
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_ref text := nullif(trim(coalesce(p_ref, '')), '');
  v_uid uuid;
begin
  if v_ref is null then
    return null;
  end if;

  begin
    v_uid := v_ref::uuid;
  exception when others then
    v_uid := null;
  end;

  if v_uid is not null then
    return v_uid;
  end if;

  select p.id into v_uid
  from public.profiles p
  where p.public_user_id = v_ref
     or lower(coalesce(p.public_user_id, '')) = lower(v_ref)
     or lower(coalesce(p.username, '')) = lower(v_ref)
  order by
    case when p.public_user_id = v_ref then 0 else 1 end,
    p.created_at asc
  limit 1;

  return v_uid;
end;
$$;

revoke all on function public.admin_kullanici_ref_coz(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3) Admin cüzdan özeti: coin + ödül coin + oyun coin (panel göstergesi)
-- -----------------------------------------------------------------------------
create or replace function public.admin_kullanici_cuzdan_ozeti(p_user_ref text)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_uid uuid;
  v_ad text;
  v_w public.wallets%rowtype;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  v_uid := public.admin_kullanici_ref_coz(p_user_ref);
  if v_uid is null then
    raise exception 'Kullanici bulunamadi';
  end if;

  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), left(p.id::text, 8))
  into v_ad
  from public.profiles p
  where p.id = v_uid;

  select * into v_w from public.wallets where user_id = v_uid;

  return jsonb_build_object(
    'ok', true,
    'user_id', v_uid,
    'display_name', v_ad,
    'coins', coalesce(v_w.coins, 0),
    'bonus_coins', coalesce(v_w.bonus_coins, 0),
    'game_coins', coalesce(v_w.game_coins, 0),
    'diamonds', coalesce(v_w.diamonds, 0),
    'total_coins',
      coalesce(v_w.coins, 0) + coalesce(v_w.bonus_coins, 0) + coalesce(v_w.game_coins, 0)
  );
end;
$$;

grant execute on function public.admin_kullanici_cuzdan_ozeti(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4) Coin işlemi: kova desteği (coins | bonus_coins)
-- -----------------------------------------------------------------------------
drop function if exists public.admin_kullanici_coin_isle(text, text, bigint, text);

create or replace function public.admin_kullanici_coin_isle(
  p_user_ref text,
  p_islem text,
  p_miktar bigint,
  p_not text default null,
  p_kova text default 'coins'
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_uid uuid;
  v_ad text;
  v_islem text := lower(trim(coalesce(p_islem, '')));
  v_kova text := lower(trim(coalesce(p_kova, 'coins')));
  v_istenen_kova text;
  v_miktar bigint := abs(coalesce(p_miktar, 0));
  v_delta bigint;
  v_reason text;
  v_bal bigint;
  v_mevcut bigint;
  v_uygulanan bigint;
  v_eksik bigint := 0;
  v_yonlendirildi boolean := false;
  v_not text := nullif(trim(coalesce(p_not, '')), '');
  v_ref text := nullif(trim(coalesce(p_user_ref, '')), '');
  v_warn_id uuid;
  v_w public.wallets%rowtype;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  -- Kova takma adları
  if v_kova in ('coin', 'coins', 'satin', 'satin_alinan', 'purchased') then
    v_kova := 'coins';
  elsif v_kova in ('bonus', 'bonus_coin', 'bonus_coins', 'odul', 'odul_coin', 'reward') then
    v_kova := 'bonus_coins';
  else
    raise exception 'Gecersiz kova (coins | bonus_coins)';
  end if;
  v_istenen_kova := v_kova;

  -- İşlem adları
  if v_islem = 'yukle' then v_islem := 'topup'; end if;
  if v_islem = 'eksilt' then v_islem := 'deduct'; end if;
  if v_islem = 'ceza' then v_islem := 'penalty'; end if;
  if v_islem not in ('topup', 'deduct', 'penalty') then
    raise exception 'Gecersiz islem (topup|deduct|penalty)';
  end if;

  -- Satın alınan kovaya admin eklemesi yapılmaz: kredi ödül kovasına yazılır.
  if v_islem = 'topup' and v_kova = 'coins' then
    v_kova := 'bonus_coins';
    v_yonlendirildi := true;
  end if;

  if v_kova = 'coins' then
    perform public.admin_require_permission('coins.adjust');
  else
    perform public.admin_require_permission('coins.bonus.adjust');
  end if;

  if v_ref is null then raise exception 'Kullanici gerekli'; end if;
  if v_miktar <= 0 then raise exception 'Miktar pozitif olmali'; end if;

  v_uid := public.admin_kullanici_ref_coz(v_ref);
  if v_uid is null then raise exception 'Kullanici bulunamadi'; end if;

  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), left(p.id::text, 8))
  into v_ad
  from public.profiles p
  where p.id = v_uid;

  insert into public.wallets (user_id, coins, diamonds)
  values (v_uid, 0, 0)
  on conflict (user_id) do nothing;

  select * into v_w from public.wallets where user_id = v_uid for update;

  v_mevcut := case
    when v_kova = 'coins' then coalesce(v_w.coins, 0)
    else coalesce(v_w.bonus_coins, 0)
  end;

  if v_islem = 'topup' then
    v_uygulanan := v_miktar;
    v_delta := v_miktar;
    v_reason := case
      when v_kova = 'coins' then 'admin_coin_topup'
      else 'admin_bonus_topup'
    end;
  else
    v_reason := case
      when v_kova = 'coins' and v_islem = 'deduct' then 'admin_deduct'
      when v_kova = 'coins' then 'admin_penalty'
      when v_islem = 'deduct' then 'admin_bonus_deduct'
      else 'admin_bonus_penalty'
    end;

    -- Bakiye negatife düşmez: istenen tutar bakiyeyle sınırlanır, fark bildirilir.
    v_uygulanan := least(v_miktar, v_mevcut);
    v_eksik := v_miktar - v_uygulanan;

    if v_uygulanan <= 0 then
      raise exception 'Yetersiz bakiye: kullanıcının % bakiyesi 0',
        case when v_kova = 'coins' then 'coin' else 'ödül coin' end;
    end if;

    v_delta := -v_uygulanan;
  end if;

  if v_kova = 'coins' then
    update public.wallets
      set coins = coins + v_delta, updated_at = now()
    where user_id = v_uid
    returning coins into v_bal;
  else
    update public.wallets
      set bonus_coins = bonus_coins + v_delta, updated_at = now()
    where user_id = v_uid
    returning bonus_coins into v_bal;
  end if;

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type)
  values (
    v_uid,
    v_kova,
    v_delta,
    v_bal,
    case
      when v_not is not null then v_reason || ':' || left(v_not, 120)
      else v_reason
    end,
    'admin'
  );

  if v_islem = 'penalty' then
    insert into public.user_warnings (user_id, issued_by, reason, severity, notes)
    values (
      v_uid,
      auth.uid(),
      coalesce(v_not, 'Coin cezasi: ' || v_uygulanan::text),
      'high',
      'coin_penalty:' || v_kova || ':' || v_uygulanan::text
    )
    returning id into v_warn_id;

    insert into public.security_events (user_id, event_type, severity, metadata)
    values (
      v_uid,
      'coin_penalty',
      'high',
      jsonb_build_object(
        'amount', v_uygulanan,
        'bucket', v_kova,
        'requested', v_miktar,
        'shortfall', v_eksik,
        'balance_after', v_bal,
        'warning_id', v_warn_id,
        'note', v_not,
        'by', auth.uid()
      )
    );
  end if;

  select * into v_w from public.wallets where user_id = v_uid;

  perform public.admin_audit_yaz(
    v_uid,
    'wallet_' || v_islem,
    (case v_islem
      when 'topup' then 'Coin yukleme: +'
      when 'deduct' then 'Coin eksiltme: -'
      else 'Coin cezasi: -'
    end) || v_uygulanan::text || ' (' || v_kova || ')'
      || case when v_yonlendirildi then ' [odul kovasina yazildi]' else '' end
      || coalesce(' · ' || v_not, ''),
    jsonb_build_object(
      'islem', v_islem,
      'kova', v_kova,
      'istenen_kova', v_istenen_kova,
      'miktar', v_miktar,
      'uygulanan', v_uygulanan,
      'eksik', v_eksik,
      'delta', v_delta,
      'balance_after', v_bal,
      'coins', coalesce(v_w.coins, 0),
      'bonus_coins', coalesce(v_w.bonus_coins, 0),
      'note', v_not,
      'warning_id', v_warn_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'user_id', v_uid,
    'display_name', v_ad,
    'islem', v_islem,
    'kova', v_kova,
    'istenen_kova', v_istenen_kova,
    'yonlendirildi', v_yonlendirildi,
    'currency', v_kova,
    'requested', v_miktar,
    'applied', abs(v_delta),
    'shortfall', v_eksik,
    'delta', v_delta,
    'balance_after', v_bal,
    'coins', coalesce(v_w.coins, 0),
    'bonus_coins', coalesce(v_w.bonus_coins, 0),
    'game_coins', coalesce(v_w.game_coins, 0),
    'warning_id', v_warn_id
  );
end;
$$;

grant execute on function public.admin_kullanici_coin_isle(text, text, bigint, text, text) to authenticated;

comment on function public.admin_kullanici_coin_isle(text, text, bigint, text, text) is
  'Admin coin: topup / deduct / penalty. p_kova: coins (satın alınan) | bonus_coins (ödül). '
  'Satın alınan kovaya topup ödül kovasına yönlendirilir ve yanıtta bildirilir.';

-- -----------------------------------------------------------------------------
-- 5) Finans Merkezi: topup / hedef artırımı açıkça ödül kovasına
-- -----------------------------------------------------------------------------
create or replace function public.admin_finance_coin_ayarla(
  p_user_id uuid,
  p_islem text,
  p_miktar bigint default null,
  p_not text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_islem text := lower(trim(coalesce(p_islem, '')));
  v_cur bigint;
  v_target bigint;
  v_delta bigint;
  v_miktar bigint;
  v_ref text;
  v_res jsonb;
begin
  if not public.finance_yetkisi_var_mi('FINANCE_ADMIN') and not public.ben_admin_miyim() then
    raise exception 'Forbidden: finance write required';
  end if;
  if p_user_id is null then raise exception 'Kullanici gerekli'; end if;

  select coalesce(w.coins, 0) into v_cur from public.wallets w where w.user_id = p_user_id;
  if v_cur is null then
    insert into public.wallets (user_id, coins, diamonds) values (p_user_id, 0, 0)
    on conflict (user_id) do nothing;
    v_cur := 0;
  end if;

  v_ref := p_user_id::text;

  if v_islem in ('reset', 'sifirla') then
    if v_cur <= 0 then
      return jsonb_build_object('ok', true, 'user_id', p_user_id, 'islem', 'reset',
        'delta', 0, 'balance_after', 0, 'kova', 'coins',
        'coins', 0, 'bonus_coins',
          coalesce((select bonus_coins from public.wallets where user_id = p_user_id), 0));
    end if;
    v_res := public.admin_kullanici_coin_isle(
      v_ref, 'deduct', v_cur, coalesce(p_not, 'Finans Merkezi: sifirlama'), 'coins');
    perform public.finance_audit_yaz('coin_reset', 'user', p_user_id::text,
      jsonb_build_object('before', v_cur), v_res, '{}'::jsonb);
    return v_res;
  end if;

  if v_islem in ('set', 'ayarla', 'hedef') then
    v_target := greatest(coalesce(p_miktar, 0), 0);
    v_delta := v_target - v_cur;
    if v_delta = 0 then
      return jsonb_build_object('ok', true, 'user_id', p_user_id, 'islem', 'set',
        'delta', 0, 'balance_after', v_cur, 'kova', 'coins',
        'coins', v_cur, 'bonus_coins',
          coalesce((select bonus_coins from public.wallets where user_id = p_user_id), 0));
    elsif v_delta > 0 then
      -- Satın alınan kova admin eklemesiyle dolmaz: fark ödül kovasına yazılır.
      v_res := public.admin_kullanici_coin_isle(
        v_ref, 'topup', v_delta, coalesce(p_not, 'Finans Merkezi: miktar ayarla'), 'bonus_coins');
    else
      v_res := public.admin_kullanici_coin_isle(
        v_ref, 'deduct', abs(v_delta), coalesce(p_not, 'Finans Merkezi: miktar ayarla'), 'coins');
    end if;
    perform public.finance_audit_yaz('coin_set', 'user', p_user_id::text,
      jsonb_build_object('before', v_cur, 'target', v_target), v_res, '{}'::jsonb);
    return v_res;
  end if;

  if v_islem in ('topup', 'yukle', 'yukselt') then
    v_miktar := abs(coalesce(p_miktar, 0));
    if v_miktar <= 0 then raise exception 'Miktar pozitif olmali'; end if;
    v_res := public.admin_kullanici_coin_isle(
      v_ref, 'topup', v_miktar, coalesce(p_not, 'Finans Merkezi: yukleme'), 'bonus_coins');
    perform public.finance_audit_yaz('coin_topup', 'user', p_user_id::text, null, v_res, '{}'::jsonb);
    return v_res;
  end if;

  if v_islem in ('deduct', 'eksilt', 'dusur') then
    v_miktar := abs(coalesce(p_miktar, 0));
    if v_miktar <= 0 then raise exception 'Miktar pozitif olmali'; end if;
    v_res := public.admin_kullanici_coin_isle(
      v_ref, 'deduct', v_miktar, coalesce(p_not, 'Finans Merkezi: dusurme'), 'coins');
    perform public.finance_audit_yaz('coin_deduct', 'user', p_user_id::text, null, v_res, '{}'::jsonb);
    return v_res;
  end if;

  raise exception 'Gecersiz islem';
end;
$$;

grant execute on function public.admin_finance_coin_ayarla(uuid, text, bigint, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 6) Finans coin listesi: ödül / oyun bakiyesi de dönsün
-- -----------------------------------------------------------------------------
create or replace function public.admin_finance_coin_yonetim(
  p_limit int default 40,
  p_offset int default 0,
  p_q text default null,
  p_filtre text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit,40),1),100);
  v_offset int := greatest(coalesce(p_offset,0),0);
  v_q text := nullif(trim(p_q),'');
  v_filtre text := lower(trim(coalesce(p_filtre,'all')));
  v_rows jsonb;
  v_plat bigint;
  v_satinal bigint;
  v_supply bigint;
  v_bonus_supply bigint;
  v_game_supply bigint;
  v_users bigint;
begin
  if not public.finance_yetkisi_var_mi('SUPPORT_ADMIN') then
    raise exception 'Forbidden: finance access required';
  end if;

  select coalesce(sum(cp.coins_added),0)::bigint into v_satinal
  from public.coin_purchases cp
  where coalesce(cp.status,'completed')='completed';

  -- Platform yüklemesi: satın alınan kovaya yazılan admin kredileri +
  -- doğrudan ödül kovasına yazılan admin/promosyon kredileri.
  select coalesce(sum(case when wl.delta > 0 then wl.delta else 0 end),0)::bigint into v_plat
  from public.wallet_ledger wl
  where wl.currency in ('coins', 'bonus_coins')
    and (
      wl.reason like 'admin_topup%'
      or wl.reason like 'admin_bonus_topup%'
      or wl.reason in ('bonus','bonus_coin','promotional','promo','promotional_coin','agency_transfer','agency_coin')
      or wl.ref_type = 'admin'
    );

  select coalesce(sum(w.coins),0)::bigint into v_supply from public.wallets w;
  select coalesce(sum(w.bonus_coins),0)::bigint into v_bonus_supply from public.wallets w;
  select coalesce(sum(w.game_coins),0)::bigint into v_game_supply from public.wallets w;
  select count(*)::bigint into v_users from public.wallets w where coalesce(w.coins,0) > 0;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  into v_rows from (
    select
      p.id as user_id,
      coalesce(nullif(trim(p.display_name),''), nullif(trim(p.username),''),'Kullanici') as display_name,
      p.username,
      p.public_user_id,
      p.avatar_url,
      a.id as agency_id,
      a.name as agency_name,
      coalesce(w.coins,0)::bigint as current_coin,
      coalesce(w.bonus_coins,0)::bigint as current_bonus_coin,
      coalesce(w.game_coins,0)::bigint as current_game_coin,
      coalesce((
        select sum(cp.coins_added) from public.coin_purchases cp
        where cp.user_id=p.id and coalesce(cp.status,'completed')='completed'
      ),0)::bigint as coin_purchased,
      coalesce((
        select sum(case when wl.delta > 0 then wl.delta else 0 end)
        from public.wallet_ledger wl
        where wl.user_id=p.id and wl.currency in ('coins','bonus_coins')
          and (
            wl.reason like 'admin_topup%'
            or wl.reason like 'admin_bonus_topup%'
            or wl.reason in ('bonus','bonus_coin','promotional','promo','promotional_coin','agency_transfer','agency_coin')
            or wl.ref_type = 'admin'
          )
      ),0)::bigint as coin_platform,
      coalesce((
        select sum(case when wl.delta < 0 then -wl.delta else 0 end)
        from public.wallet_ledger wl
        where wl.user_id=p.id and wl.currency='coins'
      ),0)::bigint as coin_spent
    from public.profiles p
    left join public.wallets w on w.user_id = p.id
    left join public.host_profiles hp on hp.user_id = p.id
    left join public.agencies a on a.id = hp.agency_id
    where (
      v_q is null
      or p.username ilike '%'||v_q||'%'
      or p.display_name ilike '%'||v_q||'%'
      or p.public_user_id::text ilike '%'||v_q||'%'
      or p.id::text ilike v_q||'%'
    )
    and (
      v_filtre = 'all'
      or (v_filtre in ('platform','platform_loaded') and coalesce((
        select sum(case when wl.delta > 0 then wl.delta else 0 end)
        from public.wallet_ledger wl
        where wl.user_id=p.id and wl.currency in ('coins','bonus_coins')
          and (wl.reason like 'admin_topup%' or wl.reason like 'admin_bonus_topup%'
            or wl.ref_type='admin'
            or wl.reason in ('bonus','bonus_coin','promotional','promo','agency_transfer','agency_coin'))
      ),0) > 0)
      or (v_filtre in ('purchase','user','satin') and coalesce((
        select sum(cp.coins_added) from public.coin_purchases cp
        where cp.user_id=p.id and coalesce(cp.status,'completed')='completed'
      ),0) > 0)
      or (v_filtre in ('balance','bakiye') and (coalesce(w.coins,0) > 0 or coalesce(w.bonus_coins,0) > 0))
    )
    order by coalesce(w.coins,0) desc, p.created_at desc
    limit v_limit offset v_offset
  ) t;

  return jsonb_build_object(
    'ok', true,
    'ozet', jsonb_build_object(
      'platform_yuklenen', v_plat,
      'kullanici_satin_alan', v_satinal,
      'cuzdan_toplam', v_supply,
      'odul_toplam', v_bonus_supply,
      'oyun_toplam', v_game_supply,
      'toplam_coin', v_supply + v_bonus_supply + v_game_supply,
      'bakiye_olan_kullanici', v_users
    ),
    'items', v_rows,
    'limit', v_limit,
    'offset', v_offset,
    'filtre', v_filtre
  );
end;
$$;

grant execute on function public.admin_finance_coin_yonetim(int, int, text, text) to authenticated;

notify pgrst, 'reload schema';
