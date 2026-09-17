-- Kayıt formu alan ayarları: admin anlık zorunlu/isteğe bağlı/gizli + özel alan ekleme

-- ---------------------------------------------------------------------------
-- Built-in alan görünürlüğü (tek satır)
-- mod: required | optional | hidden
-- ---------------------------------------------------------------------------
create table if not exists public.kayit_alan_ayarlari (
  id smallint primary key default 1 check (id = 1),
  alanlar jsonb not null default '{
    "phone": "optional",
    "gender": "optional",
    "birth_date": "optional",
    "email": "optional",
    "avatar": "optional"
  }'::jsonb,
  guncelleyen uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.kayit_alan_ayarlari (id)
values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Özel alan tanımları (admin ekler / kaldırır)
-- ---------------------------------------------------------------------------
create table if not exists public.kayit_ozel_alan_tanimlari (
  id uuid primary key default gen_random_uuid(),
  anahtar text not null,
  etiket text not null,
  alan_turu text not null default 'text'
    check (alan_turu in ('text', 'select', 'number')),
  secenekler jsonb not null default '[]'::jsonb,
  mod text not null default 'optional'
    check (mod in ('required', 'optional')),
  sira integer not null default 0,
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  constraint kayit_ozel_alan_anahtar_uniq unique (anahtar),
  constraint kayit_ozel_alan_anahtar_format check (
    anahtar ~ '^[a-z][a-z0-9_]{1,39}$'
  )
);

create index if not exists kayit_ozel_alan_aktif_sira_idx
  on public.kayit_ozel_alan_tanimlari (aktif, sira, created_at);

-- ---------------------------------------------------------------------------
-- profiles.custom_fields — özel alan cevapları
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.kayit_alan_ayarlari enable row level security;
alter table public.kayit_ozel_alan_tanimlari enable row level security;

drop policy if exists "Kayit alan ayarlari public read" on public.kayit_alan_ayarlari;
create policy "Kayit alan ayarlari public read"
  on public.kayit_alan_ayarlari for select to public
  using (true);

drop policy if exists "Kayit alan ayarlari admin write" on public.kayit_alan_ayarlari;
create policy "Kayit alan ayarlari admin write"
  on public.kayit_alan_ayarlari for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

drop policy if exists "Kayit ozel alan public read" on public.kayit_ozel_alan_tanimlari;
create policy "Kayit ozel alan public read"
  on public.kayit_ozel_alan_tanimlari for select to public
  using (aktif = true);

drop policy if exists "Kayit ozel alan admin all" on public.kayit_ozel_alan_tanimlari;
create policy "Kayit ozel alan admin all"
  on public.kayit_ozel_alan_tanimlari for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

-- ---------------------------------------------------------------------------
-- Yardımcı: alanlar jsonb normalize
-- ---------------------------------------------------------------------------
create or replace function public.kayit_alan_mod_normalize(p jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_keys text[] := array['phone', 'gender', 'birth_date', 'email', 'avatar'];
  v_key text;
  v_mod text;
  v_out jsonb := '{}'::jsonb;
  v_defaults jsonb := '{
    "phone": "optional",
    "gender": "optional",
    "birth_date": "optional",
    "email": "optional",
    "avatar": "optional"
  }'::jsonb;
begin
  foreach v_key in array v_keys loop
    v_mod := lower(trim(coalesce(p->>v_key, v_defaults->>v_key, 'optional')));
    if v_mod not in ('required', 'optional', 'hidden') then
      v_mod := 'optional';
    end if;
    v_out := v_out || jsonb_build_object(v_key, v_mod);
  end loop;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public get (kayıt ekranı — anon dahil)
-- ---------------------------------------------------------------------------
create or replace function public.kayit_alan_ayarlari_public_get()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ayar public.kayit_alan_ayarlari%rowtype;
  v_ozel jsonb;
begin
  select * into v_ayar from public.kayit_alan_ayarlari where id = 1;
  if not found then
    insert into public.kayit_alan_ayarlari (id) values (1)
    returning * into v_ayar;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'anahtar', t.anahtar,
      'etiket', t.etiket,
      'alan_turu', t.alan_turu,
      'secenekler', t.secenekler,
      'mod', t.mod,
      'sira', t.sira
    )
    order by t.sira asc, t.created_at asc
  ), '[]'::jsonb)
  into v_ozel
  from public.kayit_ozel_alan_tanimlari t
  where t.aktif = true;

  return jsonb_build_object(
    'alanlar', public.kayit_alan_mod_normalize(v_ayar.alanlar),
    'ozel_alanlar', v_ozel,
    'updated_at', v_ayar.updated_at
  );
