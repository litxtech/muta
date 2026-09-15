-- Admin platform kontrol merkezi — ozet, finans, moderasyon, bayraklar, ekonomi

-- Bayrak / kill switch admin yazma
drop policy if exists "Feature flags admin write" on public.feature_flags;
create policy "Feature flags admin write"
  on public.feature_flags for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

drop policy if exists "Kill switches admin write" on public.kill_switches;
create policy "Kill switches admin write"
  on public.kill_switches for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

-- Raporlar admin okuma/guncelleme
drop policy if exists "Reports admin all" on public.user_reports;
create policy "Reports admin all"
  on public.user_reports for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

-- Cekim / satin alma / hediye / oda admin okuma
drop policy if exists "Withdrawals admin read" on public.withdrawal_requests;
create policy "Withdrawals admin read"
  on public.withdrawal_requests for select to authenticated
  using (public.ben_admin_miyim());

drop policy if exists "Purchases admin read" on public.coin_purchases;
create policy "Purchases admin read"
  on public.coin_purchases for select to authenticated
  using (public.ben_admin_miyim());

drop policy if exists "Ledger admin read" on public.wallet_ledger;
create policy "Ledger admin read"
  on public.wallet_ledger for select to authenticated
  using (public.ben_admin_miyim());

drop policy if exists "Packages admin all" on public.coin_packages;
create policy "Packages admin all"
  on public.coin_packages for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

drop policy if exists "Gifts admin all" on public.gifts;
create policy "Gifts admin all"
  on public.gifts for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

drop policy if exists "Announcements admin all" on public.announcements;
create policy "Announcements admin all"
  on public.announcements for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

grant select, update on public.feature_flags to authenticated;
grant select, update on public.kill_switches to authenticated;
grant select, update on public.user_reports to authenticated;
grant select, update on public.withdrawal_requests to authenticated;
grant select on public.coin_purchases to authenticated;
grant select on public.wallet_ledger to authenticated;
grant select, insert, update on public.coin_packages to authenticated;
grant select, insert, update on public.gifts to authenticated;
grant select, insert, update on public.announcements to authenticated;

-- ---------------------------------------------------------------------------
-- Genis dashboard ozeti
-- ---------------------------------------------------------------------------
create or replace function public.admin_platform_ozeti()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  select jsonb_build_object(
    'kullanici', jsonb_build_object(
      'toplam', (select count(*) from public.profiles where deleted_at is null),
      'banli', (select count(*) from public.profiles where banned_at is not null and deleted_at is null),
      'misafir', (select count(*) from public.profiles where coalesce(is_guest, false) and deleted_at is null),
      'host', (select count(*) from public.profiles where is_host and deleted_at is null),
      'son_24s', (select count(*) from public.profiles where created_at > now() - interval '24 hours')
    ),
    'canli', jsonb_build_object(
      'odalar', (select count(*) from public.rooms where is_live),
      'yayinlar', (select count(*) from public.live_sessions where is_live),
      'pk', (select count(*) from public.pk_matches where status = 'live')
    ),
    'finans', jsonb_build_object(
      'toplam_yukleme_coin', coalesce((
        select sum(coins_added) from public.coin_purchases
        where coalesce(status, 'completed') = 'completed'
      ), 0),
      'yukleme_adet', (
        select count(*) from public.coin_purchases
        where coalesce(status, 'completed') = 'completed'
      ),
      'bekleyen_cekim', (
        select count(*) from public.withdrawal_requests
        where status in ('pending', 'under_review', 'frozen')
      ),
      'bekleyen_cekim_elmas', coalesce((
        select sum(diamonds) from public.withdrawal_requests
        where status in ('pending', 'under_review', 'frozen')
      ), 0),
      'son_24s_yukleme_coin', coalesce((
        select sum(coins_added) from public.coin_purchases
        where coalesce(status, 'completed') = 'completed'
          and created_at > now() - interval '24 hours'
      ), 0)
    ),
    'sosyal', jsonb_build_object(
      'acik_rapor', (select count(*) from public.user_reports where status in ('open', 'reviewing')),
      'aktif_ihtar', (select count(*) from public.user_warnings where is_active),
      'push_kuyruk', (select count(*) from public.notification_outbox where status = 'pending'),
      'hediye_24s', (
        select count(*) from public.gift_transactions
        where created_at > now() - interval '24 hours'
      )
    ),
    'bayrak', jsonb_build_object(
      'kapali_ozellik', (select count(*) from public.feature_flags where not enabled),
      'aktif_kill', (select count(*) from public.kill_switches where active)
    )
  ) into v;

  return v;
end;
$$;

