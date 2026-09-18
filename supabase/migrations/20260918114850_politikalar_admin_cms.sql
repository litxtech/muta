-- Politikalar CMS: admin CRUD, kayıt/giriş görünürlüğü, medya, slug

-- ---------------------------------------------------------------------------
-- 1) Kolonlar
-- ---------------------------------------------------------------------------
alter table public.policies
  add column if not exists link_label text,
  add column if not exists consent_label text,
  add column if not exists show_on_register boolean not null default false,
  add column if not exists show_on_login boolean not null default false,
  add column if not exists sort_order int not null default 0,
  add column if not exists updated_at timestamptz not null default now();

comment on column public.policies.link_label is
  'Giriş formu altındaki tıklanabilir kısa ad';
comment on column public.policies.consent_label is
  'Kayıt onay kutusunda görünen metin';

-- Mevcut 3 politika: kayıt + girişte göster
update public.policies set
  show_on_register = true,
  show_on_login = true,
  link_label = case code
    when 'tos' then 'Kullanım Şartları'
    when 'privacy' then 'Gizlilik'
    when 'child_safety' then 'Çocuk Koruma'
    else coalesce(link_label, title)
  end,
  consent_label = case code
    when 'tos' then 'Kullanım Şartları’nı okudum ve kabul ediyorum'
    when 'privacy' then 'Gizlilik Politikası’nı okudum ve kabul ediyorum'
    when 'child_safety' then 'Çocuk Koruma Politikası’nı okudum ve kabul ediyorum'
    else coalesce(consent_label, title || ' metnini okudum ve kabul ediyorum')
  end,
  sort_order = case code
    when 'tos' then 10
    when 'privacy' then 20
    when 'child_safety' then 30
    else sort_order
  end,
  updated_at = now()
where code in ('tos', 'privacy', 'child_safety');

-- ---------------------------------------------------------------------------
-- 2) Slug yardımcısı
-- ---------------------------------------------------------------------------
create or replace function public.politika_slug_uret(p_title text)
returns text
language plpgsql
volatile
as $$
declare
  v text := lower(trim(coalesce(p_title, '')));
begin
  v := translate(v,
    'çğıöşüâêîôûáéíóúàèìòùäëïöüÿñ',
    'cgiosuaeiouaeiouaeiouaeiouyn');
  v := regexp_replace(v, '[^a-z0-9]+', '-', 'g');
  v := regexp_replace(v, '^-+|-+$', '', 'g');
  if v is null or v = '' then
    v := 'politika-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  end if;
  return left(v, 64);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'policy-media',
  'policy-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "policy_media_public_read" on storage.objects;
create policy "policy_media_public_read" on storage.objects
  for select to public
  using (bucket_id = 'policy-media');

drop policy if exists "policy_media_admin_write" on storage.objects;
create policy "policy_media_admin_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'policy-media' and public.ben_admin_miyim())
  with check (bucket_id = 'policy-media' and public.ben_admin_miyim());

-- ---------------------------------------------------------------------------
-- 4) Public liste (anon + authenticated)
-- ---------------------------------------------------------------------------
create or replace function public.politikalari_listele(p_yer text default 'all')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order, x.title), '[]'::jsonb)
  into v_rows
  from (
    select
      p.code,
      p.title,
      p.description,
      p.is_required,
      p.is_active,
      p.link_label,
      p.consent_label,
      p.show_on_register,
      p.show_on_login,
      p.sort_order,
      v.id as version_id,
      v.version,
      v.body_md,
      v.published_at
    from public.policies p
    left join lateral (
      select pv.*
      from public.policy_versions pv
      where pv.policy_code = p.code
      order by pv.version desc
      limit 1
    ) v on true
    where p.is_active = true
      and (
        p_yer = 'all'
        or (p_yer = 'register' and p.show_on_register)
        or (p_yer = 'login' and p.show_on_login)
      )
  ) x;

  return v_rows;
end;
$$;

create or replace function public.politika_getir(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  select to_jsonb(x) into v
  from (
    select
      p.code,
      p.title,
      p.description,
      p.is_required,
      p.is_active,
      p.link_label,
      p.consent_label,
      p.show_on_register,
      p.show_on_login,
      p.sort_order,
      v.id as version_id,
      v.version,
      v.body_md,
      v.published_at
    from public.policies p
    left join lateral (
      select pv.*
      from public.policy_versions pv
      where pv.policy_code = p.code
      order by pv.version desc
      limit 1
    ) v on true
    where p.code = p_code
      and p.is_active = true
  ) x;

  return v;
end;
$$;

revoke all on function public.politikalari_listele(text) from public;
revoke all on function public.politika_getir(text) from public;
grant execute on function public.politikalari_listele(text) to anon, authenticated;
grant execute on function public.politika_getir(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Admin RPCs
-- ---------------------------------------------------------------------------
create or replace function public.admin_politika_listele()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order, x.title), '[]'::jsonb)
  into v
  from (
    select
      p.code,
      p.title,
      p.description,
      p.is_required,
      p.is_active,
      p.link_label,
      p.consent_label,
      p.show_on_register,
      p.show_on_login,
      p.sort_order,
      p.created_at,
      p.updated_at,
      v.id as version_id,
      v.version,
      v.body_md,
      v.published_at,
      length(coalesce(v.body_md, '')) as body_len
    from public.policies p
    left join lateral (
      select pv.*
      from public.policy_versions pv
      where pv.policy_code = p.code
      order by pv.version desc
      limit 1
    ) v on true
  ) x;

  return v;