end;
$$;

revoke all on function public.kayit_alan_ayarlari_public_get() from public;
grant execute on function public.kayit_alan_ayarlari_public_get() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin get (pasif özel alanlar dahil)
-- ---------------------------------------------------------------------------
create or replace function public.admin_kayit_alan_ayarlari_get()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ayar public.kayit_alan_ayarlari%rowtype;
  v_ozel jsonb;
begin
  if auth.uid() is null or not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  select * into v_ayar from public.kayit_alan_ayarlari where id = 1;
  if not found then
    insert into public.kayit_alan_ayarlari (id) values (1)
    returning * into v_ayar;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'anahtar', t.anahtar,
      'etiket', t.etiket,
      'alan_turu', t.alan_turu,
      'secenekler', t.secenekler,
      'mod', t.mod,
      'sira', t.sira,
      'aktif', t.aktif,
      'created_at', t.created_at
    )
    order by t.sira asc, t.created_at asc
  ), '[]'::jsonb)
  into v_ozel
  from public.kayit_ozel_alan_tanimlari t;

  return jsonb_build_object(
    'alanlar', public.kayit_alan_mod_normalize(v_ayar.alanlar),
    'ozel_alanlar', v_ozel,
    'updated_at', v_ayar.updated_at
  );
end;
$$;