-- En cok harcayanlar
create or replace function public.admin_en_cok_harcayanlar(p_limit int default 30)
returns table (
  user_id uuid,
  display_name text,
  username text,
  public_user_id text,
  toplam_coin bigint,
  islem_adet bigint,
  son_yukleme timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  return query
  select
    p.id,
    p.display_name,
    p.username,
    p.public_user_id,
    coalesce(sum(cp.coins_added), 0)::bigint,
    count(*)::bigint,
    max(cp.created_at)
  from public.coin_purchases cp
  join public.profiles p on p.id = cp.user_id
  where coalesce(cp.status, 'completed') = 'completed'
  group by p.id, p.display_name, p.username, p.public_user_id
  order by 5 desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
end;
$$;

-- Cekim listesi
create or replace function public.admin_cekim_listesi(p_limit int default 40)
returns setof public.withdrawal_requests
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  return query
  select * from public.withdrawal_requests
  order by created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
end;
$$;

create or replace function public.admin_cekim_durum_guncelle(
  p_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.withdrawal_requests%rowtype;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_status not in ('pending','under_review','approved','paid','rejected','frozen') then
    raise exception 'Gecersiz durum';
  end if;

  update public.withdrawal_requests set
    status = p_status,
    processed_at = case when p_status in ('approved','paid','rejected') then now() else processed_at end,
    details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
      'admin_note', p_note,
      'admin_id', auth.uid(),
      'admin_at', now()
    )
  where id = p_id
  returning * into v_row;

  if not found then raise exception 'Cekim bulunamadi'; end if;

  perform public.admin_audit_yaz(
    v_row.user_id,
    'withdrawal_' || p_status,
    'Cekim ' || p_status || ': ' || v_row.diamonds::text || ' elmas',
    jsonb_build_object('withdrawal_id', p_id, 'note', p_note)
  );

  return jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status);
end;
$$;

-- Admin cuzdan duzeltmesi
create or replace function public.admin_cuzdan_duzelt(
  p_user_id uuid,
  p_currency text,
  p_delta bigint,
  p_reason text default 'admin_adjust'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bal bigint;
  v_cur text := lower(trim(p_currency));
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if v_cur not in ('coins', 'diamonds') then raise exception 'Gecersiz birim'; end if;
  if p_delta = 0 then raise exception 'Delta 0 olamaz'; end if;

  insert into public.wallets (user_id, coins, diamonds)
  values (p_user_id, 0, 0)
  on conflict (user_id) do nothing;

  if v_cur = 'coins' then
    update public.wallets set coins = greatest(coins + p_delta, 0), updated_at = now()
    where user_id = p_user_id
    returning coins into v_bal;
  else
    update public.wallets set diamonds = greatest(diamonds + p_delta, 0), updated_at = now()
    where user_id = p_user_id
    returning diamonds into v_bal;
  end if;

  insert into public.wallet_ledger (user_id, currency, delta, balance_after, reason, ref_type)
  values (p_user_id, v_cur, p_delta, v_bal, coalesce(nullif(trim(p_reason), ''), 'admin_adjust'), 'admin');

  perform public.admin_audit_yaz(
    p_user_id,
    'wallet_adjust',
    'Cuzdan duzeltme: ' || p_delta::text || ' ' || v_cur,
    jsonb_build_object('currency', v_cur, 'delta', p_delta, 'balance_after', v_bal)
  );

  return jsonb_build_object('ok', true, 'balance_after', v_bal, 'currency', v_cur);
end;
$$;

-- Rapor listesi + cozum
create or replace function public.admin_rapor_listesi(p_limit int default 40)
returns setof public.user_reports
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  return query
  select * from public.user_reports
  order by
    case when status in ('open','reviewing') then 0 else 1 end,
    created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
end;
$$;

create or replace function public.admin_rapor_durum_guncelle(
  p_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if p_status not in ('open','reviewing','resolved','dismissed') then
    raise exception 'Gecersiz durum';
  end if;

  update public.user_reports set status = p_status
  where id = p_id
  returning target_user_id into v_uid;

  perform public.admin_audit_yaz(
    v_uid,
    'report_' || p_status,
    'Rapor durumu: ' || p_status,
    jsonb_build_object('report_id', p_id)
  );

  return jsonb_build_object('ok', true);
end;
$$;

-- Canli odalari kapat
create or replace function public.admin_oda_canli_kapat(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;

  update public.rooms set
    is_live = false,
    ended_at = coalesce(ended_at, now())
  where id = p_room_id
  returning host_id into v_host;

  if not found then raise exception 'Oda bulunamadi'; end if;

  perform public.admin_audit_yaz(
    v_host,
    'room_force_end',
    'Oda admin tarafindan kapatildi',
    jsonb_build_object('room_id', p_room_id)
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_canli_odalar(p_limit int default 40)
returns table (
  id uuid,
  title text,
  mode text,
  listener_count int,
  host_id uuid,
  host_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  return query
  select r.id, r.title, r.mode, r.listener_count, r.host_id,
    coalesce(p.display_name, p.username, 'Host'),
    r.created_at
  from public.rooms r
  left join public.profiles p on p.id = r.host_id
  where r.is_live
  order by r.listener_count desc, r.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
end;
$$;

-- Bayrak / kill toggle
create or replace function public.admin_ozellik_bayragi_ayarla(
  p_key text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  update public.feature_flags set enabled = p_enabled, updated_at = now()
  where key = p_key;
  if not found then raise exception 'Bayrak yok'; end if;
  perform public.admin_audit_yaz(
    null, 'feature_flag',
    'Bayrak ' || p_key || ' = ' || p_enabled::text,
    jsonb_build_object('key', p_key, 'enabled', p_enabled)
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_kill_switch_ayarla(
  p_key text,
  p_active boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  update public.kill_switches set
    active = p_active,
    reason = case when p_active then coalesce(p_reason, reason) else null end,
    updated_at = now()
  where key = p_key;
  if not found then raise exception 'Kill switch yok'; end if;
  perform public.admin_audit_yaz(
    null, 'kill_switch',
    'Kill ' || p_key || ' = ' || p_active::text,
    jsonb_build_object('key', p_key, 'active', p_active)
  );
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_bayraklari_getir()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  return jsonb_build_object(
    'flags', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', key, 'enabled', enabled, 'description', description
      ) order by key) from public.feature_flags
    ), '[]'::jsonb),
    'kills', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', key, 'active', active, 'reason', reason
      ) order by key) from public.kill_switches
    ), '[]'::jsonb)
  );
