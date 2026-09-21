-- Örnek (demo) ses odaları: gerçekçi host/üyeler + feed sıralaması
-- is_sample bayrağı ile yönetilir; admin_ornek_ses_odalari_seed() ile yeniden kurulur.

alter table public.rooms
  add column if not exists is_sample boolean not null default false;

create index if not exists rooms_is_sample_live_idx
  on public.rooms (is_sample, is_live, listener_count desc)
  where is_sample = true;

-- ---------------------------------------------------------------------------
-- Auth + profil: tek örnek kullanıcı garantile
-- ---------------------------------------------------------------------------
create or replace function public._ornek_kullanici_garantile(
  p_username text,
  p_display_name text,
  p_gender text,
  p_portrait int,
  p_bio text,
  p_birth date,
  p_city_code text,
  p_coins int,
  p_diamonds int,
  p_level int,
  p_is_host boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_uid uuid;
  v_email text;
  v_avatar text;
  v_region uuid;
  v_folder text;
begin
  select id into v_uid
  from public.profiles
  where lower(username) = lower(p_username)
  limit 1;

  v_folder := case when p_gender = 'female' then 'women' else 'men' end;
  v_avatar := format(
    'https://randomuser.me/api/portraits/%s/%s.jpg',
    v_folder,
    greatest(0, least(99, coalesce(p_portrait, 1)))
  );
  v_email := lower(p_username) || '@tamuso.sample';

  select id into v_region
  from public.geo_regions
  where country_code = 'TR' and code = p_city_code
  limit 1;

  if v_uid is null then
    v_uid := gen_random_uuid();

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      is_sso_user,
      is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_uid,
      'authenticated',
      'authenticated',
      v_email,
      crypt('Ornek!' || right(p_username, 4) || p_portrait::text, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'display_name', p_display_name,
        'username', p_username,
        'gender', p_gender,
        'is_sample', true,
        'is_guest', false,
        'language', 'tr'
      ),
      now(),
      now(),
      '',
      '',
      '',
      '',
      false,
      false
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      v_uid,
      jsonb_build_object(
        'sub', v_uid::text,
        'email', v_email,
        'email_verified', true
      ),
      'email',
      v_uid::text,
      now(),
      now(),
      now()
    );
  end if;

  update public.profiles
  set
    display_name = p_display_name,
    username = p_username,
    gender = p_gender,
    birth_date = p_birth,
    bio = p_bio,
    avatar_url = v_avatar,
    country = 'Türkiye',
    country_code = 'TR',
    region_id = coalesce(v_region, region_id),
    language = 'tr',
    is_guest = false,
    is_sample = true,
    is_host = coalesce(p_is_host, false),
    is_verified = true,
    level = greatest(1, coalesce(p_level, 1)),
    xp = greatest(1, coalesce(p_level, 1)) * 120,
    deleted_at = null,
    updated_at = now()
  where id = v_uid;

  update public.wallets
  set
    coins = greatest(coalesce(p_coins, 100), 0),
    diamonds = greatest(coalesce(p_diamonds, 0), 0),
    updated_at = now()
  where user_id = v_uid;

  return v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- İç seed: örnek kullanıcılar + canlı odalar (üyeler / koltuklar / sayaçlar)
-- ---------------------------------------------------------------------------
create or replace function public._ornek_ses_odalari_seed_ic()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- kullanıcılar
  u_elif uuid; u_zeynep uuid; u_ayse uuid; u_defne uuid; u_melis uuid; u_selin uuid;
  u_irem uuid; u_nazli uuid; u_ceren uuid; u_ece uuid; u_sude uuid; u_asya uuid;
  u_emre uuid; u_can uuid; u_burak uuid; u_mert uuid; u_kerem uuid; u_onur uuid;
  u_arda uuid; u_deniz uuid; u_yusuf uuid; u_baran uuid; u_tolga uuid; u_hakan uuid;

  v_room uuid;
  v_oda_sayisi int := 0;
  v_uye_sayisi int := 0;
  r record;
  i int;
  v_speakers uuid[];
  v_listeners uuid[];
  v_max_seats int;
  v_listener_count int;
  v_uid uuid;
