-- Admin anlik ciro: gun / hafta / ay / toplam + kimden + realtime

alter table public.coin_purchases
  add column if not exists amount_try numeric(12,2);

-- Paketten TRY doldur (eksik kayitlar)
update public.coin_purchases cp
set amount_try = pkg.price_try
from public.coin_packages pkg
where cp.package_id = pkg.id
  and cp.amount_try is null
  and pkg.price_try is not null;

do $$
begin
  begin
    alter publication supabase_realtime add table public.coin_purchases;
  exception when duplicate_object then null;
  end;
end $$;

alter table public.coin_purchases replica identity full;

-- TRY tutari: amount_try > paket price_try > amount_usd * 35
create or replace function public.ciro_try_hesapla(
  p_amount_try numeric,
  p_package_id uuid,
  p_amount_usd numeric
)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(p_amount_try, 0),
    (select price_try from public.coin_packages where id = p_package_id),
    case when p_amount_usd is not null then round(p_amount_usd * 35, 2) else 0 end,
    0
  )::numeric;
$$;

create or replace function public.admin_ciro_ozeti(
  p_period text default 'today',
  p_limit int default 80
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := lower(trim(coalesce(p_period, 'today')));
  v_limit int := least(greatest(coalesce(p_limit, 80), 1), 200);
  v_start timestamptz;
  v_end timestamptz := now();
  v_ozet jsonb;
  v_islemler jsonb;
  v_kimden jsonb;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  if v_period in ('day', 'gun', 'today', 'bugun') then
    v_period := 'today';
    v_start := date_trunc('day', timezone('Europe/Istanbul', now())) at time zone 'Europe/Istanbul';
  elsif v_period in ('week', 'hafta') then
    v_period := 'week';
    v_start := date_trunc('week', timezone('Europe/Istanbul', now())) at time zone 'Europe/Istanbul';
  elsif v_period in ('month', 'ay') then
    v_period := 'month';
    v_start := date_trunc('month', timezone('Europe/Istanbul', now())) at time zone 'Europe/Istanbul';
  else
    v_period := 'all';
    v_start := '1970-01-01'::timestamptz;
  end if;

  select jsonb_build_object(
    'today', jsonb_build_object(
      'try', coalesce((
        select sum(public.ciro_try_hesapla(cp.amount_try, cp.package_id, cp.amount_usd))
        from public.coin_purchases cp
        where coalesce(cp.status, 'completed') = 'completed'
          and cp.created_at >= date_trunc('day', timezone('Europe/Istanbul', now())) at time zone 'Europe/Istanbul'
      ), 0),
      'coins', coalesce((
        select sum(cp.coins_added)::bigint
        from public.coin_purchases cp
        where coalesce(cp.status, 'completed') = 'completed'
          and cp.created_at >= date_trunc('day', timezone('Europe/Istanbul', now())) at time zone 'Europe/Istanbul'
      ), 0),
      'adet', coalesce((
        select count(*)::bigint
        from public.coin_purchases cp
        where coalesce(cp.status, 'completed') = 'completed'
          and cp.created_at >= date_trunc('day', timezone('Europe/Istanbul', now())) at time zone 'Europe/Istanbul'
      ), 0)
    ),
    'week', jsonb_build_object(
      'try', coalesce((
        select sum(public.ciro_try_hesapla(cp.amount_try, cp.package_id, cp.amount_usd))
        from public.coin_purchases cp
        where coalesce(cp.status, 'completed') = 'completed'
          and cp.created_at >= date_trunc('week', timezone('Europe/Istanbul', now())) at time zone 'Europe/Istanbul'
      ), 0),
      'coins', coalesce((
        select sum(cp.coins_added)::bigint
        from public.coin_purchases cp
        where coalesce(cp.status, 'completed') = 'completed'
          and cp.created_at >= date_trunc('week', timezone('Europe/Istanbul', now())) at time zone 'Europe/Istanbul'
      ), 0),
      'adet', coalesce((
        select count(*)::bigint
        from public.coin_purchases cp
        where coalesce(cp.status, 'completed') = 'completed'
          and cp.created_at >= date_trunc('week', timezone('Europe/Istanbul', now())) at time zone 'Europe/Istanbul'
      ), 0)
    ),
    'month', jsonb_build_object(
      'try', coalesce((
        select sum(public.ciro_try_hesapla(cp.amount_try, cp.package_id, cp.amount_usd))
        from public.coin_purchases cp
        where coalesce(cp.status, 'completed') = 'completed'
          and cp.created_at >= date_trunc('month', timezone('Europe/Istanbul', now())) at time zone 'Europe/Istanbul'
      ), 0),
      'coins', coalesce((
        select sum(cp.coins_added)::bigint
        from public.coin_purchases cp
        where coalesce(cp.status, 'completed') = 'completed'
          and cp.created_at >= date_trunc('month', timezone('Europe/Istanbul', now())) at time zone 'Europe/Istanbul'
      ), 0),
      'adet', coalesce((
        select count(*)::bigint
        from public.coin_purchases cp
        where coalesce(cp.status, 'completed') = 'completed'
          and cp.created_at >= date_trunc('month', timezone('Europe/Istanbul', now())) at time zone 'Europe/Istanbul'
      ), 0)
    ),
    'all', jsonb_build_object(
      'try', coalesce((
        select sum(public.ciro_try_hesapla(cp.amount_try, cp.package_id, cp.amount_usd))
        from public.coin_purchases cp
        where coalesce(cp.status, 'completed') = 'completed'
      ), 0),
      'coins', coalesce((
        select sum(cp.coins_added)::bigint
        from public.coin_purchases cp
        where coalesce(cp.status, 'completed') = 'completed'
      ), 0),
      'adet', coalesce((
        select count(*)::bigint
        from public.coin_purchases cp
        where coalesce(cp.status, 'completed') = 'completed'
      ), 0)
    )
  ) into v_ozet;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc), '[]'::jsonb)
  into v_islemler
  from (
    select
      cp.id,
      cp.user_id,
      cp.coins_added,
      public.ciro_try_hesapla(cp.amount_try, cp.package_id, cp.amount_usd) as amount_try,
      cp.amount_usd,
      cp.provider,
      cp.status,
      cp.created_at,
      coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Kullanıcı') as display_name,
      p.username,
      p.public_user_id,
      p.avatar_url,
      pkg.title as package_title
    from public.coin_purchases cp
    join public.profiles p on p.id = cp.user_id
    left join public.coin_packages pkg on pkg.id = cp.package_id
    where coalesce(cp.status, 'completed') = 'completed'
      and cp.created_at >= v_start
      and cp.created_at <= v_end
    order by cp.created_at desc
    limit v_limit
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.toplam_try desc), '[]'::jsonb)
  into v_kimden
  from (
    select
      p.id as user_id,
      coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Kullanıcı') as display_name,
      p.username,
      p.public_user_id,
      p.avatar_url,
      sum(public.ciro_try_hesapla(cp.amount_try, cp.package_id, cp.amount_usd)) as toplam_try,
      sum(cp.coins_added)::bigint as toplam_coin,
      count(*)::bigint as islem_adet,
      max(cp.created_at) as son_yukleme
    from public.coin_purchases cp
    join public.profiles p on p.id = cp.user_id
    where coalesce(cp.status, 'completed') = 'completed'
      and cp.created_at >= v_start
      and cp.created_at <= v_end
    group by p.id, p.display_name, p.username, p.public_user_id, p.avatar_url
    order by 6 desc
    limit least(v_limit, 100)
  ) t;

  return jsonb_build_object(
    'ok', true,
    'period', v_period,
    'period_start', v_start,
    'generated_at', now(),
    'ozet', v_ozet,
    'islemler', v_islemler,
    'kimden', v_kimden
  );
end;
$$;

grant execute on function public.admin_ciro_ozeti(text, int) to authenticated;
grant execute on function public.ciro_try_hesapla(numeric, uuid, numeric) to authenticated;

-- Satin alma onayinda amount_try yaz
create or replace function public.coin_purchase_amount_try_doldur()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.amount_try is null and new.package_id is not null then
    select price_try into new.amount_try
    from public.coin_packages where id = new.package_id;
  end if;
  return new;
end;
$$;

drop trigger if exists coin_purchase_amount_try_trg on public.coin_purchases;
create trigger coin_purchase_amount_try_trg
  before insert or update of package_id on public.coin_purchases
  for each row execute function public.coin_purchase_amount_try_doldur();