end;
$$;

-- Hediye / paket aktiflik
create or replace function public.admin_ekonomi_katalogu()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  return jsonb_build_object(
    'paketler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'sku', sku, 'title', title, 'coins', coins,
        'bonus_coins', bonus_coins, 'price_usd', price_usd,
        'is_active', is_active, 'badge', badge
      ) order by sort_order, price_usd)
      from public.coin_packages
    ), '[]'::jsonb),
    'hediyeler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'code', code, 'name', name, 'emoji', emoji,
        'coin_cost', coin_cost, 'diamond_value', diamond_value,
        'rarity', rarity, 'is_active', is_active
      ) order by sort_order, coin_cost)
      from public.gifts
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_paket_aktiflik(p_id uuid, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  update public.coin_packages set is_active = p_active where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.admin_hediye_aktiflik(p_id uuid, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  update public.gifts set is_active = p_active where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Duyuru olustur
create or replace function public.admin_duyuru_olustur(
  p_title text,
  p_body text,
  p_priority text default 'normal'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_pri text := coalesce(nullif(trim(p_priority), ''), 'normal');
begin
  if not public.ben_admin_miyim() then raise exception 'Forbidden: admin only'; end if;
  if v_pri not in ('low','normal','high','urgent') then v_pri := 'normal'; end if;
  insert into public.announcements (title, body, priority, is_active)
  values (trim(p_title), trim(p_body), v_pri, true)
  returning id into v_id;
  perform public.admin_audit_yaz(null, 'announcement', 'Duyuru: ' || trim(p_title), jsonb_build_object('id', v_id));
  return v_id;
end;
$$;

grant execute on function public.admin_platform_ozeti() to authenticated;
grant execute on function public.admin_en_cok_harcayanlar(int) to authenticated;
grant execute on function public.admin_cekim_listesi(int) to authenticated;
grant execute on function public.admin_cekim_durum_guncelle(uuid, text, text) to authenticated;
grant execute on function public.admin_cuzdan_duzelt(uuid, text, bigint, text) to authenticated;
grant execute on function public.admin_rapor_listesi(int) to authenticated;
grant execute on function public.admin_rapor_durum_guncelle(uuid, text) to authenticated;
grant execute on function public.admin_oda_canli_kapat(uuid) to authenticated;
grant execute on function public.admin_canli_odalar(int) to authenticated;
grant execute on function public.admin_ozellik_bayragi_ayarla(text, boolean) to authenticated;
grant execute on function public.admin_kill_switch_ayarla(text, boolean, text) to authenticated;
grant execute on function public.admin_bayraklari_getir() to authenticated;
grant execute on function public.admin_ekonomi_katalogu() to authenticated;
grant execute on function public.admin_paket_aktiflik(uuid, boolean) to authenticated;
grant execute on function public.admin_hediye_aktiflik(uuid, boolean) to authenticated;
grant execute on function public.admin_duyuru_olustur(text, text, text) to authenticated;
