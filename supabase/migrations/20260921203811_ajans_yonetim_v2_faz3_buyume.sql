-- Ajans Yönetim V2 Faz3: Onboarding/mentor, akademi, ödül, analitik, seviye, form, QR analytics

-- ---------------------------------------------------------------------------
-- Application forms
-- ---------------------------------------------------------------------------
create table if not exists public.agency_application_forms (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  title text not null default 'Başvuru Formu',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (agency_id)
);

create table if not exists public.agency_application_form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.agency_application_forms(id) on delete cascade,
  field_type text not null
    check (field_type in ('short_text','long_text','single_choice','multi_choice','yes_no')),
  label text not null,
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  sort_order int not null default 0
);

create table if not exists public.agency_application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.host_applications(id) on delete cascade,
  field_id uuid not null references public.agency_application_form_fields(id) on delete cascade,
  answer jsonb not null default 'null'::jsonb,
  unique (application_id, field_id)
);

-- Admin kill-switch for custom forms
insert into public.feature_flags (key, enabled, description)
values ('agency_custom_application_forms', true, 'Ajans özel başvuru formu')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Academy
-- ---------------------------------------------------------------------------
create table if not exists public.agency_academy_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  category text not null default 'baslangic'
    check (category in ('baslangic','canli','ses','kurallar','guvenlik')),
  title text not null,
  body text not null default '',
  image_url text,
  video_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.agency_academy_progress (
  item_id uuid not null references public.agency_academy_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Rewards
-- ---------------------------------------------------------------------------
create table if not exists public.agency_rewards (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  reward_type text not null
    check (reward_type in ('badge','frame','agency_badge','cosmetic','virtual')),
  title text not null,
  description text not null default '',
  asset_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.agency_reward_grants (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.agency_rewards(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Analytics daily aggregates (performans için)
-- ---------------------------------------------------------------------------
create table if not exists public.agency_analytics_daily (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  day date not null,
  member_count int not null default 0,
  active_members int not null default 0,
  new_members int not null default 0,
  left_members int not null default 0,
  live_seconds bigint not null default 0,
  room_seconds bigint not null default 0,
  events_count int not null default 0,
  tasks_completed int not null default 0,
  applications_count int not null default 0,
  primary key (agency_id, day)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.agency_application_forms enable row level security;
alter table public.agency_application_form_fields enable row level security;
alter table public.agency_academy_items enable row level security;
alter table public.agency_academy_progress enable row level security;
alter table public.agency_rewards enable row level security;
alter table public.agency_reward_grants enable row level security;
alter table public.agency_analytics_daily enable row level security;

drop policy if exists "agency_academy_select" on public.agency_academy_items;
create policy "agency_academy_select" on public.agency_academy_items for select to authenticated
  using (
    exists (
      select 1 from public.host_profiles hp
      where hp.agency_id = agency_academy_items.agency_id
        and hp.user_id = auth.uid() and hp.status = 'agency'
    )
    or public.agency_has_permission(agency_id, 'agency.manage_settings')
  );

drop policy if exists "agency_analytics_select" on public.agency_analytics_daily;
create policy "agency_analytics_select" on public.agency_analytics_daily for select to authenticated
  using (public.agency_has_permission(agency_id, 'agency.view_analytics'));

grant select on public.agency_academy_items to authenticated;
grant select on public.agency_analytics_daily to authenticated;
grant select on public.agency_rewards to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.ajans_form_kaydet(
  p_agency_id uuid,
  p_title text,
  p_fields jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form uuid;
  v_item jsonb;
  v_flag boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_applications');

  select enabled into v_flag from public.feature_flags
  where key = 'agency_custom_application_forms';
  if coalesce(v_flag, true) = false then
    raise exception 'Özel başvuru formu platform tarafından kapatıldı';
  end if;

  insert into public.agency_application_forms (agency_id, title, is_active)
  values (p_agency_id, left(coalesce(nullif(trim(p_title),''), 'Başvuru Formu'), 80), true)
  on conflict (agency_id) do update set title = excluded.title, is_active = true
  returning id into v_form;

  delete from public.agency_application_form_fields where form_id = v_form;

  for v_item in select * from jsonb_array_elements(coalesce(p_fields, '[]'::jsonb))
  loop
    insert into public.agency_application_form_fields (
      form_id, field_type, label, options, required, sort_order
    ) values (
      v_form,
      coalesce(v_item->>'field_type', 'short_text'),
      left(coalesce(v_item->>'label', 'Soru'), 200),
      coalesce(v_item->'options', '[]'::jsonb),
      coalesce((v_item->>'required')::boolean, false),
      coalesce((v_item->>'sort_order')::int, 0)
    );
  end loop;

  return jsonb_build_object('ok', true, 'form_id', v_form);
end;
$$;

grant execute on function public.ajans_form_kaydet(uuid, text, jsonb) to authenticated;

create or replace function public.ajans_form_getir(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form public.agency_application_forms%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select * into v_form from public.agency_application_forms
  where agency_id = p_agency_id and is_active;
  if not found then
    return jsonb_build_object('form', null, 'fields', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'form', jsonb_build_object('id', v_form.id, 'title', v_form.title),
    'fields', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'field_type', f.field_type,
        'label', f.label,
        'options', f.options,
        'required', f.required,
        'sort_order', f.sort_order
      ) order by f.sort_order)
      from public.agency_application_form_fields f where f.form_id = v_form.id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.ajans_form_getir(uuid) to authenticated;

create or replace function public.ajans_akademi_ekle(
  p_agency_id uuid,
  p_category text,
  p_title text,
  p_body text default '',
  p_image_url text default null,
  p_video_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_settings');

  insert into public.agency_academy_items (
    agency_id, category, title, body, image_url, video_url
  ) values (
    p_agency_id,
    coalesce(nullif(p_category,''), 'baslangic'),
    left(trim(p_title), 120),
    left(coalesce(p_body,''), 8000),
    p_image_url, p_video_url
  ) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.ajans_akademi_ekle(uuid, text, text, text, text, text) to authenticated;

create or replace function public.ajans_akademi_listesi(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', i.id,
      'category', i.category,
      'title', i.title,
      'body', i.body,
      'image_url', i.image_url,
      'video_url', i.video_url,
      'completed', exists (
        select 1 from public.agency_academy_progress p
        where p.item_id = i.id and p.user_id = auth.uid()
      )
    ) order by i.sort_order, i.created_at)
    from public.agency_academy_items i
    where i.agency_id = p_agency_id and i.is_active
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.ajans_akademi_listesi(uuid) to authenticated;

create or replace function public.ajans_odul_tanimla(
  p_agency_id uuid,
  p_reward_type text,
  p_title text,
  p_description text default '',
  p_asset_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_settings');

  insert into public.agency_rewards (agency_id, reward_type, title, description, asset_url)
  values (
    p_agency_id, p_reward_type, left(trim(p_title), 80),
    left(coalesce(p_description,''), 500), p_asset_url
  ) returning id into v_id;

  perform public.agency_audit_yaz(p_agency_id, 'reward_define', 'Ödül tanımlandı', null,
    jsonb_build_object('reward_id', v_id));
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.ajans_odul_tanimla(uuid, text, text, text, text) to authenticated;

create or replace function public.ajans_odul_ver(
  p_agency_id uuid,
  p_reward_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_members');

  if not exists (
    select 1 from public.agency_rewards
    where id = p_reward_id and agency_id = p_agency_id and is_active
  ) then raise exception 'Ödül yok'; end if;

  insert into public.agency_reward_grants (reward_id, agency_id, user_id, granted_by)
  values (p_reward_id, p_agency_id, p_user_id, auth.uid())
  returning id into v_id;

  perform public.agency_audit_yaz(p_agency_id, 'reward_grant', 'Ödül verildi', p_user_id,
    jsonb_build_object('grant_id', v_id, 'reward_id', p_reward_id));
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.ajans_odul_ver(uuid, uuid, uuid) to authenticated;

create or replace function public.ajans_analitik(
  p_agency_id uuid,
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from date := coalesce(p_from, (now() - interval '30 days')::date);
  v_to date := coalesce(p_to, now()::date);
  v_uye int;
  v_aktif int;
  v_yeni int;
  v_yayin bigint;
  v_ses bigint;
  v_basvuru int;
  v_once_from date;
  v_once_to date;
  v_once_yayin bigint := 0;
  v_once_ses bigint := 0;
  v_gun int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.view_analytics');

  select count(*)::int into v_uye
  from public.host_profiles where agency_id = p_agency_id and status = 'agency';

  select count(distinct hp.user_id)::int into v_aktif
  from public.host_profiles hp
  join public.device_sessions ds on ds.user_id = hp.user_id
  where hp.agency_id = p_agency_id and hp.status = 'agency'
    and ds.revoked_at is null
    and ds.last_seen_at >= v_from::timestamptz;

  select count(*)::int into v_yeni
  from public.host_profiles
  where agency_id = p_agency_id and status = 'agency'
    and joined_agency_at >= v_from::timestamptz
    and joined_agency_at < (v_to + 1)::timestamptz;

  select coalesce(sum(extract(epoch from (
    coalesce(ls.ended_at, case when ls.is_live then now() else ls.started_at end) - ls.started_at
  ))), 0)::bigint into v_yayin
  from public.live_sessions ls
  join public.host_profiles hp on hp.user_id = ls.host_id
  where hp.agency_id = p_agency_id and hp.status = 'agency'
    and ls.started_at >= v_from::timestamptz
    and ls.started_at < (v_to + 1)::timestamptz;

  select coalesce(sum(extract(epoch from (
    coalesce(r.ended_at, case when r.is_live then now() else r.created_at end) - r.created_at
  ))), 0)::bigint into v_ses
  from public.rooms r
  join public.host_profiles hp on hp.user_id = r.host_id
  where hp.agency_id = p_agency_id and hp.status = 'agency'
    and r.created_at >= v_from::timestamptz
    and r.created_at < (v_to + 1)::timestamptz;

  select count(*)::int into v_basvuru
  from public.host_applications
  where agency_id = p_agency_id
    and created_at >= v_from::timestamptz
    and created_at < (v_to + 1)::timestamptz;

  v_gun := greatest((v_to - v_from), 1);
  v_once_to := v_from - 1;
  v_once_from := v_once_to - v_gun;

  select coalesce(sum(extract(epoch from (
    coalesce(ls.ended_at, case when ls.is_live then now() else ls.started_at end) - ls.started_at
  ))), 0)::bigint into v_once_yayin
  from public.live_sessions ls
  join public.host_profiles hp on hp.user_id = ls.host_id
  where hp.agency_id = p_agency_id and hp.status = 'agency'
    and ls.started_at >= v_once_from::timestamptz
    and ls.started_at < (v_once_to + 1)::timestamptz;

  select coalesce(sum(extract(epoch from (
    coalesce(r.ended_at, case when r.is_live then now() else r.created_at end) - r.created_at
  ))), 0)::bigint into v_once_ses
  from public.rooms r
  join public.host_profiles hp on hp.user_id = r.host_id
  where hp.agency_id = p_agency_id and hp.status = 'agency'
    and r.created_at >= v_once_from::timestamptz
    and r.created_at < (v_once_to + 1)::timestamptz;

  return jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'uye_sayisi', v_uye,
    'aktif_uye', v_aktif,
    'yeni_uye', v_yeni,
    'yayin_saniye', v_yayin,
    'ses_saniye', v_ses,
    'basvuru_sayisi', v_basvuru,
    'etkinlik_sayisi', coalesce((
      select count(*)::int from public.agency_events
      where agency_id = p_agency_id
        and starts_at >= v_from::timestamptz
        and starts_at < (v_to + 1)::timestamptz
    ), 0),
    'gorev_tamamlanan', coalesce((
      select count(*)::int from public.agency_tasks
      where agency_id = p_agency_id and status = 'done'
        and updated_at >= v_from::timestamptz
        and updated_at < (v_to + 1)::timestamptz
    ), 0),
    'karsilastirma', jsonb_build_object(
      'onceki_yayin_saniye', v_once_yayin,
      'onceki_ses_saniye', v_once_ses,
      'yayin_degisim_pct', case
        when v_once_yayin = 0 then case when v_yayin = 0 then 0 else 100 end
        else round(((v_yayin - v_once_yayin)::numeric / v_once_yayin) * 100.0, 1)
      end,
      'ses_degisim_pct', case
        when v_once_ses = 0 then case when v_ses = 0 then 0 else 100 end
        else round(((v_ses - v_once_ses)::numeric / v_once_ses) * 100.0, 1)
      end
    )
  );
end;
$$;

grant execute on function public.ajans_analitik(uuid, date, date) to authenticated;

create or replace function public.ajans_seviye_progress(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.agencies%rowtype;
  v_cur public.agency_level_criteria%rowtype;
  v_next public.agency_level_criteria%rowtype;
  v_hosts int;
  v_live numeric;
  v_room numeric;
  v_score bigint;
  v_pct numeric := 0;
  v_eksikler jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.view_dashboard');

  select * into a from public.agencies where id = p_agency_id;
  if not found then raise exception 'Ajans yok'; end if;

  select * into v_cur from public.agency_level_criteria where level_code = a.level_code;

  select c.* into v_next
  from public.agency_level_criteria c
  join public.agency_levels l on l.code = c.level_code
  join public.agency_levels cur on cur.code = a.level_code
  where l.sort_order > cur.sort_order and l.is_active
  order by l.sort_order
  limit 1;

  select count(*)::int into v_hosts
  from public.host_profiles where agency_id = p_agency_id and status = 'agency';

  select coalesce(sum(extract(epoch from (
    coalesce(ls.ended_at, case when ls.is_live then now() else ls.started_at end) - ls.started_at
  )) / 3600.0), 0) into v_live
  from public.live_sessions ls
  join public.host_profiles hp on hp.user_id = ls.host_id
  where hp.agency_id = p_agency_id and hp.status = 'agency'
    and ls.started_at >= date_trunc('month', now());

  select coalesce(sum(extract(epoch from (
    coalesce(r.ended_at, case when r.is_live then now() else r.created_at end) - r.created_at
  )) / 3600.0), 0) into v_room
  from public.rooms r
  join public.host_profiles hp on hp.user_id = r.host_id
  where hp.agency_id = p_agency_id and hp.status = 'agency'
    and r.created_at >= date_trunc('month', now());

  v_score := coalesce(a.monthly_score, 0);

  if v_next.level_code is not null then
    v_pct := least(100, round((
      (least(v_hosts::numeric / nullif(v_next.min_active_hosts, 0), 1)
        + least(v_live / nullif(v_next.min_monthly_live_hours, 0), 1)
        + least(v_room / nullif(v_next.min_monthly_room_hours, 0), 1)
        + least(v_score::numeric / nullif(v_next.min_monthly_score, 0), 1)
      ) / 4.0
    ) * 100.0, 1));

    if v_hosts < v_next.min_active_hosts then
      v_eksikler := v_eksikler || jsonb_build_array(
        (v_next.min_active_hosts - v_hosts)::text || ' aktif host'
      );
    end if;
    if v_live < v_next.min_monthly_live_hours then
      v_eksikler := v_eksikler || jsonb_build_array(
        round(v_next.min_monthly_live_hours - v_live, 0)::text || ' saat yayın'
      );
    end if;
    if v_room < v_next.min_monthly_room_hours then
      v_eksikler := v_eksikler || jsonb_build_array(
        round(v_next.min_monthly_room_hours - v_room, 0)::text || ' saat ses odası'
      );
    end if;
  else
    v_pct := 100;
  end if;

  return jsonb_build_object(
    'current', a.level_code,
    'next', v_next.level_code,
    'progress_pct', coalesce(v_pct, 0),
    'eksikler', v_eksikler,
    'metrics', jsonb_build_object(
      'active_hosts', v_hosts,
      'live_hours', round(v_live, 1),
      'room_hours', round(v_room, 1),
      'monthly_score', v_score
    )
  );
end;
$$;

grant execute on function public.ajans_seviye_progress(uuid) to authenticated;

create or replace function public.ajans_davet_event_kaydet(
  p_agency_id uuid,
  p_event_type text,
  p_source text default 'unknown',
  p_invite_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  insert into public.agency_invite_events (invite_id, agency_id, event_type, source)
  values (p_invite_id, p_agency_id, p_event_type, coalesce(nullif(p_source,''), 'unknown'));

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.ajans_davet_event_kaydet(uuid, text, text, uuid) to authenticated;

create or replace function public.ajans_davet_analitik(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.view_analytics');

  return jsonb_build_object(
    'toplam', (
      select count(*)::int from public.agency_invite_events where agency_id = p_agency_id
    ),
    'by_type', coalesce((
      select jsonb_object_agg(event_type, cnt)
      from (
        select event_type, count(*)::int as cnt
        from public.agency_invite_events
        where agency_id = p_agency_id
        group by event_type
      ) x
    ), '{}'::jsonb),
    'by_source', coalesce((
      select jsonb_object_agg(source, cnt)
      from (
        select source, count(*)::int as cnt
        from public.agency_invite_events
        where agency_id = p_agency_id
        group by source
      ) x
    ), '{}'::jsonb)
  );
end;
$$;

grant execute on function public.ajans_davet_analitik(uuid) to authenticated;
