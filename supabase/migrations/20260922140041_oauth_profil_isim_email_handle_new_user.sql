-- OAuth (Apple/Spotify): kayıtta display_name + username sağlayıcı isim/e-postadan

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  uname text;
  uname_base text;
  is_guest_meta boolean;
  is_sample_meta boolean;
  pid text;
  v_display text;
  v_phone text;
  v_birth date;
  v_birth_raw text;
  v_gender text;
  v_custom jsonb;
  v_email_local text;
  v_given text;
  v_family text;
begin
  is_guest_meta := coalesce((new.raw_user_meta_data->>'is_guest')::boolean, false);
  is_sample_meta := coalesce((new.raw_user_meta_data->>'is_sample')::boolean, false);

  v_email_local := null;
  if new.email is not null and position('@' in new.email) > 1 then
    v_email_local := lower(split_part(new.email, '@', 1));
    v_email_local := regexp_replace(v_email_local, '[^a-z0-9._-]', '', 'g');
    v_email_local := regexp_replace(v_email_local, '^[._-]+|[._-]+$', '', 'g');
    v_email_local := left(v_email_local, 20);
    if length(v_email_local) < 3 then
      v_email_local := null;
    end if;
  end if;

  uname_base := nullif(trim(coalesce(new.raw_user_meta_data->>'username', '')), '');
  if uname_base is null then
    uname_base := v_email_local;
  end if;
  if uname_base is null then
    uname_base :=
      case
        when is_guest_meta then 'guest_' || substr(replace(new.id::text, '-', ''), 1, 8)
        else 'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
      end;
  end if;

  uname := uname_base;
  if exists (select 1 from public.profiles p where p.username = uname) then
    uname := left(uname_base, 15) || '_' || substr(replace(new.id::text, '-', ''), 1, 4);
  end if;

  pid := public.yeni_public_kullanici_id();

  v_given := nullif(trim(coalesce(new.raw_user_meta_data->>'given_name', '')), '');
  v_family := nullif(trim(coalesce(new.raw_user_meta_data->>'family_name', '')), '');

  v_display := coalesce(
    nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'name', '')), ''),
    nullif(trim(both from coalesce(v_given, '') || ' ' || coalesce(v_family, '')), ''),
    uname
  );

  v_phone := public.telefon_e164_normalize(new.raw_user_meta_data->>'phone_e164');

  v_gender := nullif(trim(coalesce(new.raw_user_meta_data->>'gender', '')), '');
  if v_gender is not null and v_gender not in ('female', 'male', 'other', 'prefer_not') then
    v_gender := null;
  end if;

  v_birth_raw := nullif(trim(coalesce(new.raw_user_meta_data->>'birth_date', '')), '');
  if v_birth_raw is not null then
    begin
      v_birth := v_birth_raw::date;
    exception when others then
      v_birth := null;
    end;
    if v_birth is not null then
      if v_birth > (current_date - interval '18 years') then
        raise exception 'Platform 18 yas ve uzeri icindir';
      end if;
      if v_birth < date '1920-01-01' then
        raise exception 'Gecersiz dogum tarihi';
      end if;
    end if;
  end if;

  v_custom := coalesce(new.raw_user_meta_data->'custom_fields', '{}'::jsonb);
  if jsonb_typeof(v_custom) <> 'object' then
    v_custom := '{}'::jsonb;
  end if;

  insert into public.profiles (
    id, username, display_name, gender, birth_date, public_user_id,
    is_guest, is_sample, language, phone_e164, custom_fields
  ) values (
    new.id,
    uname,
    v_display,
    v_gender,
    v_birth,
    pid,
    is_guest_meta,
    is_sample_meta,
    coalesce(new.raw_user_meta_data->>'language', 'tr'),
    case when is_guest_meta then null else v_phone end,
    v_custom
  );

  insert into public.wallets (user_id, coins, diamonds)
  values (new.id, case when is_guest_meta then 0 else 100 end, 0);

  if not is_guest_meta then
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason)
    values (new.id, 'coins', 100, 100, 'welcome_bonus');
  end if;

  if not is_sample_meta then
    begin
      perform public.admin_operasyon_bildirimi(
        case when is_guest_meta then 'Yeni misafir kayıt' else 'Yeni kullanıcı kayıt' end,
        trim(
          coalesce(v_display, uname)
          || case when uname is not null then ' · @' || uname else '' end
          || ' · ID ' || coalesce(pid, left(new.id::text, 8))
          || case when v_phone is not null then ' · ' || v_phone else '' end
          || case when new.email is not null then ' · ' || new.email else '' end
        ),
        '/admin/kullanicilar/' || new.id::text,
        jsonb_build_object(
          'type', 'admin_new_registration',
          'user_id', new.id,
          'is_guest', is_guest_meta,
          'public_user_id', pid,
          'username', uname,
          'display_name', v_display,
          'phone_e164', v_phone
        )
      );
    exception when others then
      null;
    end;
  end if;

  return new;
end;
$function$;
