-- Durum: caption düzenleme, kullanıcı profil akışı, admin rapor ile içerik kaldırma

-- Caption güncelle (sahip)
create or replace function public.durum_guncelle(
  p_status_id uuid,
  p_caption text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_caption text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select user_id into v_owner
  from public.status_posts
  where id = p_status_id and deleted_at is null;

  if v_owner is null then raise exception 'Durum yok'; end if;
  if v_owner <> v_uid and not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;

  v_caption := nullif(left(trim(coalesce(p_caption, '')), 500), '');

  update public.status_posts
  set caption = v_caption,
      updated_at = now()
  where id = p_status_id and deleted_at is null;

  return jsonb_build_object('ok', true, 'caption', v_caption);
end;
$$;

grant execute on function public.durum_guncelle(uuid, text) to authenticated;

-- Kullanıcının durumları (profil)
create or replace function public.durum_kullanicisi(
  p_user_id uuid,
  p_limit int default 40,
  p_before timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_user_id is null then raise exception 'Kullanıcı gerekli'; end if;

  if public.kullanicilar_engelli_mi(v_uid, p_user_id) then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.created_at desc)
    from (
      select
        s.id,
        s.user_id,
        s.media_type,
        s.media_url,
        s.caption,
        s.like_count,
        s.comment_count,
        coalesce(s.gift_count, 0) as gift_count,
        s.created_at,
        coalesce(p.display_name, p.username, 'Kullanıcı') as display_name,
        p.username,
        p.avatar_url,
        p.public_user_id,
        exists(
          select 1 from public.status_likes l
          where l.status_id = s.id and l.user_id = v_uid
        ) as liked_by_me,
        (s.user_id = v_uid) as is_mine
      from public.status_posts s
      join public.profiles p on p.id = s.user_id
      where s.user_id = p_user_id
        and s.deleted_at is null
        and p.deleted_at is null
        and p.banned_at is null
        and (p_before is null or s.created_at < p_before)
      order by s.created_at desc
      limit least(greatest(coalesce(p_limit, 40), 1), 80)
    ) t
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.durum_kullanicisi(uuid, int, timestamptz) to authenticated;

-- Admin: durum gönderisi / yorumunu rapordan kaldır
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
        updated_at = now()
    where id = r.content_id and deleted_at is null;
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
