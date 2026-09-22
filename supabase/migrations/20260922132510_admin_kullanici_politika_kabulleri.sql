-- Admin: kullanıcı detayında onaylanan politikalar + çocuk koruma beyanı

create or replace function public.admin_kullanici_politika_kabulleri(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
  v_cp jsonb;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  if p_user_id is null then
    raise exception 'user required';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.accepted_at desc), '[]'::jsonb)
  into v_rows
  from (
    select
      pa.accepted_at,
      pa.policy_version_id,
      pv.policy_code,
      pv.version as policy_version,
      coalesce(pol.title, pv.policy_code) as title,
      coalesce(pol.description, '') as description,
      coalesce(pol.is_required, false) as is_required
    from public.policy_acceptances pa
    join public.policy_versions pv on pv.id = pa.policy_version_id
    left join public.policies pol on pol.code = pv.policy_code
    where pa.user_id = p_user_id
  ) t;

  select jsonb_build_object(
    'status', p.child_protection_consent_status,
    'decided_at', coalesce(o.decided_at, p.child_protection_consent_at),
    'locale', o.locale,
    'app_version', o.app_version
  )
  into v_cp
  from public.profiles p
  left join public.cocuk_koruma_onaylari o on o.user_id = p.id
  where p.id = p_user_id;

  if v_cp is null then
    v_cp := jsonb_build_object(
      'status', null,
      'decided_at', null,
      'locale', null,
      'app_version', null
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'kabuller', v_rows,
    'cocuk_koruma', v_cp
  );
end;
$$;

grant execute on function public.admin_kullanici_politika_kabulleri(uuid) to authenticated;
