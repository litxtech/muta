-- Giriş lobisi CMS: arka plan medya + metin/logo (build gerekmez)

-- ---------------------------------------------------------------------------
-- Ayarlar (tek satır)
-- ---------------------------------------------------------------------------
create table if not exists public.giris_lobisi_ayar (
  id smallint primary key default 1 check (id = 1),
  logo_goster boolean not null default false,
  logo_url text,
  logo_harf text default 'M',
  marka_goster boolean not null default false,
  marka_adi text,
  slogan_goster boolean not null default false,
  slogan text,
  form_baslik text not null default 'Giriş',
  form_alt text,
  ust_metin text,
  guncelleyen uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.giris_lobisi_ayar (id)
values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Medya (video / resim) — aktif olanlar lobide döner; yoksa modern gradient
-- ---------------------------------------------------------------------------
create table if not exists public.giris_lobisi_medya (
  id uuid primary key default gen_random_uuid(),
  tur text not null check (tur in ('video', 'image')),
  public_url text not null,
  storage_path text,
  mime_type text,
  aktif boolean not null default true,
  sira integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create index if not exists giris_lobisi_medya_aktif_idx
  on public.giris_lobisi_medya (aktif, sira, created_at desc);

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'giris-lobisi-media',
  'giris-lobisi-media',
  true,
  52428800,
  array[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Giris lobisi media public read" on storage.objects;
create policy "Giris lobisi media public read"
  on storage.objects for select to public
  using (bucket_id = 'giris-lobisi-media');

drop policy if exists "Giris lobisi media admin upload" on storage.objects;
create policy "Giris lobisi media admin upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'giris-lobisi-media'
    and public.ben_admin_miyim()
  );

drop policy if exists "Giris lobisi media admin update" on storage.objects;
create policy "Giris lobisi media admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'giris-lobisi-media' and public.ben_admin_miyim())
  with check (bucket_id = 'giris-lobisi-media' and public.ben_admin_miyim());

drop policy if exists "Giris lobisi media admin delete" on storage.objects;
create policy "Giris lobisi media admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'giris-lobisi-media' and public.ben_admin_miyim());

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.giris_lobisi_ayar enable row level security;
alter table public.giris_lobisi_medya enable row level security;

drop policy if exists "Giris lobisi ayar public read" on public.giris_lobisi_ayar;
create policy "Giris lobisi ayar public read"
  on public.giris_lobisi_ayar for select to public
  using (true);

drop policy if exists "Giris lobisi ayar admin write" on public.giris_lobisi_ayar;
create policy "Giris lobisi ayar admin write"
  on public.giris_lobisi_ayar for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

drop policy if exists "Giris lobisi medya public read" on public.giris_lobisi_medya;
create policy "Giris lobisi medya public read"
  on public.giris_lobisi_medya for select to public
  using (aktif = true);

drop policy if exists "Giris lobisi medya admin all" on public.giris_lobisi_medya;
create policy "Giris lobisi medya admin all"
  on public.giris_lobisi_medya for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

-- ---------------------------------------------------------------------------
-- Public get (login ekranı — anon dahil)
-- ---------------------------------------------------------------------------
create or replace function public.giris_lobisi_public_get()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ayar public.giris_lobisi_ayar%rowtype;
  v_medya jsonb;
begin
  select * into v_ayar from public.giris_lobisi_ayar where id = 1;
  if not found then
    insert into public.giris_lobisi_ayar (id) values (1)
    returning * into v_ayar;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'tur', m.tur,
      'public_url', m.public_url,
      'sira', m.sira,
      'created_at', m.created_at
    )
    order by m.sira asc, m.created_at desc
  ), '[]'::jsonb)
  into v_medya
  from public.giris_lobisi_medya m
  where m.aktif = true;

  return jsonb_build_object(
    'ayar', jsonb_build_object(
      'logo_goster', v_ayar.logo_goster,
      'logo_url', v_ayar.logo_url,
      'logo_harf', coalesce(nullif(trim(v_ayar.logo_harf), ''), 'M'),
      'marka_goster', v_ayar.marka_goster,
      'marka_adi', v_ayar.marka_adi,
      'slogan_goster', v_ayar.slogan_goster,
      'slogan', v_ayar.slogan,
      'form_baslik', coalesce(nullif(trim(v_ayar.form_baslik), ''), 'Giriş'),
      'form_alt', v_ayar.form_alt,
      'ust_metin', v_ayar.ust_metin,
      'updated_at', v_ayar.updated_at
    ),
    'medya', v_medya
  );
end;
$$;

