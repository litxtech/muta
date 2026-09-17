-- Ülke kodu normalizasyonu: Türkiye / Turkey / TR → TR (ISO 3166-1 alpha-2)
-- profiles.country görünen ad kalır; country_code her zaman ISO kod olur.
-- Dış API'ler (Stripe vb.) ham "Türkiye" kabul etmez.

create or replace function public.ulke_koduna_normalize(p_raw text)
returns text
language plpgsql
immutable
as $$
declare
  v_trim text;
  v_fold text;
begin
  if p_raw is null then
    return null;
  end if;
  v_trim := trim(p_raw);
  if v_trim = '' then
    return null;
  end if;

  -- Zaten ISO alpha-2
  if v_trim ~* '^[A-Za-z]{2}$' then
    return upper(v_trim);
  end if;

  -- Türkçe İ/ı + aksanları ASCII'ye indir
  v_fold := lower(v_trim);
  v_fold := replace(v_fold, 'İ', 'i');
  v_fold := replace(v_fold, 'I', 'i');
  v_fold := replace(v_fold, 'ı', 'i');
  v_fold := translate(v_fold, 'şğüöçâêîôû', 'sguocaeeiou');
  v_fold := regexp_replace(v_fold, '\s+', ' ', 'g');

  if v_fold in (
    'turkey',
    'turkiye',
    'turkiye cumhuriyeti',
    'republic of turkey',
    'republic of turkiye',
    'tr',
    'tur'
  ) then
    return 'TR';
  end if;

  if regexp_replace(v_fold, '[^a-z]', '', 'g') = 'turkiye' then
    return 'TR';
  end if;

  if v_fold in ('germany', 'deutschland', 'de') then
    return 'DE';
  end if;
  if v_fold in ('united states', 'united states of america', 'usa', 'us') then
    return 'US';
  end if;
  if v_fold in ('united kingdom', 'great britain', 'uk', 'gb') then
    return 'GB';
  end if;

  return null;
end;
$$;

comment on function public.ulke_koduna_normalize(text) is
  'Display name / alias → ISO 3166-1 alpha-2. Türkiye/Turkey → TR.';

-- ---------------------------------------------------------------------------
-- profil_guncelle: kodu normalize et; country alanına geo_countries.name yaz
-- ---------------------------------------------------------------------------
create or replace function public.profil_guncelle(
  p_display_name text default null,
  p_username text default null,
  p_bio text default null,
  p_phone_e164 text default null,
  p_clear_phone boolean default false,
  p_gender text default null,
  p_birth_date date default null,
  p_clear_birth_date boolean default false,
  p_country_code text default null,
  p_region_id uuid default null,
  p_clear_region boolean default false
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.profiles%rowtype;
  v_username text;
  v_phone text;
  v_gender text;
  v_country text;
  v_country_name text;
  v_region uuid;
  v_region_country text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if p_username is not null then
    v_username := lower(trim(p_username));
    if v_username !~ '^[a-z0-9_]{3,24}$' then
      raise exception 'Invalid username';
    end if;
  end if;

  if p_clear_phone then
    v_phone := null;
  elsif p_phone_e164 is not null and length(trim(p_phone_e164)) > 0 then
    v_phone := trim(p_phone_e164);
  end if;

  if p_gender is not null then
    v_gender := lower(trim(p_gender));
    if v_gender not in ('female', 'male', 'other', 'prefer_not') then
      raise exception 'Gecersiz cinsiyet';
    end if;
  end if;

  if p_birth_date is not null then
    if p_birth_date > (current_date - interval '18 years') then
      raise exception 'Platform 18 yas ve uzeri icindir';
    end if;
    if p_birth_date < date '1920-01-01' then
      raise exception 'Gecersiz dogum tarihi';
    end if;
  end if;

  if p_country_code is not null then
    v_country := public.ulke_koduna_normalize(p_country_code);
    if v_country is null then
      -- Son çare: geo_countries.name ile eşle
      select c.code into v_country
      from public.geo_countries c
      where c.is_active and c.profile_enabled
        and (
          lower(c.name) = lower(trim(p_country_code))
          or public.ulke_koduna_normalize(c.name) = public.ulke_koduna_normalize(p_country_code)
        )
      limit 1;
    end if;
    if v_country is null or not exists (
      select 1 from public.geo_countries
      where code = v_country and is_active and profile_enabled
    ) then
      raise exception 'Bu ulke su an secilemez';
    end if;
    select name into v_country_name
    from public.geo_countries
    where code = v_country;
  end if;

  if p_clear_region then
    v_region := null;
  elsif p_region_id is not null then
    select r.id, r.country_code into v_region, v_region_country
    from public.geo_regions r
    join public.geo_countries c on c.code = r.country_code
    where r.id = p_region_id
      and r.is_active and r.profile_enabled
      and c.is_active and c.profile_enabled;
    if v_region is null then
      raise exception 'Gecersiz il / bolge';
    end if;
    if v_country is null then
      v_country := v_region_country;
      select name into v_country_name
      from public.geo_countries
      where code = v_country;
    elsif v_country <> v_region_country then
      raise exception 'Il secilen ulkeye ait degil';
    end if;
  end if;

  update public.profiles
  set
    display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
    username = coalesce(v_username, username),
    bio = case when p_bio is null then bio else left(trim(p_bio), 280) end,
    phone_e164 = case
      when p_clear_phone then null
      when p_phone_e164 is not null and length(trim(p_phone_e164)) > 0 then v_phone
      else phone_e164
    end,
    gender = coalesce(v_gender, gender),
    birth_date = case
      when p_clear_birth_date then null
      when p_birth_date is not null then p_birth_date
      else birth_date
    end,
    country_code = coalesce(v_country, country_code),
    -- Görünen ad: geo name (Türkiye). ISO kodu country alanına yazma.
    country = coalesce(v_country_name, country),
    region_id = case
      when p_clear_region then null
      when p_region_id is not null then v_region
      else region_id
    end,
    is_guest = false,
    updated_at = now()
  where id = v_uid
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Profile not found';
  end if;
  return v_row;
end;
$$;

grant execute on function public.ulke_koduna_normalize(text) to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- Backfill: bozuk country / country_code kayıtlarını düzelt
-- ---------------------------------------------------------------------------
update public.profiles p
set country_code = 'TR'
where p.country_code is null
  and public.ulke_koduna_normalize(p.country) = 'TR';

update public.profiles p
set country_code = public.ulke_koduna_normalize(p.country_code)
where p.country_code is not null
  and public.ulke_koduna_normalize(p.country_code) is not null
  and p.country_code <> public.ulke_koduna_normalize(p.country_code);

-- country_code dolu ama country ISO kod veya İngilizce "Turkey" ise UI adını yaz
update public.profiles p
set country = g.name
from public.geo_countries g
where p.country_code = g.code
  and (
    p.country is null
    or p.country = p.country_code
    or public.ulke_koduna_normalize(p.country) = g.code
    or lower(trim(p.country)) in ('turkey', 'turkiye')
  );

-- geo_countries TR adını Türkiye tut (UI)
update public.geo_countries
set name = 'Türkiye'
where code = 'TR'
  and name is distinct from 'Türkiye';

-- Ajans / başvuru serbest metin: bilinen Türkiye varyantlarını TR yap
update public.agencies
set country = 'TR'
where public.ulke_koduna_normalize(country) = 'TR'
  and country is distinct from 'TR';

update public.agency_applications
set country = 'TR'
where public.ulke_koduna_normalize(country) = 'TR'
  and country is distinct from 'TR';
