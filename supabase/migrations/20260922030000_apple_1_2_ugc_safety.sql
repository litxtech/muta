-- Apple Guideline 1.2 — UGC safety extensions (safe patches on existing stack)

-- 1) Profile declared age + temporary ban
alter table public.profiles
  add column if not exists age_confirmed_at timestamptz,
  add column if not exists banned_until timestamptz;

-- 2) Community rules policy
insert into public.policies (
  code, title, description, is_required, is_active,
  show_on_register, show_on_login, sort_order
)
values (
  'community_rules',
  'Topluluk Kuralları',
  'UGC sıfır tolerans · bildir · engelle · 24s moderasyon',
  true, true, true, true, 15
)
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  is_required = true,
  is_active = true,
  show_on_register = true,
  show_on_login = true;

insert into public.policy_versions (policy_code, version, body_md, published_at)
select 'community_rules', 1,
  E'# Topluluk Kuralları\n\nTamuso uygunsuz içerik ve tacize sıfır tolerans uygular.\n18+ platform.\nRaporlar 24 saat içinde incelenir.\nDestek: support@litxtech.com',
  now()
where not exists (
  select 1 from public.policy_versions
  where policy_code = 'community_rules' and version = 1
);

-- 3) SLA + priority on reports
alter table public.user_reports
  add column if not exists sla_due_at timestamptz,
  add column if not exists priority text;

update public.user_reports
set sla_due_at = coalesce(sla_due_at, created_at + interval '24 hours'),
    priority = coalesce(nullif(priority, ''), 'normal')
where sla_due_at is null or priority is null;

alter table public.user_reports
  alter column priority set default 'normal';

update public.user_reports set priority = 'normal' where priority is null;
alter table public.user_reports alter column priority set not null;

do $$ begin
  alter table public.user_reports
    add constraint user_reports_priority_chk
    check (priority in ('normal', 'high', 'critical'));
exception when duplicate_object then null;
end $$;

create index if not exists user_reports_sla_idx
  on public.user_reports (status, sla_due_at, priority);

-- 4) Moderation terms + filter
create table if not exists public.moderation_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  category text not null default 'other',
  severity text not null default 'medium',
  language text not null default 'tr',
  action text not null default 'BLOCK',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term, language)
);

do $$ begin
  alter table public.moderation_terms
    add constraint moderation_terms_action_chk
    check (action in ('ALLOW', 'WARN', 'MASK', 'BLOCK', 'REVIEW'));
exception when duplicate_object then null;
end $$;

create index if not exists moderation_terms_active_idx
  on public.moderation_terms (is_active, language) where is_active;

alter table public.moderation_terms enable row level security;

drop policy if exists moderation_terms_select_auth on public.moderation_terms;
create policy moderation_terms_select_auth on public.moderation_terms
  for select to authenticated using (true);

drop policy if exists moderation_terms_admin_all on public.moderation_terms;
create policy moderation_terms_admin_all on public.moderation_terms
  for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

insert into public.moderation_terms (term, category, severity, language, action) values
  ('cocuk porn', 'child_safety', 'critical', 'tr', 'BLOCK'),
  ('cocuk porno', 'child_safety', 'critical', 'tr', 'BLOCK'),
  ('child porn', 'child_safety', 'critical', 'en', 'BLOCK'),
  ('csam', 'child_safety', 'critical', 'en', 'BLOCK'),
  ('cp link', 'child_safety', 'critical', 'en', 'BLOCK'),
  ('kill yourself', 'self_harm', 'high', 'en', 'REVIEW'),
  ('kendini oldur', 'self_harm', 'high', 'tr', 'REVIEW'),
  ('bomb yapimi', 'violence', 'high', 'tr', 'BLOCK'),
  ('how to make a bomb', 'violence', 'high', 'en', 'BLOCK')
on conflict (term, language) do nothing;

create or replace function public.metin_normalize_filtre(p_text text)
returns text
language sql
immutable
as $$
  select lower(
    regexp_replace(
      translate(
        coalesce(p_text, ''),
        'İIıĞğÜüŞşÖöÇçÂâÊêÎîÔôÛû',
        'iiigguussooccaeeiioouu'
      ),
      '[^a-z0-9]+', ' ', 'g'
    )
  );
$$;

