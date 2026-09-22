-- Oda arka plan müziği — schema, storage, flags, RLS
-- DROP yok; Kaskad müzik tablolarına dokunulmaz.

-- ---------------------------------------------------------------------------
-- Feature flags + config
-- ---------------------------------------------------------------------------
insert into public.feature_flags (key, enabled, description) values
  ('voice_room_music_enabled', true, 'Ses odası arka plan müziği'),
  ('music_ducking_enabled', true, 'Konuşurken müzik otomatik kısma'),
  ('music_playlists_enabled', true, 'Oda playlist'),
  ('music_favorites_enabled', true, 'Müzik favorileri')
on conflict (key) do nothing;

create table if not exists public.music_runtime_config (
  id int primary key default 1 check (id = 1),
  default_normal_volume numeric(4,3) not null default 0.280
    check (default_normal_volume >= 0 and default_normal_volume <= 1),
  default_ducked_volume numeric(4,3) not null default 0.100
    check (default_ducked_volume >= 0 and default_ducked_volume <= 1),
  duck_attack_ms int not null default 200 check (duck_attack_ms between 50 and 2000),
  duck_hold_ms int not null default 900 check (duck_hold_ms between 200 and 5000),
  max_music_volume numeric(4,3) not null default 0.700
    check (max_music_volume >= 0 and max_music_volume <= 1),
  updated_at timestamptz not null default now()
);

insert into public.music_runtime_config (id) values (1)
on conflict (id) do nothing;

alter table public.music_runtime_config enable row level security;
drop policy if exists "music_runtime_config_select" on public.music_runtime_config;
create policy "music_runtime_config_select"
  on public.music_runtime_config for select to authenticated using (true);
drop policy if exists "music_runtime_config_admin" on public.music_runtime_config;
create policy "music_runtime_config_admin"
  on public.music_runtime_config for all to authenticated
  using (public.ben_admin_miyim()) with check (public.ben_admin_miyim());
grant select on public.music_runtime_config to authenticated;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table if not exists public.music_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.music_categories (code, name, sort_order) values
  ('chill', 'Chill', 10),
  ('pop', 'Pop', 20),
  ('electronic', 'Elektronik', 30),
  ('lofi', 'Lo-Fi', 40),
  ('acoustic', 'Akustik', 50),
  ('ambient', 'Ambient', 60),
  ('turkish', 'Türkçe', 70),
  ('instrumental', 'Enstrümantal', 80)
on conflict (code) do nothing;

create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist_name text,
  description text,
  cover_url text,
  cover_storage_path text,
  audio_url text,
  audio_storage_path text,
  duration_ms int,
  mime_type text,
  file_size bigint,
  file_ext text,
  category_id uuid references public.music_categories(id) on delete set null,
  tags text[] not null default '{}',
  status text not null default 'UPLOADING'
    check (status in ('UPLOADING','PROCESSING','READY','FAILED','ARCHIVED')),
  is_active boolean not null default false,
  is_featured boolean not null default false,
  sort_order int not null default 0,
  play_count bigint not null default 0,
  room_play_count bigint not null default 0,
  total_play_ms bigint not null default 0,
  rights_status text not null default 'unknown'
    check (rights_status in ('unknown','owned','licensed','cleared')),
  license_type text,
  license_reference text,
  rights_holder text,
  license_notes text,
  license_valid_from date,
  license_valid_until date,
  allowed_regions text[] not null default '{}',
  rights_ack boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint music_tracks_title_len check (char_length(title) between 1 and 120)
);

create index if not exists music_tracks_library_idx
  on public.music_tracks (status, is_active, is_featured, sort_order, published_at desc);
create index if not exists music_tracks_category_idx
  on public.music_tracks (category_id) where status = 'READY' and is_active;
create index if not exists music_tracks_tags_gin
  on public.music_tracks using gin (tags);

create table if not exists public.music_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  track_id uuid not null references public.music_tracks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create table if not exists public.music_playlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint music_playlists_name_len check (char_length(name) between 1 and 80)
);

create table if not exists public.music_playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.music_playlists(id) on delete cascade,
  track_id uuid not null references public.music_tracks(id) on delete cascade,
  sort_order int not null default 0,
  unique (playlist_id, track_id)
);

create table if not exists public.room_music_sessions (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  track_id uuid references public.music_tracks(id) on delete set null,
  state text not null default 'STOPPED'
    check (state in ('STOPPED','LOADING','PLAYING','PAUSED','ENDED','ERROR')),
  position_ms int not null default 0 check (position_ms >= 0),
  started_at timestamptz,
  paused_at timestamptz,
  leader_user_id uuid references public.profiles(id) on delete set null,
  volume numeric(4,3) not null default 0.280
    check (volume >= 0 and volume <= 1),
  ducking_enabled boolean not null default true,
  normal_volume numeric(4,3) not null default 0.280
    check (normal_volume >= 0 and normal_volume <= 1),
  ducked_volume numeric(4,3) not null default 0.100
    check (ducked_volume >= 0 and ducked_volume <= 1),
  repeat_mode text not null default 'off'
    check (repeat_mode in ('off','all','one')),
  shuffle_enabled boolean not null default false,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  error_message text
);

