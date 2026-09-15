-- Profil: cinsiyet, dogum tarihi, ulke/bolge (dunya-ready; simdi TR + 81 il)

alter table public.geo_countries
  add column if not exists profile_enabled boolean not null default false,
  add column if not exists sort_order int not null default 100;

alter table public.geo_regions
  add column if not exists sort_order int not null default 100,
  add column if not exists profile_enabled boolean not null default true;

-- Simdilik sadece TR profil konumunda secilebilir
update public.geo_countries set
  is_active = true,
  profile_enabled = (code = 'TR'),
  name = case when code = 'TR' then 'Türkiye' else name end,
  sort_order = case when code = 'TR' then 1 else 100 end
where code in ('TR', 'DE', 'US', 'GB');

insert into public.geo_countries (code, name, is_active, profile_enabled, sort_order)
values ('TR', 'Türkiye', true, true, 1)
on conflict (code) do update set
  name = excluded.name,
  profile_enabled = true,
  is_active = true,
  sort_order = 1;

-- Diger ulkeler profilden kapali (ilerde acilir)
update public.geo_countries
set profile_enabled = false
where code <> 'TR';

alter table public.profiles
  add column if not exists country_code text references public.geo_countries(code),
  add column if not exists region_id uuid references public.geo_regions(id) on delete set null;

create index if not exists profiles_country_code_idx on public.profiles (country_code);
create index if not exists profiles_region_id_idx on public.profiles (region_id);

-- Mevcut country metnini code'a cevir
update public.profiles
set country_code = 'TR'
where country_code is null
  and (
    upper(coalesce(country, '')) in ('TR', 'TURKEY', 'TÜRKIYE', 'TURKIYE')
    or country is null
  );

-- ---------------------------------------------------------------------------
-- TR 81 il → geo_regions (plate code)
-- ---------------------------------------------------------------------------
insert into public.geo_regions (country_code, code, name, is_active, profile_enabled, sort_order)
values
  ('TR','01','Adana', true, true, 1),
  ('TR','02','Adıyaman', true, true, 2),
  ('TR','03','Afyonkarahisar', true, true, 3),
  ('TR','04','Ağrı', true, true, 4),
  ('TR','05','Amasya', true, true, 5),
  ('TR','06','Ankara', true, true, 6),
  ('TR','07','Antalya', true, true, 7),
  ('TR','08','Artvin', true, true, 8),
  ('TR','09','Aydın', true, true, 9),
  ('TR','10','Balıkesir', true, true, 10),
  ('TR','11','Bilecik', true, true, 11),
  ('TR','12','Bingöl', true, true, 12),
  ('TR','13','Bitlis', true, true, 13),
  ('TR','14','Bolu', true, true, 14),
  ('TR','15','Burdur', true, true, 15),
  ('TR','16','Bursa', true, true, 16),
  ('TR','17','Çanakkale', true, true, 17),
  ('TR','18','Çankırı', true, true, 18),
  ('TR','19','Çorum', true, true, 19),
  ('TR','20','Denizli', true, true, 20),
  ('TR','21','Diyarbakır', true, true, 21),
  ('TR','22','Edirne', true, true, 22),
  ('TR','23','Elazığ', true, true, 23),
  ('TR','24','Erzincan', true, true, 24),
  ('TR','25','Erzurum', true, true, 25),
  ('TR','26','Eskişehir', true, true, 26),
  ('TR','27','Gaziantep', true, true, 27),
  ('TR','28','Giresun', true, true, 28),
  ('TR','29','Gümüşhane', true, true, 29),
  ('TR','30','Hakkari', true, true, 30),
  ('TR','31','Hatay', true, true, 31),
  ('TR','32','Isparta', true, true, 32),
  ('TR','33','Mersin', true, true, 33),
  ('TR','34','İstanbul', true, true, 34),
  ('TR','35','İzmir', true, true, 35),
  ('TR','36','Kars', true, true, 36),
  ('TR','37','Kastamonu', true, true, 37),
  ('TR','38','Kayseri', true, true, 38),
  ('TR','39','Kırklareli', true, true, 39),
  ('TR','40','Kırşehir', true, true, 40),
  ('TR','41','Kocaeli', true, true, 41),
  ('TR','42','Konya', true, true, 42),
  ('TR','43','Kütahya', true, true, 43),
  ('TR','44','Malatya', true, true, 44),
  ('TR','45','Manisa', true, true, 45),
  ('TR','46','Kahramanmaraş', true, true, 46),
  ('TR','47','Mardin', true, true, 47),
  ('TR','48','Muğla', true, true, 48),
  ('TR','49','Muş', true, true, 49),
  ('TR','50','Nevşehir', true, true, 50),
  ('TR','51','Niğde', true, true, 51),
  ('TR','52','Ordu', true, true, 52),
  ('TR','53','Rize', true, true, 53),
  ('TR','54','Sakarya', true, true, 54),
  ('TR','55','Samsun', true, true, 55),
  ('TR','56','Siirt', true, true, 56),
  ('TR','57','Sinop', true, true, 57),
  ('TR','58','Sivas', true, true, 58),
  ('TR','59','Tekirdağ', true, true, 59),
  ('TR','60','Tokat', true, true, 60),
  ('TR','61','Trabzon', true, true, 61),
  ('TR','62','Tunceli', true, true, 62),
  ('TR','63','Şanlıurfa', true, true, 63),
  ('TR','64','Uşak', true, true, 64),
  ('TR','65','Van', true, true, 65),
  ('TR','66','Yozgat', true, true, 66),
  ('TR','67','Zonguldak', true, true, 67),
  ('TR','68','Aksaray', true, true, 68),
  ('TR','69','Bayburt', true, true, 69),
  ('TR','70','Karaman', true, true, 70),
  ('TR','71','Kırıkkale', true, true, 71),
  ('TR','72','Batman', true, true, 72),
  ('TR','73','Şırnak', true, true, 73),
  ('TR','74','Bartın', true, true, 74),
  ('TR','75','Ardahan', true, true, 75),
  ('TR','76','Iğdır', true, true, 76),
  ('TR','77','Yalova', true, true, 77),
  ('TR','78','Karabük', true, true, 78),
  ('TR','79','Kilis', true, true, 79),
  ('TR','80','Osmaniye', true, true, 80),
  ('TR','81','Düzce', true, true, 81)
