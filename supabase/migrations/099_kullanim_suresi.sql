-- Kullanici uygulama kullanim suresi (aktif dokunma penceresi)
-- Client: on planda + son etkilesim < 3 dk iken saniye ekler.

create table if not exists public.user_usage_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  total_seconds bigint not null default 0 check (total_seconds >= 0),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_usage_stats_updated_at on public.user_usage_stats;
create trigger user_usage_stats_updated_at
  before update on public.user_usage_stats
  for each row execute function public.set_updated_at();

alter table public.user_usage_stats enable row level security;

drop policy if exists "Own usage stats select" on public.user_usage_stats;
create policy "Own usage stats select"
  on public.user_usage_stats for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Own usage stats insert" on public.user_usage_stats;
create policy "Own usage stats insert"
  on public.user_usage_stats for insert to authenticated
  with check (auth.uid() = user_id);

-- Dogudan update yok; artirma RPC ile (race / manipülasyon sinirli)
grant select, insert on public.user_usage_stats to authenticated;

create or replace function public.kullanim_suresi_ekle(p_seconds integer)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_add integer;
  v_total bigint;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Tek cagrida makul ust sinir (yaklasik 1 saat)
  v_add := greatest(0, least(coalesce(p_seconds, 0), 3600));
  if v_add = 0 then
    select total_seconds into v_total
    from public.user_usage_stats
    where user_id = v_uid;
    return coalesce(v_total, 0);
  end if;

  insert into public.user_usage_stats (user_id, total_seconds)
  values (v_uid, v_add)
  on conflict (user_id) do update
    set total_seconds = public.user_usage_stats.total_seconds + excluded.total_seconds,
        updated_at = now()
  returning total_seconds into v_total;

  return v_total;
end;
$$;

grant execute on function public.kullanim_suresi_ekle(integer) to authenticated;

create or replace function public.kullanim_suresi_getir(p_user_id uuid default null)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_total bigint;
begin
  if v_uid is null then
    return 0;
  end if;

  select total_seconds into v_total
  from public.user_usage_stats
  where user_id = v_uid;

  return coalesce(v_total, 0);
end;
$$;

grant execute on function public.kullanim_suresi_getir(uuid) to authenticated, anon;
