-- ============================================================================
-- Tamuso Fikir & Öneri Merkezi
-- platform_feedback + kategoriler, oy, durum geçmişi, admin cevap, ödül, snapshot
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Kategoriler
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  icon text not null default 'bulb-outline',
  sort_order int not null default 100,
  is_active boolean not null default true,
  is_bug_form boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_categories_active_sort_idx
  on public.feedback_categories (is_active, sort_order);

insert into public.feedback_categories (code, name, icon, sort_order, is_bug_form) values
  ('live', 'Canlı Yayın', 'videocam-outline', 10, false),
  ('voice_rooms', 'Ses Odaları', 'headset-outline', 20, false),
  ('messaging', 'Mesajlaşma', 'chatbubbles-outline', 30, false),
  ('feed', 'Feed & Gönderiler', 'newspaper-outline', 40, false),
  ('profile', 'Profil', 'person-outline', 50, false),
  ('gifts', 'Hediyeler', 'gift-outline', 60, false),
  ('wallet', 'Coin & Cüzdan', 'wallet-outline', 70, false),
  ('follow', 'Takip Sistemi', 'people-outline', 80, false),
  ('notifications', 'Bildirimler', 'notifications-outline', 90, false),
  ('ux', 'Tasarım & Kullanım Deneyimi', 'color-palette-outline', 100, false),
  ('security', 'Güvenlik', 'shield-checkmark-outline', 110, false),
  ('performance', 'Performans', 'speedometer-outline', 120, false),
  ('new_feature', 'Yeni Özellik Önerisi', 'sparkles-outline', 130, false),
  ('bug', 'Hata / Sorun Bildirimi', 'bug-outline', 140, true),
  ('other', 'Diğer', 'ellipsis-horizontal-outline', 150, false)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 2) Ana fikir tablosu
-- ---------------------------------------------------------------------------
create table if not exists public.platform_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.feedback_categories(id),
  title text not null,
  description text not null,
  status text not null default 'RECEIVED'
    check (status in (
      'RECEIVED','REVIEWING','PLANNED','IN_DEVELOPMENT','COMPLETED','NOT_PLANNED'
    )),
  is_public boolean not null default false,
  is_featured boolean not null default false,
  is_archived boolean not null default false,
  is_hidden boolean not null default false,
  vote_count int not null default 0 check (vote_count >= 0),
  -- hata formu (opsiyonel)
  bug_where text,
  bug_what text,
  bug_repro text,
  -- teknik metadata (güvenli alanlar)
  platform text,
  app_version text,
  build_number text,
  os_version text,
  -- admin
  admin_internal_note text,
  completed_at timestamptz,
  last_status_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_feedback_title_len check (char_length(trim(title)) between 8 and 120),
  constraint platform_feedback_desc_len check (char_length(trim(description)) between 40 and 4000)
);

create index if not exists platform_feedback_user_created_idx
  on public.platform_feedback (user_id, created_at desc);
create index if not exists platform_feedback_status_created_idx
  on public.platform_feedback (status, created_at desc);
create index if not exists platform_feedback_public_votes_idx
  on public.platform_feedback (is_public, is_hidden, is_archived, vote_count desc)
  where is_public = true and is_hidden = false and is_archived = false;
create index if not exists platform_feedback_category_idx
  on public.platform_feedback (category_id, created_at desc);
create index if not exists platform_feedback_title_lower_idx
  on public.platform_feedback (lower(title));

