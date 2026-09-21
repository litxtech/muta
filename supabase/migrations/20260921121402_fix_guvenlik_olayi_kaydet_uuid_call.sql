-- Fix: kullanici_bildir → guvenlik_olayi_kaydet(text, uuid, jsonb) yanlış imza
-- Doğru imza: (p_event_type text, p_device_id text, p_metadata jsonb)
-- p_target_user_id metadata'ya taşınır; device_id null kalır.

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
  v_reason text := trim(coalesce(p_reason, ''));
  v_code text := lower(nullif(trim(coalesce(p_context->>'reason_code', '')), ''));
  v_sev text := 'medium';
  v_is_child boolean := false;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if length(v_reason) = 0 then raise exception 'Reason required'; end if;

  if v_ctype is not null and v_ctype not in (
    'user', 'dm_message', 'room_chat', 'live_chat', 'room', 'profile',
    'status_post', 'status_comment', 'other'
  ) then
    v_ctype := 'other';
  end if;

  if v_ctype = 'dm_message' and p_content_id is not null then
    select coalesce(v_ctx, '{}'::jsonb) || jsonb_build_object(
      'body', m.body, 'message_type', m.message_type, 'media_url', m.media_url,
      'sender_id', m.sender_id, 'thread_id', m.thread_id, 'created_at', m.created_at
    ) into v_ctx from public.direct_messages m where m.id = p_content_id;
  elsif v_ctype = 'room_chat' and p_content_id is not null then
    select coalesce(v_ctx, '{}'::jsonb) || jsonb_build_object(
      'body', m.body, 'user_id', m.user_id, 'room_id', m.room_id, 'created_at', m.created_at
    ) into v_ctx from public.room_chat_messages m where m.id = p_content_id;
  elsif v_ctype = 'live_chat' and p_content_id is not null then
    select coalesce(v_ctx, '{}'::jsonb) || jsonb_build_object(
      'body', m.body, 'user_id', m.user_id, 'session_id', m.session_id, 'created_at', m.created_at
    ) into v_ctx from public.live_chat_messages m where m.id = p_content_id;
  elsif v_ctype = 'status_post' and p_content_id is not null then
    select coalesce(v_ctx, '{}'::jsonb) || jsonb_build_object(
      'media_type', s.media_type, 'media_url', s.media_url, 'caption', s.caption,
      'user_id', s.user_id, 'created_at', s.created_at
    ) into v_ctx from public.status_posts s where s.id = p_content_id;
  elsif v_ctype = 'status_comment' and p_content_id is not null then
    select coalesce(v_ctx, '{}'::jsonb) || jsonb_build_object(
      'body', c.body, 'user_id', c.user_id, 'status_id', c.status_id, 'created_at', c.created_at
    ) into v_ctx from public.status_comments c where c.id = p_content_id;
  end if;

  v_is_child :=
    v_code = 'child_safety'
    or lower(v_reason) in ('child_safety')
    or lower(v_reason) like '%çocuk%'
    or lower(v_reason) like '%cocuk%'
    or lower(v_reason) like '%csam%'
    or lower(v_reason) like '%reşit olmayan%'
    or lower(v_reason) like '%resit olmayan%';

  if v_is_child
     or v_code in ('sexual', 'violence')
     or lower(v_reason) in ('sexual', 'violence')
     or lower(v_reason) like '%cinsel%'
     or lower(v_reason) like '%şiddet%'
     or lower(v_reason) like '%siddet%'
  then
    v_sev := 'critical';
  end if;

  v_ctx := coalesce(v_ctx, '{}'::jsonb) || jsonb_build_object(
    'reason_code', coalesce(nullif(v_code, ''), null),
    'priority', v_sev,
    'child_safety', v_is_child
  );

  insert into public.user_reports (
    reporter_id, target_user_id, room_id, reason, details,
    content_type, content_id, context
  )
  values (
    v_uid, p_target_user_id, p_room_id, v_reason,
    nullif(trim(coalesce(p_details, '')), ''),
    v_ctype, p_content_id, coalesce(v_ctx, '{}'::jsonb)
  )
  returning * into v_row;

  perform public.guvenlik_olayi_kaydet(
    case when v_is_child then 'child_safety_report' else 'user_report' end,
    null::text,
    jsonb_build_object(
      'report_id', v_row.id,
      'reason', v_reason,
      'reason_code', v_code,
      'content_type', v_ctype,
      'content_id', p_content_id,
      'target_user_id', p_target_user_id,
      'severity', v_sev,
      'child_safety', v_is_child
    )
  );

  return v_row;
end;
$$;

grant execute on function public.kullanici_bildir(text, uuid, uuid, text, text, uuid, jsonb)
  to authenticated;
