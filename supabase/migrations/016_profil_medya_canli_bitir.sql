-- Profil kapak + canli yayin bitir + avatar storage

alter table public.profiles
  add column if not exists cover_url text;

create or replace function public.canli_yayin_bitir(p_session_id uuid default null)
returns public.live_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.live_sessions%rowtype;
  v_target uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if p_session_id is not null then
    v_target := p_session_id;
  else
    select id into v_target
    from public.live_sessions
    where host_id = v_uid and is_live = true
    order by started_at desc
    limit 1;
  end if;

  if v_target is not null then
    update public.live_sessions
      set is_live = false,
          ended_at = coalesce(ended_at, now())
    where id = v_target
      and host_id = v_uid
    returning * into v_row;
  end if;

  -- Cikis / temizlik: kullanicinin kalan aktif yayinlarini da kapat
  update public.live_sessions
    set is_live = false,
        ended_at = coalesce(ended_at, now())
  where host_id = v_uid
    and is_live = true;

  if v_row.id is null then
    select * into v_row
    from public.live_sessions
    where host_id = v_uid
    order by started_at desc nulls last
    limit 1;
  end if;

  return v_row;
end;
$$;

grant execute on function public.canli_yayin_bitir(uuid) to authenticated;

-- Storage: profil medyasi
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-media',
  'profile-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Profile media public read" on storage.objects;
create policy "Profile media public read"
  on storage.objects for select
  to public
  using (bucket_id = 'profile-media');

drop policy if exists "Profile media own upload" on storage.objects;
create policy "Profile media own upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Profile media own update" on storage.objects;
create policy "Profile media own update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Profile media own delete" on storage.objects;
create policy "Profile media own delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
