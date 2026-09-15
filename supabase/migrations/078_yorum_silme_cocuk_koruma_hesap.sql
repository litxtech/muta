-- Yorum silme (oda/canlı), çocuk koruma önceliği, hesap silme PII/içerik temizliği

-- ---------------------------------------------------------------------------
-- Oda yorum sil (yazar veya oda host)
-- ---------------------------------------------------------------------------
create or replace function public.oda_sohbet_mesaji_sil(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_msg public.room_chat_messages%rowtype;
  v_host uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_msg from public.room_chat_messages where id = p_message_id;
  if not found then raise exception 'Mesaj yok'; end if;
  if v_msg.removed_at is not null then
    return jsonb_build_object('ok', true, 'kod', 'already_removed');
  end if;

  select host_id into v_host from public.rooms where id = v_msg.room_id;

  if v_msg.user_id <> v_uid and v_host is distinct from v_uid
     and not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;

  update public.room_chat_messages
  set body = case when v_msg.user_id = v_uid then '[silindi]' else '[kaldırıldı]' end,
      removed_at = now(),
      removed_by = v_uid
  where id = p_message_id and removed_at is null;

  return jsonb_build_object('ok', true, 'kod', 'removed');
end;
$$;

grant execute on function public.oda_sohbet_mesaji_sil(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Canlı yayın yorum sil (yazar veya yayıncı)
-- ---------------------------------------------------------------------------
create or replace function public.canli_sohbet_mesaji_sil(p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_msg public.live_chat_messages%rowtype;
  v_host uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_msg from public.live_chat_messages where id = p_message_id;
  if not found then raise exception 'Mesaj yok'; end if;
  if v_msg.removed_at is not null then
    return jsonb_build_object('ok', true, 'kod', 'already_removed');
  end if;

  select host_id into v_host from public.live_sessions where id = v_msg.session_id;

  if v_msg.user_id <> v_uid and v_host is distinct from v_uid
     and not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;

  update public.live_chat_messages
  set body = case when v_msg.user_id = v_uid then '[silindi]' else '[kaldırıldı]' end,
      removed_at = now(),
      removed_by = v_uid
  where id = p_message_id and removed_at is null;

  return jsonb_build_object('ok', true, 'kod', 'removed');
end;
$$;

grant execute on function public.canli_sohbet_mesaji_sil(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Bildir: çocuk koruma / kritik sebepler + reason_code
-- ---------------------------------------------------------------------------
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
    p_target_user_id,
    jsonb_build_object(
      'report_id', v_row.id,
      'reason', v_reason,
      'reason_code', v_code,
      'content_type', v_ctype,
      'content_id', p_content_id,
      'severity', v_sev,
      'child_safety', v_is_child
    )
  );

  return v_row;
end;
$$;

grant execute on function public.kullanici_bildir(text, uuid, uuid, text, text, uuid, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Kayıt: birth_date metadata (18+ zorunlu)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
  is_guest_meta boolean;
  is_sample_meta boolean;
  pid text;
  v_display text;
  v_phone text;
  v_birth date;
  v_birth_raw text;
begin
  is_guest_meta := coalesce((new.raw_user_meta_data->>'is_guest')::boolean, false);
  is_sample_meta := coalesce((new.raw_user_meta_data->>'is_sample')::boolean, false);
  uname := coalesce(
    new.raw_user_meta_data->>'username',
    case when is_guest_meta then 'guest_' || substr(replace(new.id::text, '-', ''), 1, 8)
         else 'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
    end
  );
  pid := public.yeni_public_kullanici_id();
  v_display := coalesce(new.raw_user_meta_data->>'display_name', uname);
  v_phone := public.telefon_e164_normalize(new.raw_user_meta_data->>'phone_e164');

  v_birth_raw := nullif(trim(coalesce(new.raw_user_meta_data->>'birth_date', '')), '');
  if v_birth_raw is not null then
    begin
      v_birth := v_birth_raw::date;
    exception when others then
      v_birth := null;
    end;
    if v_birth is not null then
      if v_birth > (current_date - interval '18 years') then
        raise exception 'Platform 18 yas ve uzeri icindir';
      end if;
      if v_birth < date '1920-01-01' then
        raise exception 'Gecersiz dogum tarihi';
      end if;
    end if;
  end if;

  insert into public.profiles (
    id, username, display_name, gender, birth_date, public_user_id,
    is_guest, is_sample, language, phone_e164
  ) values (
    new.id,
    uname,
    v_display,
    coalesce(new.raw_user_meta_data->>'gender', null),
    v_birth,
    pid,
    is_guest_meta,
    is_sample_meta,
    coalesce(new.raw_user_meta_data->>'language', 'tr'),
    case when is_guest_meta then null else v_phone end
  );

  insert into public.wallets (user_id, coins, diamonds)
  values (new.id, case when is_guest_meta then 0 else 100 end, 0);

  if not is_guest_meta then
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason)
    values (new.id, 'coins', 100, 100, 'welcome_bonus');
  end if;

  if not is_sample_meta then
    begin
      perform public.admin_operasyon_bildirimi(
        case when is_guest_meta then 'Yeni misafir kayıt' else 'Yeni kullanıcı kayıt' end,
        trim(
          coalesce(v_display, uname)
          || case when uname is not null then ' · @' || uname else '' end
          || ' · ID ' || coalesce(pid, left(new.id::text, 8))
          || case when v_phone is not null then ' · ' || v_phone else '' end
          || case when new.email is not null then ' · ' || new.email else '' end
        ),
        '/admin/kullanicilar/' || new.id::text,
        jsonb_build_object(
          'type', 'admin_new_registration',
          'user_id', new.id,
          'is_guest', is_guest_meta,
          'public_user_id', pid,
          'username', uname,
          'display_name', v_display,
          'phone_e164', v_phone
        )
      );
    exception when others then
      null;
    end;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hesap silme: PII + içerik temizliği
-- ---------------------------------------------------------------------------
create or replace function public.hesap_sil_istegi(p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  v_uname := 'deleted_' || replace(v_uid::text, '-', '');

  update public.profiles set
    deleted_at = now(),
    deletion_requested_at = now(),
    display_name = 'Silinmiş hesap',
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
    update public.rooms set
      is_live = false,
      ended_at = coalesce(ended_at, now()),
      listener_count = 0
    where host_id = v_uid and is_live = true;

    delete from public.room_members where user_id = v_uid;

    delete from public.room_members
    where room_id in (select id from public.rooms where host_id = v_uid);

    update public.room_seats
    set user_id = null, is_muted = false
    where user_id = v_uid
       or room_id in (select id from public.rooms where host_id = v_uid);
  exception when undefined_table then
    null;
  when others then
    null;
  end;

  -- Durumlar ve yorumlar
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

  -- Oda / canlı yorumları gizle
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

  -- DM thread üyelikleri
  begin
    update public.message_thread_members
      set deleted_at = coalesce(deleted_at, now())
    where user_id = v_uid and deleted_at is null;
  exception when undefined_table then
    null;
  end;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    v_uid, 'account_delete_requested', 'medium',
    jsonb_build_object(
      'reason', left(coalesce(p_reason, ''), 200),
      'source', 'hesap_sil_istegi',
      'pii_cleared', true,
      'content_scrubbed', true
    )
  );

  return jsonb_build_object('ok', true, 'kod', 'deleted');
end;
$$;

grant execute on function public.hesap_sil_istegi(text) to authenticated;
