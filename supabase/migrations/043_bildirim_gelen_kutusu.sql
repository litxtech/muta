-- Uygulama ici bildirim gelen kutusu + okundu sayaci

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null default 'system',
  title text not null,
  body text,
  deep_link text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  outbox_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

create index if not exists user_notifications_unread_idx
  on public.user_notifications (user_id)
  where read_at is null;

alter table public.user_notifications enable row level security;

drop policy if exists "Own notifications read" on public.user_notifications;
create policy "Own notifications read"
  on public.user_notifications for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Own notifications update" on public.user_notifications;
create policy "Own notifications update"
  on public.user_notifications for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, update on public.user_notifications to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.user_notifications;
  exception when duplicate_object then
    null;
  end;
end $$;

alter table public.user_notifications replica identity full;

-- ---------------------------------------------------------------------------
-- Push + gelen kutusu: gelen kutu her zaman; outbox tercihe bagli
-- ---------------------------------------------------------------------------
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
begin
  if p_user_id is null then return null; end if;
  if p_title is null or length(trim(p_title)) = 0 then return null; end if;
  if not public.hesap_aktif_mi(p_user_id) then return null; end if;

  v_title := left(trim(p_title), 120);
  v_body := case when p_body is null then null else left(trim(p_body), 400) end;

  insert into public.user_notifications (
    user_id, category, title, body, deep_link, payload
  ) values (
    p_user_id,
    v_cat,
    v_title,
    v_body,
    p_deep_link,
    coalesce(p_payload, '{}'::jsonb)
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
      p_deep_link,
      coalesce(p_payload, '{}'::jsonb),
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

-- Admin zorunlu bildirim: gelen kutu + push
create or replace function public.admin_operasyon_bildirimi(
  p_title text,
  p_body text default null,
  p_deep_link text default '/admin/kullanicilar',
  p_payload jsonb default '{}'::jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_n int := 0;
  v_inbox uuid;
  v_outbox uuid;
  v_title text;
  v_body text;
  v_link text := coalesce(p_deep_link, '/admin/kullanicilar');
begin
  if p_title is null or length(trim(p_title)) = 0 then
    return 0;
  end if;

  v_title := left(trim(p_title), 120);
  v_body := case when p_body is null then null else left(trim(p_body), 400) end;

  for v_admin in
    select p.id
    from public.profiles p
    where coalesce(p.is_admin, false) = true
      and p.deleted_at is null
      and p.banned_at is null
  loop
    begin
      insert into public.user_notifications (
        user_id, category, title, body, deep_link, payload
      ) values (
        v_admin, 'system', v_title, v_body, v_link, coalesce(p_payload, '{}'::jsonb)
      )
      returning id into v_inbox;

      insert into public.notification_outbox (
        user_id, category, title, body, deep_link, payload, status
      ) values (
        v_admin, 'system', v_title, v_body, v_link, coalesce(p_payload, '{}'::jsonb), 'pending'
      )
      returning id into v_outbox;

      update public.user_notifications
      set outbox_id = v_outbox
      where id = v_inbox;

      v_n := v_n + 1;
    exception when others then
      null;
    end;
  end loop;

  return v_n;
end;
$$;

-- Dev test: kendi gelen kutusuna yazar
drop function if exists public.bildirim_kuyruga_ekle_dev(text, text, text);

create or replace function public.bildirim_kuyruga_ekle_dev(
  p_title text,
  p_body text default null,
  p_category text default 'system'
)
returns public.user_notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_row public.user_notifications%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  v_id := public.bildirim_kuyruga_ekle(
    v_uid,
    coalesce(nullif(trim(p_category), ''), 'system'),
    p_title,
    p_body,
    '/bildirimler',
    jsonb_build_object('dev', true)
  );

  if v_id is null then
    raise exception 'Bildirim eklenemedi';
  end if;

  select * into v_row from public.user_notifications where id = v_id;
  return v_row;
end;
$$;

grant execute on function public.bildirim_kuyruga_ekle_dev(text, text, text) to authenticated;

-- Liste
create or replace function public.bildirimlerimi_listele(p_limit int default 50)
returns setof public.user_notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  return query
  select n.*
  from public.user_notifications n
  where n.user_id = v_uid
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

grant execute on function public.bildirimlerimi_listele(int) to authenticated;

-- Okunmamis sayi
create or replace function public.bildirim_okunmamis_sayim()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n bigint;
begin
  if v_uid is null then return 0; end if;
  select count(*) into v_n
  from public.user_notifications
  where user_id = v_uid and read_at is null;
  return coalesce(v_n, 0);
end;
$$;

grant execute on function public.bildirim_okunmamis_sayim() to authenticated;

-- Sayfa acilinca: hepsini okundu
create or replace function public.bildirimleri_hepsini_okundu()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_n bigint;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  with upd as (
    update public.user_notifications
    set read_at = now()
    where user_id = v_uid and read_at is null
    returning 1
  )
  select count(*) into v_n from upd;
  return coalesce(v_n, 0);
end;
$$;

grant execute on function public.bildirimleri_hepsini_okundu() to authenticated;

-- Tek bildirim okundu
create or replace function public.bildirim_okundu_isaretle(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_unread bigint;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_id is null then raise exception 'id gerekli'; end if;

  update public.user_notifications
  set read_at = coalesce(read_at, now())
  where id = p_id and user_id = v_uid;

  select count(*) into v_unread
  from public.user_notifications
  where user_id = v_uid and read_at is null;

  return jsonb_build_object('ok', true, 'unread', coalesce(v_unread, 0));
end;
$$;

grant execute on function public.bildirim_okundu_isaretle(uuid) to authenticated;

-- Eski outbox → gelen kutu (okunmamis olarak; son 90 gun)
insert into public.user_notifications (
  user_id, category, title, body, deep_link, payload, outbox_id, created_at, read_at
)
select
  o.user_id,
  o.category,
  o.title,
  o.body,
  o.deep_link,
  coalesce(o.payload, '{}'::jsonb),
  o.id,
  o.created_at,
  case when o.created_at < now() - interval '7 days' then o.created_at else null end
from public.notification_outbox o
where o.created_at > now() - interval '90 days'
  and not exists (
    select 1 from public.user_notifications n where n.outbox_id = o.id
  );
