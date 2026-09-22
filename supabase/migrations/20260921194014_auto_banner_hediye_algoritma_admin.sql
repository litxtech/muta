-- Hediye atışı → otomatik banner algoritması + admin müdahale alanları
-- Not: canlıya MCP ile uygulandı; bu dosya yerel geçmiş + tekrar deploy için.

drop function if exists public.auto_banner_olustur(text, text, text, text, text, text, text, text, jsonb, text, text, bigint);

-- ---------------------------------------------------------------------------
-- Şema: ayarlar
-- ---------------------------------------------------------------------------
alter table public.auto_banner_settings
  add column if not exists gift_burst_enabled boolean not null default true,
  add column if not exists gift_burst_window_sec int not null default 120
    check (gift_burst_window_sec between 30 and 3600),
  add column if not exists gift_burst_coin_threshold bigint not null default 10000
    check (gift_burst_coin_threshold >= 100),
  add column if not exists milestone_enabled boolean not null default true;

-- ---------------------------------------------------------------------------
-- Şema: banner kayıtları
-- ---------------------------------------------------------------------------
alter table public.auto_banners
  drop constraint if exists auto_banners_kind_check;

alter table public.auto_banners
  add constraint auto_banners_kind_check
  check (kind in (
    'room_coins',
    'live_coins',
    'seats_full',
    'game_coins',
    'gift_burst'
  ));

alter table public.auto_banners
  add column if not exists pinned boolean not null default false,
  add column if not exists admin_priority int not null default 0,
  add column if not exists milestone int not null default 1,
  add column if not exists score bigint not null default 0;

create index if not exists auto_banners_rank_idx
  on public.auto_banners (active, pinned desc, admin_priority desc, score desc, created_at desc)
  where active = true;

-- ---------------------------------------------------------------------------
-- Skor: hediye metriği + milestone + taze
-- ---------------------------------------------------------------------------
create or replace function public.auto_banner_skor_hesapla(
  p_metric bigint,
  p_milestone int,
  p_created_at timestamptz
)
returns bigint
language sql
stable
as $$
  select greatest(coalesce(p_metric, 0), 0)
    + (greatest(coalesce(p_milestone, 1), 1) * 10000)
    + greatest(
        0,
        5000 - (extract(epoch from (now() - coalesce(p_created_at, now()))) / 60.0)::bigint
      );
$$;

