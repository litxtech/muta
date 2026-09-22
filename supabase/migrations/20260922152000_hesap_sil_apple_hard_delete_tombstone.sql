-- Hesap silme: Apple tekrar girişte AYNI hesaba dönmesin.
-- 1) profiles FK CASCADE kaldır → auth.users hard delete profil tombstone'u silmesin
-- 2) hesap_sil_istegi güçlendir (içerik/oda/ajans scrub, "Hesap silindi")

-- Profil satırı auth.users silinince yok olmasın (tombstone kalsın)
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- İsteğe bağlı bütünlük: auth varken referans; silinince orphan tombstone serbest
-- (hard delete sonrası profiles satırı "Hesap silindi" olarak kalır)

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
  end;

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
    exception when others then
      null;
    end;

    begin
      update public.agency_invites set
        status = 'revoked'
      where created_by = v_uid
        and status = 'active';
    exception when others then
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
