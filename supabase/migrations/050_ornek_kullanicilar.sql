-- Ornek (demo) kullanici bayragi — toplu ekle / kaldir

alter table public.profiles
  add column if not exists is_sample boolean not null default false;

create index if not exists profiles_is_sample_idx
  on public.profiles (is_sample)
  where is_sample = true;

-- Kayit bildirimi: ornek kullanicilarda sessiz
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
  is_guest_meta boolean;
  is_sample_meta boolean;
  pid text;
  v_display text;
  v_phone text;
begin
  is_guest_meta := coalesce((new.raw_user_meta_data->>'is_guest')::boolean, false);
  is_sample_meta := coalesce((new.raw_user_meta_data->>'is_sample')::boolean, false);
  uname := coalesce(
    new.raw_user_meta_data->>'username',
    case when is_guest_meta then 'guest_' || substr(replace(new.id::text, '-', ''), 1, 8)
         else 'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
    end
  );
  pid := public.yeni_public_kullanici_id();
  v_display := coalesce(new.raw_user_meta_data->>'display_name', uname);
  v_phone := public.telefon_e164_normalize(new.raw_user_meta_data->>'phone_e164');

  insert into public.profiles (
    id, username, display_name, gender, public_user_id, is_guest, is_sample, language, phone_e164
  ) values (
    new.id,
    uname,
    v_display,
    coalesce(new.raw_user_meta_data->>'gender', null),
    pid,
    is_guest_meta,
    is_sample_meta,
    coalesce(new.raw_user_meta_data->>'language', 'tr'),
    case when is_guest_meta then null else v_phone end
  );

  insert into public.wallets (user_id, coins, diamonds)
  values (new.id, case when is_guest_meta then 0 else 100 end, 0);

  if not is_guest_meta then
    insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason)
    values (new.id, 'coins', 100, 100, 'welcome_bonus');
  end if;

  if not is_sample_meta then
    begin
      perform public.admin_operasyon_bildirimi(
        case when is_guest_meta then 'Yeni misafir kayıt' else 'Yeni kullanıcı kayıt' end,
        trim(
          coalesce(v_display, uname)
          || case when uname is not null then ' · @' || uname else '' end
          || ' · ID ' || coalesce(pid, left(new.id::text, 8))
          || case when v_phone is not null then ' · ' || v_phone else '' end
          || case when new.email is not null then ' · ' || new.email else '' end
        ),
        '/admin/kullanicilar/' || new.id::text,
        jsonb_build_object(
          'type', 'admin_new_registration',
          'user_id', new.id,
          'is_guest', is_guest_meta,
          'public_user_id', pid,
          'username', uname,
          'display_name', v_display,
          'phone_e164', v_phone
        )
      );
    exception when others then
      null;
    end;
  end if;

  return new;
end;
$$;

-- Admin listesine is_sample ekle
drop function if exists public.admin_kullanici_ara(text, int);

create or replace function public.admin_kullanici_ara(
  p_q text default null,
  p_limit int default 40
)
returns table (
  id uuid,
  username text,
  display_name text,
  public_user_id text,
  phone_e164 text,
  avatar_url text,
  is_admin boolean,
  is_guest boolean,
  is_host boolean,
  is_sample boolean,
  banned_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz,
  coins bigint,
  diamonds bigint,
  warning_count bigint,
  platform text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_lim int := least(greatest(coalesce(p_limit, 40), 1), 100);
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  return query
  select
    p.id,
    p.username,
    p.display_name,
    p.public_user_id::text,
    p.phone_e164,
    p.avatar_url,
    coalesce(p.is_admin, false),
    coalesce(p.is_guest, false),
    coalesce(p.is_host, false),
    coalesce(p.is_sample, false),
    p.banned_at,
    p.deleted_at,
    p.created_at,
    coalesce(w.coins, 0),
    coalesce(w.diamonds, 0),
    (
      select count(*)::bigint from public.user_warnings uw
      where uw.user_id = p.id and uw.is_active
    ),
    (
      select ds.platform from public.device_sessions ds
      where ds.user_id = p.id
      order by ds.last_seen_at desc nulls last
      limit 1
    )
  from public.profiles p
  left join public.wallets w on w.user_id = p.id
  where
    p.deleted_at is null
    and (
      v_q is null
      or p.username ilike '%' || v_q || '%'
      or p.display_name ilike '%' || v_q || '%'
      or p.phone_e164 ilike '%' || v_q || '%'
      or p.public_user_id::text ilike '%' || v_q || '%'
      or p.id::text ilike v_q || '%'
      or (v_q in ('ornek', 'örnek', 'sample') and p.is_sample)
    )
  order by p.created_at desc
  limit v_lim;
end;
$$;

grant execute on function public.admin_kullanici_ara(text, int) to authenticated;

create or replace function public.admin_ornek_kullanici_ozeti()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
  v_f int;
  v_m int;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  select count(*)::int into v_n from public.profiles where is_sample and deleted_at is null;
  select count(*)::int into v_f from public.profiles where is_sample and deleted_at is null and gender = 'female';
  select count(*)::int into v_m from public.profiles where is_sample and deleted_at is null and gender = 'male';
  return jsonb_build_object('ok', true, 'toplam', v_n, 'kiz', v_f, 'erkek', v_m);
end;
$$;

grant execute on function public.admin_ornek_kullanici_ozeti() to authenticated;

-- Ornek id listesi (edge function purge icin)
create or replace function public.admin_ornek_kullanici_idleri()
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  return coalesce((
    select array_agg(id) from public.profiles where is_sample = true
  ), '{}'::uuid[]);
end;
$$;

grant execute on function public.admin_ornek_kullanici_idleri() to authenticated;
