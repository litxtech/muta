-- Metin gönderilerinde caption sınırı kaldır (medya caption 500 kalır)
create or replace function public.durum_olustur(
  p_media_type text,
  p_media_url text,
  p_caption text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_id uuid;
  v_type text := lower(trim(coalesce(p_media_type, '')));
  v_url text := nullif(left(trim(coalesce(p_media_url, '')), 2000), '');
  v_caption_raw text := nullif(trim(coalesce(p_caption, '')), '');
  v_caption text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir durum paylasamaz'; end if;

  if v_type = 'text' or (v_type = '' and v_url is null) then
    if v_caption_raw is null then
      raise exception 'Metin gerekli';
    end if;
    v_type := 'text';
    v_url := null;
    v_caption := left(v_caption_raw, 100000);
  elsif v_type in ('image', 'video') then
    if v_url is null or length(v_url) < 8 or v_url !~* '^https?://' then
      raise exception 'Medya gerekli';
    end if;
    v_caption := nullif(left(v_caption_raw, 500), '');
  else
    raise exception 'Gecersiz medya turu';
  end if;

  insert into public.status_posts (user_id, media_type, media_url, caption, post_kind)
  values (
    v_uid,
    v_type,
    v_url,
    v_caption,
    'media'
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.durum_olustur(text, text, text) to authenticated;

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
  v_media_type text;
  v_caption_raw text := nullif(trim(coalesce(p_caption, '')), '');
  v_caption text;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select user_id, media_type into v_owner, v_media_type
  from public.status_posts
  where id = p_status_id and deleted_at is null;

  if v_owner is null then raise exception 'Durum yok'; end if;
  if v_owner <> v_uid and not public.ben_admin_miyim() then
    raise exception 'Forbidden';
  end if;

  if v_media_type = 'text' then
    if v_caption_raw is null then
      raise exception 'Metin gerekli';
    end if;
    v_caption := left(v_caption_raw, 100000);
  else
    v_caption := nullif(left(coalesce(v_caption_raw, ''), 500), '');
  end if;

  update public.status_posts
  set caption = v_caption,
      updated_at = now()
  where id = p_status_id and deleted_at is null;

  return jsonb_build_object('ok', true, 'caption', v_caption);
end;
$$;

grant execute on function public.durum_guncelle(uuid, text) to authenticated;