create or replace function public.icerik_metin_denetle(p_text text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_norm text := public.metin_normalize_filtre(p_text);
  v_row public.moderation_terms%rowtype;
  v_term_norm text;
begin
  if length(trim(coalesce(p_text, ''))) = 0 then
    return jsonb_build_object('ok', true, 'action', 'ALLOW');
  end if;
  for v_row in
    select * from public.moderation_terms where is_active
    order by case severity when 'critical' then 0 when 'high' then 1 else 2 end,
             length(term) desc
  loop
    v_term_norm := public.metin_normalize_filtre(v_row.term);
    if v_term_norm <> '' and position(v_term_norm in v_norm) > 0 then
      return jsonb_build_object(
        'ok', v_row.action in ('ALLOW', 'WARN', 'MASK', 'REVIEW'),
        'action', v_row.action,
        'matched', v_row.term,
        'category', v_row.category,
        'severity', v_row.severity,
        'message', case when v_row.action = 'BLOCK' then
          'Bu içerik Topluluk Kurallarımıza uygun görünmüyor. Lütfen düzenleyip tekrar deneyin.'
        else null end
      );
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'action', 'ALLOW');
end;
$$;

revoke all on function public.icerik_metin_denetle(text) from public;
grant execute on function public.icerik_metin_denetle(text) to authenticated;

create or replace function public.hesap_ugc_izinli_mi(p_uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_uid
      and p.deleted_at is null
      and (
        p.banned_at is null
        or (p.banned_until is not null and p.banned_until <= now())
      )
  );
$$;

create or replace function public.ugc_metin_zorunlu_filtre(p_text text)
returns void
language plpgsql
as $$
declare v jsonb;
begin
  if auth.uid() is not null and not public.hesap_ugc_izinli_mi(auth.uid()) then
    raise exception 'Hesabın UGC için kısıtlı veya askıda.';
  end if;
  v := public.icerik_metin_denetle(p_text);
  if (v->>'action') = 'BLOCK' then
    raise exception '%', coalesce(v->>'message',
      'Bu içerik Topluluk Kurallarımıza uygun görünmüyor. Lütfen düzenleyip tekrar deneyin.');
  end if;
end;
$$;

create or replace function public.trg_status_posts_metin_filtre()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.caption is not null and length(trim(new.caption)) > 0 then
    perform public.ugc_metin_zorunlu_filtre(new.caption);
  end if;
  return new;
end;
$$;
drop trigger if exists status_posts_metin_filtre on public.status_posts;
create trigger status_posts_metin_filtre
  before insert or update of caption on public.status_posts
  for each row execute function public.trg_status_posts_metin_filtre();

create or replace function public.trg_status_comments_metin_filtre()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.body is not null then
    perform public.ugc_metin_zorunlu_filtre(new.body);
  end if;
  return new;
end;
$$;
drop trigger if exists status_comments_metin_filtre on public.status_comments;
create trigger status_comments_metin_filtre
  before insert or update of body on public.status_comments
  for each row execute function public.trg_status_comments_metin_filtre();

do $$
begin
  if to_regclass('public.room_chat_messages') is not null then
    execute $t$
      create or replace function public.trg_room_chat_metin_filtre()
      returns trigger language plpgsql security definer set search_path = public as $f$
      begin
        if new.body is not null then perform public.ugc_metin_zorunlu_filtre(new.body); end if;
        return new;
      end; $f$;
      drop trigger if exists room_chat_metin_filtre on public.room_chat_messages;
      create trigger room_chat_metin_filtre
        before insert or update of body on public.room_chat_messages
        for each row execute function public.trg_room_chat_metin_filtre();
    $t$;
  end if;
  if to_regclass('public.live_chat_messages') is not null then
    execute $t$
      create or replace function public.trg_live_chat_metin_filtre()
      returns trigger language plpgsql security definer set search_path = public as $f$
      begin
        if new.body is not null then perform public.ugc_metin_zorunlu_filtre(new.body); end if;
        return new;
      end; $f$;
      drop trigger if exists live_chat_metin_filtre on public.live_chat_messages;
      create trigger live_chat_metin_filtre
        before insert or update of body on public.live_chat_messages
        for each row execute function public.trg_live_chat_metin_filtre();
    $t$;
  end if;
end $$;