on conflict (country_code, code) do update set
  name = excluded.name,
  is_active = true,
  profile_enabled = true,
  sort_order = excluded.sort_order;

-- geo_cities TR isimlerini Turkce + region bagla (mevcut sehir savaslari icin)
update public.geo_cities c
set
  name = case c.slug
    when 'istanbul' then 'İstanbul'
    when 'ankara' then 'Ankara'
    when 'izmir' then 'İzmir'
    else c.name
  end,
  region_id = r.id
from public.geo_regions r
where c.country_code = 'TR'
  and r.country_code = 'TR'
  and (
    (c.slug = 'istanbul' and r.code = '34')
    or (c.slug = 'ankara' and r.code = '06')
    or (c.slug = 'izmir' and r.code = '35')
  );

-- ---------------------------------------------------------------------------
-- Profil konum listesi (sadece profile_enabled)
-- ---------------------------------------------------------------------------
create or replace function public.profil_konum_katalogu()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  return jsonb_build_object(
    'countries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', c.code,
        'name', c.name,
        'sort_order', c.sort_order
      ) order by c.sort_order, c.name)
      from public.geo_countries c
      where c.is_active and c.profile_enabled
    ), '[]'::jsonb),
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'country_code', r.country_code,
        'code', r.code,
        'name', r.name,
        'sort_order', r.sort_order
      ) order by r.sort_order, r.name)
      from public.geo_regions r
      join public.geo_countries c on c.code = r.country_code
      where r.is_active and r.profile_enabled
        and c.is_active and c.profile_enabled
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.profil_konum_katalogu() to authenticated;

-- ---------------------------------------------------------------------------
-- profil_guncelle: gender, birth_date, country_code, region_id
-- ---------------------------------------------------------------------------
drop function if exists public.profil_guncelle(text, text, text, text, boolean);

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
    v_country := upper(trim(p_country_code));
    if not exists (
      select 1 from public.geo_countries
      where code = v_country and is_active and profile_enabled
    ) then
      raise exception 'Bu ulke su an secilemez';
    end if;
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
    -- Ulke verilmediyse region'dan al
    if v_country is null then
      v_country := v_region_country;
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
    country = coalesce(v_country, country),
    region_id = case
      when p_clear_region then null
      when p_region_id is not null then v_region
      else region_id
    end,
    is_guest = false,
    updated_at = now()
  where id = v_uid
  returning * into v_row;

  if v_row.id is null then raise exception 'Profile not found'; end if;
  return v_row;
end;
$$;

grant execute on function public.profil_guncelle(
  text, text, text, text, boolean, text, date, boolean, text, uuid, boolean
) to authenticated;
