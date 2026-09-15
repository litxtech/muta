-- Uygulama paylaşım / indirme linkleri
-- Admin CRUD; kullanıcılar kişisel davet kodu ile paylaşır.
-- Edge function (share-redirect) mağaza URL'lerine yönlendirir.

create table if not exists public.app_share_links (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  description text,
  platform text not null
    check (platform in ('ios', 'android', 'web', 'universal', 'other')),
  url text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_share_links_code_unique unique (code),
  constraint app_share_links_url_len check (char_length(trim(url)) >= 8)
);

create index if not exists app_share_links_active_sort_idx
  on public.app_share_links (is_active, sort_order, created_at desc);

drop trigger if exists app_share_links_updated_at on public.app_share_links;
create trigger app_share_links_updated_at
  before update on public.app_share_links
  for each row execute function public.set_updated_at();

-- Kullanıcı kişisel davet kodları
create table if not exists public.user_share_codes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null,
  click_count bigint not null default 0 check (click_count >= 0),
  install_count bigint not null default 0 check (install_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_share_codes_code_unique unique (code),
  constraint user_share_codes_code_format check (code ~ '^[A-Z0-9]{4,16}$')
);

drop trigger if exists user_share_codes_updated_at on public.user_share_codes;
create trigger user_share_codes_updated_at
  before update on public.user_share_codes
  for each row execute function public.set_updated_at();

-- Tıklama / açılma logu (opsiyonel analitik)
create table if not exists public.share_link_opens (
  id uuid primary key default gen_random_uuid(),
  share_code text,
  link_code text,
  platform_hint text,
  user_agent text,
  opener_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists share_link_opens_created_idx
  on public.share_link_opens (created_at desc);
create index if not exists share_link_opens_share_code_idx
  on public.share_link_opens (share_code, created_at desc);

-- Seed: admin düzenleyecek mağaza / web URL'leri
insert into public.app_share_links (code, title, description, platform, url, sort_order)
values
  (
    'ios',
    'App Store',
    'iOS indirme bağlantısı',
    'ios',
    'https://apps.apple.com/app/id0000000000',
    10
  ),
  (
    'android',
    'Google Play',
    'Android indirme bağlantısı',
    'android',
    'https://play.google.com/store/apps/details?id=com.litxtech.muta',
    20
  ),
  (
    'web',
    'Web / yedek',
    'Masaüstü veya bilinmeyen cihazlar',
    'web',
    'https://tamuso.app',
    30
  )
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create or replace function public.benim_davet_kodumu_al_veya_olustur()
returns public.user_share_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.user_share_codes%rowtype;
  v_code text;
  v_try int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_row from public.user_share_codes where user_id = v_uid;
  if found then
    return v_row;
  end if;

  loop
    v_try := v_try + 1;
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into public.user_share_codes (user_id, code)
      values (v_uid, v_code)
      returning * into v_row;
      return v_row;
    exception when unique_violation then
      if v_try >= 8 then
        raise exception 'Invite code generation failed';
      end if;
    end;
  end loop;
end;
$$;

create or replace function public.paylasim_tiklama_kaydet(
  p_share_code text default null,
  p_link_code text default null,
  p_platform_hint text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := nullif(upper(trim(coalesce(p_share_code, ''))), '');
  v_opens bigint := 0;
begin
  insert into public.share_link_opens (
    share_code, link_code, platform_hint, user_agent, opener_user_id
  ) values (
    v_code,
    nullif(trim(coalesce(p_link_code, '')), ''),
    nullif(trim(coalesce(p_platform_hint, '')), ''),
    left(coalesce(p_user_agent, ''), 500),
    auth.uid()
  );

  if v_code is not null then
    update public.user_share_codes
    set click_count = click_count + 1
    where code = v_code and is_active
    returning click_count into v_opens;
  end if;

  return jsonb_build_object(
    'ok', true,
    'share_code', v_code,
    'click_count', coalesce(v_opens, 0)
  );
end;
$$;

create or replace function public.aktif_paylasim_linklerini_getir()
returns setof public.app_share_links
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.app_share_links
  where is_active
  order by sort_order asc, created_at asc;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.app_share_links enable row level security;
alter table public.user_share_codes enable row level security;
alter table public.share_link_opens enable row level security;

drop policy if exists "Share links read" on public.app_share_links;
create policy "Share links read"
  on public.app_share_links for select to authenticated
  using (is_active or public.ben_admin_miyim());

drop policy if exists "Share links admin insert" on public.app_share_links;
create policy "Share links admin insert"
  on public.app_share_links for insert to authenticated
  with check (public.ben_admin_miyim());

drop policy if exists "Share links admin update" on public.app_share_links;
create policy "Share links admin update"
  on public.app_share_links for update to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

drop policy if exists "Share links admin delete" on public.app_share_links;
create policy "Share links admin delete"
  on public.app_share_links for delete to authenticated
  using (public.ben_admin_miyim());

drop policy if exists "Own share code select" on public.user_share_codes;
create policy "Own share code select"
  on public.user_share_codes for select to authenticated
  using (auth.uid() = user_id or public.ben_admin_miyim());

drop policy if exists "Own share code insert" on public.user_share_codes;
create policy "Own share code insert"
  on public.user_share_codes for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Own share code update" on public.user_share_codes;
create policy "Own share code update"
  on public.user_share_codes for update to authenticated
  using (auth.uid() = user_id or public.ben_admin_miyim())
  with check (auth.uid() = user_id or public.ben_admin_miyim());

drop policy if exists "Share opens admin select" on public.share_link_opens;
create policy "Share opens admin select"
  on public.share_link_opens for select to authenticated
  using (public.ben_admin_miyim() or opener_user_id = auth.uid());

grant select, insert, update, delete on public.app_share_links to authenticated;
grant select, insert, update on public.user_share_codes to authenticated;
grant select on public.share_link_opens to authenticated;

grant execute on function public.benim_davet_kodumu_al_veya_olustur() to authenticated;
grant execute on function public.paylasim_tiklama_kaydet(text, text, text, text) to authenticated, anon;
grant execute on function public.aktif_paylasim_linklerini_getir() to authenticated, anon;