create or replace function public.trg_profiles_bio_filtre()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.bio is distinct from old.bio and coalesce(new.bio, '') <> '' then
      perform public.ugc_metin_zorunlu_filtre(new.bio);
    end if;
    if new.display_name is distinct from old.display_name and coalesce(new.display_name, '') <> '' then
      perform public.ugc_metin_zorunlu_filtre(new.display_name);
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_bio_filtre on public.profiles;
create trigger profiles_bio_filtre
  before update of bio, display_name on public.profiles
  for each row execute function public.trg_profiles_bio_filtre();

-- 5) Patch kullanici_bildir: SLA columns + rate limit (keep signature)
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
  v_priority text := 'normal';
  v_is_child boolean := false;
  v_room_id uuid := p_room_id;
  v_recent int;
  v_dup int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if length(v_reason) = 0 then raise exception 'Reason required'; end if;

  if v_ctype in ('live_session', 'livestream', 'live_stream') then v_ctype := 'live'; end if;
  if v_ctype in ('voice_room', 'ses_odasi') then v_ctype := 'room'; end if;

  if v_ctype is not null and v_ctype not in (
    'user', 'dm_message', 'room_chat', 'live_chat', 'room', 'live', 'profile',
    'status_post', 'status_comment', 'other'
  ) then
    v_ctype := 'other';
  end if;

  select count(*) into v_recent from public.user_reports
  where reporter_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= 20 then
    raise exception 'Çok fazla rapor gönderdin. Lütfen biraz bekle.';
  end if;

  if p_content_id is not null then
    select count(*) into v_dup from public.user_reports
    where reporter_id = v_uid and content_type = v_ctype and content_id = p_content_id
      and created_at > now() - interval '10 minutes';
    if v_dup > 0 then
      select * into v_row from public.user_reports
      where reporter_id = v_uid and content_type = v_ctype and content_id = p_content_id
      order by created_at desc limit 1;
      return v_row;
    end if;
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
  elsif v_ctype = 'room' and coalesce(p_content_id, v_room_id) is not null then
    v_room_id := coalesce(v_room_id, p_content_id);
    select coalesce(v_ctx, '{}'::jsonb) || jsonb_build_object(
      'title', rm.title, 'mode', rm.mode, 'is_live', rm.is_live,
      'host_id', rm.host_id, 'cover_url', rm.cover_url,
      'listener_count', rm.listener_count, 'room_code', rm.room_code
    ), coalesce(p_target_user_id, rm.host_id)
    into v_ctx, p_target_user_id
    from public.rooms rm where rm.id = coalesce(p_content_id, v_room_id);
  elsif v_ctype = 'live' and p_content_id is not null then
    select coalesce(v_ctx, '{}'::jsonb) || jsonb_build_object(
      'title', ls.title, 'mode', ls.mode, 'is_live', ls.is_live,
      'host_id', ls.host_id, 'viewer_count', ls.viewer_count,
      'like_count', ls.like_count, 'started_at', ls.started_at
    ), coalesce(p_target_user_id, ls.host_id)
    into v_ctx, p_target_user_id
    from public.live_sessions ls where ls.id = p_content_id;
  end if;

  v_is_child :=
    v_code = 'child_safety'
    or lower(v_reason) like '%çocuk%' or lower(v_reason) like '%cocuk%'
    or lower(v_reason) like '%csam%' or lower(v_reason) like '%reşit olmayan%'
    or lower(v_reason) like '%resit olmayan%';

  if v_is_child or v_code in ('sexual', 'violence') then
    v_sev := 'critical';
    v_priority := 'critical';
  elsif v_code in ('harassment', 'hate', 'self_harm') then
    v_sev := 'high';
    v_priority := 'high';
  end if;

  v_ctx := coalesce(v_ctx, '{}'::jsonb) || jsonb_build_object(
    'reason_code', coalesce(nullif(v_code, ''), null),
    'priority', v_priority,
    'child_safety', v_is_child
  );

  insert into public.user_reports (
    reporter_id, target_user_id, room_id, reason, details,
    content_type, content_id, context, priority, sla_due_at
  ) values (
    v_uid, p_target_user_id, v_room_id, v_reason,
    nullif(trim(coalesce(p_details, '')), ''),
    v_ctype, coalesce(p_content_id, v_room_id), coalesce(v_ctx, '{}'::jsonb),
    v_priority, now() + interval '24 hours'
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
      'content_id', v_row.content_id,
      'target_user_id', p_target_user_id,
      'severity', v_sev,
      'priority', v_priority,
      'sla_due_at', v_row.sla_due_at,
      'child_safety', v_is_child
    )
  );

  return v_row;
