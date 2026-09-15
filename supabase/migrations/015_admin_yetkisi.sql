-- Platform admin bayragi (mobil UI + route korumasi)
-- is_admin client tarafindan degistirilemez (trigger)

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create index if not exists profiles_is_admin_idx
  on public.profiles (id)
  where is_admin = true;

create or replace function public.profiles_is_admin_koru()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.is_admin, false) = true and auth.role() <> 'service_role' then
      new.is_admin := false;
    end if;
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin and auth.role() <> 'service_role' then
    raise exception 'Forbidden: is_admin';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_is_admin_koru on public.profiles;
create trigger profiles_is_admin_koru
  before insert or update on public.profiles
  for each row execute function public.profiles_is_admin_koru();

create or replace function public.ben_admin_miyim()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.ben_admin_miyim() to authenticated;

-- Seed: sonertoprak97@gmail.com
update public.profiles p
set is_admin = true
from auth.users u
where p.id = u.id
  and (
    p.id = '298908eb-d21e-4ac7-a89c-fbb9cf04b4e1'
    or lower(u.email) = lower('sonertoprak97@gmail.com')
  );