-- ---------------------------------------------------------------------------
-- 3) Yazar snapshot (gönderim anı)
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_author_snapshots (
  feedback_id uuid primary key references public.platform_feedback(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text,
  display_name text,
  profile_photo_url text,
  public_user_id text,
  country text,
  country_code text,
  account_created_at timestamptz,
  platform text,
  app_version text,
  build_number text,
  os_version text,
  feedback_created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4) Ekler
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_attachments (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.platform_feedback(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  mime_type text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists feedback_attachments_feedback_idx
  on public.feedback_attachments (feedback_id, sort_order);

-- ---------------------------------------------------------------------------
-- 5) Destek / oy
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_votes (
  feedback_id uuid not null references public.platform_feedback(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (feedback_id, user_id)
);

create index if not exists feedback_votes_user_idx
  on public.feedback_votes (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 6) Durum geçmişi
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_status_history (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.platform_feedback(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists feedback_status_history_fb_idx
  on public.feedback_status_history (feedback_id, created_at asc);

-- ---------------------------------------------------------------------------
-- 7) Admin cevapları
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_admin_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.platform_feedback(id) on delete cascade,
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  is_visible_to_user boolean not null default true,
  created_at timestamptz not null default now(),
  constraint feedback_admin_replies_body_len check (char_length(trim(body)) between 1 and 2000)
);

create index if not exists feedback_admin_replies_fb_idx
  on public.feedback_admin_replies (feedback_id, created_at asc);

-- ---------------------------------------------------------------------------
-- 8) Ödüller
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_rewards (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.platform_feedback(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  reward_type text not null check (reward_type in ('coin', 'badge')),
  reward_value text not null,
  reward_amount bigint,
  reward_metadata jsonb not null default '{}'::jsonb,
  user_message text,
  admin_note text,
  granted_by uuid not null references public.profiles(id),
  status text not null default 'granted'
    check (status in ('granted', 'cancelled')),
  idempotency_key text not null unique,
  ledger_ref uuid,
  created_at timestamptz not null default now()
);

create index if not exists feedback_rewards_fb_idx
  on public.feedback_rewards (feedback_id, created_at desc);
create index if not exists feedback_rewards_recipient_idx
  on public.feedback_rewards (recipient_user_id, created_at desc);

-- Rozet seed
insert into public.badges (code, name, description, rarity, is_active)
values (
  'tamuso_katkilari',
  'Tamuso Katkıcısı',
  'Platform gelişimine katkı sağlayan fikir sahiplerine özel rozet',
  'epic',
  true
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = true;

-- ---------------------------------------------------------------------------
-- 9) Rate limit yardımcısı
-- ---------------------------------------------------------------------------
create table if not exists public.feedback_rate_limits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_submit_at timestamptz not null default now(),
  submit_count_hour int not null default 1,
  hour_window_start timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 10) Storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'feedback-media',
  'feedback-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Feedback media public read" on storage.objects;
create policy "Feedback media public read"
  on storage.objects for select
  to public
  using (bucket_id = 'feedback-media');

drop policy if exists "Feedback media own upload" on storage.objects;
create policy "Feedback media own upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'feedback-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Feedback media own update" on storage.objects;
create policy "Feedback media own update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'feedback-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Feedback media own delete" on storage.objects;
create policy "Feedback media own delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'feedback-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 11) RLS
-- ---------------------------------------------------------------------------
alter table public.feedback_categories enable row level security;
alter table public.platform_feedback enable row level security;
alter table public.feedback_author_snapshots enable row level security;
alter table public.feedback_attachments enable row level security;
alter table public.feedback_votes enable row level security;
alter table public.feedback_status_history enable row level security;
alter table public.feedback_admin_replies enable row level security;
alter table public.feedback_rewards enable row level security;
alter table public.feedback_rate_limits enable row level security;

drop policy if exists "feedback_categories_select" on public.feedback_categories;
create policy "feedback_categories_select"
  on public.feedback_categories for select to authenticated
  using (is_active = true or public.ben_admin_miyim());

drop policy if exists "feedback_categories_admin_all" on public.feedback_categories;
create policy "feedback_categories_admin_all"
  on public.feedback_categories for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

drop policy if exists "platform_feedback_select" on public.platform_feedback;
create policy "platform_feedback_select"
  on public.platform_feedback for select to authenticated
  using (
    user_id = auth.uid()
    or public.ben_admin_miyim()
    or (is_public = true and is_hidden = false and is_archived = false)
  );

-- Insert/update sadece RPC üzerinden (direct insert engelle)
drop policy if exists "platform_feedback_no_direct_write" on public.platform_feedback;
create policy "platform_feedback_no_direct_write"
  on public.platform_feedback for insert to authenticated
  with check (false);

drop policy if exists "platform_feedback_no_direct_update" on public.platform_feedback;
create policy "platform_feedback_no_direct_update"
  on public.platform_feedback for update to authenticated
  using (false);

drop policy if exists "feedback_snapshots_select" on public.feedback_author_snapshots;
create policy "feedback_snapshots_select"
  on public.feedback_author_snapshots for select to authenticated
  using (
    user_id = auth.uid()
    or public.ben_admin_miyim()
    or exists (
      select 1 from public.platform_feedback f
      where f.id = feedback_id
        and f.is_public = true and f.is_hidden = false and f.is_archived = false
    )
  );

drop policy if exists "feedback_attachments_select" on public.feedback_attachments;
create policy "feedback_attachments_select"
  on public.feedback_attachments for select to authenticated
  using (
    user_id = auth.uid()
    or public.ben_admin_miyim()
    or exists (
      select 1 from public.platform_feedback f
      where f.id = feedback_id
        and (
          f.user_id = auth.uid()
          or (f.is_public = true and f.is_hidden = false and f.is_archived = false)
        )
    )
  );

drop policy if exists "feedback_votes_select" on public.feedback_votes;
create policy "feedback_votes_select"
  on public.feedback_votes for select to authenticated
  using (true);

drop policy if exists "feedback_votes_no_direct" on public.feedback_votes;
create policy "feedback_votes_no_direct"
  on public.feedback_votes for insert to authenticated
  with check (false);

drop policy if exists "feedback_status_history_select" on public.feedback_status_history;
create policy "feedback_status_history_select"
  on public.feedback_status_history for select to authenticated
  using (
    public.ben_admin_miyim()
    or exists (
      select 1 from public.platform_feedback f
      where f.id = feedback_id
        and (
          f.user_id = auth.uid()
          or (f.is_public = true and f.is_hidden = false and f.is_archived = false)
        )
    )
  );

drop policy if exists "feedback_admin_replies_select" on public.feedback_admin_replies;
create policy "feedback_admin_replies_select"
  on public.feedback_admin_replies for select to authenticated
  using (
    public.ben_admin_miyim()
    or (
      is_visible_to_user = true
      and exists (
        select 1 from public.platform_feedback f
        where f.id = feedback_id and f.user_id = auth.uid()
      )
    )
  );

drop policy if exists "feedback_rewards_select" on public.feedback_rewards;
create policy "feedback_rewards_select"
  on public.feedback_rewards for select to authenticated
  using (
    recipient_user_id = auth.uid()
    or public.ben_admin_miyim()
  );

drop policy if exists "feedback_rate_limits_deny" on public.feedback_rate_limits;
create policy "feedback_rate_limits_deny"
  on public.feedback_rate_limits for all to authenticated
  using (false)
  with check (false);

-- ---------------------------------------------------------------------------
-- 12) Yardımcı: durum etiketi
-- ---------------------------------------------------------------------------
create or replace function public.feedback_durum_etiketi(p_status text)
returns text
language sql
immutable
as $$
  select case upper(coalesce(p_status, ''))
    when 'RECEIVED' then 'Alındı'
    when 'REVIEWING' then 'İnceleniyor'
    when 'PLANNED' then 'Planlandı'
    when 'IN_DEVELOPMENT' then 'Geliştiriliyor'
    when 'COMPLETED' then 'Hayata Geçirildi'
    when 'NOT_PLANNED' then 'Şimdilik Planlanmıyor'
    else coalesce(p_status, '')
  end;
$$;

-- ---------------------------------------------------------------------------
-- 13) Kategorileri getir
-- ---------------------------------------------------------------------------
create or replace function public.feedback_kategorileri_getir(p_include_inactive boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := public.ben_admin_miyim();
  v_out jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.sort_order, t.name), '[]'::jsonb)
  into v_out
  from (
    select id, code, name, icon, sort_order, is_active, is_bug_form
    from public.feedback_categories
    where (p_include_inactive and v_admin) or is_active = true
    order by sort_order, name
  ) t;

  return v_out;
