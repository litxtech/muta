-- Telefon ile kayıt / giriş: phone_e164 + çözümleme

create or replace function public.telefon_e164_normalize(p_ham text)
returns text
language plpgsql
immutable
as $$
declare
  v text := regexp_replace(trim(coalesce(p_ham, '')), '[^0-9]', '', 'g');
begin
  if v = '' then return null; end if;
  if left(v, 2) = '00' then v := substr(v, 3); end if;
  if length(v) = 11 and left(v, 1) = '0' then
    v := '90' || substr(v, 2);
  elsif length(v) = 10 and left(v, 1) = '5' then
    v := '90' || v;
  end if;
  if length(v) < 10 or length(v) > 15 then return null; end if;
  return '+' || v;
end;
$$;

create or replace function public.telefon_kayit_musait_mi(p_telefon text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_e164 text := public.telefon_e164_normalize(p_telefon);
begin
  if v_e164 is null then return false; end if;
  return not exists (
    select 1 from public.profiles p
    where p.phone_e164 = v_e164
      and p.deleted_at is null
  );
end;
$$;

grant execute on function public.telefon_e164_normalize(text) to anon, authenticated;
grant execute on function public.telefon_kayit_musait_mi(text) to anon, authenticated;

-- Giriş çözümleme: e-posta / telefon / kullanıcı adı / public ID
create or replace function public.giris_icin_email_coz(p_kimlik text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_raw text := trim(coalesce(p_kimlik, ''));
  v_kimlik text := lower(v_raw);
  v_email text;
  v_phone text;
  v_digits text;
begin
  if char_length(v_kimlik) < 2 or char_length(v_kimlik) > 120 then
    return null;
  end if;

  -- E-posta
  if position('@' in v_kimlik) > 0 then
    select u.email::text into v_email
    from auth.users u
    where lower(u.email) = v_kimlik
    limit 1;
    return v_email;
  end if;

  -- Telefon (rakam ağırlıklı)
  v_digits := regexp_replace(v_raw, '[^0-9]', '', 'g');
  if length(v_digits) >= 10 and v_raw ~ '^[0-9+\s\-()]+$' then
    v_phone := public.telefon_e164_normalize(v_raw);
    if v_phone is not null then
      select u.email::text into v_email
      from public.profiles p
      join auth.users u on u.id = p.id
      where p.phone_e164 = v_phone
        and coalesce(p.is_guest, false) = false
        and p.deleted_at is null
      limit 1;
      if v_email is not null then return v_email; end if;
    end if;
  end if;

  -- Kullanıcı adı veya public ID
  select u.email::text into v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where coalesce(p.is_guest, false) = false
    and p.deleted_at is null
    and (
      lower(p.username) = v_kimlik
      or p.public_user_id = v_raw
      or lower(coalesce(p.public_user_id, '')) = v_kimlik
    )
  limit 1;

  return v_email;
end;
$$;

revoke all on function public.giris_icin_email_coz(text) from public;
grant execute on function public.giris_icin_email_coz(text) to anon, authenticated;

-- Kayıtta phone_e164 yaz
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
  is_guest_meta boolean;
  pid text;
  v_display text;
  v_phone text;
begin
  is_guest_meta := coalesce((new.raw_user_meta_data->>'is_guest')::boolean, false);
  uname := coalesce(
    new.raw_user_meta_data->>'username',
    case when is_guest_meta then 'guest_' || substr(replace(new.id::text, '-', ''), 1, 8)
         else 'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
    end
  );
  pid := public.yeni_public_kullanici_id();
  v_display := coalesce(new.raw_user_meta_data->>'display_name', uname);
  v_phone := public.telefon_e164_normalize(new.raw_user_meta_data->>'phone_e164');

  insert into public.profiles (
    id, username, display_name, gender, public_user_id, is_guest, language, phone_e164
  ) values (
    new.id,
    uname,
    v_display,
    coalesce(new.raw_user_meta_data->>'gender', null),
    pid,
    is_guest_meta,
    coalesce(new.raw_user_meta_data->>'language', 'tr'),
    case when is_guest_meta then null else v_phone end
  );

  insert into public.wallets (user_id, coins, diamonds)
  values (new.id, case when is_guest_meta then 0 else 100 end, 0);

  if not is_guest_meta then
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason)
    values (new.id, 'coins', 100, 100, 'welcome_bonus');
  end if;

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

  return new;
end;
$$;
