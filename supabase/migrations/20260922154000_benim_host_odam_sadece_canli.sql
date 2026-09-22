-- benim_host_odam: yalnızca canlı oda (kapalı oda hamburger’de görünmesin)

create or replace function public.benim_host_odam()
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  r public.rooms%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into r
  from public.rooms
  where host_id = v_uid and coalesce(is_live, false) = true
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'hata', 'Canlı ses odan yok — önce bir oda aç.'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'room_id', r.id,
    'title', r.title,
    'is_live', true
  );
end;
$function$;

grant execute on function public.benim_host_odam() to authenticated;