end;
$$;

grant execute on function public.feedback_kategorileri_getir(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 14) Fikir gönder
-- ---------------------------------------------------------------------------
create or replace function public.feedback_gonder(
  p_category_id uuid,
  p_title text,
  p_description text,
  p_attachments jsonb default '[]'::jsonb,
  p_bug_where text default null,
  p_bug_what text default null,
  p_bug_repro text default null,
  p_platform text default null,
  p_app_version text default null,
  p_build_number text default null,
  p_os_version text default null,
  p_client_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cat public.feedback_categories%rowtype;
  v_title text := left(trim(coalesce(p_title, '')), 120);
  v_desc text := left(trim(coalesce(p_description, '')), 4000);
  v_fb_id uuid;
  v_now timestamptz := now();
  v_rl public.feedback_rate_limits%rowtype;
  v_att jsonb;
  v_path text;
  v_url text;
  v_mime text;
  v_i int := 0;
  v_token text := nullif(trim(coalesce(p_client_token, '')), '');
  v_prof record;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.hesap_aktif_mi(v_uid) then raise exception 'Hesap aktif değil'; end if;

  select * into v_cat from public.feedback_categories where id = p_category_id and is_active;
  if not found then raise exception 'Kategori bulunamadı'; end if;

  if char_length(v_title) < 8 then raise exception 'Başlık en az 8 karakter olmalı'; end if;
  if char_length(v_desc) < 40 then raise exception 'Açıklama en az 40 karakter olmalı'; end if;

  -- Rate limit: 60 sn cooldown + saatte max 5
  select * into v_rl from public.feedback_rate_limits where user_id = v_uid for update;
  if found then
    if v_rl.last_submit_at > v_now - interval '60 seconds' then
      raise exception 'Çok hızlı gönderim. Lütfen bir dakika bekleyin.';
    end if;
    if v_rl.hour_window_start > v_now - interval '1 hour' then
      if v_rl.submit_count_hour >= 5 then
        raise exception 'Saatlik fikir limiti doldu. Daha sonra tekrar deneyin.';
      end if;
      update public.feedback_rate_limits set
        last_submit_at = v_now,
        submit_count_hour = submit_count_hour + 1
      where user_id = v_uid;
    else
      update public.feedback_rate_limits set
        last_submit_at = v_now,
        submit_count_hour = 1,
        hour_window_start = v_now
      where user_id = v_uid;
    end if;
  else
    insert into public.feedback_rate_limits (user_id, last_submit_at, submit_count_hour, hour_window_start)
    values (v_uid, v_now, 1, v_now);
  end if;

  -- Duplicate: aynı başlık + aynı kullanıcı 24 saat içinde
  if exists (
    select 1 from public.platform_feedback
    where user_id = v_uid
      and lower(title) = lower(v_title)
      and created_at > v_now - interval '24 hours'
      and is_archived = false
  ) then
    raise exception 'Aynı başlıkla yakın zamanda fikir gönderdiniz.';
  end if;

  -- Client token idempotency (opsiyonel)
  if v_token is not null then
    if exists (
      select 1 from public.finance_idempotency_keys
      where idempotency_key = 'feedback_submit:' || v_token
        and user_id = v_uid
    ) then
      select result_payload into v_att
      from public.finance_idempotency_keys
      where idempotency_key = 'feedback_submit:' || v_token
        and user_id = v_uid;
      return coalesce(v_att, jsonb_build_object('ok', true, 'duplicate', true));
    end if;
  end if;

  insert into public.platform_feedback (
    user_id, category_id, title, description, status,
    bug_where, bug_what, bug_repro,
    platform, app_version, build_number, os_version,
    last_status_at
  ) values (
    v_uid, p_category_id, v_title, v_desc, 'RECEIVED',
    nullif(trim(coalesce(p_bug_where, '')), ''),
    nullif(trim(coalesce(p_bug_what, '')), ''),
    nullif(trim(coalesce(p_bug_repro, '')), ''),
    left(nullif(trim(coalesce(p_platform, '')), ''), 32),
    left(nullif(trim(coalesce(p_app_version, '')), ''), 32),
    left(nullif(trim(coalesce(p_build_number, '')), ''), 32),
    left(nullif(trim(coalesce(p_os_version, '')), ''), 64),
    v_now
  )
  returning id into v_fb_id;

  select
    p.username, p.display_name, p.avatar_url, p.public_user_id,
    p.country, p.country_code, p.created_at
  into v_prof
  from public.profiles p where p.id = v_uid;

  insert into public.feedback_author_snapshots (
    feedback_id, user_id, username, display_name, profile_photo_url,
    public_user_id, country, country_code, account_created_at,
    platform, app_version, build_number, os_version, feedback_created_at
  ) values (
    v_fb_id, v_uid, v_prof.username, v_prof.display_name, v_prof.avatar_url,
    v_prof.public_user_id, v_prof.country, v_prof.country_code, v_prof.created_at,
    left(nullif(trim(coalesce(p_platform, '')), ''), 32),
    left(nullif(trim(coalesce(p_app_version, '')), ''), 32),
    left(nullif(trim(coalesce(p_build_number, '')), ''), 32),
    left(nullif(trim(coalesce(p_os_version, '')), ''), 64),
    v_now
  );

  insert into public.feedback_status_history (feedback_id, from_status, to_status, changed_by, note)
  values (v_fb_id, null, 'RECEIVED', v_uid, 'Fikir alındı');

  if jsonb_typeof(coalesce(p_attachments, '[]'::jsonb)) = 'array' then
    for v_att in select * from jsonb_array_elements(p_attachments) loop
      v_path := nullif(trim(coalesce(v_att->>'storage_path', '')), '');
      v_url := nullif(trim(coalesce(v_att->>'public_url', '')), '');
      v_mime := nullif(trim(coalesce(v_att->>'mime_type', '')), '');
      if v_path is null or v_url is null then continue; end if;
      -- sadece kendi klasörü
      if split_part(v_path, '/', 1) <> v_uid::text then
        raise exception 'Geçersiz ek yolu';
      end if;
      insert into public.feedback_attachments (
        feedback_id, user_id, storage_path, public_url, mime_type, sort_order
      ) values (v_fb_id, v_uid, v_path, v_url, v_mime, v_i);
      v_i := v_i + 1;
      if v_i >= 5 then exit; end if;
    end loop;
  end if;

  v_att := jsonb_build_object('ok', true, 'id', v_fb_id, 'status', 'RECEIVED');

  if v_token is not null then
    insert into public.finance_idempotency_keys (
      idempotency_key, user_id, operation, result_ref, result_payload
    ) values (
      'feedback_submit:' || v_token, v_uid, 'feedback_submit', v_fb_id, v_att
    )
    on conflict (idempotency_key) do nothing;
  end if;

  return v_att;
end;
$$;

grant execute on function public.feedback_gonder(
  uuid, text, text, jsonb, text, text, text, text, text, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- 15) Fikirlerim listesi
-- ---------------------------------------------------------------------------
create or replace function public.feedback_fikirlerim(
  p_limit integer default 30,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := greatest(1, least(coalesce(p_limit, 30), 50));
  v_offset int := greatest(0, coalesce(p_offset, 0));
  v_out jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
  into v_out
  from (
    select
      f.id, f.title, f.status, f.is_public, f.is_featured, f.vote_count,
      f.created_at, f.updated_at, f.last_status_at,
      jsonb_build_object(
        'id', c.id, 'code', c.code, 'name', c.name, 'icon', c.icon
      ) as category
    from public.platform_feedback f
    join public.feedback_categories c on c.id = f.category_id
    where f.user_id = v_uid and f.is_archived = false
    order by f.created_at desc
    limit v_limit offset v_offset
  ) t;

  return v_out;
end;
$$;

grant execute on function public.feedback_fikirlerim(integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 16) Topluluk / public listeler
-- ---------------------------------------------------------------------------
create or replace function public.feedback_topluluk_liste(
  p_sort text default 'popular',
  p_limit integer default 20,
  p_offset integer default 0,
  p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 50));
  v_offset int := greatest(0, coalesce(p_offset, 0));
  v_sort text := lower(coalesce(p_sort, 'popular'));
  v_out jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  into v_out
  from (
    select
      f.id, f.title, f.status, f.vote_count, f.is_featured, f.created_at,
      jsonb_build_object(
        'id', c.id, 'code', c.code, 'name', c.name, 'icon', c.icon
      ) as category,
      exists (
        select 1 from public.feedback_votes v
        where v.feedback_id = f.id and v.user_id = v_uid
      ) as i_voted,
      case
        when s.display_name is not null or s.username is not null then
          jsonb_build_object(
            'display_name', s.display_name,
            'username', s.username,
            'avatar_url', s.profile_photo_url
          )
        else null
      end as author_snapshot
    from public.platform_feedback f
    join public.feedback_categories c on c.id = f.category_id
    left join public.feedback_author_snapshots s on s.feedback_id = f.id
    where f.is_public = true
      and f.is_hidden = false
      and f.is_archived = false
      and (p_status is null or f.status = upper(p_status))
    order by
      case when v_sort = 'featured' then (f.is_featured::int) else 0 end desc,
      case when v_sort = 'popular' then f.vote_count else 0 end desc,
      case when v_sort = 'new' then extract(epoch from f.created_at) else 0 end desc,
      case when v_sort = 'reviewing' and f.status = 'REVIEWING' then 1 else 0 end desc,
      f.created_at desc
    limit v_limit offset v_offset
  ) t;

  return v_out;
end;
$$;

grant execute on function public.feedback_topluluk_liste(text, integer, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 17) Benzer fikir arama (basit)
-- ---------------------------------------------------------------------------
create or replace function public.feedback_benzer_ara(p_title text, p_limit integer default 5)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_q text := lower(trim(coalesce(p_title, '')));
  v_limit int := greatest(1, least(coalesce(p_limit, 5), 10));
  v_out jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if char_length(v_q) < 4 then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  into v_out
  from (
    select f.id, f.title, f.vote_count, f.status,
      jsonb_build_object('name', c.name, 'icon', c.icon) as category
    from public.platform_feedback f
    join public.feedback_categories c on c.id = f.category_id
    where f.is_public = true
      and f.is_hidden = false
      and f.is_archived = false
      and lower(f.title) like '%' || v_q || '%'
    order by
      case when lower(f.title) = v_q then 0
           when lower(f.title) like v_q || '%' then 1
           else 2 end,
      f.vote_count desc,
      f.created_at desc
    limit v_limit
  ) t;

  return coalesce(v_out, '[]'::jsonb);
end;
$$;

grant execute on function public.feedback_benzer_ara(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 18) Fikir detay
-- ---------------------------------------------------------------------------
create or replace function public.feedback_detay(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean := public.ben_admin_miyim();
  v_f public.platform_feedback%rowtype;
  v_out jsonb;
  v_can boolean := false;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if p_id is null then raise exception 'id required'; end if;

  select * into v_f from public.platform_feedback where id = p_id;
  if not found then raise exception 'Fikir bulunamadı'; end if;

  v_can := v_admin
    or v_f.user_id = v_uid
    or (v_f.is_public and not v_f.is_hidden and not v_f.is_archived);

  if not v_can then raise exception 'Bu fikri görme yetkiniz yok'; end if;

  select jsonb_build_object(
    'id', v_f.id,
    'user_id', v_f.user_id,
    'title', v_f.title,
    'description', case
      when v_admin or v_f.user_id = v_uid or v_f.is_public then v_f.description
      else null
    end,
    'status', v_f.status,
    'status_label', public.feedback_durum_etiketi(v_f.status),
    'is_public', v_f.is_public,
    'is_featured', v_f.is_featured,
    'is_archived', v_f.is_archived,
    'is_hidden', v_f.is_hidden,
    'vote_count', v_f.vote_count,
    'bug_where', case when v_admin or v_f.user_id = v_uid then v_f.bug_where else null end,
    'bug_what', case when v_admin or v_f.user_id = v_uid then v_f.bug_what else null end,
    'bug_repro', case when v_admin or v_f.user_id = v_uid then v_f.bug_repro else null end,
    'platform', case when v_admin or v_f.user_id = v_uid then v_f.platform else null end,
    'app_version', case when v_admin or v_f.user_id = v_uid then v_f.app_version else null end,
    'build_number', case when v_admin or v_f.user_id = v_uid then v_f.build_number else null end,
    'os_version', case when v_admin or v_f.user_id = v_uid then v_f.os_version else null end,
    'admin_internal_note', case when v_admin then v_f.admin_internal_note else null end,
    'created_at', v_f.created_at,
    'updated_at', v_f.updated_at,
    'last_status_at', v_f.last_status_at,
    'completed_at', v_f.completed_at,
    'is_mine', v_f.user_id = v_uid,
    'i_voted', exists (
      select 1 from public.feedback_votes v
      where v.feedback_id = v_f.id and v.user_id = v_uid
    ),
    'category', (
      select jsonb_build_object(
        'id', c.id, 'code', c.code, 'name', c.name, 'icon', c.icon, 'is_bug_form', c.is_bug_form
      ) from public.feedback_categories c where c.id = v_f.category_id
    ),
    'author_snapshot', (
      select jsonb_build_object(
        'user_id', s.user_id,
        'username', s.username,
        'display_name', s.display_name,
        'profile_photo_url', s.profile_photo_url,
        'public_user_id', s.public_user_id,
        'country', s.country,
        'country_code', s.country_code,
        'account_created_at', s.account_created_at,
        'platform', s.platform,
        'app_version', s.app_version,
        'build_number', s.build_number,
        'os_version', s.os_version,
        'feedback_created_at', s.feedback_created_at
      ) from public.feedback_author_snapshots s where s.feedback_id = v_f.id
    ),
    'current_author', case when v_admin then (
      select jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'public_user_id', p.public_user_id,
        'country', p.country,
        'country_code', p.country_code
      ) from public.profiles p where p.id = v_f.user_id
    ) else null end,
    'attachments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'public_url', a.public_url,
        'mime_type', a.mime_type,
        'sort_order', a.sort_order
      ) order by a.sort_order)
      from public.feedback_attachments a where a.feedback_id = v_f.id
    ), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id,
        'from_status', h.from_status,
        'to_status', h.to_status,
        'to_label', public.feedback_durum_etiketi(h.to_status),
        'note', h.note,
        'created_at', h.created_at
      ) order by h.created_at asc)
      from public.feedback_status_history h where h.feedback_id = v_f.id
    ), '[]'::jsonb),
    'admin_replies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'body', r.body,
        'created_at', r.created_at,
        'team_badge', true
      ) order by r.created_at asc)
      from public.feedback_admin_replies r
      where r.feedback_id = v_f.id
        and (v_admin or (r.is_visible_to_user and v_f.user_id = v_uid))
    ), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rw.id,
        'reward_type', rw.reward_type,
        'reward_value', rw.reward_value,
        'reward_amount', rw.reward_amount,
        'user_message', rw.user_message,
        'admin_note', case when v_admin then rw.admin_note else null end,
        'status', rw.status,
        'created_at', rw.created_at
      ) order by rw.created_at asc)
      from public.feedback_rewards rw
      where rw.feedback_id = v_f.id
        and rw.status = 'granted'
        and (v_admin or rw.recipient_user_id = v_uid)
    ), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

