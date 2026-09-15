-- Giriş: e-posta, kullanıcı adı veya public_user_id → auth email

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
