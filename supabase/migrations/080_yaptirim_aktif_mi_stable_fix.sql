-- Fix: "UPDATE is not allowed in a non-volatile function"
-- kullanici_yaptirim_aktif_mi / benim_aktif_yaptirimlarim STABLE iken UPDATE yapıyordu.
-- RLS (oda açma) bu fonksiyonu çağırdığı için ses odası oluşturma patlıyordu.
-- Süresi dolmuş yaptırımlar zaten expires_at filtresiyle aktif sayılmaz; lazy UPDATE gereksiz.

create or replace function public.kullanici_yaptirim_aktif_mi(
  p_user_id uuid,
  p_kind text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_kind text := lower(trim(coalesce(p_kind, '')));
begin
  if p_user_id is null or v_kind = '' then
    return false;
  end if;

  return exists (
    select 1
    from public.user_feature_sanctions s
    where s.user_id = p_user_id
      and s.kind = v_kind
      and s.is_active = true
      and (s.expires_at is null or s.expires_at > now())
  );
end;
$$;

grant execute on function public.kullanici_yaptirim_aktif_mi(uuid, text) to authenticated, anon, service_role;

create or replace function public.benim_aktif_yaptirimlarim()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'kind', s.kind,
      'reason', s.reason,
      'starts_at', s.starts_at,
      'expires_at', s.expires_at,
      'room_id', s.room_id
    ) order by s.created_at desc)
    from public.user_feature_sanctions s
    where s.user_id = v_uid
      and s.is_active = true
      and (s.expires_at is null or s.expires_at > now())
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.benim_aktif_yaptirimlarim() to authenticated;
