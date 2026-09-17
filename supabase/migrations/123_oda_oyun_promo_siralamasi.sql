-- Otomatik feed banner’ları: son N günde oda başına oyun oturumu sayısı
-- (kaskad + katalog game_sessions + zeus)

create or replace function public.oda_oyun_promo_siralamasi(
  p_limit int default 5,
  p_days int default 7
)
returns table (
  room_id uuid,
  room_title text,
  room_cover_url text,
  room_is_live boolean,
  score bigint,
  rank int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 5), 1), 20);
  v_days int := least(greatest(coalesce(p_days, 7), 1), 30);
  v_since timestamptz := now() - make_interval(days => v_days);
begin
  return query
  with oyunlar as (
    select s.room_id as rid, count(*)::bigint as adet
    from public.kaskad_sessions s
    where s.room_id is not null
      and s.created_at >= v_since
    group by s.room_id

    union all

    select g.room_id as rid, count(*)::bigint as adet
    from public.game_sessions g
    where g.room_id is not null
      and g.created_at >= v_since
    group by g.room_id

    union all

    select z.room_id as rid, count(*)::bigint as adet
    from public.zeus_sessions z
    where z.room_id is not null
      and z.created_at >= v_since
    group by z.room_id
  ),
  toplam as (
    select o.rid, sum(o.adet)::bigint as skor
    from oyunlar o
    group by o.rid
  ),
  sirali as (
    select
      t.rid,
      t.skor,
      row_number() over (
        order by t.skor desc, coalesce(r.is_live, false) desc, r.listener_count desc nulls last
      )::int as sira
    from toplam t
    join public.rooms r on r.id = t.rid
    where r.ended_at is null
  )
  select
    s.rid,
    coalesce(nullif(trim(r.title), ''), 'Ses odası'),
    r.cover_url,
    coalesce(r.is_live, false),
    s.skor,
    s.sira
  from sirali s
  join public.rooms r on r.id = s.rid
  where s.sira <= v_limit
  order by s.sira;
end;
$$;

grant execute on function public.oda_oyun_promo_siralamasi(int, int) to authenticated;
grant execute on function public.oda_oyun_promo_siralamasi(int, int) to anon;

comment on function public.oda_oyun_promo_siralamasi(int, int) is
  'Feed otomatik banner: son N günde en çok oyun oynanan ses odaları';
