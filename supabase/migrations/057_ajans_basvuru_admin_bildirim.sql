-- Ajans başvurusu: zorunlu alanlar + tüm adminlere bildirim + admin listesinde tam alanlar

create or replace function public.ajans_basvurusu_olustur(
  p_agency_name text,
  p_country text default null,
  p_email text default null,
  p_phone text default null,
  p_experience text default null,
  p_expected_hosts int default null,
  p_description text default null
)
returns public.agency_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_name text := trim(coalesce(p_agency_name, ''));
  v_country text := nullif(trim(coalesce(p_country, '')), '');
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
  v_experience text := nullif(trim(coalesce(p_experience, '')), '');
  v_description text := nullif(trim(coalesce(p_description, '')), '');
  v_row public.agency_applications%rowtype;
  v_display text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if not public.ozellik_bayragi_aktif_mi('agency_enabled') then
    raise exception 'Agency feature disabled';
  end if;

  select is_guest, coalesce(nullif(trim(display_name), ''), username)
    into v_guest, v_display
  from public.profiles where id = v_uid;

  if coalesce(v_guest, false) then raise exception 'Guest cannot create agency'; end if;

  if length(v_name) < 3 then
    raise exception 'Ajans adı en az 3 karakter olmalı';
  end if;
  if v_country is null or length(v_country) < 2 then
    raise exception 'Ülke / bölge zorunlu';
  end if;
  if v_email is null or position('@' in v_email) < 2 then
    raise exception 'Geçerli e-posta zorunlu';
  end if;
  if v_phone is null or length(v_phone) < 7 then
    raise exception 'Telefon zorunlu (en az 7 karakter)';
  end if;
  if v_description is null or length(v_description) < 20 then
    raise exception 'Ajans açıklaması en az 20 karakter olmalı';
  end if;
  if p_expected_hosts is null or p_expected_hosts < 1 then
    raise exception 'Beklenen host sayısı en az 1 olmalı';
  end if;
  if p_expected_hosts > 5000 then
    raise exception 'Beklenen host sayısı çok yüksek';
  end if;

  -- Aynı kullanıcıda bekleyen başvuru varsa yenisini engelle
  if exists (
    select 1 from public.agency_applications
    where applicant_id = v_uid and status in ('pending', 'under_review')
  ) then
    raise exception 'Zaten bekleyen bir ajans başvurun var';
  end if;

  insert into public.agency_applications (
    applicant_id, agency_name, country, email, phone, experience, expected_hosts, description, status
  ) values (
    v_uid, v_name, v_country, v_email, v_phone, v_experience, p_expected_hosts, v_description, 'pending'
  ) returning * into v_row;

  -- Yetkili adminlere operasyon bildirimi
  perform public.admin_operasyon_bildirimi(
    'Yeni ajans başvurusu',
    coalesce(v_display, 'Kullanıcı') || ' · ' || v_name || ' · ' || v_country,
    '/admin/ajanslar',
    jsonb_build_object(
      'type', 'agency_application',
      'application_id', v_row.id,
      'agency_name', v_name,
      'applicant_id', v_uid
    )
  );

  return v_row;
end;
$$;

grant execute on function public.ajans_basvurusu_olustur(text, text, text, text, text, int, text)
  to authenticated;

-- Admin listesinde iletişim + deneyim alanları
create or replace function public.admin_ajans_basvuru_listesi(p_limit int default 40)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', ap.id,
      'agency_name', ap.agency_name,
      'country', ap.country,
      'email', ap.email,
      'phone', ap.phone,
      'experience', ap.experience,
      'status', ap.status,
      'created_at', ap.created_at,
      'applicant_id', ap.applicant_id,
      'applicant_name', coalesce(p.display_name, p.username),
      'applicant_username', p.username,
      'expected_hosts', ap.expected_hosts,
      'description', ap.description
    ) order by ap.created_at desc)
    from (
      select * from public.agency_applications
      where status in ('pending', 'under_review')
      order by created_at desc
      limit least(greatest(coalesce(p_limit, 40), 1), 100)
    ) ap
    left join public.profiles p on p.id = ap.applicant_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_ajans_basvuru_listesi(int) to authenticated;
