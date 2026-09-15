-- Admin: kullaniciya coin yukle / eksilt / ceza
-- p_user_ref: uuid, public_user_id veya username
-- p_islem: topup | deduct | penalty

create or replace function public.admin_kullanici_coin_isle(
  p_user_ref text,
  p_islem text,
  p_miktar bigint,
  p_not text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_ad text;
  v_islem text := lower(trim(coalesce(p_islem, '')));
  v_miktar bigint := abs(coalesce(p_miktar, 0));
  v_delta bigint;
  v_reason text;
  v_bal bigint;
  v_not text := nullif(trim(coalesce(p_not, '')), '');
  v_ref text := nullif(trim(coalesce(p_user_ref, '')), '');
  v_warn_id uuid;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  if v_ref is null then
    raise exception 'Kullanici gerekli';
  end if;
  if v_miktar <= 0 then
    raise exception 'Miktar pozitif olmali';
  end if;
  if v_islem not in ('topup', 'deduct', 'penalty', 'yukle', 'eksilt', 'ceza') then
    raise exception 'Gecersiz islem (topup|deduct|penalty)';
  end if;

  -- TR alias
  if v_islem = 'yukle' then v_islem := 'topup'; end if;
  if v_islem = 'eksilt' then v_islem := 'deduct'; end if;
  if v_islem = 'ceza' then v_islem := 'penalty'; end if;

  -- UUID
  begin
    v_uid := v_ref::uuid;
  exception when others then
    v_uid := null;
  end;

  if v_uid is null then
    select p.id into v_uid
    from public.profiles p
    where p.public_user_id = v_ref
       or lower(coalesce(p.public_user_id, '')) = lower(v_ref)
       or lower(coalesce(p.username, '')) = lower(v_ref)
    order by
      case when p.public_user_id = v_ref then 0 else 1 end,
      p.created_at asc
    limit 1;
  end if;

  if v_uid is null then
    raise exception 'Kullanici bulunamadi';
  end if;

  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), left(p.id::text, 8))
  into v_ad
  from public.profiles p
  where p.id = v_uid;

  if v_islem = 'topup' then
    v_delta := v_miktar;
    v_reason := 'admin_topup';
  elsif v_islem = 'deduct' then
    v_delta := -v_miktar;
    v_reason := 'admin_deduct';
  else
    v_delta := -v_miktar;
    v_reason := 'admin_penalty';
  end if;

  insert into public.wallets (user_id, coins, diamonds)
  values (v_uid, 0, 0)
  on conflict (user_id) do nothing;

  update public.wallets
  set coins = greatest(coins + v_delta, 0), updated_at = now()
  where user_id = v_uid
  returning coins into v_bal;

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type)
  values (
    v_uid,
    'coins',
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
      coalesce(v_not, 'Coin cezasi: ' || v_miktar::text),
      'high',
      'coin_penalty:' || v_miktar::text
    )
    returning id into v_warn_id;

    insert into public.security_events (user_id, event_type, severity, metadata)
    values (
      v_uid,
      'coin_penalty',
      'high',
      jsonb_build_object(
        'amount', v_miktar,
        'balance_after', v_bal,
        'warning_id', v_warn_id,
        'note', v_not,
        'by', auth.uid()
      )
    );
  end if;

  perform public.admin_audit_yaz(
    v_uid,
    'wallet_' || v_islem,
    case v_islem
      when 'topup' then 'Coin yukleme: +' || v_miktar::text
      when 'deduct' then 'Coin eksiltme: -' || v_miktar::text
      else 'Coin cezasi: -' || v_miktar::text
    end || coalesce(' · ' || v_not, ''),
    jsonb_build_object(
      'islem', v_islem,
      'miktar', v_miktar,
      'delta', v_delta,
      'balance_after', v_bal,
      'note', v_not,
      'warning_id', v_warn_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'user_id', v_uid,
    'display_name', v_ad,
    'islem', v_islem,
    'delta', v_delta,
    'balance_after', v_bal,
    'currency', 'coins',
    'warning_id', v_warn_id
  );
end;
$$;

grant execute on function public.admin_kullanici_coin_isle(text, text, bigint, text) to authenticated;

-- Eski duzeltme: sebep etiketleri netlestirilsin (davranis ayni)
comment on function public.admin_kullanici_coin_isle(text, text, bigint, text) is
  'Admin coin: topup / deduct / penalty. Kullanici uuid, public_user_id veya username.';
