-- Ajans Yönetim V2 Faz1: Dashboard KPI, canlı operasyon, bugün, uyarı motoru

create or replace function public.ajans_dashboard_kpi(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.agencies%rowtype;
  v_uye int := 0;
  v_online int := 0;
  v_canli int := 0;
  v_ses int := 0;
  v_bekleyen int := 0;
  v_yayin_sn bigint := 0;
  v_ses_sn bigint := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.view_dashboard');

  select * into a from public.agencies where id = p_agency_id;
  if not found then raise exception 'Ajans bulunamadı'; end if;

  select count(*)::int into v_uye
  from public.host_profiles
  where agency_id = p_agency_id and status = 'agency';

  select count(distinct hp.user_id)::int into v_online
  from public.host_profiles hp
  join public.device_sessions ds on ds.user_id = hp.user_id
  where hp.agency_id = p_agency_id
    and hp.status = 'agency'
    and ds.revoked_at is null
    and ds.last_seen_at > now() - interval '5 minutes';

  select count(*)::int into v_canli
  from public.live_sessions ls
  join public.host_profiles hp on hp.user_id = ls.host_id
  where hp.agency_id = p_agency_id and hp.status = 'agency' and ls.is_live = true;

  select count(distinct r.id)::int into v_ses
  from public.rooms r
  join public.host_profiles hp on hp.user_id = r.host_id
  where hp.agency_id = p_agency_id and hp.status = 'agency' and r.is_live = true;

  select count(*)::int into v_bekleyen
  from public.host_applications
  where agency_id = p_agency_id and status = 'agency_review';

  select coalesce(sum(extract(epoch from (
    coalesce(ls.ended_at, case when ls.is_live then now() else ls.started_at end) - ls.started_at
  ))), 0)::bigint into v_yayin_sn
  from public.live_sessions ls
  join public.host_profiles hp on hp.user_id = ls.host_id
  where hp.agency_id = p_agency_id and hp.status = 'agency'
    and ls.started_at >= date_trunc('month', now());

  select coalesce(sum(extract(epoch from (
    coalesce(r.ended_at, case when r.is_live then now() else r.created_at end) - r.created_at
  ))), 0)::bigint into v_ses_sn
  from public.rooms r
  join public.host_profiles hp on hp.user_id = r.host_id
  where hp.agency_id = p_agency_id and hp.status = 'agency'
    and r.created_at >= date_trunc('month', now());

  return jsonb_build_object(
    'agency', jsonb_build_object(
      'id', a.id,
      'agency_public_id', a.agency_public_id,
      'name', a.name,
      'username', a.username,
      'logo_url', a.logo_url,
      'banner_url', a.banner_url,
      'level_code', a.level_code,
      'is_verified', coalesce(a.is_verified, false),
      'host_count', a.host_count,
      'status', a.status,
      'owner_id', a.owner_id,
      'is_coin_distributor', a.is_coin_distributor,
      'slogan', a.slogan
    ),
    'uyeler', v_uye,
    'cevrimici', v_online,
    'canli_yayinda', v_canli,
    'ses_odasinda', v_ses,
    'bekleyen_basvuru', v_bekleyen,
    'bu_ay_yayin_saniye', v_yayin_sn,
    'bu_ay_ses_saniye', v_ses_sn,
    'bu_ay_platform_aktivite_saniye', v_yayin_sn + v_ses_sn
  );
end;
$$;

grant execute on function public.ajans_dashboard_kpi(uuid) to authenticated;

create or replace function public.ajans_canli_operasyon(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yaklasan jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.view_live_ops');

  if to_regclass('public.agency_schedules') is not null then
    execute $q$
      select coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'starts_at', s.starts_at,
          'kind', s.kind,
          'host_id', s.host_id
        ) order by s.starts_at asc)
        from public.agency_schedules s
        where s.agency_id = $1
          and s.status = 'scheduled'
          and s.starts_at between now() and now() + interval '48 hours'
      ), '[]'::jsonb)
    $q$ into v_yaklasan using p_agency_id;
  end if;

  return jsonb_build_object(
    'cevrimici', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', x.user_id,
        'display_name', x.display_name,
        'username', x.username,
        'avatar_url', x.avatar_url,
        'last_seen_at', x.last_seen_at
      ) order by x.last_seen_at desc)
      from (
        select distinct on (hp.user_id)
          hp.user_id, p.display_name, p.username, p.avatar_url, ds.last_seen_at
        from public.host_profiles hp
        join public.device_sessions ds on ds.user_id = hp.user_id
        join public.profiles p on p.id = hp.user_id
        where hp.agency_id = p_agency_id and hp.status = 'agency'
          and ds.revoked_at is null
          and ds.last_seen_at > now() - interval '5 minutes'
        order by hp.user_id, ds.last_seen_at desc
      ) x
    ), '[]'::jsonb),
    'canli_yayinlar', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id', ls.id,
        'user_id', ls.host_id,
        'title', ls.title,
        'viewer_count', coalesce(ls.viewer_count, 0),
        'started_at', ls.started_at,
        'display_name', p.display_name,
        'username', p.username,
        'avatar_url', p.avatar_url
      ) order by ls.started_at desc)
      from public.live_sessions ls
      join public.host_profiles hp on hp.user_id = ls.host_id
      join public.profiles p on p.id = ls.host_id
      where hp.agency_id = p_agency_id and hp.status = 'agency' and ls.is_live = true
    ), '[]'::jsonb),
    'ses_odalari', coalesce((
      select jsonb_agg(jsonb_build_object(
        'room_id', r.id,
        'user_id', r.host_id,
        'title', r.title,
        'listener_count', coalesce(r.listener_count, 0),
        'created_at', r.created_at,
        'display_name', p.display_name,
        'username', p.username,
        'avatar_url', p.avatar_url
      ) order by r.created_at desc)
      from public.rooms r
      join public.host_profiles hp on hp.user_id = r.host_id
      join public.profiles p on p.id = r.host_id
      where hp.agency_id = p_agency_id and hp.status = 'agency' and r.is_live = true
    ), '[]'::jsonb),
    'yaklasan_programlar', v_yaklasan,
    'ozet', jsonb_build_object(
      'cevrimici', (
        select count(distinct hp.user_id)::int
        from public.host_profiles hp
        join public.device_sessions ds on ds.user_id = hp.user_id
        where hp.agency_id = p_agency_id and hp.status = 'agency'
          and (ds.revoked_at is null) and ds.last_seen_at > now() - interval '5 minutes'
      ),
      'canli', (
        select count(*)::int from public.live_sessions ls
        join public.host_profiles hp on hp.user_id = ls.host_id
        where hp.agency_id = p_agency_id and hp.status = 'agency' and ls.is_live
      ),
      'ses', (
        select count(*)::int from public.rooms r
        join public.host_profiles hp on hp.user_id = r.host_id
        where hp.agency_id = p_agency_id and hp.status = 'agency' and r.is_live
      )
    )
  );
