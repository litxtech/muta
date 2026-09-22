-- Hesap silme: platformda "Hesap silindi" profili, içerik/oda/ajans temizliği,
-- soft-delete sonrası aynı kimlikle tekrar giriş engeli (auth ban).

create or replace function public.hesap_sil_istegi(p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_already boolean := false;
  v_uname text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select deleted_at is not null into v_already
  from public.profiles where id = v_uid;
  if not found then
    return jsonb_build_object('ok', true, 'kod', 'no_profile');
  end if;
  if v_already then
    return jsonb_build_object('ok', true, 'kod', 'already_deleted');
  end if;

  begin
    perform public.platform_guvenlik_tombstone_yaz(v_uid, 'self', p_reason);
  exception when others then
    null;
  end;

  v_uname := 'deleted_' || replace(v_uid::text, '-', '');

  update public.profiles set
    deleted_at = now(),
    deletion_requested_at = now(),
    display_name = 'Hesap silindi',
    username = v_uname,
    avatar_url = null,
    cover_url = null,
    bio = '',
    phone_e164 = null,
    birth_date = null,
    gender = null,
    country_code = null,
    region_id = null,
    public_user_id = left('x' || replace(v_uid::text, '-', ''), 12),
    is_host = false,
    is_verified = false,
    updated_at = now()
  where id = v_uid and deleted_at is null;

  update public.device_sessions
    set revoked_at = now()
  where user_id = v_uid and revoked_at is null;

  begin
    update public.device_push_tokens
      set push_token = null,
          active = false,
          notification_enabled = false
    where user_id = v_uid;
  exception when undefined_table then
    null;
  when undefined_column then
    delete from public.device_push_tokens where user_id = v_uid;
  end;

  begin
    delete from public.user_bank_accounts where user_id = v_uid;
  exception when undefined_table then
    null;
  end;

  -- Görüşme / canlı yayın
  begin
    update public.direct_calls set
      status = case when status = 'ringing' then 'cancelled' else 'ended' end,
      ended_at = now(),
      ended_by = v_uid,
      end_reason = 'account_deleted'
    where status in ('ringing', 'active')
      and (caller_id = v_uid or callee_id = v_uid);
  exception when undefined_table then
    null;
  end;

  begin
    update public.live_sessions set
      is_live = false,
      ended_at = coalesce(ended_at, now()),
      viewer_count = 0
    where host_id = v_uid and is_live = true;
  exception when undefined_table then
    null;
  end;

  -- Ses odaları: üyelikten çıkar + sahip olduğu odaları kapat / gizle
  begin
    delete from public.room_members where user_id = v_uid;

    update public.room_seats
      set user_id = null, is_muted = false
    where user_id = v_uid;

    begin
      delete from public.room_mic_requests where user_id = v_uid;
    exception when undefined_table then
      null;
    end;

    begin
      delete from public.room_lobby_presence where user_id = v_uid;
    exception when undefined_table then
      null;
    end;

    update public.rooms set
      is_live = false,
      ended_at = coalesce(ended_at, now()),
      listener_count = 0,
      title = 'Silinmiş oda',
      cover_url = null,
      updated_at = now()
    where host_id = v_uid;

    -- Host odalarındaki kalan üyeleri de boşalt
    delete from public.room_members
    where room_id in (select id from public.rooms where host_id = v_uid);

    update public.room_seats
      set user_id = null, is_muted = false
    where room_id in (select id from public.rooms where host_id = v_uid);
  exception when undefined_table then
    null;
  when others then
    null;
  end;

  -- Durum gönderileri / yorumlar
  begin
    update public.status_posts
      set deleted_at = coalesce(deleted_at, now()), updated_at = now()
    where user_id = v_uid and deleted_at is null;

    update public.status_comments
      set deleted_at = coalesce(deleted_at, now())
    where user_id = v_uid and deleted_at is null;
  exception when undefined_table then
    null;
  end;

  begin
    update public.room_chat_messages
      set body = '[silindi]',
          removed_at = coalesce(removed_at, now()),
          removed_by = coalesce(removed_by, v_uid)
    where user_id = v_uid and removed_at is null;
  exception when undefined_table then
    null;
  when undefined_column then
    null;
  end;

  begin
    update public.live_chat_messages
      set body = '[silindi]',
          removed_at = coalesce(removed_at, now()),
          removed_by = coalesce(removed_by, v_uid)
    where user_id = v_uid and removed_at is null;
  exception when undefined_table then
    null;
  when undefined_column then
    null;
  end;

  begin
    update public.message_thread_members
      set deleted_at = coalesce(deleted_at, now())
    where user_id = v_uid and deleted_at is null;
  exception when undefined_table then
    null;
  end;

  -- Takip grafiği
  begin
    delete from public.follows
    where follower_id = v_uid or following_id = v_uid;
  exception when undefined_table then
    null;
  end;

  begin
    delete from public.follow_requests
    where requester_id = v_uid or target_id = v_uid;
  exception when undefined_table then
    null;
  when undefined_column then
    null;
  end;

  -- Ajans: sahip olunan ajansları kapat, üyelikleri kopar
  begin
    update public.agencies set
      status = 'closed',
      updated_at = now()
    where owner_id = v_uid
      and status is distinct from 'closed';

    update public.host_profiles set
      status = 'independent',
      agency_id = null,
      updated_at = now()
    where user_id = v_uid
      and (agency_id is not null or status = 'agency');

    delete from public.agency_staff_roles where user_id = v_uid;

    begin
      update public.agency_applications set
        status = 'rejected',
        reviewed_at = coalesce(reviewed_at, now()),
        review_note = coalesce(review_note, 'account_deleted')
      where applicant_id = v_uid
        and status in ('pending', 'under_review');
    exception when undefined_table then
      null;
    when others then
      null;
    end;

    begin
      update public.agency_invites set
        status = 'revoked'
      where created_by = v_uid
        and status = 'active';
    exception when undefined_table then
      null;
    when others then
      null;
    end;
  exception when undefined_table then
    null;
  when others then
    null;
  end;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    v_uid, 'account_delete_requested', 'medium',
    jsonb_build_object(
      'reason', left(coalesce(p_reason, ''), 200),
      'source', 'hesap_sil_istegi',
      'pii_cleared', true,
      'content_scrubbed', true,
      'rooms_closed', true,
      'agency_scrubbed', true
    )
  );

  return jsonb_build_object('ok', true, 'kod', 'deleted');
