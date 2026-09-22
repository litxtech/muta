-- ajans_profil_getir: username + is_verified alanları (X-tarzı profil)
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
      'username', a.username,
      'is_verified', coalesce(a.is_verified, false),
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
