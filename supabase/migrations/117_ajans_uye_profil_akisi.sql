-- Ajans üyeliği: profil rozeti, ajansa başvuru, onay bildirimi, üye paneli.

create or replace function public.ajans_uye_durumum(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hedef uuid;
  v_kendim boolean;
  v_agency public.agencies%rowtype;
  v_app public.host_applications%rowtype;
  v_role text := 'none';
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  v_hedef := coalesce(p_user_id, v_uid);
  v_kendim := (v_hedef = v_uid);

  select a.* into v_agency
  from public.host_profiles hp
  join public.agencies a on a.id = hp.agency_id
  where hp.user_id = v_hedef
    and hp.status = 'agency'
    and hp.agency_id is not null
    and a.status <> 'closed'
  limit 1;

  if found then
    v_role := 'member';
  else
    select a.* into v_agency
    from public.agencies a
    where a.owner_id = v_hedef
      and a.status <> 'closed'
    order by a.created_at desc
    limit 1;
    if found then
      v_role := 'owner';
    elsif v_kendim then
      select ha.* into v_app
      from public.host_applications ha
      where ha.user_id = v_hedef
        and ha.path = 'join_agency'
        and ha.status = 'agency_review'
      order by ha.created_at desc
      limit 1;
      if found and v_app.agency_id is not null then
        select * into v_agency from public.agencies where id = v_app.agency_id;
        if found and v_agency.status <> 'closed' then
          v_role := 'pending';
        end if;
      end if;
    end if;
  end if;

  if v_role = 'none' then
    return jsonb_build_object(
      'role', 'none',
      'agency', null,
      'application_id', null,
      'application_status', null
    );
  end if;

  return jsonb_build_object(
    'role', v_role,
    'agency', jsonb_build_object(
      'id', v_agency.id,
      'agency_public_id', v_agency.agency_public_id,
      'name', v_agency.name,
      'logo_url', v_agency.logo_url,
      'slogan', v_agency.slogan,
      'status', v_agency.status,
      'owner_id', v_agency.owner_id
    ),
    'application_id', case when v_role = 'pending' then v_app.id else null end,
    'application_status', case when v_role = 'pending' then v_app.status else null end
  );
end;
$$;

grant execute on function public.ajans_uye_durumum(uuid) to authenticated;

create or replace function public.ajans_uye_basvurusu_olustur(
  p_agency_id uuid default null,
  p_invite_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_agency public.agencies%rowtype;
  v_host public.host_profiles%rowtype;
  v_mevcut uuid;
  v_ad text;
  v_row public.host_applications%rowtype;
  v_kod text := nullif(upper(trim(coalesce(p_invite_code, ''))), '');
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir ajansa katılamaz'; end if;

  if p_agency_id is not null then
    select * into v_agency from public.agencies where id = p_agency_id;
  elsif v_kod is not null then
    select * into v_agency from public.agencies
    where invite_code = v_kod and status = 'active';
  else
    raise exception 'Ajans veya davet kodu gerekli';
  end if;

  if not found then raise exception 'Ajans bulunamadı'; end if;
  if v_agency.status <> 'active' then raise exception 'Ajans aktif değil'; end if;
  if v_agency.owner_id = v_uid then raise exception 'Bu ajansın sahibisin'; end if;

  select * into v_host from public.host_profiles where user_id = v_uid;
  if found and v_host.status = 'agency' and v_host.agency_id is not null then
    if v_host.agency_id = v_agency.id then
      raise exception 'Zaten bu ajansın üyesisin';
    end if;
    raise exception 'Başka bir ajansa kayıtlısın';
  end if;

  select ha.agency_id into v_mevcut
  from public.host_applications ha
  where ha.user_id = v_uid
    and ha.path = 'join_agency'
    and ha.status = 'agency_review'
  order by ha.created_at desc
  limit 1;

  if v_mevcut is not null then
    if v_mevcut = v_agency.id then
      raise exception 'Bu ajansa zaten bekleyen başvurun var';
    end if;
    raise exception 'Bekleyen başka bir ajans başvurun var';
  end if;

  insert into public.host_applications (user_id, path, agency_id, invite_code, status)
  values (
    v_uid,
    'join_agency',
    v_agency.id,
    coalesce(v_kod, v_agency.invite_code),
    'agency_review'
  )
  returning * into v_row;

  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Bir kullanıcı')
  into v_ad
  from public.profiles p
  where p.id = v_uid;

  if v_agency.owner_id is distinct from v_uid then
    perform public.bildirim_kuyruga_ekle(
      v_agency.owner_id,
      'system',
      'Ajans katılım başvurusu',
      coalesce(v_ad, 'Bir kullanıcı') || ' ' || v_agency.name || ' ajansına katılmak istiyor.',
      '/ajans/' || v_agency.id::text,
      jsonb_build_object(
        'type', 'agency_host_apply',
        'agency_id', v_agency.id,
        'application_id', v_row.id,
        'actor_id', v_uid
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'application_id', v_row.id,
    'agency_id', v_agency.id,
    'status', v_row.status
  );
end;
$$;

grant execute on function public.ajans_uye_basvurusu_olustur(uuid, text) to authenticated;

create or replace function public.host_basvurusu_olustur(
  p_path text,
  p_invite_code text default null
)
returns public.host_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_agency uuid;
  v_row public.host_applications%rowtype;
  v_json jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir ev sahibi olamaz'; end if;

  if p_path = 'join_agency' then
    v_json := public.ajans_uye_basvurusu_olustur(null, p_invite_code);
    select * into v_row
    from public.host_applications
    where id = (v_json->>'application_id')::uuid;
    return v_row;
  end if;

  if p_path <> 'independent' then
    raise exception 'Geçersiz başvuru yolu';
  end if;

  insert into public.host_applications (user_id, path, agency_id, invite_code, status)
  values (v_uid, p_path, v_agency, p_invite_code, 'platform_review')
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.ajans_host_basvurusunu_onayla(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.host_applications%rowtype;
  v_agency public.agencies%rowtype;
  v_host public.host_profiles%rowtype;
  v_prev_agency uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_app from public.host_applications where id = p_application_id for update;
  if not found then raise exception 'Başvuru bulunamadı'; end if;
  if v_app.status <> 'agency_review' then
    raise exception 'Başvuru onaylanabilir değil';
  end if;
  if v_app.agency_id is null then raise exception 'Ajans yok'; end if;

  select * into v_agency from public.agencies where id = v_app.agency_id for update;
  if not found then raise exception 'Ajans bulunamadı'; end if;
  if v_agency.owner_id <> v_uid and not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;
  if v_agency.status <> 'active' then raise exception 'Ajans aktif değil'; end if;

  select agency_id into v_prev_agency
  from public.host_profiles where user_id = v_app.user_id;

  insert into public.host_profiles (user_id, agency_id, status, joined_agency_at)
  values (
    v_app.user_id, v_app.agency_id, 'agency', now()
  )
  on conflict (user_id) do update set
    agency_id = excluded.agency_id,
    status = 'agency',
    joined_agency_at = coalesce(host_profiles.joined_agency_at, excluded.joined_agency_at),
    updated_at = now()
  returning * into v_host;

  update public.profiles set is_host = true, updated_at = now() where id = v_app.user_id;

  insert into public.user_profile_stats (user_id)
  values (v_app.user_id)
  on conflict (user_id) do nothing;

  update public.user_profile_stats set
    host_status = v_host.status,
    agency_id = v_host.agency_id,
    updated_at = now()
  where user_id = v_app.user_id;

  if v_prev_agency is distinct from v_app.agency_id then
    if v_prev_agency is not null then
      update public.agencies
      set host_count = greatest(0, host_count - 1), updated_at = now()
      where id = v_prev_agency;
    end if;
    update public.agencies
    set host_count = host_count + 1, updated_at = now()
    where id = v_app.agency_id;
  end if;

  update public.host_applications
  set status = 'approved', reviewed_at = now()
  where id = p_application_id;

  perform public.bildirim_kuyruga_ekle(
    v_app.user_id,
    'system',
    'Ajans başvurun onaylandı',
    v_agency.name || ' ajansına katıldın. Panelin hazır.',
    '/ajans/uye',
    jsonb_build_object(
      'type', 'agency_host_approved',
      'agency_id', v_app.agency_id,
      'application_id', p_application_id
    )
  );

  return jsonb_build_object('ok', true, 'user_id', v_app.user_id);
end;
$$;

create or replace function public.ajans_host_basvurusunu_reddet(
  p_application_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.host_applications%rowtype;
  v_agency public.agencies%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_app from public.host_applications where id = p_application_id for update;
  if not found then raise exception 'Başvuru bulunamadı'; end if;
  if v_app.status <> 'agency_review' then
    raise exception 'Başvuru reddedilebilir değil';
  end if;
  if v_app.agency_id is null then raise exception 'Ajans yok'; end if;

  select * into v_agency from public.agencies where id = v_app.agency_id;
  if not found then raise exception 'Ajans bulunamadı'; end if;
  if v_agency.owner_id <> v_uid and not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;

  update public.host_applications set
    status = 'rejected',
    note = coalesce(nullif(trim(p_note), ''), note),
    reviewed_at = now()
  where id = p_application_id;

  perform public.bildirim_kuyruga_ekle(
    v_app.user_id,
    'system',
    'Ajans başvurun reddedildi',
    v_agency.name || ' katılım başvurunu reddetti.',
    '/ajans',
    jsonb_build_object(
      'type', 'agency_host_rejected',
      'agency_id', v_app.agency_id,
      'application_id', p_application_id
    )
  );

  return jsonb_build_object('ok', true);
end;
$$;