end;
$function$;

grant execute on function public.hesap_sil_istegi(text) to authenticated;

-- Admin silme de aynı görünür adı kullansın
create or replace function public.admin_kullanici_sil(
  p_user_id uuid,
  p_reason text default 'admin_delete'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'admin_delete');
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_user_id = auth.uid() then raise exception 'Kendini silemezsin'; end if;

  begin
    perform public.platform_guvenlik_tombstone_yaz(p_user_id, 'admin', v_reason);
  exception when others then
    null;
  end;

  update public.profiles set
    deleted_at = now(),
    deletion_requested_at = now(),
    banned_at = coalesce(banned_at, now()),
    ban_reason = coalesce(ban_reason, v_reason),
    display_name = 'Hesap silindi',
    username = 'deleted_' || replace(id::text, '-', ''),
    avatar_url = null,
    cover_url = null,
    bio = '',
    phone_e164 = null,
    updated_at = now()
  where id = p_user_id and deleted_at is null;

  update public.device_sessions
    set revoked_at = now()
  where user_id = p_user_id and revoked_at is null;

  begin
    delete from public.room_members where user_id = p_user_id;
    update public.room_seats set user_id = null, is_muted = false where user_id = p_user_id;
    update public.rooms set
      is_live = false,
      ended_at = coalesce(ended_at, now()),
      listener_count = 0,
      title = 'Silinmiş oda',
      cover_url = null,
      updated_at = now()
    where host_id = p_user_id;
    delete from public.room_members
    where room_id in (select id from public.rooms where host_id = p_user_id);
  exception when others then
    null;
  end;

  begin
    update public.status_posts
      set deleted_at = coalesce(deleted_at, now()), updated_at = now()
    where user_id = p_user_id and deleted_at is null;
    update public.status_comments
      set deleted_at = coalesce(deleted_at, now())
    where user_id = p_user_id and deleted_at is null;
  exception when others then
    null;
  end;

  begin
    update public.agencies set status = 'closed', updated_at = now()
    where owner_id = p_user_id and status is distinct from 'closed';
    update public.host_profiles set
      status = 'independent', agency_id = null, updated_at = now()
    where user_id = p_user_id;
    delete from public.agency_staff_roles where user_id = p_user_id;
  exception when others then
    null;
  end;

  begin
    delete from public.follows
    where follower_id = p_user_id or following_id = p_user_id;
  exception when others then
    null;
  end;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    p_user_id, 'account_admin_deleted', 'critical',
    jsonb_build_object('reason', v_reason, 'by', auth.uid())
  );

  begin
    perform public.admin_audit_yaz(
      p_user_id, 'delete',
      'Hesap admin tarafindan silindi',
      jsonb_build_object('reason', v_reason)
    );
  exception when others then
    null;
  end;

  return jsonb_build_object('ok', true, 'kod', 'deleted');
end;
$function$;
