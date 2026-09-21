-- Binlerce canlı oda/yayın için feed sıralama indeksleri + ek örnek odalar

create index if not exists rooms_live_listener_idx
  on public.rooms (listener_count desc, created_at desc)
  where coalesce(is_live, false) = true;

create index if not exists rooms_live_mode_listener_idx
  on public.rooms (mode, listener_count desc)
  where coalesce(is_live, false) = true;

create index if not exists live_sessions_live_viewer_idx
  on public.live_sessions (viewer_count desc nulls last, started_at desc)
  where coalesce(is_live, false) = true;

-- Ek örnek odalar (host başına tek canlı; zaten canlıysa atlanır)
do $$
declare
  u_ayse uuid; u_can uuid; u_melis uuid; u_yusuf uuid;
  u_nazli uuid; u_kerem uuid; u_irem uuid; u_deniz uuid;
  u_sude uuid; u_tolga uuid;
  u_ece uuid; u_burak uuid; u_asya uuid; u_onur uuid;
  u_arda uuid; u_baran uuid;
  r record;
  v_room uuid;
  v_max_seats int;
  v_speakers uuid[];
  v_listeners uuid[];
  v_listener_count int;
  v_uid uuid;
  i int;
begin
  select id into u_ayse from profiles where username='ornek_ayse' and coalesce(is_sample,false) limit 1;
  select id into u_can from profiles where username='ornek_can' and coalesce(is_sample,false) limit 1;
  select id into u_melis from profiles where username='ornek_melis' and coalesce(is_sample,false) limit 1;
  select id into u_yusuf from profiles where username='ornek_yusuf' and coalesce(is_sample,false) limit 1;
  select id into u_nazli from profiles where username='ornek_nazli' and coalesce(is_sample,false) limit 1;
  select id into u_kerem from profiles where username='ornek_kerem' and coalesce(is_sample,false) limit 1;
  select id into u_irem from profiles where username='ornek_irem' and coalesce(is_sample,false) limit 1;
  select id into u_deniz from profiles where username='ornek_deniz' and coalesce(is_sample,false) limit 1;
  select id into u_sude from profiles where username='ornek_sude' and coalesce(is_sample,false) limit 1;
  select id into u_tolga from profiles where username='ornek_tolga' and coalesce(is_sample,false) limit 1;
  select id into u_ece from profiles where username='ornek_ece' and coalesce(is_sample,false) limit 1;
  select id into u_burak from profiles where username='ornek_burak' and coalesce(is_sample,false) limit 1;
  select id into u_asya from profiles where username='ornek_asya' and coalesce(is_sample,false) limit 1;
  select id into u_onur from profiles where username='ornek_onur' and coalesce(is_sample,false) limit 1;
  select id into u_arda from profiles where username='ornek_arda' and coalesce(is_sample,false) limit 1;
  select id into u_baran from profiles where username='ornek_baran' and coalesce(is_sample,false) limit 1;

  for r in
    select * from (values
      (u_ayse, 'İzmir Sahil Sohbeti', 'Akşam esintisi · rahat muhabbet',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
        'party', 8, 45, 3800::bigint, 'arctic_mist',
        array[u_kerem,u_sude]::uuid[], array[u_melis,u_tolga]::uuid[]),
      (u_can, 'Spor & Muhabbet', 'Maç sonrası sohbet',
        'https://images.unsplash.com/photo-1461896836934-ffe607ba6851?auto=format&fit=crop&w=900&q=80',
        'party', 10, 71, 9200::bigint, 'emerald_haze',
        array[u_deniz,u_yusuf,u_tolga]::uuid[], array[u_irem,u_nazli]::uuid[]),
      (u_melis, 'Gece Masalı', 'Sakin sesler · yumuşak sohbet',
        'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80',
        'dating', 6, 38, 4100::bigint, 'cherry_noir',
        array[u_ayse,u_kerem]::uuid[], array[u_sude]::uuid[]),
      (u_yusuf, 'Antep Sofrası', 'Sıcak muhabbet · hediye',
        'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80',
        'party', 8, 59, 11200::bigint, 'sunset_pulse',
        array[u_can,u_irem,u_nazli]::uuid[], array[u_deniz,u_tolga]::uuid[]),
      (u_nazli, 'Karadeniz Gecesi', 'Horon enerjisi · canlı sohbet',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80',
        'party', 8, 48, 5600::bigint, 'ocean_depth',
        array[u_deniz,u_melis]::uuid[], array[u_ayse,u_sude]::uuid[]),
      (u_kerem, 'Yaz Plaj Vibes', 'Tatil modu · hafif müzik',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
        'party', 8, 54, 6700::bigint, 'sunset_pulse',
        array[u_ayse,u_sude,u_tolga]::uuid[], array[u_melis,u_irem]::uuid[]),
      (u_irem, 'Gece Radyosu', 'İstek şarkı · sohbet',
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=900&q=80',
        'karaoke', 8, 62, 8800::bigint, 'neon_aurora',
        array[u_nazli,u_can]::uuid[], array[u_deniz,u_yusuf,u_melis]::uuid[]),
      (u_deniz, 'Oyun Lobisi 2', 'Mini oyun · PK ısınma',
        'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=900&q=80',
        'game', 12, 89, 15400::bigint, 'cosmic_void',
        array[u_yusuf,u_can,u_tolga,u_kerem]::uuid[], array[u_irem,u_nazli,u_sude]::uuid[]),
      (u_sude, 'Adana Gece Modu', 'Neşeli oda · hediye',
        'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80',
        'party', 8, 43, 4900::bigint, 'electric_lilac',
        array[u_ece,u_burak]::uuid[], array[u_asya,u_onur,u_baran]::uuid[]),
      (u_tolga, 'Konya Akşamı', 'Samimi sohbet · sakin tempo',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80',
        'dating', 6, 31, 2800::bigint, 'royal_gold',
        array[u_arda,u_asya]::uuid[], array[u_ece,u_burak]::uuid[])
    ) as t(host_id, title, topic, cover_url, mode, max_seats, listener_count, coins, theme_code, speakers, listeners)
    where t.host_id is not null
  loop
    if exists (select 1 from rooms where host_id = r.host_id and coalesce(is_live,false)) then
      continue;
    end if;

    v_max_seats := least(greatest(r.max_seats, 2), 20);
    v_speakers := coalesce(r.speakers, array[]::uuid[]);
    v_listeners := coalesce(r.listeners, array[]::uuid[]);
    v_listener_count := greatest(
      r.listener_count,
      1 + coalesce(cardinality(v_speakers), 0) + coalesce(cardinality(v_listeners), 0)
    );

    insert into public.rooms (
      host_id, title, topic, cover_url, mode, max_seats,
      is_live, is_locked, listener_count, total_coins_earned,
      layout_code, theme_code, capacity_tier_code,
      audience_capacity, microphone_capacity, is_sample, created_at
    ) values (
      r.host_id, r.title, r.topic, r.cover_url, r.mode, v_max_seats,
      true, false, v_listener_count, r.coins,
      'floating_glass', r.theme_code, 'social',
      250, v_max_seats, true, now() - (random() * interval '90 minutes')
    ) returning id into v_room;

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

    insert into public.room_members (room_id, user_id, role)
    values (v_room, r.host_id, 'host')
    on conflict (room_id, user_id) do update set role = 'host';

    if cardinality(v_speakers) > 0 then
      for i in 1..cardinality(v_speakers) loop
        v_uid := v_speakers[i];
        if v_uid is null or v_uid = r.host_id then continue; end if;
        insert into public.room_members (room_id, user_id, role)
        values (v_room, v_uid, case when i = 1 then 'cohost' else 'speaker' end)
        on conflict (room_id, user_id) do update set role = excluded.role;
      end loop;
    end if;

    if cardinality(v_listeners) > 0 then
      for i in 1..cardinality(v_listeners) loop
        v_uid := v_listeners[i];
        if v_uid is null or v_uid = r.host_id then continue; end if;
        insert into public.room_members (room_id, user_id, role)
        values (v_room, v_uid, 'listener')
        on conflict (room_id, user_id) do nothing;
      end loop;
    end if;
  end loop;
end;
$$;