revoke all on function public.admin_kayit_alan_ayarlari_get() from public;
grant execute on function public.admin_kayit_alan_ayarlari_get() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: built-in alan modlarını güncelle
-- ---------------------------------------------------------------------------
create or replace function public.admin_kayit_alan_ayarlari_guncelle(p_alanlar jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  insert into public.kayit_alan_ayarlari (id) values (1)
  on conflict (id) do nothing;

  update public.kayit_alan_ayarlari set
    alanlar = public.kayit_alan_mod_normalize(coalesce(p_alanlar, '{}'::jsonb)),
    guncelleyen = v_uid,
    updated_at = now()
  where id = 1;

  return public.admin_kayit_alan_ayarlari_get();
end;
$$;

revoke all on function public.admin_kayit_alan_ayarlari_guncelle(jsonb) from public;
grant execute on function public.admin_kayit_alan_ayarlari_guncelle(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: özel alan ekle
-- ---------------------------------------------------------------------------
create or replace function public.admin_kayit_ozel_alan_ekle(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_anahtar text;
  v_etiket text;
  v_tur text;
  v_mod text;
  v_sira integer;
  v_secenekler jsonb;
begin
  if v_uid is null or not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  v_etiket := nullif(trim(coalesce(p_payload->>'etiket', '')), '');
  if v_etiket is null then
    raise exception 'Etiket gerekli';
  end if;

  v_anahtar := lower(trim(coalesce(p_payload->>'anahtar', '')));
  if v_anahtar = '' then
    v_anahtar := regexp_replace(
      translate(lower(v_etiket),
        'çğıöşüâîû',
        'cgiosuaiu'
      ),
      '[^a-z0-9]+', '_', 'g'
    );
    v_anahtar := trim(both '_' from v_anahtar);
  end if;
  if v_anahtar !~ '^[a-z][a-z0-9_]{1,39}$' then
    raise exception 'Geçersiz alan anahtarı';
  end if;
  if v_anahtar in ('phone', 'gender', 'birth_date', 'email', 'avatar', 'username', 'display_name', 'password') then
    raise exception 'Bu anahtar yerleşik alana ayrılmış';
  end if;

  v_tur := lower(trim(coalesce(p_payload->>'alan_turu', 'text')));
  if v_tur not in ('text', 'select', 'number') then
    v_tur := 'text';
  end if;

  v_mod := lower(trim(coalesce(p_payload->>'mod', 'optional')));
  if v_mod not in ('required', 'optional') then
    v_mod := 'optional';
  end if;

  v_sira := coalesce((p_payload->>'sira')::integer, 0);
  v_secenekler := coalesce(p_payload->'secenekler', '[]'::jsonb);
  if jsonb_typeof(v_secenekler) <> 'array' then
    v_secenekler := '[]'::jsonb;
  end if;

  insert into public.kayit_ozel_alan_tanimlari (
    anahtar, etiket, alan_turu, secenekler, mod, sira, aktif, created_by
  ) values (
    v_anahtar, v_etiket, v_tur, v_secenekler, v_mod, v_sira, true, v_uid
  );

  return public.admin_kayit_alan_ayarlari_get();
end;
$$;

revoke all on function public.admin_kayit_ozel_alan_ekle(jsonb) from public;
grant execute on function public.admin_kayit_ozel_alan_ekle(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: özel alan güncelle
-- ---------------------------------------------------------------------------
create or replace function public.admin_kayit_ozel_alan_guncelle(
  p_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_etiket text;
  v_tur text;
  v_mod text;
begin
  if v_uid is null or not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  if not exists (select 1 from public.kayit_ozel_alan_tanimlari where id = p_id) then
    raise exception 'Alan bulunamadı';
  end if;

  v_etiket := nullif(trim(coalesce(p_payload->>'etiket', '')), '');
  v_tur := lower(trim(coalesce(p_payload->>'alan_turu', '')));
  v_mod := lower(trim(coalesce(p_payload->>'mod', '')));

  update public.kayit_ozel_alan_tanimlari set
    etiket = coalesce(v_etiket, etiket),
    alan_turu = case
      when v_tur in ('text', 'select', 'number') then v_tur
      else alan_turu
    end,
    secenekler = case
      when p_payload ? 'secenekler' and jsonb_typeof(p_payload->'secenekler') = 'array'
        then p_payload->'secenekler'
      else secenekler
    end,
    mod = case
      when v_mod in ('required', 'optional') then v_mod
      else mod
    end,
    sira = coalesce((p_payload->>'sira')::integer, sira),
    aktif = coalesce((p_payload->>'aktif')::boolean, aktif)
  where id = p_id;

  return public.admin_kayit_alan_ayarlari_get();
end;
$$;

revoke all on function public.admin_kayit_ozel_alan_guncelle(uuid, jsonb) from public;
grant execute on function public.admin_kayit_ozel_alan_guncelle(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin: özel alan sil (kalıcı)
-- ---------------------------------------------------------------------------
create or replace function public.admin_kayit_ozel_alan_sil(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  delete from public.kayit_ozel_alan_tanimlari where id = p_id;
  return public.admin_kayit_alan_ayarlari_get();
end;
$$;

revoke all on function public.admin_kayit_ozel_alan_sil(uuid) from public;
grant execute on function public.admin_kayit_ozel_alan_sil(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- handle_new_user: custom_fields metadata desteği
-- ---------------------------------------------------------------------------
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
  v_birth date;
  v_birth_raw text;
  v_gender text;
  v_custom jsonb;
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

  v_gender := nullif(trim(coalesce(new.raw_user_meta_data->>'gender', '')), '');
  if v_gender is not null and v_gender not in ('female', 'male', 'other', 'prefer_not') then
    v_gender := null;
  end if;

  v_birth_raw := nullif(trim(coalesce(new.raw_user_meta_data->>'birth_date', '')), '');
  if v_birth_raw is not null then
    begin
      v_birth := v_birth_raw::date;
    exception when others then
      v_birth := null;
    end;
    if v_birth is not null then
      if v_birth > (current_date - interval '18 years') then
        raise exception 'Platform 18 yas ve uzeri icindir';
      end if;
      if v_birth < date '1920-01-01' then
        raise exception 'Gecersiz dogum tarihi';
      end if;
    end if;
  end if;

  v_custom := coalesce(new.raw_user_meta_data->'custom_fields', '{}'::jsonb);
  if jsonb_typeof(v_custom) <> 'object' then
    v_custom := '{}'::jsonb;
  end if;

  insert into public.profiles (
    id, username, display_name, gender, birth_date, public_user_id,
    is_guest, is_sample, language, phone_e164, custom_fields
  ) values (
    new.id,
    uname,
    v_display,
    v_gender,
    v_birth,
    pid,
    is_guest_meta,
    is_sample_meta,
    coalesce(new.raw_user_meta_data->>'language', 'tr'),
    case when is_guest_meta then null else v_phone end,
    v_custom
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
