-- Bildirim: kimden geldi (actor) + zengin liste + hedef link cozumu

alter table public.user_notifications
  add column if not exists actor_id uuid references public.profiles(id) on delete set null;

create index if not exists user_notifications_actor_idx
  on public.user_notifications (actor_id)
  where actor_id is not null;

-- Payload'dan actor uuid cikar
create or replace function public.bildirim_payload_actor_id(p_payload jsonb)
returns uuid
language plpgsql
immutable
as $$
declare
  v_txt text;
  v_uid uuid;
begin
  if p_payload is null then return null; end if;
  v_txt := coalesce(
    nullif(trim(p_payload->>'actor_id'), ''),
    nullif(trim(p_payload->>'sender_id'), ''),
    nullif(trim(p_payload->>'host_id'), ''),
    nullif(trim(p_payload->>'follower_id'), ''),
    nullif(trim(p_payload->>'from_user_id'), ''),
    nullif(trim(p_payload->>'user_id'), '')
  );
  if v_txt is null then return null; end if;
  begin
    v_uid := v_txt::uuid;
  exception when others then
    return null;
  end;
  return v_uid;
end;
$$;

-- Deep link yoksa payload'dan uret / duzelt
create or replace function public.bildirim_hedef_link(
  p_category text,
  p_deep_link text,
  p_payload jsonb
)
returns text
language plpgsql
immutable
as $$
declare
  v_type text := lower(coalesce(p_payload->>'type', ''));
  v_link text := nullif(trim(coalesce(p_deep_link, '')), '');
  v_thread text := nullif(trim(coalesce(p_payload->>'thread_id', '')), '');
  v_room text := nullif(trim(coalesce(p_payload->>'room_id', '')), '');
  v_live text := nullif(trim(coalesce(p_payload->>'live_id', '')), '');
  v_actor text := nullif(trim(coalesce(
    p_payload->>'follower_id',
    p_payload->>'sender_id',
    p_payload->>'host_id',
    p_payload->>'actor_id',
    ''
  )), '');
begin
  -- Zaten iyi bir hedef varsa kullan (genel profil disinda)
  if v_link is not null
     and v_link not in ('/(tabs)/profile', '/profile', '/bildirimler') then
    return v_link;
  end if;

  if v_thread is not null then
    return '/mesaj/' || v_thread;
  end if;
  if v_live is not null then
    return '/canli/' || v_live;
  end if;
  if v_room is not null then
    return '/lobi/' || v_room;
  end if;
  if v_type = 'follow' and v_actor is not null then
    return '/kullanici/' || v_actor;
  end if;
  if v_type in ('gift_received', 'dm') and v_actor is not null and v_room is null then
    return '/kullanici/' || v_actor;
  end if;
  if lower(coalesce(p_category, '')) = 'wallet' then
    return '/(tabs)/wallet';
  end if;
  if v_link is not null then
    return v_link;
  end if;
  if v_actor is not null then
    return '/kullanici/' || v_actor;
  end if;
  return null;
end;
$$;

create or replace function public.bildirim_kuyruga_ekle(
  p_user_id uuid,
  p_category text,
  p_title text,
  p_body text default null,
  p_deep_link text default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inbox_id uuid;
  v_outbox_id uuid;
  v_cat text := lower(trim(coalesce(p_category, 'system')));
  v_title text;
  v_body text;
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_actor uuid;
  v_link text;
begin
  if p_user_id is null then return null; end if;
  if p_title is null or length(trim(p_title)) = 0 then return null; end if;
  if not public.hesap_aktif_mi(p_user_id) then return null; end if;

  v_title := left(trim(p_title), 120);
  v_body := case when p_body is null then null else left(trim(p_body), 400) end;
  v_actor := public.bildirim_payload_actor_id(v_payload);
  v_link := public.bildirim_hedef_link(v_cat, p_deep_link, v_payload);

  if v_actor is not null and (v_payload->>'actor_id') is null then
    v_payload := v_payload || jsonb_build_object('actor_id', v_actor);
  end if;

  insert into public.user_notifications (
    user_id, category, title, body, deep_link, payload, actor_id
  ) values (
    p_user_id,
    v_cat,
    v_title,
    v_body,
    v_link,
    v_payload,
    v_actor
  )
  returning id into v_inbox_id;

  if public.push_tercihi_aktif_mi(p_user_id, v_cat) then
    insert into public.notification_outbox (
      user_id, category, title, body, deep_link, payload, status
    ) values (
      p_user_id,
      v_cat,
      v_title,
      v_body,
      v_link,
      v_payload,
      'pending'
    )
    returning id into v_outbox_id;

    update public.user_notifications
    set outbox_id = v_outbox_id
    where id = v_inbox_id;
  end if;

  return v_inbox_id;
exception when others then
  return null;
end;
$$;

-- Mevcut kayitlari zenginlestir
update public.user_notifications n
set
  actor_id = coalesce(n.actor_id, public.bildirim_payload_actor_id(n.payload)),
  deep_link = coalesce(
    nullif(trim(n.deep_link), ''),
    public.bildirim_hedef_link(n.category, n.deep_link, n.payload)
  ),
  payload = case
    when public.bildirim_payload_actor_id(n.payload) is not null
      and (n.payload->>'actor_id') is null
    then n.payload || jsonb_build_object(
      'actor_id', public.bildirim_payload_actor_id(n.payload)
    )
    else n.payload
  end
where n.actor_id is null
   or n.deep_link is null
   or nullif(trim(n.deep_link), '') in ('/(tabs)/profile', '/profile');

-- Zengin liste (avatar + isim)
drop function if exists public.bildirimlerimi_listele(int);

create or replace function public.bildirimlerimi_listele(p_limit int default 50)
returns table (
  id uuid,
  category text,
  title text,
  body text,
  deep_link text,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz,
  actor_id uuid,
  actor_name text,
  actor_username text,
  actor_avatar_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  return query
  select
    n.id,
    n.category,
    n.title,
    n.body,
    coalesce(
      nullif(trim(n.deep_link), ''),
      public.bildirim_hedef_link(n.category, n.deep_link, n.payload)
    ) as deep_link,
    n.payload,
    n.read_at,
    n.created_at,
    coalesce(n.actor_id, public.bildirim_payload_actor_id(n.payload)) as actor_id,
    coalesce(
      nullif(trim(p.display_name), ''),
      nullif(trim(p.username), ''),
      case
        when n.category = 'system' then 'Tamuso'
        when n.category = 'wallet' then 'Cüzdan'
        else null
      end
    ) as actor_name,
    p.username as actor_username,
    p.avatar_url as actor_avatar_url
  from public.user_notifications n
  left join public.profiles p
    on p.id = coalesce(n.actor_id, public.bildirim_payload_actor_id(n.payload))
  where n.user_id = v_uid
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

grant execute on function public.bildirimlerimi_listele(int) to authenticated;
grant execute on function public.bildirim_payload_actor_id(jsonb) to authenticated;
grant execute on function public.bildirim_hedef_link(text, text, jsonb) to authenticated;
