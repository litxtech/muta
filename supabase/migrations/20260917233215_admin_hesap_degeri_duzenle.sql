-- Admin: hesap değeri artır / eksilt / sabitle + formülden yenile
-- Manuel düzenleme account_value_override=true ile formül tetiklerinden korunur

alter table public.user_profile_stats
  add column if not exists account_value_override boolean not null default false;

comment on column public.user_profile_stats.account_value_override is
  'true ise admin manuel skor; hesap_degerini_yenile üzerine yazmaz';

-- Formül: override varsa dokunma (admin kilidi)
create or replace function public.hesap_degerini_yenile(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_weight_sum numeric := 0;
  v_weighted numeric := 0;
  v_score int := 0;
  v_label text;
  v_override boolean := false;
  r record;
  v_sig numeric;
begin
  insert into public.user_profile_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select coalesce(account_value_override, false), account_value
  into v_override, v_score
  from public.user_profile_stats
  where user_id = p_user_id;

  if v_override then
    return coalesce(v_score, 0);
  end if;

  for r in
    select signal_key, weight
    from public.account_value_signals
    where is_active = true
  loop
    v_sig := public.hesap_degeri_sinyal_skoru(r.signal_key, p_user_id);
    v_weighted := v_weighted + (coalesce(v_sig, 0) * r.weight);
    v_weight_sum := v_weight_sum + r.weight;
  end loop;

  if v_weight_sum <= 0 then
    v_score := 0;
  else
    v_score := least(1000, greatest(0, round(v_weighted / v_weight_sum * 10)::int));
  end if;

  v_label := public.hesap_degeri_etiketi(v_score);

  update public.user_profile_stats
  set
    account_value = v_score,
    account_value_label = v_label,
    account_value_version = 1,
    account_value_updated_at = now(),
    updated_at = now()
  where user_id = p_user_id;

  return v_score;
end;
$$;

create or replace function public.admin_kullanici_hesap_degeri_isle(
  p_user_ref text,
  p_islem text,
  p_miktar int default 0,
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
  v_miktar int := abs(coalesce(p_miktar, 0));
  v_not text := nullif(trim(coalesce(p_not, '')), '');
  v_ref text := nullif(trim(coalesce(p_user_ref, '')), '');
  v_once int := 0;
  v_sonra int := 0;
  v_label text;
  v_override boolean := false;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  if v_ref is null then
    raise exception 'Kullanici gerekli';
  end if;
  if v_islem not in (
    'artir', 'eksilt', 'sabitle', 'formul',
    'topup', 'deduct', 'set', 'refresh'
  ) then
    raise exception 'Gecersiz islem (artir|eksilt|sabitle|formul)';
  end if;

  if v_islem = 'topup' then v_islem := 'artir'; end if;
  if v_islem = 'deduct' then v_islem := 'eksilt'; end if;
  if v_islem = 'set' then v_islem := 'sabitle'; end if;
  if v_islem = 'refresh' then v_islem := 'formul'; end if;

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

  insert into public.user_profile_stats (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  select coalesce(account_value, 0)
  into v_once
  from public.user_profile_stats
  where user_id = v_uid;

  if v_islem = 'formul' then
    update public.user_profile_stats
    set account_value_override = false
    where user_id = v_uid;
    v_sonra := public.hesap_degerini_yenile(v_uid);
    v_override := false;
  else
    if v_islem in ('artir', 'eksilt') and v_miktar <= 0 then
      raise exception 'Miktar pozitif olmali';
    end if;
    if v_islem = 'sabitle' and (p_miktar is null or p_miktar < 0 or p_miktar > 1000) then
      raise exception 'Sabit skor 0–1000 araliginda olmali';
    end if;

    if v_islem = 'artir' then
      v_sonra := least(1000, v_once + v_miktar);
    elsif v_islem = 'eksilt' then
      v_sonra := greatest(0, v_once - v_miktar);
    else
      v_sonra := least(1000, greatest(0, coalesce(p_miktar, 0)));
    end if;

    v_label := public.hesap_degeri_etiketi(v_sonra);
    v_override := true;

    update public.user_profile_stats
    set
      account_value = v_sonra,
      account_value_label = v_label,
      account_value_override = true,
      account_value_updated_at = now(),
      updated_at = now()
    where user_id = v_uid;
  end if;

  select account_value, account_value_label, coalesce(account_value_override, false)
  into v_sonra, v_label, v_override
  from public.user_profile_stats
  where user_id = v_uid;

  perform public.admin_audit_yaz(
    v_uid,
    'account_value_' || v_islem,
    case v_islem
      when 'artir' then 'Hesap degeri artirildi: +' || v_miktar::text
      when 'eksilt' then 'Hesap degeri eksiltildi: -' || v_miktar::text
      when 'sabitle' then 'Hesap degeri sabitlendi: ' || v_sonra::text
      else 'Hesap degeri formülden yenilendi: ' || v_sonra::text
    end || ' (' || v_once::text || ' → ' || v_sonra::text || ')'
      || coalesce(' · ' || v_not, ''),
    jsonb_build_object(
      'islem', v_islem,
      'miktar', v_miktar,
      'value_before', v_once,
      'value_after', v_sonra,
      'label', v_label,
      'override', v_override,
      'note', v_not
    )
  );

  return jsonb_build_object(
    'ok', true,
    'user_id', v_uid,
    'display_name', v_ad,
    'islem', v_islem,
    'value_before', v_once,
    'value_after', v_sonra,
    'label', v_label,
    'override', v_override
  );
end;
$$;

grant execute on function public.admin_kullanici_hesap_degeri_isle(text, text, int, text) to authenticated;

comment on function public.admin_kullanici_hesap_degeri_isle(text, text, int, text) is
  'Admin hesap değeri: artir | eksilt | sabitle | formul. Yalnızca ben_admin_miyim().';