create table if not exists public.room_music_queue (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  track_id uuid not null references public.music_tracks(id) on delete cascade,
  sort_order int not null default 0,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists room_music_queue_room_idx
  on public.room_music_queue (room_id, sort_order);

create table if not exists public.room_music_permissions (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  can_manage boolean not null default true,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.music_play_aggregates (
  track_id uuid primary key references public.music_tracks(id) on delete cascade,
  start_count bigint not null default 0,
  distinct_rooms bigint not null default 0,
  total_play_ms bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.music_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  track_id uuid references public.music_tracks(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists music_admin_audit_created_idx
  on public.music_admin_audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'music-audio',
  'music-audio',
  true,
  52428800,
  array[
    'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac',
    'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave',
    'audio/ogg', 'audio/opus', 'application/ogg', 'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'music-covers',
  'music-covers',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "music_audio_public_read" on storage.objects;
create policy "music_audio_public_read"
  on storage.objects for select to authenticated, anon
  using (bucket_id = 'music-audio');

drop policy if exists "music_audio_admin_write" on storage.objects;
create policy "music_audio_admin_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'music-audio' and public.ben_admin_miyim());

drop policy if exists "music_audio_admin_update" on storage.objects;
create policy "music_audio_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'music-audio' and public.ben_admin_miyim());

drop policy if exists "music_audio_admin_delete" on storage.objects;
create policy "music_audio_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'music-audio' and public.ben_admin_miyim());

drop policy if exists "music_covers_public_read" on storage.objects;
create policy "music_covers_public_read"
  on storage.objects for select to authenticated, anon
  using (bucket_id = 'music-covers');

drop policy if exists "music_covers_admin_write" on storage.objects;
create policy "music_covers_admin_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'music-covers' and public.ben_admin_miyim());

drop policy if exists "music_covers_admin_update" on storage.objects;
create policy "music_covers_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'music-covers' and public.ben_admin_miyim());

drop policy if exists "music_covers_admin_delete" on storage.objects;
create policy "music_covers_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'music-covers' and public.ben_admin_miyim());

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.music_categories enable row level security;
alter table public.music_tracks enable row level security;
alter table public.music_favorites enable row level security;
alter table public.music_playlists enable row level security;
alter table public.music_playlist_items enable row level security;
alter table public.room_music_sessions enable row level security;
alter table public.room_music_queue enable row level security;
alter table public.room_music_permissions enable row level security;
alter table public.music_play_aggregates enable row level security;
alter table public.music_admin_audit_logs enable row level security;

drop policy if exists "music_categories_read" on public.music_categories;
create policy "music_categories_read"
  on public.music_categories for select to authenticated using (is_active or public.ben_admin_miyim());
drop policy if exists "music_categories_admin" on public.music_categories;
create policy "music_categories_admin"
  on public.music_categories for all to authenticated
  using (public.ben_admin_miyim()) with check (public.ben_admin_miyim());

drop policy if exists "music_tracks_library_read" on public.music_tracks;
create policy "music_tracks_library_read"
  on public.music_tracks for select to authenticated
  using (
    public.ben_admin_miyim()
    or (
      status = 'READY' and is_active = true
      and (license_valid_until is null or license_valid_until >= current_date)
    )
  );
drop policy if exists "music_tracks_admin" on public.music_tracks;
create policy "music_tracks_admin"
  on public.music_tracks for all to authenticated
  using (public.ben_admin_miyim()) with check (public.ben_admin_miyim());

drop policy if exists "music_favorites_own" on public.music_favorites;
create policy "music_favorites_own"
  on public.music_favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "music_playlists_own" on public.music_playlists;
create policy "music_playlists_own"
  on public.music_playlists for all to authenticated
  using (owner_id = auth.uid() or public.ben_admin_miyim())
  with check (owner_id = auth.uid() or public.ben_admin_miyim());

drop policy if exists "music_playlist_items_own" on public.music_playlist_items;
create policy "music_playlist_items_own"
  on public.music_playlist_items for all to authenticated
  using (
    exists (
      select 1 from public.music_playlists p
      where p.id = playlist_id and (p.owner_id = auth.uid() or public.ben_admin_miyim())
    )
  )
  with check (
    exists (
      select 1 from public.music_playlists p
      where p.id = playlist_id and (p.owner_id = auth.uid() or public.ben_admin_miyim())
    )
  );

drop policy if exists "room_music_sessions_read" on public.room_music_sessions;
create policy "room_music_sessions_read"
  on public.room_music_sessions for select to authenticated using (true);

drop policy if exists "room_music_queue_read" on public.room_music_queue;
create policy "room_music_queue_read"
  on public.room_music_queue for select to authenticated using (true);

drop policy if exists "room_music_permissions_read" on public.room_music_permissions;
create policy "room_music_permissions_read"
  on public.room_music_permissions for select to authenticated using (true);

drop policy if exists "music_play_aggregates_read" on public.music_play_aggregates;
create policy "music_play_aggregates_read"
  on public.music_play_aggregates for select to authenticated using (true);

drop policy if exists "music_admin_audit_admin" on public.music_admin_audit_logs;
create policy "music_admin_audit_admin"
  on public.music_admin_audit_logs for select to authenticated
  using (public.ben_admin_miyim());

grant select on public.music_categories to authenticated;
grant select on public.music_tracks to authenticated;
grant select, insert, update, delete on public.music_favorites to authenticated;
grant select, insert, update, delete on public.music_playlists to authenticated;
grant select, insert, update, delete on public.music_playlist_items to authenticated;
grant select on public.room_music_sessions to authenticated;
grant select on public.room_music_queue to authenticated;
grant select on public.room_music_permissions to authenticated;
grant select on public.music_play_aggregates to authenticated;

-- Realtime
do $$
begin
  begin
    alter publication supabase_realtime add table public.music_tracks;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.room_music_sessions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.room_music_queue;
  exception when duplicate_object then null;
  end;
end $$;
