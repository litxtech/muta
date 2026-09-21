-- Durum → DM paylaşımı (shared_post)
-- Mesaj gönderiye referans verir; içerik snapshot kopyalanmaz.

-- ---------------------------------------------------------------------------
-- 1) status_posts: share_count + removal_source
-- ---------------------------------------------------------------------------
alter table public.status_posts
  add column if not exists share_count integer not null default 0;

alter table public.status_posts
  add column if not exists removal_source text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'status_posts_removal_source_check'
  ) then
    alter table public.status_posts
      add constraint status_posts_removal_source_check
      check (
        removal_source is null
        or removal_source in ('owner', 'platform')
      );
  end if;
end $$;

comment on column public.status_posts.removal_source is
  'owner = kullanıcı sildi; platform = moderasyon/admin kaldırdı';

-- ---------------------------------------------------------------------------
-- 2) direct_messages: shared_post tipi + ref_id
-- ---------------------------------------------------------------------------
alter table public.direct_messages
  add column if not exists ref_id uuid;

comment on column public.direct_messages.ref_id is
  'shared_post → status_posts.id (içerik snapshot yok)';

alter table public.direct_messages
  drop constraint if exists direct_messages_message_type_check;

alter table public.direct_messages
  add constraint direct_messages_message_type_check
  check (
    message_type = any (
      array[
        'text'::text,
        'image'::text,
        'video'::text,
        'voice'::text,
        'emoji'::text,
        'gift'::text,
        'system'::text,
        'shared_post'::text
      ]
    )
  );

create index if not exists direct_messages_ref_id_idx
  on public.direct_messages (ref_id)
  where ref_id is not null and message_type = 'shared_post';

