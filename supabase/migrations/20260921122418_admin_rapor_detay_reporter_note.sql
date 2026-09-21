-- admin_rapor_detay: bildirene not (reporter_note) alanını da döndür
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
      'reporter_note', r.reporter_note,
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