end;
$$;

grant execute on function public.kullanici_bildir(text, uuid, uuid, text, text, uuid, jsonb)
  to authenticated;

-- 6) Block-aware room join
create or replace function public.oda_uye_katil(
  p_room_id uuid,
  p_role text default 'listener'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
  v_live boolean;
begin
  if v_uid is null then raise exception 'Oturum gerekli'; end if;
  if not public.hesap_ugc_izinli_mi(v_uid) then
    raise exception 'Hesabın kısıtlı.';
  end if;

  select host_id, is_live into v_host, v_live from public.rooms where id = p_room_id;
  if not found then raise exception 'Oda bulunamadı'; end if;
  if v_live is false then raise exception 'Bu ses odası kapatıldı'; end if;

  if exists (
    select 1 from public.room_bans rb
    where rb.room_id = p_room_id and rb.user_id = v_uid
  ) then
    raise exception 'Bu odadan yasaklandın';
  end if;

  if v_host is not null and public.kullanicilar_engelli_mi(v_uid, v_host) then
    raise exception 'Bu odaya katılamazsın (engel).';
  end if;

  insert into public.room_members (room_id, user_id, role)
  values (p_room_id, v_uid, coalesce(nullif(p_role, ''), 'listener'))
  on conflict (room_id, user_id) do nothing;
end;
$$;
grant execute on function public.oda_uye_katil(uuid, text) to authenticated;

-- 7) Admin content remove: live/room/cover
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
    set body = '[moderasyon tarafından kaldırıldı]', removed_at = now(), removed_by = v_uid
    where id = r.content_id and removed_at is null;
    v_done := found;
  elsif r.content_type = 'live_chat' and r.content_id is not null then
    update public.live_chat_messages
    set body = '[moderasyon tarafından kaldırıldı]', removed_at = now(), removed_by = v_uid
    where id = r.content_id and removed_at is null;
    v_done := found;
  elsif r.content_type = 'profile' and r.target_user_id is not null then
    update public.profiles
    set avatar_url = null, cover_url = null, bio = null
    where id = r.target_user_id;
    v_done := found;
  elsif r.content_type = 'status_post' and r.content_id is not null then
    update public.status_posts
    set deleted_at = coalesce(deleted_at, now()), updated_at = now(),
        removal_source = coalesce(removal_source, 'platform')
    where id = r.content_id;
    v_done := found;
  elsif r.content_type = 'status_comment' and r.content_id is not null then
    update public.status_comments
    set deleted_at = coalesce(deleted_at, now())
    where id = r.content_id and deleted_at is null;
    v_done := found;
  elsif r.content_type = 'room' and coalesce(r.room_id, r.content_id) is not null then
    update public.rooms set is_live = false, updated_at = now()
    where id = coalesce(r.room_id, r.content_id);
    v_done := found;
  elsif r.content_type = 'live' and r.content_id is not null then
    update public.live_sessions
    set is_live = false, ended_at = coalesce(ended_at, now())
    where id = r.content_id;
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

-- 8) Temporary suspend
create or replace function public.admin_kullanici_askiya_al(
  p_user_id uuid,
  p_hours int default 24,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Admin yetkisi gerekli'; end if;
  update public.profiles
  set banned_at = now(),
      banned_until = now() + make_interval(hours => greatest(1, coalesce(p_hours, 24))),
      ban_reason = coalesce(p_reason, 'Geçici askıya alma')
  where id = p_user_id;
  perform public.admin_audit_yaz(
    p_user_id, 'suspend_user', 'Kullanici gecici askıya alindi',
    jsonb_build_object('hours', p_hours, 'reason', p_reason)
  );
end;
$$;
grant execute on function public.admin_kullanici_askiya_al(uuid, int, text) to authenticated;

-- Auto-clear expired temp bans
create or replace function public.ban_suresi_temizle(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set banned_at = null, banned_until = null, ban_reason = null
  where id = p_uid
    and banned_at is not null
    and banned_until is not null
    and banned_until <= now();
end;
$$;
