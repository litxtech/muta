-- Admin rapor detay: neden bildirildi, ilgili icerik, uyari/ban/sil/icerik kaldir

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
alter table public.user_reports
  add column if not exists content_type text,
  add column if not exists content_id uuid,
  add column if not exists context jsonb not null default '{}'::jsonb,
  add column if not exists admin_note text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null;

alter table public.room_chat_messages
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references public.profiles(id) on delete set null;

alter table public.live_chat_messages
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references public.profiles(id) on delete set null;

create index if not exists user_reports_status_created_idx
  on public.user_reports (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Bildir: icerik baglami ile
-- ---------------------------------------------------------------------------
drop function if exists public.kullanici_bildir(text, uuid, uuid, text);

create or replace function public.kullanici_bildir(
  p_reason text,
  p_target_user_id uuid default null,
  p_room_id uuid default null,
  p_details text default null,
  p_content_type text default null,
  p_content_id uuid default null,
  p_context jsonb default '{}'::jsonb
)
returns public.user_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.user_reports%rowtype;
  v_ctype text := lower(nullif(trim(coalesce(p_content_type, '')), ''));
  v_ctx jsonb := coalesce(p_context, '{}'::jsonb);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'Reason required';
  end if;
  if v_ctype is not null and v_ctype not in (
    'user', 'dm_message', 'room_chat', 'live_chat', 'room', 'profile', 'other'
  ) then
    v_ctype := 'other';
  end if;

  -- DM mesaj snapshot (silinse bile admin gorsun)
  if v_ctype = 'dm_message' and p_content_id is not null then
    select coalesce(v_ctx, '{}'::jsonb) || jsonb_build_object(
      'body', m.body,
      'message_type', m.message_type,
      'media_url', m.media_url,
      'sender_id', m.sender_id,
      'thread_id', m.thread_id,
      'created_at', m.created_at
    )
    into v_ctx
    from public.direct_messages m
    where m.id = p_content_id;
  elsif v_ctype = 'room_chat' and p_content_id is not null then
    select coalesce(v_ctx, '{}'::jsonb) || jsonb_build_object(
      'body', m.body,
      'user_id', m.user_id,
      'room_id', m.room_id,
      'created_at', m.created_at
    )
    into v_ctx
    from public.room_chat_messages m
    where m.id = p_content_id;
  elsif v_ctype = 'live_chat' and p_content_id is not null then
    select coalesce(v_ctx, '{}'::jsonb) || jsonb_build_object(
      'body', m.body,
      'user_id', m.user_id,
      'session_id', m.session_id,
      'created_at', m.created_at
    )
    into v_ctx
    from public.live_chat_messages m
    where m.id = p_content_id;
  end if;

  insert into public.user_reports (
    reporter_id, target_user_id, room_id, reason, details,
    content_type, content_id, context
  )
  values (
    v_uid, p_target_user_id, p_room_id, trim(p_reason),
    nullif(trim(coalesce(p_details, '')), ''),
    v_ctype, p_content_id, coalesce(v_ctx, '{}'::jsonb)
  )
  returning * into v_row;

  perform public.guvenlik_olayi_kaydet(
    'user_report',
    p_target_user_id,
    jsonb_build_object(
      'report_id', v_row.id,
      'reason', p_reason,
      'content_type', v_ctype,
      'content_id', p_content_id
    )
  );

  return v_row;
end;
$$;

grant execute on function public.kullanici_bildir(text, uuid, uuid, text, text, uuid, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Zengin rapor listesi
-- ---------------------------------------------------------------------------
create or replace function public.admin_rapor_kuyrugu(p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lim int := least(greatest(coalesce(p_limit, 50), 1), 120);
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(x)::jsonb order by x.sort_rank, x.created_at desc)
    from (
      select
        r.id,
        r.reporter_id,
        r.target_user_id,
        r.room_id,
        r.reason,
        r.details,
        r.status,
        r.created_at,
        r.content_type,
        r.content_id,
        r.context,
        r.admin_note,
        case when r.status in ('open', 'reviewing') then 0 else 1 end as sort_rank,
        jsonb_build_object(
          'id', rp.id,
          'display_name', rp.display_name,
          'username', rp.username,
          'avatar_url', rp.avatar_url,
          'public_user_id', rp.public_user_id
        ) as reporter,
        case when tp.id is null then null else jsonb_build_object(
          'id', tp.id,
          'display_name', tp.display_name,
          'username', tp.username,
          'avatar_url', tp.avatar_url,
          'public_user_id', tp.public_user_id,
          'banned_at', tp.banned_at,
          'deleted_at', tp.deleted_at
        ) end as target,
        case when rm.id is null then null else jsonb_build_object(
          'id', rm.id,
          'title', rm.title,
          'mode', rm.mode,
          'is_live', rm.is_live
        ) end as room,
        coalesce(r.context->>'body', r.details, r.reason) as ozet
      from public.user_reports r
      left join public.profiles rp on rp.id = r.reporter_id
      left join public.profiles tp on tp.id = r.target_user_id
      left join public.rooms rm on rm.id = r.room_id
      order by
        case when r.status in ('open', 'reviewing') then 0 else 1 end,
        r.created_at desc
      limit v_lim
    ) x
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Tek rapor detay (canli icerik + snapshot)
-- ---------------------------------------------------------------------------
create or replace function public.admin_rapor_detay(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.user_reports%rowtype;
  v_live jsonb := null;
  v_media text := null;
  v_text text := null;
  v_removed boolean := false;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_id is null then raise exception 'id gerekli'; end if;

  select * into r from public.user_reports where id = p_id;
  if not found then raise exception 'Rapor bulunamadi'; end if;

  if r.content_type = 'dm_message' and r.content_id is not null then
    select jsonb_build_object(
      'kind', 'dm_message',
      'id', m.id,
      'body', m.body,
      'message_type', m.message_type,
      'media_url', m.media_url,
      'deleted_at', m.deleted_at,
      'created_at', m.created_at,
      'thread_id', m.thread_id,
      'sender_id', m.sender_id
    ), m.media_url, m.body, (m.deleted_at is not null)
    into v_live, v_media, v_text, v_removed
    from public.direct_messages m where m.id = r.content_id;
  elsif r.content_type = 'room_chat' and r.content_id is not null then
    select jsonb_build_object(
      'kind', 'room_chat',
      'id', m.id,
      'body', m.body,
      'room_id', m.room_id,
      'user_id', m.user_id,
      'removed_at', m.removed_at,
      'created_at', m.created_at
    ), null, m.body, (m.removed_at is not null)
    into v_live, v_media, v_text, v_removed
    from public.room_chat_messages m where m.id = r.content_id;
  elsif r.content_type = 'live_chat' and r.content_id is not null then
    select jsonb_build_object(
      'kind', 'live_chat',
      'id', m.id,
      'body', m.body,
      'session_id', m.session_id,
      'user_id', m.user_id,
      'removed_at', m.removed_at,
      'created_at', m.created_at
    ), null, m.body, (m.removed_at is not null)
    into v_live, v_media, v_text, v_removed
    from public.live_chat_messages m where m.id = r.content_id;
  elsif r.content_type = 'profile' and r.target_user_id is not null then
    select jsonb_build_object(
      'kind', 'profile',
      'id', p.id,
      'bio', p.bio,
      'avatar_url', p.avatar_url,
      'display_name', p.display_name
    ), p.avatar_url, p.bio, false
    into v_live, v_media, v_text, v_removed
    from public.profiles p where p.id = r.target_user_id;
  end if;

  -- Snapshot fallback
  if v_media is null then
    v_media := nullif(r.context->>'media_url', '');
  end if;
  if v_text is null then
    v_text := coalesce(nullif(r.context->>'body', ''), r.details);
  end if;

  return jsonb_build_object(
    'rapor', jsonb_build_object(
      'id', r.id,
      'reason', r.reason,
      'details', r.details,
      'status', r.status,
      'created_at', r.created_at,
      'content_type', r.content_type,
      'content_id', r.content_id,
      'context', r.context,
      'admin_note', r.admin_note,
      'room_id', r.room_id,
      'reporter_id', r.reporter_id,
      'target_user_id', r.target_user_id,
      'resolved_at', r.resolved_at
    ),
    'reporter', (
      select jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'username', p.username,
        'avatar_url', p.avatar_url,
        'public_user_id', p.public_user_id
      ) from public.profiles p where p.id = r.reporter_id
    ),
    'target', (
      select case when p.id is null then null else jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'username', p.username,
        'avatar_url', p.avatar_url,
        'public_user_id', p.public_user_id,
        'banned_at', p.banned_at,
        'ban_reason', p.ban_reason,
        'deleted_at', p.deleted_at,
        'is_guest', p.is_guest,
        'level', p.level
      ) end
      from public.profiles p where p.id = r.target_user_id
    ),
    'room', (
      select case when rm.id is null then null else jsonb_build_object(
        'id', rm.id,
        'title', rm.title,
        'mode', rm.mode,
        'is_live', rm.is_live,
        'host_id', rm.host_id
      ) end
      from public.rooms rm where rm.id = r.room_id
    ),
    'icerik', jsonb_build_object(
      'canli', v_live,
      'snapshot', r.context,
      'metin', v_text,
      'media_url', v_media,
      'kaldirildi', coalesce(v_removed, false),
      'tur', coalesce(r.content_type, 'user')
    ),
    'hedef_ihtarlar', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id,
        'reason', w.reason,
        'severity', w.severity,
        'created_at', w.created_at,
        'cleared_at', w.cleared_at
      ) order by w.created_at desc)
      from public.user_warnings w
      where w.user_id = r.target_user_id
      limit 12
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Icerik kaldir
-- ---------------------------------------------------------------------------
create or replace function public.admin_rapor_icerik_kaldir(p_report_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.user_reports%rowtype;
  v_uid uuid := auth.uid();
  v_done boolean := false;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  select * into r from public.user_reports where id = p_report_id;
  if not found then raise exception 'Rapor bulunamadi'; end if;

  if r.content_type = 'dm_message' and r.content_id is not null then
    update public.direct_messages
    set deleted_at = coalesce(deleted_at, now()),
        body = case when body is null or body = '' then '[kaldırıldı]' else body end
    where id = r.content_id;
    v_done := found;
  elsif r.content_type = 'room_chat' and r.content_id is not null then
    update public.room_chat_messages
    set body = '[moderasyon tarafından kaldırıldı]',
        removed_at = now(),
        removed_by = v_uid
    where id = r.content_id and removed_at is null;
    v_done := found;
  elsif r.content_type = 'live_chat' and r.content_id is not null then
    update public.live_chat_messages
    set body = '[moderasyon tarafından kaldırıldı]',
        removed_at = now(),
        removed_by = v_uid
    where id = r.content_id and removed_at is null;
    v_done := found;
  elsif r.content_type = 'profile' and r.target_user_id is not null then
    update public.profiles
    set avatar_url = null,
        bio = null
    where id = r.target_user_id;
    v_done := found;
  else
    raise exception 'Bu raporda kaldırılacak içerik yok';
  end if;

  perform public.admin_audit_yaz(
    r.target_user_id,
    'report_content_removed',
    'Rapor icerigi kaldirildi',
    jsonb_build_object(
      'report_id', p_report_id,
      'content_type', r.content_type,
      'content_id', r.content_id
    )
  );

  return jsonb_build_object('ok', true, 'removed', v_done);
end;
$$;

-- ---------------------------------------------------------------------------
-- Durum guncelle + opsiyonel admin not
-- ---------------------------------------------------------------------------
drop function if exists public.admin_rapor_durum_guncelle(uuid, text);

create or replace function public.admin_rapor_durum_guncelle(
  p_id uuid,
  p_status text,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_status not in ('open','reviewing','resolved','dismissed') then
    raise exception 'Gecersiz durum';
  end if;

  update public.user_reports set
    status = p_status,
    admin_note = coalesce(nullif(trim(coalesce(p_admin_note, '')), ''), admin_note),
    resolved_at = case
      when p_status in ('resolved', 'dismissed') then coalesce(resolved_at, now())
      else null
    end,
    resolved_by = case
      when p_status in ('resolved', 'dismissed') then auth.uid()
      else null
    end
  where id = p_id
  returning target_user_id into v_uid;

  if not found then raise exception 'Rapor bulunamadi'; end if;

  perform public.admin_audit_yaz(
    v_uid,
    'report_' || p_status,
    'Rapor durumu: ' || p_status,
    jsonb_build_object('report_id', p_id)
  );

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Ihtar verirken push bildirimi
-- ---------------------------------------------------------------------------
create or replace function public.admin_ihtar_ver(
  p_user_id uuid,
  p_reason text,
  p_severity text default 'medium',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_sev text := coalesce(nullif(trim(p_severity), ''), 'medium');
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Sebep gerekli'; end if;
  if v_sev not in ('low', 'medium', 'high', 'critical') then
    v_sev := 'medium';
  end if;

  insert into public.user_warnings (user_id, issued_by, reason, severity, notes)
  values (p_user_id, auth.uid(), trim(p_reason), v_sev, nullif(trim(p_notes), ''))
  returning id into v_id;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    p_user_id, 'user_warning', v_sev,
    jsonb_build_object('warning_id', v_id, 'reason', p_reason, 'by', auth.uid())
  );

  perform public.admin_audit_yaz(
    p_user_id, 'warning',
    'Ihtar verildi: ' || trim(p_reason),
    jsonb_build_object('warning_id', v_id, 'severity', v_sev)
  );

  perform public.bildirim_kuyruga_ekle(
    p_user_id,
    'system',
    'Uyarı aldın',
    left(trim(p_reason), 180),
    '/guvenlik',
    jsonb_build_object('warning_id', v_id, 'type', 'admin_warning', 'severity', v_sev)
  );

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- Sohbet listelerinde kaldirilanlari gizle
create or replace function public.oda_sohbet_mesajlarini_getir(
  p_room_id uuid,
  p_limit int default 50
)
returns table (
  id uuid,
  room_id uuid,
  user_id uuid,
  body text,
  created_at timestamptz,
  display_name text,
  username text,
  avatar_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  return query
  select
    m.id, m.room_id, m.user_id, m.body, m.created_at,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Kullanıcı'),
    p.username,
    p.avatar_url
  from public.room_chat_messages m
  left join public.profiles p on p.id = m.user_id
  where m.room_id = p_room_id
    and m.removed_at is null
    and not public.kullanicilar_engelli_mi(v_uid, m.user_id)
  order by m.created_at desc
  limit v_limit;
end;
$$;

create or replace function public.canli_sohbet_mesajlarini_getir(
  p_session_id uuid,
  p_limit int default 50
)
returns table (
  id uuid,
  session_id uuid,
  user_id uuid,
  body text,
  created_at timestamptz,
  display_name text,
  username text,
  avatar_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  return query
  select
    m.id, m.session_id, m.user_id, m.body, m.created_at,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Kullanıcı'),
    p.username,
    p.avatar_url
  from public.live_chat_messages m
  left join public.profiles p on p.id = m.user_id
  where m.session_id = p_session_id
    and m.removed_at is null
    and not public.kullanicilar_engelli_mi(v_uid, m.user_id)
  order by m.created_at desc
  limit v_limit;
end;
$$;

grant execute on function public.admin_rapor_kuyrugu(int) to authenticated;
grant execute on function public.admin_rapor_detay(uuid) to authenticated;
grant execute on function public.admin_rapor_icerik_kaldir(uuid) to authenticated;
grant execute on function public.admin_rapor_durum_guncelle(uuid, text, text) to authenticated;
grant execute on function public.oda_sohbet_mesajlarini_getir(uuid, int) to authenticated;
grant execute on function public.canli_sohbet_mesajlarini_getir(uuid, int) to authenticated;
