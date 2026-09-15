-- 81 TR sehir + tam secim sistemi (admin baslat, oy, canli gidisat, sonuc bildirimi)

-- Ozellik ac
update public.feature_flags
set enabled = true, updated_at = now()
where key = 'city_elections_enabled';

-- Secim sema genislet
alter table public.city_elections
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists winner_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists winner_candidate_id uuid references public.city_candidates(id) on delete set null,
  add column if not exists total_votes int not null default 0,
  add column if not exists tallied_at timestamptz;

-- Yabanci ornek sehirleri kapat (hub TR odakli)
update public.geo_cities
set is_active = false
where country_code <> 'TR';

-- 81 il → geo_cities (region bagli)
insert into public.geo_cities (country_code, region_id, name, slug, timezone, is_active)
select
  'TR',
  r.id,
  r.name,
  'tr-' || r.code,
  'Europe/Istanbul',
  true
from public.geo_regions r
where r.country_code = 'TR'
on conflict (slug) do update set
  name = excluded.name,
  region_id = excluded.region_id,
  is_active = true,
  timezone = 'Europe/Istanbul';

-- Mevcut istanbul/ankara/izmir sluglarini da aktif tut + region bagla
update public.geo_cities c
set
  is_active = true,
  region_id = coalesce(c.region_id, r.id),
  name = r.name
from public.geo_regions r
where c.country_code = 'TR'
  and r.country_code = 'TR'
  and (
    (c.slug in ('istanbul', 'tr-34') and r.code = '34')
    or (c.slug in ('ankara', 'tr-06') and r.code = '06')
    or (c.slug in ('izmir', 'tr-35') and r.code = '35')
  );