end;
$$;

grant execute on function public.ajans_canli_operasyon(uuid) to authenticated;

create or replace function public.ajans_bugun_ozet(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_basvuru int := 0;
  v_program int := 0;
  v_destek int := 0;
  v_bildirim int := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.view_dashboard');

  select count(*)::int into v_basvuru
  from public.host_applications
  where agency_id = p_agency_id
    and status = 'agency_review'
    and created_at >= date_trunc('day', now());

  if to_regclass('public.agency_schedules') is not null then
    execute $q$
      select count(*)::int from public.agency_schedules
      where agency_id = $1 and status = 'scheduled'
        and starts_at >= date_trunc('day', now())
        and starts_at < date_trunc('day', now()) + interval '1 day'
    $q$ into v_program using p_agency_id;
  end if;

  if to_regclass('public.agency_support_tickets') is not null then
    execute $q$
      select count(*)::int from public.agency_support_tickets
      where agency_id = $1 and status in ('open','in_progress')
    $q$ into v_destek using p_agency_id;
  end if;

  if to_regclass('public.agency_announcements') is not null then
    execute $q$
      select count(*)::int
      from public.agency_announcements a
      where a.agency_id = $1
        and a.created_at >= now() - interval '7 days'
        and not exists (
          select 1 from public.agency_announcement_reads r
          where r.announcement_id = a.id and r.user_id = auth.uid()
        )
    $q$ into v_bildirim using p_agency_id;
  end if;

  return jsonb_build_object(
    'yeni_basvuru', v_basvuru,
    'planlanan_yayin', v_program,
    'acik_destek', v_destek,
    'okunmamis_bildirim', v_bildirim,
    'maddeler', jsonb_build_array(
      jsonb_build_object('key', 'basvurular', 'label', 'yeni başvuru', 'count', v_basvuru, 'href', 'basvurular'),
      jsonb_build_object('key', 'program', 'label', 'planlanan yayın', 'count', v_program, 'href', 'program'),
      jsonb_build_object('key', 'destek', 'label', 'açık destek talebi', 'count', v_destek, 'href', 'destek'),
      jsonb_build_object('key', 'bildirim', 'label', 'okunmamış yönetim bildirimi', 'count', v_bildirim, 'href', 'duyurular')
    )
  );
end;
$$;

grant execute on function public.ajans_bugun_ozet(uuid) to authenticated;

create or replace function public.ajans_uyari_motoru(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.view_dashboard');

  -- 5+ gündür aktif olmayan host (device session)
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', 'inactive_host',
    'severity', 'medium',
    'title', 'Pasif host',
    'body', coalesce(p.display_name, p.username, 'Host') || ' 5+ gündür aktif değil',
    'user_id', x.user_id,
    'href', 'uyeler'
  )), '[]'::jsonb) into v_list
  from (
    select hp.user_id
    from public.host_profiles hp
    where hp.agency_id = p_agency_id and hp.status = 'agency'
      and not exists (
        select 1 from public.device_sessions ds
        where ds.user_id = hp.user_id
          and ds.revoked_at is null
          and ds.last_seen_at > now() - interval '5 days'
      )
    limit 20
  ) x
  join public.profiles p on p.id = x.user_id;

  -- Bekleyen başvuru > 48 saat
  v_list := v_list || coalesce((
    select jsonb_agg(jsonb_build_object(
      'code', 'stale_application',
      'severity', 'high',
      'title', 'Bekleyen başvuru',
      'body', coalesce(p.display_name, p.username, 'Aday') || ' başvurusu 48s+ bekliyor',
      'application_id', ha.id,
      'href', 'basvurular'
    ))
    from public.host_applications ha
    join public.profiles p on p.id = ha.user_id
    where ha.agency_id = p_agency_id
      and ha.status = 'agency_review'
      and ha.created_at < now() - interval '48 hours'
  ), '[]'::jsonb);

  -- Açık destek
  if to_regclass('public.agency_support_tickets') is not null then
    v_list := v_list || coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', 'open_support',
        'severity', 'medium',
        'title', 'Açık destek',
        'body', t.subject,
        'ticket_id', t.id,
        'href', 'destek'
      ))
      from public.agency_support_tickets t
      where t.agency_id = p_agency_id and t.status in ('open','in_progress')
    ), '[]'::jsonb);
  end if;

  -- Yeni güvenlik olayı
  if to_regclass('public.agency_security_events') is not null then
    v_list := v_list || coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', 'security_event',
        'severity', 'high',
        'title', 'Güvenlik olayı',
        'body', e.title,
        'event_id', e.id,
        'href', 'guvenlik'
      ))
      from public.agency_security_events e
      where e.agency_id = p_agency_id
        and e.created_at > now() - interval '7 days'
        and coalesce(e.acked, false) = false
    ), '[]'::jsonb);
  end if;

  -- Planlanan yayın başlamadı
  if to_regclass('public.agency_schedules') is not null then
    v_list := v_list || coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', 'missed_schedule',
        'severity', 'high',
        'title', 'Program başlamadı',
        'body', s.title,
        'schedule_id', s.id,
        'href', 'program'
      ))
      from public.agency_schedules s
      where s.agency_id = p_agency_id
        and s.status = 'scheduled'
        and s.starts_at < now() - interval '15 minutes'
        and s.starts_at > now() - interval '6 hours'
    ), '[]'::jsonb);
  end if;

  return jsonb_build_object('uyarilar', coalesce(v_list, '[]'::jsonb));
