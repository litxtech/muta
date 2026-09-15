-- Sehir destek geri cekme

create or replace function public.sehir_destek_geri_cek(p_city_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_deleted int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ozellik_bayragi_aktif_mi('city_league_enabled') then
    raise exception 'City feature disabled';
  end if;

  delete from public.user_supported_cities
  where user_id = v_uid and city_id = p_city_id;

  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'Support not found';
  end if;

  update public.geo_cities
  set supporter_count = (
    select count(*)::int from public.user_supported_cities where city_id = p_city_id
  ),
  power_score = greatest(0, power_score - 1)
  where id = p_city_id;

  insert into public.city_power_events (city_id, event_type, delta, balance_after, ref_type)
  select p_city_id, 'unsupport', -1, power_score, 'support'
  from public.geo_cities where id = p_city_id;
end;
$$;

grant execute on function public.sehir_destek_geri_cek(uuid) to authenticated;