-- ---------------------------------------------------------------------------
-- Herkese bildirim (sonuc / secim duyurusu)
-- ---------------------------------------------------------------------------
create or replace function public.herkese_sistem_bildirimi(
  p_title text,
  p_body text default null,
  p_deep_link text default null,
  p_category text default 'system',
  p_payload jsonb default '{}'::jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int := 0;
  v_cat text := lower(trim(coalesce(p_category, 'system')));
  v_title text := left(trim(coalesce(p_title, '')), 120);
  v_body text := case when p_body is null then null else left(trim(p_body), 400) end;
  v_link text := nullif(trim(coalesce(p_deep_link, '')), '');
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if v_title is null or length(v_title) = 0 then return 0; end if;

  insert into public.user_notifications (
    user_id, category, title, body, deep_link, payload
  )
  select
    p.id, v_cat, v_title, v_body, v_link, v_payload
  from public.profiles p
  where p.deleted_at is null
    and p.banned_at is null
    and coalesce(p.is_guest, false) = false;

  get diagnostics v_n = row_count;

  insert into public.notification_outbox (
    user_id, category, title, body, deep_link, payload, status
  )
  select
    p.id, v_cat, v_title, v_body, v_link, v_payload, 'pending'
  from public.profiles p
  where p.deleted_at is null
    and p.banned_at is null
    and coalesce(p.is_guest, false) = false
    and public.push_tercihi_aktif_mi(p.id, v_cat);

  return coalesce(v_n, 0);
exception when others then
  return coalesce(v_n, 0);
end;
$$;

grant execute on function public.herkese_sistem_bildirimi(text, text, text, text, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Admin: secim baslat
-- ---------------------------------------------------------------------------
create or replace function public.admin_sehir_secim_baslat(
  p_city_id uuid,
  p_role text default 'leader',
  p_hours int default 48,
  p_title text default null,
  p_start_voting boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_city public.geo_cities%rowtype;
  v_role text := coalesce(nullif(trim(p_role), ''), 'leader');
  v_hours int := least(greatest(coalesce(p_hours, 48), 1), 168);
  v_status text := case when coalesce(p_start_voting, true) then 'voting' else 'nominating' end;
  v_id uuid;
  v_title text;
  v_notify int := 0;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if v_role not in ('leader', 'vice_leader') then raise exception 'Gecersiz rol'; end if;

  select * into v_city from public.geo_cities
  where id = p_city_id and is_active and country_code = 'TR';
  if v_city.id is null then raise exception 'Sehir bulunamadi'; end if;

  -- Ayni sehirde aktif secim varsa engelle
  if exists (
    select 1 from public.city_elections e
    where e.city_id = p_city_id
      and e.role_target = v_role
      and e.status in ('nominating', 'voting')
  ) then
    raise exception 'Bu sehirde zaten aktif secim var';
  end if;

  v_title := coalesce(
    nullif(trim(p_title), ''),
    v_city.name || case when v_role = 'leader' then ' Lider Secimi' else ' Yardimci Lider Secimi' end
  );

  insert into public.city_elections (
    city_id, title, role_target, status, starts_at, ends_at, created_by
  ) values (
    p_city_id,
    left(v_title, 120),
    v_role,
    v_status,
    now(),
    now() + make_interval(hours => v_hours),
    v_uid
  )
  returning id into v_id;

  v_notify := public.herkese_sistem_bildirimi(
    v_city.name || ' secimi basladi',
    case when v_status = 'voting'
      then 'Oy kullanmak icin secim sayfasina git. Sure: ' || v_hours::text || ' saat.'
      else 'Adaylik acik. Secim sayfasindan basvurabilirsin.'
    end,
    '/sehir/secim/' || v_id::text,
    'live',
    jsonb_build_object(
      'type', 'city_election_start',
      'election_id', v_id,
      'city_id', p_city_id,
      'city_name', v_city.name,
      'role', v_role
    )
  );

  perform public.admin_audit_yaz(
    null,
    'city_election_start',
    v_title,
    jsonb_build_object('election_id', v_id, 'city_id', p_city_id, 'notify', v_notify)
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'status', v_status,
    'notified', v_notify
  );
end;
$$;

grant execute on function public.admin_sehir_secim_baslat(uuid, text, int, text, boolean)
  to authenticated;

-- Admin: oylamaya ac
create or replace function public.admin_sehir_secim_oylamaya_ac(p_election_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_el public.city_elections%rowtype;
  v_city_name text;
  v_notify int := 0;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  update public.city_elections
  set status = 'voting', starts_at = least(starts_at, now())
  where id = p_election_id and status = 'nominating'
  returning * into v_el;
  if v_el.id is null then raise exception 'Oylama acilamadi'; end if;

  select name into v_city_name from public.geo_cities where id = v_el.city_id;
  v_notify := public.herkese_sistem_bildirimi(
    coalesce(v_city_name, 'Sehir') || ' oylamasi acik',
    'Adaylara oy verebilirsin.',
    '/sehir/secim/' || v_el.id::text,
    'live',
    jsonb_build_object('type', 'city_election_voting', 'election_id', v_el.id)
  );

  return jsonb_build_object('ok', true, 'id', v_el.id, 'notified', v_notify);
end;
$$;

grant execute on function public.admin_sehir_secim_oylamaya_ac(uuid) to authenticated;

-- Admin / otomatik: sonuclandir
create or replace function public.admin_sehir_secim_sonuclandir(p_election_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_el public.city_elections%rowtype;
  v_cand public.city_candidates%rowtype;
  v_name text;
  v_city_name text;
  v_role_tr text;
  v_notify int := 0;
  v_total int;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  select * into v_el from public.city_elections where id = p_election_id for update;
  if v_el.id is null then raise exception 'Secim yok'; end if;
  if v_el.status not in ('voting', 'nominating') then
    raise exception 'Secim zaten kapali';
  end if;

  select * into v_cand
  from public.city_candidates
  where election_id = p_election_id and status = 'approved'
  order by vote_count desc, created_at asc
  limit 1;

  if v_cand.id is null then
    update public.city_elections
    set status = 'cancelled', tallied_at = now()
    where id = p_election_id;
    return jsonb_build_object('ok', true, 'cancelled', true, 'reason', 'no_candidates');
  end if;

  select coalesce(sum(vote_count), 0)::int into v_total
  from public.city_candidates
  where election_id = p_election_id and status = 'approved';

  -- Eski aktif rolü kapat
  update public.city_roles
  set is_active = false, term_end = now()
  where city_id = v_el.city_id
    and role = v_el.role_target
    and is_active;

  insert into public.city_roles (city_id, user_id, role, term_start, is_active)
  values (v_el.city_id, v_cand.user_id, v_el.role_target, now(), true);

  update public.city_elections
  set
    status = 'tallied',
    winner_user_id = v_cand.user_id,
    winner_candidate_id = v_cand.id,
    total_votes = v_total,
    tallied_at = now()
  where id = p_election_id;

  select coalesce(display_name, username, 'Bir kullanici') into v_name
  from public.profiles where id = v_cand.user_id;
  select name into v_city_name from public.geo_cities where id = v_el.city_id;
  v_role_tr := case when v_el.role_target = 'leader' then 'lideri' else 'yardimci lideri' end;

  v_notify := public.herkese_sistem_bildirimi(
    coalesce(v_city_name, 'Sehir') || ' ' || v_role_tr || ' secildi',
    v_name || ' · ' || v_cand.vote_count::text || ' oy ile kazandi',
    '/sehir/secim/' || p_election_id::text,
    'social',
    jsonb_build_object(
      'type', 'city_election_winner',
      'election_id', p_election_id,
      'city_id', v_el.city_id,
      'city_name', v_city_name,
      'winner_user_id', v_cand.user_id,
      'winner_name', v_name,
      'role', v_el.role_target,
      'votes', v_cand.vote_count
    )
  );

  perform public.admin_audit_yaz(
    v_cand.user_id,
    'city_election_tallied',
    coalesce(v_city_name, '') || ' ' || v_role_tr || ': ' || v_name,
    jsonb_build_object('election_id', p_election_id, 'votes', v_cand.vote_count, 'notify', v_notify)
  );

  return jsonb_build_object(
    'ok', true,
    'winner_user_id', v_cand.user_id,
    'winner_name', v_name,
    'votes', v_cand.vote_count,
    'total_votes', v_total,
    'notified', v_notify
  );
end;
$$;

grant execute on function public.admin_sehir_secim_sonuclandir(uuid) to authenticated;

-- Suresi bitenleri otomatik sonuclandir (oylama sirasinda cagrilabilir)
create or replace function public.sehir_secim_suresi_dolanlari_bitir()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_n int := 0;
begin
  for v_id in
    select id from public.city_elections
    where status = 'voting' and ends_at <= now()
  loop
    perform public.sehir_secim_sonuclandir_ic(v_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Adaylik: nominating + voting (admin dogrudan oylama acsa da basvuru mumkun)
create or replace function public.sehir_aday_basvurusu(
  p_election_id uuid,
  p_manifesto text default null
)
returns public.city_candidates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_el public.city_elections%rowtype;
  v_row public.city_candidates%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ozellik_bayragi_aktif_mi('city_elections_enabled') then
    raise exception 'Elections disabled';
  end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot run'; end if;

  select * into v_el from public.city_elections where id = p_election_id for update;
  if not found then raise exception 'Election not found'; end if;
  if v_el.status not in ('nominating', 'voting') then
    raise exception 'Not accepting candidates';
  end if;
  if v_el.status = 'voting' and v_el.ends_at <= now() then
    raise exception 'Election ended';
  end if;

  insert into public.city_candidates (election_id, user_id, manifesto, status)
  values (p_election_id, v_uid, left(trim(coalesce(p_manifesto, '')), 280), 'approved')
  on conflict (election_id, user_id) do update
    set manifesto = excluded.manifesto
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.sehir_aday_basvurusu(uuid, text) to authenticated;

-- Internal tally (no admin check) for cron / vote path
create or replace function public.sehir_secim_sonuclandir_ic(p_election_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_el public.city_elections%rowtype;
  v_cand public.city_candidates%rowtype;
  v_name text;
  v_city_name text;
  v_role_tr text;
  v_notify int := 0;
  v_total int;
begin
  select * into v_el from public.city_elections where id = p_election_id for update;
  if v_el.id is null then return jsonb_build_object('ok', false); end if;
  if v_el.status <> 'voting' then return jsonb_build_object('ok', false, 'status', v_el.status); end if;

  select * into v_cand
  from public.city_candidates
  where election_id = p_election_id and status = 'approved'
  order by vote_count desc, created_at asc
  limit 1;

  if v_cand.id is null then
    update public.city_elections set status = 'cancelled', tallied_at = now() where id = p_election_id;
    return jsonb_build_object('ok', true, 'cancelled', true);
  end if;

  select coalesce(sum(vote_count), 0)::int into v_total
  from public.city_candidates
  where election_id = p_election_id and status = 'approved';

  update public.city_roles
  set is_active = false, term_end = now()
  where city_id = v_el.city_id and role = v_el.role_target and is_active;

  insert into public.city_roles (city_id, user_id, role, term_start, is_active)
  values (v_el.city_id, v_cand.user_id, v_el.role_target, now(), true);

  update public.city_elections set
    status = 'tallied',
    winner_user_id = v_cand.user_id,
    winner_candidate_id = v_cand.id,
    total_votes = v_total,
    tallied_at = now()
  where id = p_election_id;

  select coalesce(display_name, username, 'Bir kullanici') into v_name
  from public.profiles where id = v_cand.user_id;
  select name into v_city_name from public.geo_cities where id = v_el.city_id;
  v_role_tr := case when v_el.role_target = 'leader' then 'lideri' else 'yardimci lideri' end;

  v_notify := public.herkese_sistem_bildirimi(
    coalesce(v_city_name, 'Sehir') || ' ' || v_role_tr || ' secildi',
    v_name || ' · ' || v_cand.vote_count::text || ' oy ile kazandi',
    '/sehir/secim/' || p_election_id::text,
    'social',
    jsonb_build_object(
      'type', 'city_election_winner',
      'election_id', p_election_id,
      'city_id', v_el.city_id,
      'city_name', v_city_name,
      'winner_user_id', v_cand.user_id,
      'winner_name', v_name,
      'role', v_el.role_target
    )
  );

  return jsonb_build_object('ok', true, 'winner_name', v_name, 'notified', v_notify);
end;
$$;

-- Oy kullan: sure dolmussa once bitir
drop function if exists public.sehir_oyu_kullan(uuid, uuid);
create or replace function public.sehir_oyu_kullan(
  p_election_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_el public.city_elections%rowtype;
  v_cand public.city_candidates%rowtype;
  v_total int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ozellik_bayragi_aktif_mi('city_elections_enabled') then
    raise exception 'Elections disabled';
  end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Guest cannot vote'; end if;

  select * into v_el from public.city_elections where id = p_election_id for update;
  if not found then raise exception 'Election not found'; end if;

  if v_el.status = 'voting' and v_el.ends_at <= now() then
    perform public.sehir_secim_sonuclandir_ic(p_election_id);
    raise exception 'Secim suresi doldu, sonuclar acilandi';
  end if;

  if v_el.status <> 'voting' then raise exception 'Voting closed'; end if;
  if now() < v_el.starts_at or now() > v_el.ends_at then
    raise exception 'Outside voting window';
  end if;

  select * into v_cand from public.city_candidates
  where id = p_candidate_id and election_id = p_election_id;
  if not found or v_cand.status <> 'approved' then
    raise exception 'Invalid candidate';
  end if;

  insert into public.city_votes (election_id, candidate_id, user_id)
  values (p_election_id, p_candidate_id, v_uid);

  update public.city_candidates
  set vote_count = vote_count + 1
  where id = p_candidate_id;

  select coalesce(sum(vote_count), 0)::int into v_total
  from public.city_candidates
  where election_id = p_election_id and status = 'approved';

  update public.city_elections set total_votes = v_total where id = p_election_id;

  return jsonb_build_object('ok', true, 'total_votes', v_total);
exception
  when unique_violation then
    raise exception 'Already voted in this election';
end;
$$;

grant execute on function public.sehir_oyu_kullan(uuid, uuid) to authenticated;

-- Canli gidisat
create or replace function public.sehir_secim_gidisat(p_election_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_el public.city_elections%rowtype;
  v_total int;
  v_my_vote uuid;
  v_city jsonb;
  v_winner jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  -- Sure dolduysa bitir
  select * into v_el from public.city_elections where id = p_election_id;
  if v_el.id is null then raise exception 'Secim yok'; end if;
  if v_el.status = 'voting' and v_el.ends_at <= now() then
    perform public.sehir_secim_sonuclandir_ic(p_election_id);
    select * into v_el from public.city_elections where id = p_election_id;
  end if;

  select coalesce(sum(c.vote_count), 0)::int into v_total
  from public.city_candidates c
  where c.election_id = p_election_id and c.status = 'approved';

  select v.candidate_id into v_my_vote
  from public.city_votes v
  where v.election_id = p_election_id and v.user_id = v_uid;

  select jsonb_build_object('id', g.id, 'name', g.name, 'slug', g.slug, 'country_code', g.country_code)
  into v_city from public.geo_cities g where g.id = v_el.city_id;

  if v_el.winner_user_id is not null then
    select jsonb_build_object(
      'user_id', p.id,
      'display_name', coalesce(p.display_name, p.username),
      'username', p.username,
      'avatar_url', p.avatar_url
    ) into v_winner
    from public.profiles p where p.id = v_el.winner_user_id;
  end if;

  return jsonb_build_object(
    'election', jsonb_build_object(
      'id', v_el.id,
      'title', v_el.title,
      'city_id', v_el.city_id,
      'role_target', v_el.role_target,
      'status', v_el.status,
      'starts_at', v_el.starts_at,
      'ends_at', v_el.ends_at,
      'total_votes', greatest(v_el.total_votes, v_total),
      'tallied_at', v_el.tallied_at
    ),
    'city', v_city,
    'winner', v_winner,
    'my_vote_candidate_id', v_my_vote,
    'candidates', coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.vote_count desc, t.created_at asc)
      from (
        select
          c.id,
          c.user_id,
          c.manifesto,
          c.vote_count,
          c.status,
          c.created_at,
          coalesce(p.display_name, p.username, 'Aday') as display_name,
          p.username,
          p.avatar_url,
          case when v_total > 0
            then round((c.vote_count::numeric * 100) / v_total, 1)
            else 0
          end as percent
        from public.city_candidates c
        join public.profiles p on p.id = c.user_id
        where c.election_id = p_election_id and c.status = 'approved'
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.sehir_secim_gidisat(uuid) to authenticated;

-- Admin listeler
create or replace function public.admin_sehir_secim_listesi(p_limit int default 40)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc)
    from (
      select
        e.id, e.title, e.status, e.role_target, e.starts_at, e.ends_at,
        e.total_votes, e.created_at, e.tallied_at,
        g.name as city_name, g.id as city_id,
        wp.display_name as winner_name
      from public.city_elections e
      join public.geo_cities g on g.id = e.city_id
      left join public.profiles wp on wp.id = e.winner_user_id
      order by e.created_at desc
      limit least(greatest(coalesce(p_limit, 40), 1), 100)
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_sehir_secim_listesi(int) to authenticated;

create or replace function public.tr_sehirleri_listesi()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.sort_order, t.name)
    from (
      select
        c.id, c.name, c.slug, c.country_code, c.supporter_count, c.power_score,
        r.code as plate_code, r.sort_order
      from public.geo_cities c
      left join public.geo_regions r on r.id = c.region_id
      where c.country_code = 'TR' and c.is_active
        and c.slug like 'tr-%'
      order by coalesce(r.sort_order, 999), c.name
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.tr_sehirleri_listesi() to authenticated;

-- Realtime
do $$
begin
  begin alter publication supabase_realtime add table public.city_elections;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.city_candidates;
  exception when duplicate_object then null; end;
end $$;

alter table public.city_elections replica identity full;
alter table public.city_candidates replica identity full;
