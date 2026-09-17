-- Fix: record "a" has no field "slogan"
-- 087 ajans_profil kolonlari remote'ta uygulanmamıs / fonksiyon eski rowtype ile kalmis olabilir.

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

-- Rowtype yeniden derlensin diye panel detayi recreate
create or replace function public.ajans_panel_detay(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.agencies%rowtype;
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_daily bigint;
  v_monthly bigint;
  v_ledger_toplam bigint;
  v_ledger_aylik bigint;
  v_sahip boolean;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  v_admin := public.ben_admin_miyim();

  select * into a from public.agencies where id = p_agency_id;
  if not found then raise exception 'Ajans bulunamadi'; end if;

  v_sahip := (a.owner_id = v_uid);
  if not v_admin and not v_sahip then
    raise exception 'Forbidden';
  end if;

  select coalesce(sum(coins), 0) into v_daily
  from public.agency_coin_transfers
  where agency_id = p_agency_id and status = 'completed'
    and created_at >= date_trunc('day', now());

  select coalesce(sum(coins), 0) into v_monthly
  from public.agency_coin_transfers
  where agency_id = p_agency_id and status = 'completed'
    and created_at >= date_trunc('month', now());

  select coalesce(sum(greatest(delta_diamonds, 0)), 0) into v_ledger_toplam
  from public.agency_earnings_ledger
  where agency_id = p_agency_id;

  select coalesce(sum(greatest(delta_diamonds, 0)), 0) into v_ledger_aylik
  from public.agency_earnings_ledger
  where agency_id = p_agency_id
    and created_at >= date_trunc('month', now());

  return jsonb_build_object(
    'ben_sahibiyim', v_sahip,
    'agency', jsonb_build_object(
      'id', a.id,
      'agency_public_id', a.agency_public_id,
      'name', a.name,
      'country', a.country,
      'status', a.status,
      'trust_tier', a.trust_tier,
      'level_code', a.level_code,
      'is_coin_distributor', a.is_coin_distributor,
      'host_count', a.host_count,
      'owner_id', a.owner_id,
      'invite_code', a.invite_code,
      'created_at', a.created_at,
      'description', a.description,
      'total_gifts', a.total_gifts,
      'monthly_score', a.monthly_score,
      'logo_url', a.logo_url,
      'banner_url', a.banner_url,
      'slogan', a.slogan,
      'website_url', a.website_url
    ),
    'owner', (
      select jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'username', p.username,
        'public_user_id', p.public_user_id,
        'avatar_url', p.avatar_url
      ) from public.profiles p where p.id = a.owner_id
    ),
    'wallet', (
      select jsonb_build_object(
        'distribution_balance', coalesce(w.distribution_balance, 0),
        'diamonds', coalesce(w.diamonds, 0),
        'updated_at', w.updated_at
      ) from public.agency_wallets w where w.agency_id = a.id
    ),
    'ciro', jsonb_build_object(
      'elmas_bakiye', coalesce((
        select w.diamonds from public.agency_wallets w where w.agency_id = a.id
      ), 0),
      'ledger_toplam', v_ledger_toplam,
      'ledger_aylik', v_ledger_aylik,
      'total_gifts', a.total_gifts,
      'monthly_score', a.monthly_score
    ),
    'limits', (
      select jsonb_build_object(
        'single_transfer_limit', l.single_transfer_limit,
        'daily_limit', l.daily_limit,
        'monthly_limit', l.monthly_limit,
        'per_user_limit', l.per_user_limit,
        'unlimited', coalesce(l.unlimited, false),
        'updated_at', l.updated_at
      ) from public.agency_transfer_limits l where l.agency_id = a.id
    ),
    'rules', (
      select jsonb_build_object(
        'body', coalesce(r.body, ''),
        'updated_at', r.updated_at
      ) from public.agency_rules r where r.agency_id = a.id
    ),
    'payment_template', (
      select jsonb_build_object(
        'account_holder', t.account_holder,
        'bank_name', t.bank_name,
        'iban', t.iban,
        'phone', t.phone,
        'note', t.note,
        'updated_at', t.updated_at
      ) from public.agency_payment_templates t where t.agency_id = a.id
    ),
    'kullanim', jsonb_build_object(
      'gunluk_transfer', v_daily,
      'aylik_transfer', v_monthly
    ),
    'uyeler', coalesce((
      select jsonb_agg(uye_row.obj order by uye_row.sort_name)
      from (
        select
          lower(coalesce(p.display_name, p.username, '')) as sort_name,
          jsonb_build_object(
            'user_id', hp.user_id,
            'display_name', p.display_name,
            'username', p.username,
            'public_user_id', p.public_user_id,
            'avatar_url', p.avatar_url,
            'status', hp.status,
            'joined_at', hp.joined_agency_at,
            'ses_dakika_toplam', coalesce((
              select floor(sum(
                extract(epoch from (
                  coalesce(r.ended_at, case when r.is_live then now() else r.created_at end)
                  - r.created_at
                )) / 60.0
              ))::bigint
              from public.rooms r where r.host_id = hp.user_id
            ), 0),
            'ses_dakika_ay', coalesce((
              select floor(sum(
                extract(epoch from (
                  coalesce(r.ended_at, case when r.is_live then now() else r.created_at end)
                  - r.created_at
                )) / 60.0
              ))::bigint
              from public.rooms r
              where r.host_id = hp.user_id
                and r.created_at >= date_trunc('month', now())
            ), 0),
            'yayin_dakika_toplam', coalesce((
              select floor(sum(
                extract(epoch from (
                  coalesce(ls.ended_at, case when ls.is_live then now() else ls.started_at end)
                  - ls.started_at
                )) / 60.0
              ))::bigint
              from public.live_sessions ls where ls.host_id = hp.user_id
            ), 0),
            'yayin_dakika_ay', coalesce((
              select floor(sum(
                extract(epoch from (
                  coalesce(ls.ended_at, case when ls.is_live then now() else ls.started_at end)
                  - ls.started_at
                )) / 60.0
              ))::bigint
              from public.live_sessions ls
              where ls.host_id = hp.user_id
                and ls.started_at >= date_trunc('month', now())
            ), 0),
            'yukleme_coin_toplam', coalesce((
              select sum(cp.coins_added)::bigint
              from public.coin_purchases cp
              where cp.user_id = hp.user_id and cp.status = 'completed'
            ), 0),
            'yukleme_coin_ay', coalesce((
              select sum(cp.coins_added)::bigint
              from public.coin_purchases cp
              where cp.user_id = hp.user_id and cp.status = 'completed'
                and cp.created_at >= date_trunc('month', now())
            ), 0),
            'kazanc_elmas_toplam', coalesce((
              select sum(gt.diamonds_earned)::bigint
              from public.gift_transactions gt where gt.receiver_id = hp.user_id
            ), coalesce(hp.gift_income_diamonds, 0)),
            'kazanc_elmas_ay', coalesce((
              select sum(gt.diamonds_earned)::bigint
              from public.gift_transactions gt
              where gt.receiver_id = hp.user_id
                and gt.created_at >= date_trunc('month', now())
            ), 0)
          ) as obj
        from public.host_profiles hp
        join public.profiles p on p.id = hp.user_id
        where hp.agency_id = p_agency_id and hp.status = 'agency'
      ) uye_row
    ), '[]'::jsonb),
    'bekleyen_host_basvurulari', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ha.id,
        'user_id', ha.user_id,
        'invite_code', ha.invite_code,
        'status', ha.status,
        'created_at', ha.created_at,
        'display_name', p.display_name,
        'username', p.username,
        'public_user_id', p.public_user_id,
        'avatar_url', p.avatar_url
      ) order by ha.created_at desc)
      from public.host_applications ha
      join public.profiles p on p.id = ha.user_id
      where ha.agency_id = p_agency_id and ha.status = 'agency_review'
    ), '[]'::jsonb),
    'son_transferler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'to_user_id', t.to_user_id,
        'coins', t.coins,
        'status', t.status,
        'created_at', t.created_at,
        'to_name', coalesce(tp.display_name, tp.username, left(t.to_user_id::text, 8)),
        'to_username', tp.username,
        'to_public_id', tp.public_user_id
      ) order by t.created_at desc)
      from (
        select * from public.agency_coin_transfers
        where agency_id = p_agency_id
        order by created_at desc
        limit 30
      ) t
      left join public.profiles tp on tp.id = t.to_user_id
    ), '[]'::jsonb),
    'bekleyen_basvurular', case when v_admin then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ap.id,
        'agency_name', ap.agency_name,
        'status', ap.status,
        'created_at', ap.created_at,
        'applicant_id', ap.applicant_id
      ) order by ap.created_at desc)
      from public.agency_applications ap
      where ap.status in ('pending', 'under_review')
      limit 20
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

grant execute on function public.ajans_panel_detay(uuid) to authenticated;

-- Profil getirme de ayni kolonlara bagli; rowtype yenilensin
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