-- ---------------------------------------------------------------------------
-- Oluştur — skor + milestone + admin alanları korunur
-- ---------------------------------------------------------------------------
create or replace function public.auto_banner_olustur(
  p_kind text,
  p_source_key text,
  p_ref_type text,
  p_ref_id text,
  p_title text,
  p_subtitle text,
  p_badge text,
  p_media_url text,
  p_gradient_json jsonb,
  p_action_type text,
  p_action_target text,
  p_metric_value bigint,
  p_milestone int default 1
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ayar public.auto_banner_settings%rowtype;
  v_id uuid;
  v_aktif int;
  v_cooldown_var boolean;
  v_ms int := greatest(coalesce(p_milestone, 1), 1);
  v_score bigint;
begin
  if not public.auto_banner_sistem_acik_mi() then
    return null;
  end if;

  select * into v_ayar from public.auto_banner_settings where id = 1;
  if not found then
    return null;
  end if;

  if p_kind = 'room_coins' and not v_ayar.room_coins_enabled then return null; end if;
  if p_kind = 'live_coins' and not v_ayar.live_coins_enabled then return null; end if;
  if p_kind = 'seats_full' and not v_ayar.seats_full_enabled then return null; end if;
  if p_kind = 'game_coins' and not v_ayar.game_coins_enabled then return null; end if;
  if p_kind = 'gift_burst' and not coalesce(v_ayar.gift_burst_enabled, true) then return null; end if;

  perform public.auto_banner_suresi_dolmuslari_temizle();

  v_score := public.auto_banner_skor_hesapla(p_metric_value, v_ms, now());

  select exists (
    select 1 from public.auto_banners b
    where b.source_key = p_source_key
      and (
        b.active = true
        or b.created_at > now() - make_interval(hours => v_ayar.cooldown_hours)
      )
  ) into v_cooldown_var;

  if v_cooldown_var then
    update public.auto_banners
      set metric_value = greatest(metric_value, coalesce(p_metric_value, 0)),
          milestone = greatest(milestone, v_ms),
          score = greatest(
            score,
            public.auto_banner_skor_hesapla(
              greatest(metric_value, coalesce(p_metric_value, 0)),
              greatest(milestone, v_ms),
              created_at
            )
          ),
          title = coalesce(nullif(trim(p_title), ''), title),
          subtitle = coalesce(p_subtitle, subtitle),
          media_url = coalesce(nullif(trim(p_media_url), ''), media_url),
          badge = coalesce(nullif(trim(p_badge), ''), badge)
    where source_key = p_source_key
      and active = true;
    return null;
  end if;

  select count(*)::int into v_aktif
  from public.auto_banners
  where active = true and expires_at > now();

  if v_aktif >= v_ayar.max_active then
    -- Sabitlenmemiş en düşük skorluyu düşür
    update public.auto_banners
      set active = false,
          deactivated_at = now(),
          deactivate_reason = 'max_active'
    where id = (
      select id from public.auto_banners
      where active = true
        and pinned = false
      order by admin_priority asc, score asc, created_at asc
      limit 1
    );
  end if;

  insert into public.auto_banners (
    kind, source_key, ref_type, ref_id,
    title, subtitle, badge, media_url, gradient_json,
    action_type, action_target, metric_value,
    expires_at, milestone, score
  ) values (
    p_kind, p_source_key, p_ref_type, p_ref_id,
    left(trim(p_title), 80),
    left(nullif(trim(p_subtitle), ''), 120),
    left(nullif(trim(p_badge), ''), 24),
    nullif(trim(p_media_url), ''),
    p_gradient_json,
    p_action_type,
    p_action_target,
    coalesce(p_metric_value, 0),
    now() + make_interval(hours => v_ayar.ttl_hours),
    v_ms,
    v_score
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    return null;
end;
$$;

-- 12 arg çağrılar DEFAULT milestone=1 ile aynı fonksiyona gider
revoke all on function public.auto_banner_olustur(text, text, text, text, text, text, text, text, jsonb, text, text, bigint, int) from public;
grant execute on function public.auto_banner_olustur(text, text, text, text, text, text, text, text, jsonb, text, text, bigint, int) to service_role;

-- ---------------------------------------------------------------------------
-- Oda / canlı: eşik + milestone (1x, 2x, 3x…)
-- ---------------------------------------------------------------------------
create or replace function public.auto_banner_oda_coin_degerlendir(
  p_room_id uuid,
  p_coins bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ayar public.auto_banner_settings%rowtype;
  v_title text;
  v_cover text;
  v_host text;
  v_avatar text;
  v_live boolean;
  v_esik bigint;
  v_ms int;
begin
  if p_room_id is null then return; end if;
  select * into v_ayar from public.auto_banner_settings where id = 1;
  if not found or not v_ayar.room_coins_enabled then return; end if;

  v_esik := greatest(v_ayar.room_coin_threshold, 1);
  if coalesce(p_coins, 0) < v_esik then return; end if;

  select r.is_live, r.title, r.cover_url, p.display_name, p.avatar_url
    into v_live, v_title, v_cover, v_host, v_avatar
  from public.rooms r
  left join public.profiles p on p.id = r.host_id
  where r.id = p_room_id;

  if not coalesce(v_live, false) then return; end if;

  v_ms := case
    when coalesce(v_ayar.milestone_enabled, true)
      then greatest(1, (coalesce(p_coins, 0) / v_esik)::int)
    else 1
  end;

  perform public.auto_banner_olustur(
    'room_coins',
    'room_coins:' || p_room_id::text || ':m' || v_ms::text,
    'room',
    p_room_id::text,
    coalesce(nullif(trim(v_title), ''), 'Canlı ses odası'),
    coalesce(v_host, 'Host') || ' · ' || coalesce(p_coins, 0)::text || ' coin',
    case when v_ms >= 5 then 'EFSANE' when v_ms >= 2 then 'ATEŞ' else 'HOT' end,
    coalesce(nullif(trim(v_cover), ''), v_avatar),
    jsonb_build_object('colors', jsonb_build_array('#0F3A36', '#3DCFB0')),
    'INTERNAL_ROOM',
    p_room_id::text,
    coalesce(p_coins, 0),
    v_ms
  );
end;
$$;

create or replace function public.auto_banner_canli_coin_degerlendir(
  p_session_id uuid,
  p_coins bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ayar public.auto_banner_settings%rowtype;
  v_title text;
  v_host text;
  v_avatar text;
  v_live boolean;
  v_esik bigint;
  v_ms int;
begin
  if p_session_id is null then return; end if;
  select * into v_ayar from public.auto_banner_settings where id = 1;
  if not found or not v_ayar.live_coins_enabled then return; end if;

  v_esik := greatest(v_ayar.live_coin_threshold, 1);
  if coalesce(p_coins, 0) < v_esik then return; end if;

  select s.is_live, s.title, p.display_name, p.avatar_url
    into v_live, v_title, v_host, v_avatar
  from public.live_sessions s
  left join public.profiles p on p.id = s.host_id
  where s.id = p_session_id;

  if not coalesce(v_live, false) then return; end if;

  v_ms := case
    when coalesce(v_ayar.milestone_enabled, true)
      then greatest(1, (coalesce(p_coins, 0) / v_esik)::int)
    else 1
  end;

  perform public.auto_banner_olustur(
    'live_coins',
    'live_coins:' || p_session_id::text || ':m' || v_ms::text,
    'live_session',
    p_session_id::text,
    coalesce(nullif(trim(v_title), ''), 'Canlı yayın'),
    coalesce(v_host, 'Yayıncı') || ' · ' || coalesce(p_coins, 0)::text || ' coin',
    case when v_ms >= 5 then 'EFSANE' when v_ms >= 2 then 'ATEŞ' else 'CANLI' end,
    v_avatar,
    jsonb_build_object('colors', jsonb_build_array('#3A1A38', '#E84091')),
    'INTERNAL_LIVE',
    p_session_id::text,
    coalesce(p_coins, 0),
    v_ms
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Hediye patlaması (kısa pencerede yoğun hediye)
-- ---------------------------------------------------------------------------
create or replace function public.auto_banner_hediye_patlama_degerlendir(
  p_ref_type text,
  p_ref_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ayar public.auto_banner_settings%rowtype;
  v_burst bigint;
  v_title text;
  v_cover text;
  v_live boolean;
begin
  select * into v_ayar from public.auto_banner_settings where id = 1;
  if not found or not coalesce(v_ayar.gift_burst_enabled, true) then return; end if;
  if p_ref_id is null then return; end if;

  if p_ref_type = 'room' then
    select coalesce(sum(gt.coins_spent), 0) into v_burst
    from public.gift_transactions gt
    where gt.room_id = p_ref_id
      and gt.created_at > now() - make_interval(secs => v_ayar.gift_burst_window_sec);

    if v_burst < v_ayar.gift_burst_coin_threshold then return; end if;

    select r.is_live, r.title, r.cover_url into v_live, v_title, v_cover
    from public.rooms r where r.id = p_ref_id;
    if not coalesce(v_live, false) then return; end if;

    perform public.auto_banner_olustur(
      'gift_burst',
      'gift_burst:room:' || p_ref_id::text,
      'room',
      p_ref_id::text,
      coalesce(nullif(trim(v_title), ''), 'Ses odası'),
      'Hediye yağmuru · ' || v_burst::text || ' coin / '
        || v_ayar.gift_burst_window_sec::text || 'sn',
      'YAĞMUR',
      v_cover,
      jsonb_build_object('colors', jsonb_build_array('#2A1020', '#F0B429')),
      'INTERNAL_ROOM',
      p_ref_id::text,
      v_burst,
      1
    );
  elsif p_ref_type = 'live_session' then
    select coalesce(sum(gt.coins_spent), 0) into v_burst
    from public.gift_transactions gt
    where gt.live_session_id = p_ref_id
      and gt.created_at > now() - make_interval(secs => v_ayar.gift_burst_window_sec);

    if v_burst < v_ayar.gift_burst_coin_threshold then return; end if;

    select s.is_live, s.title, p.avatar_url into v_live, v_title, v_cover
    from public.live_sessions s
    left join public.profiles p on p.id = s.host_id
    where s.id = p_ref_id;
    if not coalesce(v_live, false) then return; end if;

    perform public.auto_banner_olustur(
      'gift_burst',
      'gift_burst:live:' || p_ref_id::text,
      'live_session',
      p_ref_id::text,
      coalesce(nullif(trim(v_title), ''), 'Canlı yayın'),
      'Hediye yağmuru · ' || v_burst::text || ' coin / '
        || v_ayar.gift_burst_window_sec::text || 'sn',
      'YAĞMUR',
      v_cover,
      jsonb_build_object('colors', jsonb_build_array('#3A1A10', '#E84091')),
      'INTERNAL_LIVE',
      p_ref_id::text,
      v_burst,
      1
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- gift_transactions INSERT → algoritma
-- ---------------------------------------------------------------------------
create or replace function public.auto_banner_hediye_tx_tetik()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coins bigint;
begin
  if not public.auto_banner_sistem_acik_mi() then
    return new;
  end if;

  if new.room_id is not null then
    select total_coins_earned into v_coins
    from public.rooms where id = new.room_id;
    perform public.auto_banner_oda_coin_degerlendir(new.room_id, coalesce(v_coins, 0));
    perform public.auto_banner_hediye_patlama_degerlendir('room', new.room_id);
  end if;

  if new.live_session_id is not null then
    select total_coins_earned into v_coins
    from public.live_sessions where id = new.live_session_id;
    perform public.auto_banner_canli_coin_degerlendir(
      new.live_session_id,
      coalesce(v_coins, 0)
    );
    perform public.auto_banner_hediye_patlama_degerlendir(
      'live_session',
      new.live_session_id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists auto_banner_hediye_tx_trg on public.gift_transactions;
create trigger auto_banner_hediye_tx_trg
  after insert on public.gift_transactions
  for each row
  execute function public.auto_banner_hediye_tx_tetik();

-- Mevcut oda/canlı tetiklerini milestone ile güçlendir
create or replace function public.auto_banner_oda_coin_tetik()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.is_live is distinct from old.is_live and new.is_live = false then
    perform public.auto_banner_kaynak_kapat('room', new.id::text, 'room_closed');
    return new;
  end if;

  if coalesce(new.is_live, false) then
    perform public.auto_banner_oda_coin_degerlendir(
      new.id,
      coalesce(new.total_coins_earned, 0)
    );
  end if;
  return new;
end;
$$;

create or replace function public.auto_banner_canli_coin_tetik()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.is_live is distinct from old.is_live and new.is_live = false then
    perform public.auto_banner_kaynak_kapat('live_session', new.id::text, 'live_closed');
    return new;
  end if;

  if coalesce(new.is_live, false) then
    perform public.auto_banner_canli_coin_degerlendir(
      new.id,
      coalesce(new.total_coins_earned, 0)
    );
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Aktif liste — pin + skor sırası
-- ---------------------------------------------------------------------------
create or replace function public.auto_banner_aktif_listele()
returns setof public.auto_banners
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
begin
  perform public.auto_banner_suresi_dolmuslari_temizle();

  update public.auto_banners ab
    set active = false,
        deactivated_at = now(),
        deactivate_reason = 'source_not_live'
  where ab.active = true
    and ab.ref_type = 'room'
    and not exists (
      select 1 from public.rooms r
      where r.id::text = ab.ref_id and r.is_live = true
    );

  update public.auto_banners ab
    set active = false,
        deactivated_at = now(),
        deactivate_reason = 'source_not_live'
  where ab.active = true
    and ab.ref_type = 'live_session'
    and not exists (
      select 1 from public.live_sessions ls
      where ls.id::text = ab.ref_id and ls.is_live = true
    );

  if not public.auto_banner_sistem_acik_mi() then
    return;
  end if;

  select carousel_max into v_max from public.auto_banner_settings where id = 1;

  return query
  select ab.*
  from public.auto_banners ab
  where ab.active = true
    and ab.expires_at > now()
  order by
    ab.pinned desc,
    ab.admin_priority desc,
    ab.score desc,
    ab.metric_value desc,
    ab.created_at desc
  limit greatest(coalesce(v_max, 8), 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- Ayar getir / kaydet — yeni alanlar
-- ---------------------------------------------------------------------------
create or replace function public.auto_banner_ayarlari_getir()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.auto_banner_settings%rowtype;
  v_flag boolean;
begin
  select * into v_row from public.auto_banner_settings where id = 1;
  v_flag := coalesce(public.ozellik_bayragi_aktif_mi('auto_event_banners_enabled'), false);
  return jsonb_build_object(
    'enabled', coalesce(v_row.enabled, false),
    'feature_flag', v_flag,
    'ttl_hours', v_row.ttl_hours,
    'cooldown_hours', v_row.cooldown_hours,
    'room_coin_threshold', v_row.room_coin_threshold,
    'live_coin_threshold', v_row.live_coin_threshold,
    'game_coin_threshold', v_row.game_coin_threshold,
    'seats_full_enabled', v_row.seats_full_enabled,
    'room_coins_enabled', v_row.room_coins_enabled,
    'live_coins_enabled', v_row.live_coins_enabled,
    'game_coins_enabled', v_row.game_coins_enabled,
    'gift_burst_enabled', coalesce(v_row.gift_burst_enabled, true),
    'gift_burst_window_sec', coalesce(v_row.gift_burst_window_sec, 120),
    'gift_burst_coin_threshold', coalesce(v_row.gift_burst_coin_threshold, 10000),
    'milestone_enabled', coalesce(v_row.milestone_enabled, true),
    'max_active', v_row.max_active,
    'carousel_max', v_row.carousel_max,
    'updated_at', v_row.updated_at
  );
end;
$$;

create or replace function public.admin_auto_banner_ayarlari_kaydet(p_ayarlar jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then
    raise exception 'Admin required';
  end if;

  update public.auto_banner_settings set
    enabled = coalesce((p_ayarlar->>'enabled')::boolean, enabled),
    ttl_hours = coalesce((p_ayarlar->>'ttl_hours')::int, ttl_hours),
    cooldown_hours = coalesce((p_ayarlar->>'cooldown_hours')::int, cooldown_hours),
    room_coin_threshold = coalesce((p_ayarlar->>'room_coin_threshold')::bigint, room_coin_threshold),
    live_coin_threshold = coalesce((p_ayarlar->>'live_coin_threshold')::bigint, live_coin_threshold),
    game_coin_threshold = coalesce((p_ayarlar->>'game_coin_threshold')::bigint, game_coin_threshold),
    seats_full_enabled = coalesce((p_ayarlar->>'seats_full_enabled')::boolean, seats_full_enabled),
    room_coins_enabled = coalesce((p_ayarlar->>'room_coins_enabled')::boolean, room_coins_enabled),
    live_coins_enabled = coalesce((p_ayarlar->>'live_coins_enabled')::boolean, live_coins_enabled),
    game_coins_enabled = coalesce((p_ayarlar->>'game_coins_enabled')::boolean, game_coins_enabled),
    gift_burst_enabled = coalesce((p_ayarlar->>'gift_burst_enabled')::boolean, gift_burst_enabled),
    gift_burst_window_sec = coalesce((p_ayarlar->>'gift_burst_window_sec')::int, gift_burst_window_sec),
    gift_burst_coin_threshold = coalesce((p_ayarlar->>'gift_burst_coin_threshold')::bigint, gift_burst_coin_threshold),
    milestone_enabled = coalesce((p_ayarlar->>'milestone_enabled')::boolean, milestone_enabled),
    max_active = coalesce((p_ayarlar->>'max_active')::int, max_active),
    carousel_max = coalesce((p_ayarlar->>'carousel_max')::int, carousel_max),
    updated_at = now(),
    updated_by = auth.uid()
  where id = 1;

  if p_ayarlar ? 'enabled' then
    update public.feature_flags
      set enabled = (p_ayarlar->>'enabled')::boolean,
          updated_at = now()
    where key = 'auto_event_banners_enabled';
  end if;

  if coalesce((p_ayarlar->>'enabled')::boolean, true) = false then
    update public.auto_banners
      set active = false,
          deactivated_at = now(),
          deactivate_reason = 'admin_disabled'
    where active = true;
  end if;

  return public.auto_banner_ayarlari_getir();
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin müdahale
-- ---------------------------------------------------------------------------
create or replace function public.admin_auto_banner_pin(
  p_id uuid,
  p_pinned boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then
    raise exception 'Admin required';
  end if;
  update public.auto_banners
    set pinned = coalesce(p_pinned, true),
        admin_priority = case
          when coalesce(p_pinned, true) then greatest(admin_priority, 100)
          else admin_priority
        end
  where id = p_id;
end;
$$;

create or replace function public.admin_auto_banner_oncelik(
  p_id uuid,
  p_priority int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then
    raise exception 'Admin required';
  end if;
  update public.auto_banners
    set admin_priority = greatest(coalesce(p_priority, 0), 0)
  where id = p_id;
end;
$$;

create or replace function public.admin_auto_banner_ttl_uzat(
  p_id uuid,
  p_hours int default 12
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then
    raise exception 'Admin required';
  end if;
  update public.auto_banners
    set expires_at = greatest(expires_at, now())
      + make_interval(hours => greatest(coalesce(p_hours, 12), 1)),
        active = true,
        deactivated_at = null,
        deactivate_reason = null
  where id = p_id;
end;
$$;

create or replace function public.admin_auto_banner_hepsini_kapat(
  p_reason text default 'admin_bulk'
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Admin required';
  end if;
  update public.auto_banners
    set active = false,
        pinned = false,
        deactivated_at = now(),
        deactivate_reason = coalesce(nullif(trim(p_reason), ''), 'admin_bulk')
  where active = true;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.admin_auto_banner_cooldown_temizle(
  p_ref_type text default null,
  p_ref_id text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Admin required';
  end if;
  -- Cooldown: created_at'i eskiye çek ki yeni hediye tekrar banner üretebilsin
  update public.auto_banners
    set created_at = now() - interval '365 days',
        deactivate_reason = coalesce(deactivate_reason, '') || '|cooldown_cleared'
  where active = false
    and (p_ref_type is null or ref_type = p_ref_type)
    and (p_ref_id is null or ref_id = p_ref_id);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.admin_auto_banner_tara_yenile()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int := 0;
  r record;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Admin required';
  end if;

  for r in
    select id, total_coins_earned
    from public.rooms
    where is_live = true
      and coalesce(total_coins_earned, 0) > 0
  loop
    perform public.auto_banner_oda_coin_degerlendir(r.id, r.total_coins_earned);
    perform public.auto_banner_hediye_patlama_degerlendir('room', r.id);
    v_n := v_n + 1;
  end loop;

  for r in
    select id, total_coins_earned
    from public.live_sessions
    where is_live = true
      and coalesce(total_coins_earned, 0) > 0
  loop
    perform public.auto_banner_canli_coin_degerlendir(r.id, r.total_coins_earned);
    perform public.auto_banner_hediye_patlama_degerlendir('live_session', r.id);
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

grant execute on function public.admin_auto_banner_pin(uuid, boolean) to authenticated;
grant execute on function public.admin_auto_banner_oncelik(uuid, int) to authenticated;
grant execute on function public.admin_auto_banner_ttl_uzat(uuid, int) to authenticated;
grant execute on function public.admin_auto_banner_hepsini_kapat(text) to authenticated;
grant execute on function public.admin_auto_banner_cooldown_temizle(text, text) to authenticated;
grant execute on function public.admin_auto_banner_tara_yenile() to authenticated;