end;
$$;

create or replace function public.admin_politika_olustur(
  p_title text,
  p_code text default null,
  p_description text default null,
  p_link_label text default null,
  p_consent_label text default null,
  p_show_on_register boolean default false,
  p_show_on_login boolean default false,
  p_is_required boolean default true,
  p_body_md text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_base text;
  v_i int := 0;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Başlık gerekli';
  end if;

  v_base := coalesce(nullif(trim(p_code), ''), public.politika_slug_uret(p_title));
  v_code := v_base;
  while exists (select 1 from public.policies where code = v_code) loop
    v_i := v_i + 1;
    v_code := left(v_base, 56) || '-' || v_i::text;
  end loop;

  insert into public.policies (
    code, title, description, is_required, is_active,
    link_label, consent_label, show_on_register, show_on_login, sort_order
  ) values (
    v_code,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_is_required, true),
    true,
    coalesce(nullif(trim(p_link_label), ''), trim(p_title)),
    coalesce(
      nullif(trim(p_consent_label), ''),
      trim(p_title) || ' metnini okudum ve kabul ediyorum'
    ),
    coalesce(p_show_on_register, false),
    coalesce(p_show_on_login, false),
    coalesce((select max(sort_order) + 10 from public.policies), 100)
  );

  insert into public.policy_versions (policy_code, version, body_md)
  values (v_code, 1, coalesce(p_body_md, ''));

  return public.politika_getir(v_code);
end;
$$;

create or replace function public.admin_politika_guncelle(
  p_code text,
  p_title text default null,
  p_description text default null,
  p_link_label text default null,
  p_consent_label text default null,
  p_show_on_register boolean default null,
  p_show_on_login boolean default null,
  p_is_required boolean default null,
  p_is_active boolean default null,
  p_sort_order int default null,
  p_body_md text default null,
  p_yeni_surum boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ver int;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  if not exists (select 1 from public.policies where code = p_code) then
    raise exception 'Politika bulunamadı';
  end if;

  update public.policies set
    title = coalesce(nullif(trim(p_title), ''), title),
    description = case
      when p_description is null then description
      else nullif(trim(p_description), '')
    end,
    link_label = case
      when p_link_label is null then link_label
      else nullif(trim(p_link_label), '')
    end,
    consent_label = case
      when p_consent_label is null then consent_label
      else nullif(trim(p_consent_label), '')
    end,
    show_on_register = coalesce(p_show_on_register, show_on_register),
    show_on_login = coalesce(p_show_on_login, show_on_login),
    is_required = coalesce(p_is_required, is_required),
    is_active = coalesce(p_is_active, is_active),
    sort_order = coalesce(p_sort_order, sort_order),
    updated_at = now()
  where code = p_code;

  if p_body_md is not null then
    if coalesce(p_yeni_surum, true) then
      select coalesce(max(version), 0) + 1 into v_ver
      from public.policy_versions where policy_code = p_code;
      insert into public.policy_versions (policy_code, version, body_md)
      values (p_code, v_ver, p_body_md);
    else
      update public.policy_versions pv set
        body_md = p_body_md,
        published_at = now()
      where pv.id = (
        select id from public.policy_versions
        where policy_code = p_code
        order by version desc limit 1
      );
    end if;
  end if;

  return (
    select to_jsonb(x) from (
      select
        p.*,
        v.id as version_id,
        v.version,
        v.body_md,
        v.published_at
      from public.policies p
      left join lateral (
        select pv.* from public.policy_versions pv
        where pv.policy_code = p.code
        order by pv.version desc limit 1
      ) v on true
      where p.code = p_code
    ) x
  );
end;
$$;

create or replace function public.admin_politika_sil(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  update public.policies set
    is_active = false,
    show_on_register = false,
    show_on_login = false,
    updated_at = now()
  where code = p_code;
  if not found then
    raise exception 'Politika bulunamadı';
  end if;
  return true;
end;
$$;

revoke all on function public.admin_politika_listele() from public;
revoke all on function public.admin_politika_olustur(text, text, text, text, text, boolean, boolean, boolean, text) from public;
revoke all on function public.admin_politika_guncelle(text, text, text, text, text, boolean, boolean, boolean, boolean, int, text, boolean) from public;
revoke all on function public.admin_politika_sil(text) from public;

grant execute on function public.admin_politika_listele() to authenticated;
grant execute on function public.admin_politika_olustur(text, text, text, text, text, boolean, boolean, boolean, text) to authenticated;
grant execute on function public.admin_politika_guncelle(text, text, text, text, text, boolean, boolean, boolean, boolean, int, text, boolean) to authenticated;
grant execute on function public.admin_politika_sil(text) to authenticated;
