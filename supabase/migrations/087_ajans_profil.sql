-- Ajans public profil: liste istatistikleri, profil detay, sahip düzenleme

alter table public.agencies
  add column if not exists slogan text,
  add column if not exists website_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'agencies_slogan_len'
  ) then
    alter table public.agencies
      add constraint agencies_slogan_len
      check (slogan is null or char_length(slogan) <= 120);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'agencies_website_len'
  ) then
    alter table public.agencies
      add constraint agencies_website_len
      check (website_url is null or char_length(website_url) <= 200);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Popüler / keşif listesi (logo + özet istatistik)
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
-- Ziyaret edilebilir ajans profili
-- ---------------------------------------------------------------------------
create or replace function public.ajans_profil_getir(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.agencies%rowtype;
  v_uid uuid := auth.uid();
  v_uye int;
  v_toplam_coin bigint;
  v_haftalik_coin bigint;
  v_aylik_coin bigint;
  v_yayin_dk bigint;
  v_yayin_dk_ay bigint;
  v_ses_dk bigint;
  v_oyun_kazanc bigint;
  v_oyun_adet int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into a from public.agencies where id = p_agency_id;
  if not found then raise exception 'Ajans bulunamadi'; end if;
  if a.status = 'closed' and a.owner_id <> v_uid and not public.ben_admin_miyim() then
    raise exception 'Ajans kapali';
  end if;

  select count(*)::int into v_uye
  from public.host_profiles
  where agency_id = p_agency_id and status = 'agency';

  select coalesce(sum(gt.coins_spent), 0)::bigint into v_toplam_coin
  from public.gift_transactions gt
  join public.host_profiles hp on hp.user_id = gt.receiver_id
  where hp.agency_id = p_agency_id and hp.status = 'agency';

  select coalesce(sum(gt.coins_spent), 0)::bigint into v_haftalik_coin
  from public.gift_transactions gt
  join public.host_profiles hp on hp.user_id = gt.receiver_id
  where hp.agency_id = p_agency_id and hp.status = 'agency'
    and gt.created_at >= now() - interval '7 days';

  select coalesce(sum(gt.coins_spent), 0)::bigint into v_aylik_coin
  from public.gift_transactions gt
  join public.host_profiles hp on hp.user_id = gt.receiver_id
  where hp.agency_id = p_agency_id and hp.status = 'agency'
    and gt.created_at >= date_trunc('month', now());

  select coalesce(floor(sum(
    extract(epoch from (
      coalesce(ls.ended_at, case when ls.is_live then now() else ls.started_at end)
      - ls.started_at
    )) / 60.0
  )), 0)::bigint into v_yayin_dk
  from public.live_sessions ls
  join public.host_profiles hp on hp.user_id = ls.host_id
  where hp.agency_id = p_agency_id and hp.status = 'agency';

  select coalesce(floor(sum(
    extract(epoch from (
      coalesce(ls.ended_at, case when ls.is_live then now() else ls.started_at end)
      - ls.started_at
    )) / 60.0
  )), 0)::bigint into v_yayin_dk_ay
  from public.live_sessions ls
  join public.host_profiles hp on hp.user_id = ls.host_id
  where hp.agency_id = p_agency_id and hp.status = 'agency'
    and ls.started_at >= date_trunc('month', now());

  select coalesce(floor(sum(
    extract(epoch from (
      coalesce(r.ended_at, case when r.is_live then now() else r.created_at end)
      - r.created_at
    )) / 60.0
  )), 0)::bigint into v_ses_dk
  from public.rooms r
  join public.host_profiles hp on hp.user_id = r.host_id
  where hp.agency_id = p_agency_id and hp.status = 'agency';

  select
    coalesce(sum(gsp.coin_reward), 0)::bigint,
    coalesce(count(*), 0)::int
  into v_oyun_kazanc, v_oyun_adet
  from public.game_session_players gsp
  join public.host_profiles hp on hp.user_id = gsp.user_id
  where hp.agency_id = p_agency_id and hp.status = 'agency';

  return jsonb_build_object(
    'agency', jsonb_build_object(
      'id', a.id,
      'agency_public_id', a.agency_public_id,
      'name', a.name,
      'logo_url', a.logo_url,
      'banner_url', a.banner_url,
      'slogan', a.slogan,
      'website_url', a.website_url,
      'country', a.country,
      'description', a.description,
      'level_code', a.level_code,
      'host_count', a.host_count,
      'total_gifts', a.total_gifts,
      'monthly_score', a.monthly_score,
      'trust_tier', a.trust_tier,
      'is_coin_distributor', a.is_coin_distributor,
      'status', a.status,
      'owner_id', a.owner_id,
      'invite_code', case
        when a.owner_id = v_uid or public.ben_admin_miyim() then a.invite_code
        else null
      end,
      'created_at', a.created_at
    ),
    'owner', (
      select jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'username', p.username,
        'avatar_url', p.avatar_url,
        'public_user_id', p.public_user_id
      ) from public.profiles p where p.id = a.owner_id
    ),
    'ben_sahibiyim', (a.owner_id = v_uid),
    'istatistik', jsonb_build_object(
      'uye_sayisi', v_uye,
      'toplam_coin', v_toplam_coin,
      'haftalik_coin', v_haftalik_coin,
      'aylik_coin', v_aylik_coin,
      'yayin_dakika_toplam', v_yayin_dk,
      'yayin_dakika_ay', v_yayin_dk_ay,
      'ses_dakika_toplam', v_ses_dk,
      'oyun_kazanc_coin', v_oyun_kazanc,
      'oyun_oturum', v_oyun_adet
    ),
    'yayincilar', coalesce((
      select jsonb_agg(y.obj order by y.sort_kazanc desc)
      from (
        select
          coalesce((
            select sum(gt.diamonds_earned)::bigint
            from public.gift_transactions gt
            where gt.receiver_id = hp.user_id
          ), 0) as sort_kazanc,
          jsonb_build_object(
            'user_id', hp.user_id,
            'display_name', p.display_name,
            'username', p.username,
            'avatar_url', p.avatar_url,
            'public_user_id', p.public_user_id,
            'joined_at', hp.joined_agency_at,
            'yayin_dakika', coalesce((
              select floor(sum(
                extract(epoch from (
                  coalesce(ls.ended_at, case when ls.is_live then now() else ls.started_at end)
                  - ls.started_at
                )) / 60.0
              ))::bigint
              from public.live_sessions ls
              where ls.host_id = hp.user_id
            ), 0),
            'ses_dakika', coalesce((
              select floor(sum(
                extract(epoch from (
                  coalesce(r.ended_at, case when r.is_live then now() else r.created_at end)
                  - r.created_at
                )) / 60.0
              ))::bigint
              from public.rooms r
              where r.host_id = hp.user_id
            ), 0),
            'kazanc_elmas', coalesce((
              select sum(gt.diamonds_earned)::bigint
              from public.gift_transactions gt
              where gt.receiver_id = hp.user_id
            ), coalesce(hp.gift_income_diamonds, 0)),
            'haftalik_coin', coalesce((
              select sum(gt.coins_spent)::bigint
              from public.gift_transactions gt
              where gt.receiver_id = hp.user_id
                and gt.created_at >= now() - interval '7 days'
            ), 0),
            'oyun_kazanc_coin', coalesce((
              select sum(gsp.coin_reward)::bigint
              from public.game_session_players gsp
              where gsp.user_id = hp.user_id
            ), 0),
            'oyun_oturum', coalesce((
              select count(*)::int
              from public.game_session_players gsp
              where gsp.user_id = hp.user_id
            ), 0)
          ) as obj
        from public.host_profiles hp
        join public.profiles p on p.id = hp.user_id
        where hp.agency_id = p_agency_id and hp.status = 'agency'
        limit 50
      ) y
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.ajans_profil_getir(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Sahip: profil bilgileri + logo/banner URL güncelle
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
