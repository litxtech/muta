-- Admin panelinden kullaniciya is_admin verme / kaldirma
-- Trigger yalnizca service_role veya guvenli RPC (GUC + definer) ile is_admin degistirilebilir

create or replace function public.profiles_is_admin_koru()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bypass text := coalesce(current_setting('app.allow_is_admin_change', true), '');
  v_definer boolean := current_user in ('postgres', 'supabase_admin');
begin
  if tg_op = 'INSERT' then
    if coalesce(new.is_admin, false) = true
       and auth.role() <> 'service_role'
       and not (v_definer and v_bypass = '1') then
      new.is_admin := false;
    end if;
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin
     and auth.role() <> 'service_role'
     and not (v_definer and v_bypass = '1') then
    raise exception 'Forbidden: is_admin';
  end if;
  return new;
end;
$$;

create or replace function public.admin_kullanici_admin_yetki_ayarla(
  p_user_id uuid,
  p_is_admin boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hedef public.profiles%rowtype;
  v_onceki boolean;
  v_kalan_admin bigint;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  if p_user_id is null then
    raise exception 'Kullanici gerekli';
  end if;
  if p_is_admin is null then
    raise exception 'Yetki durumu gerekli';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Kendi admin yetkini degistiremezsin';
  end if;

  select * into v_hedef from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Kullanici bulunamadi';
  end if;
  if v_hedef.deleted_at is not null then
    raise exception 'Silinmis hesaba yetki verilemez';
  end if;

  v_onceki := coalesce(v_hedef.is_admin, false);
  if v_onceki = p_is_admin then
    return jsonb_build_object(
      'ok', true,
      'kod', 'degismedi',
      'is_admin', p_is_admin
    );
  end if;

  if p_is_admin = false then
    select count(*)::bigint into v_kalan_admin
    from public.profiles
    where coalesce(is_admin, false) = true
      and deleted_at is null
      and id <> p_user_id;
    if coalesce(v_kalan_admin, 0) < 1 then
      raise exception 'Son admin yetkisi kaldirilamaz';
    end if;
  end if;

  perform set_config('app.allow_is_admin_change', '1', true);

  update public.profiles
  set
    is_admin = p_is_admin,
    updated_at = now()
  where id = p_user_id;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    p_user_id,
    case when p_is_admin then 'admin_granted' else 'admin_revoked' end,
    'critical',
    jsonb_build_object(
      'by', auth.uid(),
      'is_admin', p_is_admin,
      'onceki', v_onceki
    )
  );

  perform public.admin_audit_yaz(
    p_user_id,
    case when p_is_admin then 'admin_grant' else 'admin_revoke' end,
    case
      when p_is_admin then 'Admin yetkisi verildi'
      else 'Admin yetkisi kaldirildi'
    end,
    jsonb_build_object('is_admin', p_is_admin, 'onceki', v_onceki)
  );

  return jsonb_build_object(
    'ok', true,
    'kod', case when p_is_admin then 'admin_granted' else 'admin_revoked' end,
    'is_admin', p_is_admin
  );
end;
$$;

revoke all on function public.admin_kullanici_admin_yetki_ayarla(uuid, boolean) from public;
grant execute on function public.admin_kullanici_admin_yetki_ayarla(uuid, boolean) to authenticated;