begin
  -- 12 kız + 12 erkek (edge function katalogu ile aynı)
  u_elif   := public._ornek_kullanici_garantile('ornek_elif',   'Elif Yılmaz',  'female', 44, 'İstanbul · kahve ve gece sohbeti ☕', '1998-03-12', '34', 4200, 180, 12, false);
  u_zeynep := public._ornek_kullanici_garantile('ornek_zeynep', 'Zeynep Kara',  'female', 65, 'Ankara geceleri · müzik 🎧', '1996-07-21', '06', 2800, 95, 9, true);
  u_ayse   := public._ornek_kullanici_garantile('ornek_ayse',   'Ayşe Demir',   'female', 68, 'İzmir sahil ruhu 🌊', '2000-01-08', '35', 1500, 40, 6, false);
  u_defne  := public._ornek_kullanici_garantile('ornek_defne',  'Defne Aydın',  'female', 32, 'Antalya · tatil ve oda keyfi ☀️', '1999-11-02', '07', 6100, 220, 15, false);
  u_melis  := public._ornek_kullanici_garantile('ornek_melis',  'Melis Çelik',  'female', 17, 'Bursa · samimi sohbet 💜', '1997-05-19', '16', 900, 20, 4, false);
  u_selin  := public._ornek_kullanici_garantile('ornek_selin',  'Selin Arslan', 'female', 26, 'Eskişehir · öğrenci hayatı 📚', '2001-09-14', '26', 2200, 70, 7, false);
  u_irem   := public._ornek_kullanici_garantile('ornek_irem',   'İrem Koç',     'female', 9,  'Gaziantep · sıcak muhabbet 🌶️', '1995-12-30', '27', 3400, 110, 10, false);
  u_nazli  := public._ornek_kullanici_garantile('ornek_nazli',  'Nazlı Şahin',  'female', 47, 'Trabzon · Karadeniz enerjisi 🌿', '1998-08-03', '61', 1700, 55, 8, false);
  u_ceren  := public._ornek_kullanici_garantile('ornek_ceren',  'Ceren Yıldız', 'female', 71, 'Konya · sakin akşamlar 🌙', '1994-04-25', '42', 5100, 300, 14, true);
  u_ece    := public._ornek_kullanici_garantile('ornek_ece',    'Ece Kurt',     'female', 12, 'Mersin · deniz kokusu 🐚', '2002-02-17', '33', 800, 15, 3, false);
  u_sude   := public._ornek_kullanici_garantile('ornek_sude',   'Sude Aksoy',   'female', 55, 'Adana · neşeli oda ✨', '1999-06-09', '01', 2600, 88, 9, false);
  u_asya   := public._ornek_kullanici_garantile('ornek_asya',   'Asya Polat',   'female', 39, 'Samsun · yeni arkadaşlar 💫', '1997-10-11', '55', 1900, 60, 7, false);

  u_emre   := public._ornek_kullanici_garantile('ornek_emre',   'Emre Yılmaz',  'male', 32, 'İstanbul · gece odaları 🎤', '1995-02-14', '34', 3800, 140, 11, true);
  u_can    := public._ornek_kullanici_garantile('ornek_can',    'Can Demir',    'male', 75, 'Ankara · spor ve sohbet ⚽', '1993-08-22', '06', 4500, 200, 13, false);
  u_burak  := public._ornek_kullanici_garantile('ornek_burak',  'Burak Kaya',   'male', 11, 'İzmir · rahat ortam 🌊', '1998-12-01', '35', 1200, 35, 5, false);
  u_mert   := public._ornek_kullanici_garantile('ornek_mert',   'Mert Aydın',   'male', 52, 'Bursa · müzik ve PK 🔥', '1996-03-28', '16', 7200, 410, 18, true);
  u_kerem  := public._ornek_kullanici_garantile('ornek_kerem',  'Kerem Çelik',  'male', 22, 'Antalya · yaz vibe ☀️', '2000-07-07', '07', 2100, 75, 8, false);
  u_onur   := public._ornek_kullanici_garantile('ornek_onur',   'Onur Şahin',   'male', 41, 'Kayseri · samimi sohbet', '1994-11-19', '38', 1600, 45, 6, false);
  u_arda   := public._ornek_kullanici_garantile('ornek_arda',   'Arda Koç',     'male', 8,  'Eskişehir · kampüs enerjisi 🎓', '2001-01-30', '26', 950, 22, 4, false);
  u_deniz  := public._ornek_kullanici_garantile('ornek_deniz',  'Deniz Arslan', 'male', 67, 'Trabzon · Karadeniz 💚', '1997-09-05', '61', 3000, 120, 10, false);
  u_yusuf  := public._ornek_kullanici_garantile('ornek_yusuf',  'Yusuf Kurt',   'male', 18, 'Gaziantep · muhabbet 🌶️', '1992-05-16', '27', 5400, 260, 16, false);
  u_baran  := public._ornek_kullanici_garantile('ornek_baran',  'Baran Yıldız', 'male', 36, 'Diyarbakır · yeni bağlantılar', '1999-04-02', '21', 1800, 50, 7, false);
  u_tolga  := public._ornek_kullanici_garantile('ornek_tolga',  'Tolga Aksoy',  'male', 60, 'Konya · akşam odaları', '1995-10-24', '42', 2700, 90, 9, false);
  u_hakan  := public._ornek_kullanici_garantile('ornek_hakan',  'Hakan Polat',  'male', 4,  'Samsun · sohbet & hediye 🎁', '1991-06-13', '55', 6500, 330, 17, true);

  -- Eski örnek canlı odaları kapat
  update public.rooms
  set is_live = false, ended_at = coalesce(ended_at, now()), updated_at = now()
  where is_sample = true and coalesce(is_live, false) = true;

  -- Oda tanımları (host, title, topic, cover, mode, seats, listeners, coins, theme, layout, speakers[], listeners[])
  for r in
    select * from (values
      (
        u_emre,
        'Gece Sohbeti · İstanbul',
        'Gece geç saate kadar muhabbet',
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=900&q=80',
        'party',
        10,
        86,
        12400::bigint,
        'midnight_plum',
        'floating_glass',
        array[u_elif, u_zeynep, u_can, u_burak, u_sude]::uuid[],
        array[u_melis, u_onur, u_ece, u_tolga, u_asya, u_baran]::uuid[]
      ),
      (
        u_ceren,
        'Karaoke Gecesi',
        'Şarkı sırası açık · istek alıyoruz',
        'https://images.unsplash.com/photo-1516280440614-6697288d5d38?auto=format&fit=crop&w=900&q=80',
        'karaoke',
        8,
        64,
        9800::bigint,
        'neon_aurora',
        'floating_glass',
        array[u_selin, u_irem, u_arda, u_deniz]::uuid[],
        array[u_ayse, u_kerem, u_nazli, u_burak]::uuid[]
      ),
      (
        u_zeynep,
        'Samimi Sohbet · Tanışma',
        'Rahat ortam · hafif sohbet',
        'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=900&q=80',
        'dating',
        8,
        52,
        7200::bigint,
        'cherry_noir',
        'floating_glass',
        array[u_emre, u_ayse, u_kerem, u_ece]::uuid[],
        array[u_melis, u_onur, u_sude]::uuid[]
      ),
      (
        u_mert,
        'PK & Oyun Lobisi',
        'PK hazırlık · mini oyunlar',
        'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=80',
        'game',
        12,
        118,
        18600::bigint,
        'cosmic_void',
        'floating_glass',
        array[u_hakan, u_yusuf, u_can, u_defne, u_irem, u_tolga]::uuid[],
        array[u_baran, u_asya, u_burak, u_ece, u_onur, u_nazli, u_arda]::uuid[]
      ),
      (
        u_defne,
        'Antalya Vibes',
        'Yaz enerjisi · tatil sohbeti',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
        'party',
        8,
        41,
        5400::bigint,
        'sunset_pulse',
        'floating_glass',
        array[u_kerem, u_ayse, u_sude]::uuid[],
        array[u_melis, u_deniz, u_ece]::uuid[]
      ),
      (
        u_elif,
        'Sabah Kahvesi',
        'Güne yumuşak başlangıç',
        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80',
        'party',
        6,
        27,
        2100::bigint,
        'royal_gold',
        'floating_glass',
        array[u_selin, u_onur]::uuid[],
        array[u_asya, u_tolga, u_melis]::uuid[]
      ),
      (
        u_hakan,
        'Hediye & Sohbet',
        'Büyük hediyeler · canlı sıralama',
        'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=900&q=80',
        'party',
        10,
        97,
        22100::bigint,
        'electric_lilac',
        'floating_glass',
        array[u_mert, u_ceren, u_yusuf, u_defne, u_can]::uuid[],
        array[u_irem, u_baran, u_nazli, u_arda, u_sude, u_burak]::uuid[]
      ),
      (
        u_selin,
        'Kampüs Muhabbeti',
        'Öğrenci odası · sınav & gece',
        'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=900&q=80',
        'party',
        8,
        33,
        1600::bigint,
        'emerald_haze',
        'floating_glass',
        array[u_arda, u_ece, u_melis]::uuid[],
        array[u_asya, u_burak, u_nazli]::uuid[]
      ),
      (
        u_ayse,
        'İzmir Sahil Sohbeti',
        'Akşam esintisi · rahat muhabbet',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
        'party',
        8,
        45,
        3800::bigint,
        'arctic_mist',
        'floating_glass',
        array[u_kerem, u_sude]::uuid[],
        array[u_melis, u_tolga]::uuid[]
      ),
      (
        u_can,
        'Spor & Muhabbet',
        'Maç sonrası sohbet',
        'https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=900&q=80',
        'party',
        10,
        71,
        9200::bigint,
        'emerald_haze',
        'floating_glass',
        array[u_deniz, u_yusuf, u_tolga]::uuid[],
        array[u_irem, u_nazli]::uuid[]
      ),
      (
        u_melis,
        'Gece Masalı',
        'Sakin sesler · yumuşak sohbet',
        'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80',
        'dating',
        6,
        38,
        4100::bigint,
        'cherry_noir',
        'floating_glass',
        array[u_ayse, u_kerem]::uuid[],
        array[u_sude]::uuid[]
      ),
      (
        u_yusuf,
        'Antep Sofrası',
        'Sıcak muhabbet · hediye',
        'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80',
        'party',
        8,
        59,
        11200::bigint,
        'sunset_pulse',
        'floating_glass',
        array[u_can, u_irem, u_nazli]::uuid[],
        array[u_deniz, u_tolga]::uuid[]
      ),
      (
        u_nazli,
        'Karadeniz Gecesi',
        'Horon enerjisi · canlı sohbet',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80',
        'party',
        8,
        48,
        5600::bigint,
        'ocean_depth',
        'floating_glass',
        array[u_deniz, u_melis]::uuid[],
        array[u_ayse, u_sude]::uuid[]
      ),
      (
        u_kerem,
        'Yaz Plaj Vibes',
        'Tatil modu · hafif müzik',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
        'party',
        8,
        54,
        6700::bigint,
        'sunset_pulse',
        'floating_glass',
        array[u_ayse, u_sude, u_tolga]::uuid[],
        array[u_melis, u_irem]::uuid[]
      ),
      (
        u_irem,
        'Gece Radyosu',
        'İstek şarkı · sohbet',
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=900&q=80',
        'karaoke',
        8,
        62,
        8800::bigint,
        'neon_aurora',
        'floating_glass',
        array[u_nazli, u_can]::uuid[],
        array[u_deniz, u_yusuf, u_melis]::uuid[]
      ),
      (
        u_deniz,
        'Oyun Lobisi 2',
        'Mini oyun · PK ısınma',
        'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80',
        'game',
        12,
        89,
        15400::bigint,
        'cosmic_void',
        'floating_glass',
        array[u_yusuf, u_can, u_tolga, u_kerem]::uuid[],
        array[u_irem, u_nazli, u_sude]::uuid[]
      ),
      (
        u_sude,
        'Adana Gece Modu',
        'Neşeli oda · hediye',
        'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80',
        'party',
        8,
        43,
        4900::bigint,
        'electric_lilac',
        'floating_glass',
        array[u_ece, u_burak]::uuid[],
        array[u_asya, u_onur, u_baran]::uuid[]
      ),
      (
        u_tolga,
        'Konya Akşamı',
        'Samimi sohbet · sakin tempo',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80',
        'dating',
        6,
        31,
        2800::bigint,
        'royal_gold',
        'floating_glass',
        array[u_arda, u_asya]::uuid[],
        array[u_ece, u_burak]::uuid[]
      )
    ) as t(
      host_id, title, topic, cover_url, mode, max_seats, listener_count, coins,
      theme_code, layout_code, speakers, listeners
    )
  loop
    -- Host'un başka canlı odası varsa kapat (tek canlı kuralı)
    update public.rooms
    set is_live = false, ended_at = coalesce(ended_at, now()), updated_at = now()
    where host_id = r.host_id and coalesce(is_live, false) = true;

    v_max_seats := least(greatest(r.max_seats, 2), 20);
    v_speakers := coalesce(r.speakers, array[]::uuid[]);
    v_listeners := coalesce(r.listeners, array[]::uuid[]);
    -- Feed skoru için dinleyici sayısı: koltuk + dinleyici + ekstra kalabalık
    v_listener_count := greatest(
      r.listener_count,
      1 + coalesce(cardinality(v_speakers), 0) + coalesce(cardinality(v_listeners), 0)
    );

    insert into public.rooms (
      host_id, title, topic, cover_url, mode, max_seats,
      is_live, is_locked, listener_count, total_coins_earned,
      layout_code, theme_code, capacity_tier_code,
      audience_capacity, microphone_capacity, is_sample, created_at
    )
    values (
      r.host_id,
      r.title,
      r.topic,
      r.cover_url,
      r.mode,
      v_max_seats,
      true,
      false,
      v_listener_count,
      r.coins,
      r.layout_code,
      r.theme_code,
      'social',
      250,
      v_max_seats,
      true,
      now() - (random() * interval '90 minutes')
    )
    returning id into v_room;

    -- Koltuklar
    for i in 0..(v_max_seats - 1) loop
      v_uid := null;
      if i = 0 then
        v_uid := r.host_id;
      elsif i <= coalesce(cardinality(v_speakers), 0) then
        v_uid := v_speakers[i];
      end if;

      insert into public.room_seats (room_id, seat_index, user_id, is_muted)
      values (v_room, i, v_uid, false);
    end loop;

    -- Host üyelik
    insert into public.room_members (room_id, user_id, role)
    values (v_room, r.host_id, 'host')
    on conflict (room_id, user_id) do update set role = 'host';
    v_uye_sayisi := v_uye_sayisi + 1;

    -- Konuşmacılar
    if cardinality(v_speakers) > 0 then
      for i in 1..cardinality(v_speakers) loop
        v_uid := v_speakers[i];
        if v_uid is null or v_uid = r.host_id then
          continue;
        end if;
        insert into public.room_members (room_id, user_id, role)
        values (v_room, v_uid, case when i = 1 then 'cohost' else 'speaker' end)
        on conflict (room_id, user_id) do update
          set role = excluded.role;
        v_uye_sayisi := v_uye_sayisi + 1;
      end loop;
    end if;

    -- Dinleyiciler
    if cardinality(v_listeners) > 0 then
      for i in 1..cardinality(v_listeners) loop
        v_uid := v_listeners[i];
        if v_uid is null or v_uid = r.host_id then
          continue;
        end if;
        insert into public.room_members (room_id, user_id, role)
        values (v_room, v_uid, 'listener')
        on conflict (room_id, user_id) do nothing;
        v_uye_sayisi := v_uye_sayisi + 1;
      end loop;
    end if;

    v_oda_sayisi := v_oda_sayisi + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'oda_sayisi', v_oda_sayisi,
    'uye_kaydi', v_uye_sayisi,
    'kullanici', 24
  );
end;
$$;

create or replace function public.admin_ornek_ses_odalari_seed()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  return public._ornek_ses_odalari_seed_ic();
end;
$$;

create or replace function public.admin_ornek_ses_odalari_kapat()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  update public.rooms
  set is_live = false, ended_at = coalesce(ended_at, now()), updated_at = now()
  where is_sample = true and coalesce(is_live, false) = true;

  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'kapatilan', v_n);
end;
$$;

grant execute on function public.admin_ornek_ses_odalari_seed() to authenticated;
grant execute on function public.admin_ornek_ses_odalari_kapat() to authenticated;

-- İlk kurulum
select public._ornek_ses_odalari_seed_ic();