-- Normalize ilişki (opsiyonel bütünlük; mesajdaki ref_id authoritative)
create table if not exists public.message_shared_posts (
  message_id uuid primary key
    references public.direct_messages (id) on delete cascade,
  status_post_id uuid not null
    references public.status_posts (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists message_shared_posts_status_idx
  on public.message_shared_posts (status_post_id);

alter table public.message_shared_posts enable row level security;

drop policy if exists "message_shared_posts_select" on public.message_shared_posts;
create policy "message_shared_posts_select"
  on public.message_shared_posts for select to authenticated
  using (
    exists (
      select 1
      from public.direct_messages m
      join public.message_thread_members tm
        on tm.thread_id = m.thread_id and tm.user_id = auth.uid()
      where m.id = message_id
    )
  );

-- ---------------------------------------------------------------------------
-- 3) durum_sil → removal_source ayır
-- ---------------------------------------------------------------------------
create or replace function public.durum_sil(p_status_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_source text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select user_id into v_owner from public.status_posts where id = p_status_id;
  if v_owner is null then raise exception 'Durum yok'; end if;
  if v_owner <> v_uid and not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;

  v_source := case
    when v_owner = v_uid then 'owner'
    else 'platform'
  end;

  update public.status_posts
  set
    deleted_at = coalesce(deleted_at, now()),
    updated_at = now(),
    removal_source = coalesce(removal_source, v_source)
  where id = p_status_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.durum_sil(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Platform kaldırma: admin_rapor_icerik_kaldir
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
  elsif r.content_type = 'status_post' and r.content_id is not null then
    update public.status_posts
    set deleted_at = coalesce(deleted_at, now()),
        updated_at = now(),
        removal_source = coalesce(removal_source, 'platform')
    where id = r.content_id;
    v_done := found;
  elsif r.content_type = 'status_comment' and r.content_id is not null then
    update public.status_comments
    set deleted_at = coalesce(deleted_at, now())
    where id = r.content_id and deleted_at is null;
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

grant execute on function public.admin_rapor_icerik_kaldir(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Realtime: silinen/kaldırılan gönderi yayını (tek kanal, N+1 yok)
-- ---------------------------------------------------------------------------
create or replace function public.status_post_silindi_yayinla()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avail text;
begin
  if NEW.deleted_at is not null
     and (OLD.deleted_at is null or OLD.removal_source is distinct from NEW.removal_source)
  then
    v_avail := case coalesce(NEW.removal_source, 'owner')
      when 'platform' then 'REMOVED_BY_PLATFORM'
      else 'DELETED_BY_OWNER'
    end;
    perform realtime.send(
      jsonb_build_object(
        'status_id', NEW.id,
        'availability', v_avail,
        'removal_source', NEW.removal_source
      ),
      'status_post_removed',
      'shared-posts',
      false
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists status_post_silindi_yayinla_trg on public.status_posts;
create trigger status_post_silindi_yayinla_trg
  after update of deleted_at, removal_source on public.status_posts
  for each row
  execute function public.status_post_silindi_yayinla();

-- ---------------------------------------------------------------------------
-- 6) Batch önizleme — görünürlük / silme / platform ayrımı
-- ---------------------------------------------------------------------------
create or replace function public.paylasilan_durumlari_onizle(p_status_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb := '{}'::jsonb;
  v_ids uuid[];
  v_id uuid;
  v_row record;
  v_item jsonb;
  v_avail text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_status_ids is null or cardinality(p_status_ids) = 0 then
    return v_out;
  end if;

  select array_agg(distinct x)
  into v_ids
  from unnest(p_status_ids) as t(x)
  where x is not null;

  if v_ids is null then
    return v_out;
  end if;

  foreach v_id in array v_ids
  loop
    select
      s.id,
      s.user_id,
      s.media_type,
      s.media_url,
      s.caption,
      s.post_kind,
      s.payload,
      s.deleted_at,
      s.removal_source,
      s.created_at,
      p.display_name,
      p.username,
      p.avatar_url,
      p.public_user_id,
      p.deleted_at as owner_deleted_at
    into v_row
    from public.status_posts s
    left join public.profiles p on p.id = s.user_id
    where s.id = v_id;

    if not found then
      v_item := jsonb_build_object(
        'status_id', v_id,
        'availability', 'NOT_AVAILABLE',
        'message', 'Bu gönderiye artık ulaşılamıyor.'
      );
    elsif v_row.deleted_at is not null then
      v_avail := case coalesce(v_row.removal_source, 'owner')
        when 'platform' then 'REMOVED_BY_PLATFORM'
        else 'DELETED_BY_OWNER'
      end;
      v_item := jsonb_build_object(
        'status_id', v_id,
        'availability', v_avail,
        'message', case v_avail
          when 'REMOVED_BY_PLATFORM'
            then 'Bu içerik platform tarafından kaldırıldı.'
          else 'Bu gönderi sahibi tarafından silindi.'
        end
      );
    elsif v_row.owner_deleted_at is not null then
      v_item := jsonb_build_object(
        'status_id', v_id,
        'availability', 'NOT_AVAILABLE',
        'message', 'Bu gönderiye artık ulaşılamıyor.'
      );
    elsif public.kullanicilar_engelli_mi(v_uid, v_row.user_id) then
      v_item := jsonb_build_object(
        'status_id', v_id,
        'availability', 'PERMISSION_DENIED',
        'message', 'Bu gönderiyi görüntüleyemezsiniz.'
      );
    elsif not public.takip_icerik_gorunur_mu(v_uid, v_row.user_id) then
      v_item := jsonb_build_object(
        'status_id', v_id,
        'availability', 'PERMISSION_DENIED',
        'message', 'Bu gönderiyi görüntüleyemezsiniz.'
      );
    else
      v_item := jsonb_build_object(
        'status_id', v_id,
        'availability', 'AVAILABLE',
        'user_id', v_row.user_id,
        'media_type', v_row.media_type,
        'media_url', coalesce(v_row.media_url, ''),
        'caption', v_row.caption,
        'post_kind', coalesce(v_row.post_kind, 'media'),
        'payload', coalesce(v_row.payload, '{}'::jsonb),
        'created_at', v_row.created_at,
        'display_name', coalesce(v_row.display_name, v_row.username, 'Kullanıcı'),
        'username', v_row.username,
        'avatar_url', v_row.avatar_url,
        'public_user_id', v_row.public_user_id
      );
    end if;

    v_out := v_out || jsonb_build_object(v_id::text, v_item);
  end loop;

  return v_out;
end;
$$;

grant execute on function public.paylasilan_durumlari_onizle(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) DM paylaşım RPC — server-side güvenlik + çoklu alıcı + dedup
-- ---------------------------------------------------------------------------
create or replace function public.durum_dm_paylas(
  p_status_id uuid,
  p_recipient_ids uuid[],
  p_note text default null,
  p_client_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_guest boolean;
  v_owner uuid;
  v_deleted timestamptz;
  v_note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
  v_recipients uuid[];
  v_peer uuid;
  v_thread uuid;
  v_msg public.direct_messages%rowtype;
  v_client uuid;
  v_idx int := 0;
  v_ok int := 0;
  v_fail int := 0;
  v_results jsonb := '[]'::jsonb;
  v_sender_name text;
  v_preview text := 'Bir gönderi paylaştı';
  v_push_body text;
  v_err text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if not public.ozellik_bayragi_aktif_mi('messages_enabled') then
    raise exception 'Messages feature disabled';
  end if;

  select is_guest into v_is_guest from public.profiles where id = v_uid;
  if coalesce(v_is_guest, false) then
    raise exception 'Guest cannot send messages';
  end if;

  select user_id, deleted_at into v_owner, v_deleted
  from public.status_posts
  where id = p_status_id;

  if v_owner is null or v_deleted is not null then
    raise exception 'Gönderi bulunamadı veya silinmiş';
  end if;

  if not public.takip_icerik_gorunur_mu(v_uid, v_owner) then
    raise exception 'Bu gönderiyi paylaşamazsınız';
  end if;

  if public.kullanicilar_engelli_mi(v_uid, v_owner) then
    raise exception 'Bu gönderiyi paylaşamazsınız';
  end if;

  select array_agg(distinct x)
  into v_recipients
  from unnest(coalesce(p_recipient_ids, array[]::uuid[])) as t(x)
  where x is not null and x <> v_uid;

  if v_recipients is null or cardinality(v_recipients) = 0 then
    raise exception 'Alıcı seçilmedi';
  end if;

  if cardinality(v_recipients) > 20 then
    raise exception 'En fazla 20 kişiye paylaşabilirsiniz';
  end if;

  select coalesce(display_name, username, 'Birisi') into v_sender_name
  from public.profiles where id = v_uid;

  v_push_body := v_sender_name || ' sana bir gönderi gönderdi.';

  foreach v_peer in array v_recipients
  loop
    v_idx := v_idx + 1;
    v_client := null;
    v_err := null;

    begin
      if p_client_ids is not null and cardinality(p_client_ids) >= v_idx then
        v_client := p_client_ids[v_idx];
      end if;

      if public.kullanicilar_engelli_mi(v_uid, v_peer) then
        raise exception 'Bu kullaniciyla iletisim engellenmis';
      end if;

      if not exists (
        select 1 from public.profiles p
        where p.id = v_peer and p.deleted_at is null
      ) then
        raise exception 'Kullanıcı bulunamadı';
      end if;

      -- Idempotent: aynı client_id ile tekrar gönderim
      if v_client is not null then
        select * into v_msg
        from public.direct_messages
        where sender_id = v_uid and client_id = v_client
        limit 1;
        if found then
          v_ok := v_ok + 1;
          v_results := v_results || jsonb_build_array(
            jsonb_build_object(
              'ok', true,
              'recipient_id', v_peer,
              'thread_id', v_msg.thread_id,
              'message_id', v_msg.id,
              'deduped', true
            )
          );
          continue;
        end if;
      end if;

      v_thread := public.ozel_sohbet_ac_veya_getir(v_peer);

      insert into public.direct_messages (
        thread_id, sender_id, body, message_type, media_url, client_id, ref_id
      ) values (
        v_thread,
        v_uid,
        v_note,
        'shared_post',
        null,
        v_client,
        p_status_id
      )
      returning * into v_msg;

      insert into public.message_shared_posts (message_id, status_post_id)
      values (v_msg.id, p_status_id)
      on conflict (message_id) do nothing;

      update public.message_threads set
        updated_at = now(),
        last_message_at = now(),
        last_message_preview = v_preview
      where id = v_thread;

      update public.message_thread_members set
        archived_at = null,
        deleted_at = null
      where thread_id = v_thread
        and (archived_at is not null or deleted_at is not null);

      -- share_count: yalnızca yeni (dedup olmayan) başarılı paylaşım
      update public.status_posts
      set share_count = share_count + 1, updated_at = now()
      where id = p_status_id;

      perform public.bildirim_kuyruga_ekle(
        v_peer,
        'messages',
        v_sender_name,
        v_push_body,
        '/mesaj/' || v_thread::text,
        jsonb_build_object(
          'thread_id', v_thread,
          'sender_id', v_uid,
          'type', 'dm',
          'message_type', 'shared_post',
          'status_id', p_status_id
        )
      );

      v_ok := v_ok + 1;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'ok', true,
          'recipient_id', v_peer,
          'thread_id', v_thread,
          'message_id', v_msg.id,
          'deduped', false
        )
      );
    exception when others then
      v_fail := v_fail + 1;
      v_err := sqlerrm;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'ok', false,
          'recipient_id', v_peer,
          'error', v_err
        )
      );
    end;
  end loop;

  return jsonb_build_object(
    'ok', v_ok > 0,
    'sent_count', v_ok,
    'fail_count', v_fail,
    'results', v_results
  );
end;
$$;

grant execute on function public.durum_dm_paylas(uuid, uuid[], text, uuid[]) to authenticated;

-- mesaj_gonder shared_post enjekte edemesin (mevcut fonksiyonu koru, tip listesine ekleme)
-- shared_post yalnızca durum_dm_paylas üzerinden oluşur.