grant execute on function public.feedback_detay(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 19) Destekle / geri al
-- ---------------------------------------------------------------------------
create or replace function public.feedback_destek_toggle(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_f public.platform_feedback%rowtype;
  v_voted boolean;
  v_count int;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_f from public.platform_feedback where id = p_id for update;
  if not found then raise exception 'Fikir bulunamadı'; end if;
  if not v_f.is_public or v_f.is_hidden or v_f.is_archived then
    raise exception 'Bu fikre destek verilemez';
  end if;

  select exists (
    select 1 from public.feedback_votes where feedback_id = p_id and user_id = v_uid
  ) into v_voted;

  if v_voted then
    delete from public.feedback_votes where feedback_id = p_id and user_id = v_uid;
    update public.platform_feedback
      set vote_count = greatest(vote_count - 1, 0), updated_at = now()
    where id = p_id
    returning vote_count into v_count;
    return jsonb_build_object('ok', true, 'voted', false, 'vote_count', v_count);
  else
    insert into public.feedback_votes (feedback_id, user_id) values (p_id, v_uid);
    update public.platform_feedback
      set vote_count = vote_count + 1, updated_at = now()
    where id = p_id
    returning vote_count into v_count;
    return jsonb_build_object('ok', true, 'voted', true, 'vote_count', v_count);
  end if;
end;
$$;

grant execute on function public.feedback_destek_toggle(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 20) Admin: liste + istatistik
-- ---------------------------------------------------------------------------
create or replace function public.admin_feedback_istatistik()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start timestamptz := date_trunc('week', now());
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  return jsonb_build_object(
    'this_week', (select count(*) from public.platform_feedback where created_at >= v_week_start),
    'received', (select count(*) from public.platform_feedback where status = 'RECEIVED' and not is_archived),
    'reviewing', (select count(*) from public.platform_feedback where status = 'REVIEWING' and not is_archived),
    'planned', (select count(*) from public.platform_feedback where status = 'PLANNED' and not is_archived),
    'in_development', (select count(*) from public.platform_feedback where status = 'IN_DEVELOPMENT' and not is_archived),
    'completed', (select count(*) from public.platform_feedback where status = 'COMPLETED' and not is_archived),
    'not_planned', (select count(*) from public.platform_feedback where status = 'NOT_PLANNED' and not is_archived),
    'top_categories', coalesce((
      select jsonb_agg(jsonb_build_object('name', x.name, 'count', x.cnt) order by x.cnt desc)
      from (
        select c.name, count(*)::int as cnt
        from public.platform_feedback f
        join public.feedback_categories c on c.id = f.category_id
        where f.created_at >= now() - interval '30 days'
        group by c.name
        order by count(*) desc
        limit 5
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.admin_feedback_istatistik() to authenticated;

create or replace function public.admin_feedback_liste(
  p_status text default null,
  p_category_id uuid default null,
  p_user_ref text default null,
  p_q text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 40,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 40), 100));
  v_offset int := greatest(0, coalesce(p_offset, 0));
  v_q text := nullif(lower(trim(coalesce(p_q, ''))), '');
  v_ref text := nullif(trim(coalesce(p_user_ref, '')), '');
  v_user uuid;
  v_out jsonb;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  if v_ref is not null then
    begin
      v_user := v_ref::uuid;
    exception when others then
      v_user := null;
    end;
    if v_user is null then
      select p.id into v_user
      from public.profiles p
      where p.public_user_id = v_ref
         or lower(coalesce(p.username, '')) = lower(v_ref)
      limit 1;
    end if;
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]'::jsonb)
  into v_out
  from (
    select
      f.id, f.title, f.status, f.is_public, f.is_featured, f.is_hidden, f.is_archived,
      f.vote_count, f.created_at, f.last_status_at,
      jsonb_build_object('id', c.id, 'name', c.name, 'icon', c.icon) as category,
      jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'public_user_id', p.public_user_id
      ) as user
    from public.platform_feedback f
    join public.feedback_categories c on c.id = f.category_id
    join public.profiles p on p.id = f.user_id
    where (p_status is null or f.status = upper(p_status))
      and (p_category_id is null or f.category_id = p_category_id)
      and (v_user is null or f.user_id = v_user)
      and (p_from is null or f.created_at >= p_from)
      and (p_to is null or f.created_at <= p_to)
      and (
        v_q is null
        or lower(f.title) like '%' || v_q || '%'
        or lower(f.description) like '%' || v_q || '%'
        or lower(coalesce(p.username, '')) like '%' || v_q || '%'
        or lower(coalesce(p.display_name, '')) like '%' || v_q || '%'
        or coalesce(p.public_user_id, '') like '%' || v_q || '%'
      )
    order by f.created_at desc
    limit v_limit offset v_offset
  ) t;

  return v_out;
end;
$$;

grant execute on function public.admin_feedback_liste(
  text, uuid, text, text, timestamptz, timestamptz, integer, integer
) to authenticated;

-- ---------------------------------------------------------------------------
-- 21) Admin: durum güncelle
-- ---------------------------------------------------------------------------
create or replace function public.admin_feedback_durum_guncelle(
  p_id uuid,
  p_status text,
  p_admin_note text default null,
  p_is_public boolean default null,
  p_is_featured boolean default null,
  p_is_hidden boolean default null,
  p_is_archived boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.platform_feedback%rowtype;
  v_status text := upper(trim(coalesce(p_status, '')));
  v_title text;
  v_body text;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if v_status not in ('RECEIVED','REVIEWING','PLANNED','IN_DEVELOPMENT','COMPLETED','NOT_PLANNED') then
    raise exception 'Geçersiz durum';
  end if;

  select * into v_old from public.platform_feedback where id = p_id for update;
  if not found then raise exception 'Fikir bulunamadı'; end if;

  update public.platform_feedback set
    status = v_status,
    admin_internal_note = coalesce(nullif(trim(coalesce(p_admin_note, '')), ''), admin_internal_note),
    is_public = coalesce(p_is_public, is_public),
    is_featured = coalesce(p_is_featured, is_featured),
    is_hidden = coalesce(p_is_hidden, is_hidden),
    is_archived = coalesce(p_is_archived, is_archived),
    completed_at = case when v_status = 'COMPLETED' then coalesce(completed_at, now()) else completed_at end,
    last_status_at = case when v_status <> v_old.status then now() else last_status_at end,
    updated_at = now()
  where id = p_id;

  if v_status <> v_old.status then
    insert into public.feedback_status_history (feedback_id, from_status, to_status, changed_by)
    values (p_id, v_old.status, v_status, auth.uid());

    v_title := case v_status
      when 'REVIEWING' then 'Fikrin inceleniyor 💡'
      when 'PLANNED' then 'Fikrin planlandı 📋'
      when 'IN_DEVELOPMENT' then 'Fikrin geliştirmeye alındı 🚀'
      when 'COMPLETED' then 'Fikrin Tamuso''da! 🎉'
      when 'NOT_PLANNED' then 'Fikrin değerlendirildi'
      else 'Fikir durumun güncellendi'
    end;
    v_body := case v_status
      when 'REVIEWING' then '«' || left(v_old.title, 60) || '» önerin ekibimiz tarafından inceleniyor.'
      when 'PLANNED' then '«' || left(v_old.title, 60) || '» geliştirme planımıza eklendi.'
      when 'IN_DEVELOPMENT' then '«' || left(v_old.title, 60) || '» şu an geliştiriliyor.'
      when 'COMPLETED' then 'Bu öneri Tamuso''ya eklendi. Katkın için teşekkürler 💜'
      when 'NOT_PLANNED' then '«' || left(v_old.title, 60) || '» şu an için planlanmıyor.'
      else 'Fikir durumun değişti.'
    end;

    begin
      perform public.bildirim_kuyruga_ekle(
        v_old.user_id,
        'system',
        v_title,
        v_body,
        '/fikirler/' || p_id::text,
        jsonb_build_object('kind', 'feedback_status', 'feedback_id', p_id, 'status', v_status)
      );
    exception when others then null;
    end;
  end if;

  perform public.admin_audit_yaz(
    v_old.user_id,
    'feedback_status_' || lower(v_status),
    'Fikir durumu: ' || v_status,
    jsonb_build_object('feedback_id', p_id, 'from', v_old.status, 'to', v_status)
  );

  return jsonb_build_object('ok', true, 'id', p_id, 'status', v_status);
end;
$$;

grant execute on function public.admin_feedback_durum_guncelle(
  uuid, text, text, boolean, boolean, boolean, boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- 22) Admin cevap
-- ---------------------------------------------------------------------------
create or replace function public.admin_feedback_cevap_yaz(
  p_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_body text := left(trim(coalesce(p_body, '')), 2000);
  v_reply_id uuid;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if char_length(v_body) < 1 then raise exception 'Cevap boş olamaz'; end if;

  select user_id into v_owner from public.platform_feedback where id = p_id;
  if not found then raise exception 'Fikir bulunamadı'; end if;

  insert into public.feedback_admin_replies (feedback_id, admin_user_id, body)
  values (p_id, v_uid, v_body)
  returning id into v_reply_id;

  begin
    perform public.bildirim_kuyruga_ekle(
      v_owner,
      'system',
      'Tamuso Ekibi yanıtladı 💜',
      left(v_body, 120),
      '/fikirler/' || p_id::text,
      jsonb_build_object('kind', 'feedback_reply', 'feedback_id', p_id, 'reply_id', v_reply_id)
    );
  exception when others then null;
  end;

  return jsonb_build_object('ok', true, 'id', v_reply_id);
end;
$$;

grant execute on function public.admin_feedback_cevap_yaz(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 23) Admin kategori yönetimi
-- ---------------------------------------------------------------------------
create or replace function public.admin_feedback_kategori_kaydet(
  p_id uuid default null,
  p_name text default null,
  p_icon text default null,
  p_sort_order int default null,
  p_is_active boolean default null,
  p_is_bug_form boolean default null,
  p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_code text;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  if p_id is null then
    v_code := coalesce(
      nullif(trim(coalesce(p_code, '')), ''),
      lower(regexp_replace(trim(coalesce(p_name, '')), '[^a-zA-Z0-9]+', '_', 'g'))
    );
    if v_code is null or v_code = '' then raise exception 'Kod gerekli'; end if;
    insert into public.feedback_categories (code, name, icon, sort_order, is_active, is_bug_form)
    values (
      v_code,
      coalesce(nullif(trim(p_name), ''), v_code),
      coalesce(nullif(trim(p_icon), ''), 'bulb-outline'),
      coalesce(p_sort_order, 200),
      coalesce(p_is_active, true),
      coalesce(p_is_bug_form, false)
    )
    returning id into v_id;
  else
    update public.feedback_categories set
      name = coalesce(nullif(trim(p_name), ''), name),
      icon = coalesce(nullif(trim(p_icon), ''), icon),
      sort_order = coalesce(p_sort_order, sort_order),
      is_active = coalesce(p_is_active, is_active),
      is_bug_form = coalesce(p_is_bug_form, is_bug_form),
      updated_at = now()
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Kategori bulunamadı'; end if;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function public.admin_feedback_kategori_kaydet(
  uuid, text, text, int, boolean, boolean, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- 24) Admin ödül ver (coin / badge) — idempotent
-- ---------------------------------------------------------------------------
create or replace function public.admin_feedback_odul_ver(
  p_feedback_id uuid,
  p_reward_type text,
  p_reward_amount bigint default null,
  p_badge_code text default null,
  p_user_message text default null,
  p_admin_note text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_f public.platform_feedback%rowtype;
  v_type text := lower(trim(coalesce(p_reward_type, '')));
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_reward_id uuid;
  v_ledger_id uuid;
  v_bal bigint;
  v_amount bigint := abs(coalesce(p_reward_amount, 0));
  v_badge text := coalesce(nullif(trim(coalesce(p_badge_code, '')), ''), 'tamuso_katkilari');
  v_existing public.feedback_rewards%rowtype;
  v_msg text;
  v_value text;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if v_type not in ('coin', 'badge') then raise exception 'Geçersiz ödül türü'; end if;

  select * into v_f from public.platform_feedback where id = p_feedback_id for update;
  if not found then raise exception 'Fikir bulunamadı'; end if;

  if v_key is null then
    v_key := 'feedback_reward:' || p_feedback_id::text || ':' || v_type || ':' ||
      coalesce(p_reward_amount::text, v_badge) || ':' || v_admin::text || ':' ||
      to_char(now(), 'YYYYMMDDHH24MI');
  end if;

  select * into v_existing from public.feedback_rewards where idempotency_key = v_key;
  if found then
    return jsonb_build_object(
      'ok', true, 'duplicate', true, 'id', v_existing.id, 'status', v_existing.status
    );
  end if;

  if v_type = 'coin' then
    if v_amount <= 0 then raise exception 'Coin miktarı gerekli'; end if;
    v_value := v_amount::text;

    insert into public.wallets (user_id, coins, diamonds)
    values (v_f.user_id, 0, 0)
    on conflict (user_id) do nothing;

    update public.wallets
      set coins = coins + v_amount, updated_at = now()
    where user_id = v_f.user_id
    returning coins into v_bal;

    insert into public.wallet_ledger (
      user_id, currency, delta, balance_after, reason, ref_type, ref_id, meta
    ) values (
      v_f.user_id,
      'coins',
      v_amount,
      v_bal,
      'feedback_reward',
      'feedback',
      p_feedback_id,
      jsonb_build_object(
        'feedback_id', p_feedback_id,
        'admin_user_id', v_admin,
        'reward_type', 'coin',
        'source', 'feedback_reward'
      )
    )
    returning id into v_ledger_id;

    insert into public.feedback_rewards (
      feedback_id, recipient_user_id, reward_type, reward_value, reward_amount,
      reward_metadata, user_message, admin_note, granted_by, status,
      idempotency_key, ledger_ref
    ) values (
      p_feedback_id, v_f.user_id, 'coin', v_value, v_amount,
      jsonb_build_object('balance_after', v_bal),
      nullif(trim(coalesce(p_user_message, '')), ''),
      nullif(trim(coalesce(p_admin_note, '')), ''),
      v_admin, 'granted', v_key, v_ledger_id
    )
    returning id into v_reward_id;

    v_msg := coalesce(
      nullif(trim(coalesce(p_user_message, '')), ''),
      'Paylaştığın fikir hayata geçirildi. Platformun gelişimine katkın için sana '
        || to_char(v_amount, 'FM999,999,999') || ' Coin hediye ettik. 💜'
    );

    begin
      perform public.bildirim_kuyruga_ekle(
        v_f.user_id,
        'system',
        '🎉 Fikrin Tamuso''da!',
        left(v_msg, 200),
        '/fikirler/' || p_feedback_id::text,
        jsonb_build_object(
          'kind', 'feedback_reward',
          'feedback_id', p_feedback_id,
          'reward_type', 'coin',
          'amount', v_amount
        )
      );
    exception when others then null;
    end;

  else
    -- badge
    if not exists (select 1 from public.badges where code = v_badge and is_active) then
      raise exception 'Rozet bulunamadı';
    end if;
    v_value := v_badge;

    insert into public.user_badges (user_id, badge_code, awarded_at, source)
    values (v_f.user_id, v_badge, now(), 'feedback_reward:' || p_feedback_id::text)
    on conflict (user_id, badge_code) do nothing;

    insert into public.feedback_rewards (
      feedback_id, recipient_user_id, reward_type, reward_value, reward_amount,
      reward_metadata, user_message, admin_note, granted_by, status, idempotency_key
    ) values (
      p_feedback_id, v_f.user_id, 'badge', v_value, null,
      jsonb_build_object('badge_code', v_badge),
      nullif(trim(coalesce(p_user_message, '')), ''),
      nullif(trim(coalesce(p_admin_note, '')), ''),
      v_admin, 'granted', v_key
    )
    returning id into v_reward_id;

    v_msg := coalesce(
      nullif(trim(coalesce(p_user_message, '')), ''),
      'Katkin için sana "Tamuso Katkıcısı" rozeti verdik. 🏅'
    );

    begin
      perform public.bildirim_kuyruga_ekle(
        v_f.user_id,
        'system',
        '🏅 Tamuso Katkıcısı',
        left(v_msg, 200),
        '/fikirler/' || p_feedback_id::text,
        jsonb_build_object(
          'kind', 'feedback_reward',
          'feedback_id', p_feedback_id,
          'reward_type', 'badge',
          'badge_code', v_badge
        )
      );
    exception when others then null;
    end;
  end if;

  insert into public.finance_idempotency_keys (
    idempotency_key, user_id, operation, result_ref, result_payload
  ) values (
    v_key, v_admin, 'feedback_reward', v_reward_id,
    jsonb_build_object('feedback_id', p_feedback_id, 'type', v_type, 'amount', v_amount)
  )
  on conflict (idempotency_key) do nothing;

  perform public.admin_audit_yaz(
    v_f.user_id,
    'feedback_reward',
    'Fikir ödülü: ' || v_type,
    jsonb_build_object(
      'feedback_id', p_feedback_id,
      'reward_id', v_reward_id,
      'type', v_type,
      'amount', v_amount,
      'badge', v_badge
    )
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_reward_id,
    'reward_type', v_type,
    'amount', v_amount,
    'badge_code', case when v_type = 'badge' then v_badge else null end
  );
end;
$$;

grant execute on function public.admin_feedback_odul_ver(
  uuid, text, bigint, text, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- 25) Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.platform_feedback;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.feedback_status_history;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.feedback_admin_replies;
  exception when duplicate_object then null;
  end;
end $$;

alter table public.platform_feedback replica identity full;
alter table public.feedback_status_history replica identity full;
alter table public.feedback_admin_replies replica identity full;
