-- Oda sohbet mesajlarına profil seviyesi ekle (yorum tacı / animasyon).
drop function if exists public.oda_sohbet_mesajlarini_getir(uuid, int);

create function public.oda_sohbet_mesajlarini_getir(
  p_room_id uuid,
  p_limit int default 50
)
returns table (
  id uuid,
  room_id uuid,
  user_id uuid,
  body text,
  created_at timestamptz,
  display_name text,
  username text,
  avatar_url text,
  level int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  return query
  select
    m.id, m.room_id, m.user_id, m.body, m.created_at,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Kullanıcı'),
    p.username,
    p.avatar_url,
    coalesce(p.level, 1)::int
  from public.room_chat_messages m
  left join public.profiles p on p.id = m.user_id
  where m.room_id = p_room_id
    and m.removed_at is null
    and not public.kullanicilar_engelli_mi(v_uid, m.user_id)
  order by m.created_at desc
  limit v_limit;
end;
$$;

grant execute on function public.oda_sohbet_mesajlarini_getir(uuid, int) to authenticated;
