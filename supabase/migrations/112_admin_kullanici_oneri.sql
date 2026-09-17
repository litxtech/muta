-- Admin coin yükleme: yazılan harfle başlayan isim önerisi (avatar + ad)

create or replace function public.admin_kullanici_oneri(
  p_q text,
  p_limit int default 8
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := left(regexp_replace(trim(coalesce(p_q, '')), '[%_]', '', 'g'), 40);
  v_lim int := least(greatest(coalesce(p_limit, 8), 1), 24);
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  if v_q is null or length(v_q) < 1 then
    return;
  end if;

  return query
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url
  from public.profiles p
  where
    p.deleted_at is null
    and (
      p.display_name ilike v_q || '%'
      or p.username ilike v_q || '%'
      or p.display_name ilike '% ' || v_q || '%'
    )
  order by
    case
      when p.display_name ilike v_q || '%' then 0
      when p.username ilike v_q || '%' then 1
      else 2
    end,
    p.display_name nulls last
  limit v_lim;
end;
$$;

grant execute on function public.admin_kullanici_oneri(text, int) to authenticated;
