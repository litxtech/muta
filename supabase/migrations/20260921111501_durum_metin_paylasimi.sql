-- Durum: sadece metin / mood paylaşımı (medya zorunlu değil)

alter table public.status_posts
  alter column media_url drop not null;

alter table public.status_posts
  drop constraint if exists status_posts_media_type_check;

alter table public.status_posts
  add constraint status_posts_media_type_check
  check (media_type in ('image', 'video', 'card', 'text'));

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
  v_caption text := nullif(left(trim(coalesce(p_caption, '')), 500), '');
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir durum paylasamaz'; end if;

  -- Metin / mood: medya yok
  if v_type = 'text' or (v_type = '' and v_url is null) then
    if v_caption is null then
      raise exception 'Metin gerekli';
    end if;
    v_type := 'text';
    v_url := null;
  elsif v_type in ('image', 'video') then
    if v_url is null or length(v_url) < 8 or v_url !~* '^https?://' then
      raise exception 'Medya gerekli';
    end if;
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
