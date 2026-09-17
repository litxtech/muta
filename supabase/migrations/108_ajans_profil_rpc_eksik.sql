-- Fix: local 087_ajans_profil.sql remote'ta uygulanmadi
-- (remote 087 = kaskad_admin_operasyon). ajans_profil_getir 095 ile geldi;
-- ajans_listesi_modern + ajans_profil_guncelle hic olusmadi.
-- Sonuc: logo/banner kaydi PGRST202 "Could not find the ... function in the schema cache".

-- ---------------------------------------------------------------------------
-- Popüler / keşif listesi
-- ---------------------------------------------------------------------------
create or replace function public.ajans_listesi_modern(p_limit int default 40)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 40), 1), 80);
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb)
    from (
      select
        a.id,
        a.agency_public_id,
        a.name,
        a.logo_url,
        a.banner_url,
        a.slogan,
        a.country,
        a.description,
        a.level_code,
        a.host_count,
        a.total_gifts,
        a.monthly_score,
        a.trust_tier,
        a.is_coin_distributor,
        a.status,
        a.owner_id,
        coalesce((
          select count(*)::int
          from public.host_profiles hp
          where hp.agency_id = a.id and hp.status = 'agency'
        ), 0) as uye_sayisi,
        coalesce((
          select sum(gt.coins_spent)::bigint
          from public.gift_transactions gt
          join public.host_profiles hp on hp.user_id = gt.receiver_id
          where hp.agency_id = a.id and hp.status = 'agency'
            and gt.created_at >= now() - interval '7 days'
        ), 0) as haftalik_coin,
        coalesce((
          select sum(gt.coins_spent)::bigint
          from public.gift_transactions gt
          join public.host_profiles hp on hp.user_id = gt.receiver_id
          where hp.agency_id = a.id and hp.status = 'agency'
        ), 0) as toplam_coin
      from public.agencies a
      where a.status = 'active'
      order by a.monthly_score desc nulls last, a.host_count desc, a.created_at desc
      limit v_limit
    ) x
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.ajans_listesi_modern(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Sahip: profil + logo/banner URL
-- ---------------------------------------------------------------------------
create or replace function public.ajans_profil_guncelle(
  p_agency_id uuid,
  p_name text default null,
  p_description text default null,
  p_slogan text default null,
  p_country text default null,
  p_website_url text default null,
  p_logo_url text default null,
  p_banner_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  a public.agencies%rowtype;
  v_name text;
  v_desc text;
  v_slogan text;
  v_country text;
  v_web text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into a from public.agencies where id = p_agency_id for update;
  if not found then raise exception 'Ajans bulunamadi'; end if;
  if a.owner_id <> v_uid and not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;
  if a.status = 'closed' then raise exception 'Ajans kapali'; end if;

  if p_name is not null then
    v_name := trim(p_name);
    if char_length(v_name) < 3 then raise exception 'Ajans adi en az 3 karakter'; end if;
    if char_length(v_name) > 60 then raise exception 'Ajans adi cok uzun'; end if;
  end if;

  if p_description is not null then
    v_desc := trim(p_description);
    if char_length(v_desc) > 2000 then raise exception 'Aciklama cok uzun'; end if;
  end if;

  if p_slogan is not null then
    v_slogan := nullif(trim(p_slogan), '');
    if v_slogan is not null and char_length(v_slogan) > 120 then
      raise exception 'Slogan cok uzun';
    end if;
  end if;

  if p_country is not null then
    v_country := nullif(trim(p_country), '');
  end if;

  if p_website_url is not null then
    v_web := nullif(trim(p_website_url), '');
    if v_web is not null and char_length(v_web) > 200 then
      raise exception 'Website cok uzun';
    end if;
  end if;

  update public.agencies set
    name = coalesce(v_name, name),
    description = case when p_description is null then description else v_desc end,
    slogan = case when p_slogan is null then slogan else v_slogan end,
    country = case when p_country is null then country else v_country end,
    website_url = case when p_website_url is null then website_url else v_web end,
    logo_url = case
      when p_logo_url is null then logo_url
      when trim(p_logo_url) = '' then null
      else trim(p_logo_url)
    end,
    banner_url = case
      when p_banner_url is null then banner_url
      when trim(p_banner_url) = '' then null
      else trim(p_banner_url)
    end,
    updated_at = now()
  where id = p_agency_id
  returning * into a;

  return jsonb_build_object(
    'ok', true,
    'agency', jsonb_build_object(
      'id', a.id,
      'name', a.name,
      'logo_url', a.logo_url,
      'banner_url', a.banner_url,
      'slogan', a.slogan,
      'description', a.description,
      'country', a.country,
      'website_url', a.website_url
    )
  );
end;
$$;

grant execute on function public.ajans_profil_guncelle(uuid, text, text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage RLS: yaptirim fonksiyonunu sema ile nitelendir
-- (storage search_path altinda unqualified cozumleme hatasini onler)
-- ---------------------------------------------------------------------------
drop policy if exists "Profile media own upload" on storage.objects;
create policy "Profile media own upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.kullanici_yaptirim_aktif_mi(auth.uid(), 'upload_ban')
  );

drop policy if exists "Profile media own update" on storage.objects;
create policy "Profile media own update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.kullanici_yaptirim_aktif_mi(auth.uid(), 'upload_ban')
  );

drop policy if exists "Status media own upload" on storage.objects;
create policy "Status media own upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'status-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.kullanici_yaptirim_aktif_mi(auth.uid(), 'upload_ban')
  );

drop policy if exists "Status media own update" on storage.objects;
create policy "Status media own update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'status-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.kullanici_yaptirim_aktif_mi(auth.uid(), 'upload_ban')
  );

drop policy if exists "DM media insert" on storage.objects;
create policy "DM media insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'dm-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.kullanici_yaptirim_aktif_mi(auth.uid(), 'upload_ban')
  );

drop policy if exists "DM media update own" on storage.objects;
create policy "DM media update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'dm-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not public.kullanici_yaptirim_aktif_mi(auth.uid(), 'upload_ban')
  );

notify pgrst, 'reload schema';