revoke all on function public.giris_lobisi_public_get() from public;
grant execute on function public.giris_lobisi_public_get() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin: ayar güncelle
-- ---------------------------------------------------------------------------
create or replace function public.admin_giris_lobisi_ayar_guncelle(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.giris_lobisi_ayar%rowtype;
begin
  if v_uid is null or not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  insert into public.giris_lobisi_ayar (id) values (1)
  on conflict (id) do nothing;

  update public.giris_lobisi_ayar set
    logo_goster = coalesce((p_payload->>'logo_goster')::boolean, logo_goster),
    logo_url = case
      when p_payload ? 'logo_url' then nullif(trim(p_payload->>'logo_url'), '')
      else logo_url
    end,
    logo_harf = coalesce(nullif(trim(p_payload->>'logo_harf'), ''), logo_harf),
    marka_goster = coalesce((p_payload->>'marka_goster')::boolean, marka_goster),
    marka_adi = case
      when p_payload ? 'marka_adi' then nullif(trim(p_payload->>'marka_adi'), '')
      else marka_adi
    end,
    slogan_goster = coalesce((p_payload->>'slogan_goster')::boolean, slogan_goster),
    slogan = case
      when p_payload ? 'slogan' then nullif(trim(p_payload->>'slogan'), '')
      else slogan
    end,
    form_baslik = coalesce(
      nullif(trim(p_payload->>'form_baslik'), ''),
      form_baslik,
      'Giriş'
    ),
    form_alt = case
      when p_payload ? 'form_alt' then nullif(trim(p_payload->>'form_alt'), '')
      else form_alt
    end,
    ust_metin = case
      when p_payload ? 'ust_metin' then nullif(trim(p_payload->>'ust_metin'), '')
      else ust_metin
    end,
    guncelleyen = v_uid,
    updated_at = now()
  where id = 1
  returning * into v_row;

  return public.giris_lobisi_public_get();
end;
$$;

revoke all on function public.admin_giris_lobisi_ayar_guncelle(jsonb) from public;
grant execute on function public.admin_giris_lobisi_ayar_guncelle(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: medya ekle (yeni video/resim → önceki medyayı kaldırır, anında aktif)
-- ---------------------------------------------------------------------------
create or replace function public.admin_giris_lobisi_medya_ekle(
  p_tur text,
  p_public_url text,
  p_storage_path text default null,
  p_mime_type text default null,
  p_eskiyi_sil boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null or not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  if p_tur not in ('video', 'image') then
    raise exception 'Invalid tur';
  end if;
  if nullif(trim(p_public_url), '') is null then
    raise exception 'public_url required';
  end if;

  if coalesce(p_eskiyi_sil, true) then
    delete from public.giris_lobisi_medya where aktif = true;
  end if;

  insert into public.giris_lobisi_medya (
    tur, public_url, storage_path, mime_type, aktif, sira, created_by
  ) values (
    p_tur,
    trim(p_public_url),
    nullif(trim(coalesce(p_storage_path, '')), ''),
    nullif(trim(coalesce(p_mime_type, '')), ''),
    true,
    0,
    v_uid
  )
  returning id into v_id;

  return public.giris_lobisi_public_get() || jsonb_build_object('eklenen_id', v_id);
end;
$$;

revoke all on function public.admin_giris_lobisi_medya_ekle(text, text, text, text, boolean) from public;
grant execute on function public.admin_giris_lobisi_medya_ekle(text, text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: medya sil
-- ---------------------------------------------------------------------------
create or replace function public.admin_giris_lobisi_medya_sil(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  delete from public.giris_lobisi_medya where id = p_id;

  return public.giris_lobisi_public_get();
end;
$$;

revoke all on function public.admin_giris_lobisi_medya_sil(uuid) from public;
grant execute on function public.admin_giris_lobisi_medya_sil(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: tüm medyayı sil (modern arka plan)
-- ---------------------------------------------------------------------------
create or replace function public.admin_giris_lobisi_medya_hepsini_sil()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  delete from public.giris_lobisi_medya;

  return public.giris_lobisi_public_get();
end;
$$;

revoke all on function public.admin_giris_lobisi_medya_hepsini_sil() from public;
grant execute on function public.admin_giris_lobisi_medya_hepsini_sil() to authenticated;

-- Admin liste (pasif dahil)
create or replace function public.admin_giris_lobisi_get()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ayar jsonb;
  v_medya jsonb;
begin
  if auth.uid() is null or not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  select to_jsonb(a) into v_ayar
  from public.giris_lobisi_ayar a where id = 1;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.aktif desc, m.sira, m.created_at desc), '[]'::jsonb)
  into v_medya
  from public.giris_lobisi_medya m;

  return jsonb_build_object('ayar', coalesce(v_ayar, '{}'::jsonb), 'medya', v_medya);
end;
$$;

revoke all on function public.admin_giris_lobisi_get() from public;
grant execute on function public.admin_giris_lobisi_get() to authenticated;
