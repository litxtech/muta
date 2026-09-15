-- Admin rehber: isim, telefon, e-posta (auth.users) — iletisim listesi

create or replace function public.admin_rehber_listesi(
  p_q text default null,
  p_limit int default 300
)
returns table (
  id uuid,
  display_name text,
  username text,
  public_user_id text,
  phone_e164 text,
  email text,
  avatar_url text,
  is_guest boolean,
  is_host boolean,
  banned_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_lim int := least(greatest(coalesce(p_limit, 300), 1), 500);
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.username,
    p.public_user_id::text,
    p.phone_e164,
    u.email::text,
    p.avatar_url,
    coalesce(p.is_guest, false),
    coalesce(p.is_host, false),
    p.banned_at,
    p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.deleted_at is null
    and (
      v_q is null
      or p.display_name ilike '%' || v_q || '%'
      or p.username ilike '%' || v_q || '%'
      or p.phone_e164 ilike '%' || v_q || '%'
      or u.email ilike '%' || v_q || '%'
      or p.public_user_id::text ilike '%' || v_q || '%'
      or p.id::text ilike v_q || '%'
    )
  order by
    lower(
      coalesce(
        nullif(trim(p.display_name), ''),
        nullif(trim(p.username), ''),
        nullif(trim(u.email), ''),
        'zzz'
      )
    ) asc,
    p.created_at desc
  limit v_lim;
end;
$$;

grant execute on function public.admin_rehber_listesi(text, int) to authenticated;