end;
$$;

grant execute on function public.ajans_uyari_motoru(uuid) to authenticated;

-- Yönetim ajans listesini staff rollerine aç
create or replace function public.ajans_yonetim_ajanslarim()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'agency_public_id', a.agency_public_id,
      'name', a.name,
      'status', a.status,
      'is_coin_distributor', a.is_coin_distributor,
      'invite_code', a.invite_code,
      'host_count', a.host_count,
      'level_code', a.level_code,
      'logo_url', a.logo_url,
      'username', a.username,
      'is_verified', coalesce(a.is_verified, false)
    ) order by a.created_at desc)
    from public.agencies a
    where a.status in ('active', 'suspended')
      and (
        a.owner_id = v_uid
        or exists (
          select 1 from public.agency_staff_roles s
          where s.agency_id = a.id and s.user_id = v_uid
            and s.role_code in ('OWNER','MANAGER','MODERATOR','HOST_MANAGER')
        )
      )
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.ajans_yonetim_ajanslarim() to authenticated;

-- Üye detay
create or replace function public.ajans_uye_detay(p_agency_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hp public.host_profiles%rowtype;
  crm public.agency_member_crm%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_members');

  select * into hp from public.host_profiles
  where user_id = p_user_id and agency_id = p_agency_id;
  if not found then raise exception 'Üye bulunamadı'; end if;

  select * into crm from public.agency_member_crm
  where agency_id = p_agency_id and user_id = p_user_id;

  return jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'username', p.username,
        'public_user_id', p.public_user_id,
        'avatar_url', p.avatar_url
      ) from public.profiles p where p.id = p_user_id
    ),
    'host', jsonb_build_object(
      'status', hp.status,
      'joined_at', hp.joined_agency_at,
      'daily_live_seconds', hp.daily_live_seconds,
      'monthly_live_seconds', hp.monthly_live_seconds,
      'total_live_seconds', hp.total_live_seconds
    ),
    'crm', case when crm.user_id is null then null else jsonb_build_object(
      'agency_status', crm.agency_status,
      'tags', crm.tags,
      'notes', crm.notes,
      'assigned_manager_id', crm.assigned_manager_id,
      'mentor_id', crm.mentor_id,
      'follow_up_at', crm.follow_up_at,
      'onboarding_stage', crm.onboarding_stage
    ) end,
    'role', (
      select role_code from public.agency_staff_roles
      where agency_id = p_agency_id and user_id = p_user_id
    ),
    'aktivite', jsonb_build_object(
      'ses_dakika_ay', coalesce((
        select floor(sum(extract(epoch from (
          coalesce(r.ended_at, case when r.is_live then now() else r.created_at end) - r.created_at
        )) / 60.0))::bigint
        from public.rooms r where r.host_id = p_user_id
          and r.created_at >= date_trunc('month', now())
      ), 0),
      'yayin_dakika_ay', coalesce((
        select floor(sum(extract(epoch from (
          coalesce(ls.ended_at, case when ls.is_live then now() else ls.started_at end) - ls.started_at
        )) / 60.0))::bigint
        from public.live_sessions ls where ls.host_id = p_user_id
          and ls.started_at >= date_trunc('month', now())
      ), 0),
      'son_aktif', (
        select max(ds.last_seen_at) from public.device_sessions ds where ds.user_id = p_user_id
      )
    ),
    'audit', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'action', l.action, 'summary', l.summary, 'created_at', l.created_at
      ) order by l.created_at desc)
      from (
        select * from public.agency_audit_logs
        where agency_id = p_agency_id and target_user_id = p_user_id
        order by created_at desc limit 30
      ) l
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.ajans_uye_detay(uuid, uuid) to authenticated;
