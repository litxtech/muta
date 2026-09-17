-- Hesap değeri: güven/kalite skoru (0–1000), eklenebilir sinyal kataloğu

-- ---------------------------------------------------------------------------
-- 1) Sinyal kataloğu (yeni değer = satır + weight; skor yeniden hesaplanır)
-- ---------------------------------------------------------------------------
create table if not exists public.account_value_signals (
  signal_key text primary key,
  label text not null,
  weight numeric(8, 2) not null check (weight > 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.account_value_signals is
  'Hesap değeri formül sinyalleri. Yeni sinyal ekleyip weight ver; hesap_degerini_yenile yeniden ağırlıklar.';

insert into public.account_value_signals (signal_key, label, weight, sort_order, description)
values
  ('verification', 'Doğrulama', 20, 10, 'Onaylı hesap güven bonusu'),
  ('host_status', 'Host / ajans', 15, 20, 'Platform host / ajans durumu'),
  ('violations', 'İhlal kaydı', 15, 30, 'Ceza yokluğu = yüksek güven'),
  ('activity_30d', 'Aktiflik', 20, 40, 'Son 30 gün canlılık'),
  ('social_quality', 'Sosyal kalite', 15, 50, 'Takipçi tabanı (log ölçek)'),
  ('gift_presence', 'Hediye varlığı', 15, 60, 'Hafif katkı / etkileşim sinyali')
on conflict (signal_key) do nothing;

alter table public.account_value_signals enable row level security;

drop policy if exists "Account value signals readable" on public.account_value_signals;
create policy "Account value signals readable"
  on public.account_value_signals for select to authenticated
  using (true);

grant select on public.account_value_signals to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Denormalized skor alanları
-- ---------------------------------------------------------------------------
alter table public.user_profile_stats
  add column if not exists account_value int not null default 0
    check (account_value >= 0 and account_value <= 1000),
  add column if not exists account_value_label text not null default 'Yeni',
  add column if not exists account_value_version int not null default 1,
  add column if not exists account_value_updated_at timestamptz;

comment on column public.user_profile_stats.account_value is 'Güven/kalite skoru 0–1000';
comment on column public.user_profile_stats.account_value_label is 'Skor dilimi etiketi';
comment on column public.user_profile_stats.account_value_version is 'Formül sürümü (sinyal seti değişince artır)';

-- ---------------------------------------------------------------------------
-- 3) Gizlilik
-- ---------------------------------------------------------------------------
alter table public.user_privacy_settings
  add column if not exists hide_account_value boolean not null default false;

comment on column public.user_privacy_settings.hide_account_value is
  'Profil ziyaretinde hesap değeri rozetini gizle';

-- ---------------------------------------------------------------------------
-- 4) Etiket + sinyal skoru yardımcıları
-- ---------------------------------------------------------------------------
create or replace function public.hesap_degeri_etiketi(p_score int)
returns text
language sql
immutable
as $$
  select case
    when p_score >= 750 then 'Prestijli'
    when p_score >= 550 then 'Yüksek güven'
    when p_score >= 350 then 'Güvenilir'
    when p_score >= 150 then 'Yükselen'
    else 'Yeni'
  end;
$$;

create or replace function public.hesap_degeri_sinyal_skoru(
  p_signal_key text,
  p_user_id uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_verified boolean;
  v_level int;
  v_host text;
  v_violations int;
  v_followers bigint;
  v_gifts_sent bigint;
  v_gifts_recv bigint;
  v_last_seen timestamptz;
  v_created timestamptz;
  v_days numeric;
  v_activity numeric;
  v_social numeric;
  v_gift numeric;
begin
  select
    coalesce(p.is_verified, false),
    coalesce(p.level, 1),
    p.created_at
  into v_verified, v_level, v_created
  from public.profiles p
  where p.id = p_user_id;

  if not found then
    return 0;
  end if;

  select
    coalesce(s.host_status, 'none'),
    coalesce(s.followers_count, 0),
    coalesce(s.total_gifts_sent, 0),
    coalesce(s.total_gifts_received, 0)
  into v_host, v_followers, v_gifts_sent, v_gifts_recv
  from public.user_profile_stats s
  where s.user_id = p_user_id;

  v_host := coalesce(v_host, 'none');
  v_followers := coalesce(v_followers, 0);
  v_gifts_sent := coalesce(v_gifts_sent, 0);
  v_gifts_recv := coalesce(v_gifts_recv, 0);

  select coalesce(hp.violations, 0)
  into v_violations
  from public.host_profiles hp
  where hp.user_id = p_user_id;
  v_violations := coalesce(v_violations, 0);

  select max(d.last_seen_at)
  into v_last_seen
  from public.device_push_tokens d
  where d.user_id = p_user_id and d.active = true;

  if v_last_seen is null then
    select p.updated_at into v_last_seen
    from public.profiles p where p.id = p_user_id;
  end if;

  case p_signal_key
    when 'verification' then
      return case when v_verified then 100 else 0 end;

    when 'host_status' then
      return case v_host
        when 'agency' then 100
        when 'independent' then 70
        when 'pending' then 30
        else least(20, greatest(0, (v_level - 1) * 2))
      end;

    when 'violations' then
      return greatest(0, 100 - (v_violations * 25));

    when 'activity_30d' then
      if v_last_seen is null then
        v_days := extract(epoch from (now() - coalesce(v_created, now()))) / 86400.0;
        if v_days <= 3 then
          return 40;
        end if;
        return 10;
      end if;
      v_days := extract(epoch from (now() - v_last_seen)) / 86400.0;
      if v_days <= 1 then
        v_activity := 100;
      elsif v_days <= 7 then
        v_activity := 80;
      elsif v_days <= 14 then
        v_activity := 55;
      elsif v_days <= 30 then
        v_activity := 35;
      elsif v_days <= 60 then
        v_activity := 15;
      else
        v_activity := 5;
      end if;
      return v_activity;

    when 'social_quality' then
      -- log ölçek: ~1000 takipçi ≈ 100
      v_social := least(100, ln(1 + v_followers::numeric) / ln(1001) * 100);
      return round(v_social, 2);

    when 'gift_presence' then
      v_gift := least(
        100,
        ln(1 + (v_gifts_sent + v_gifts_recv)::numeric) / ln(501) * 100
      );
      return round(v_gift, 2);

    else
      -- Bilinmeyen / henüz implement edilmemiş sinyal → 0 (katalogda weight durabilir)
      return 0;
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Ana yenileme RPC
-- ---------------------------------------------------------------------------
create or replace function public.hesap_degerini_yenile(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_weight_sum numeric := 0;
  v_weighted numeric := 0;
  v_score int := 0;
  v_label text;
  r record;
  v_sig numeric;
begin
  insert into public.user_profile_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  for r in
    select signal_key, weight
    from public.account_value_signals
    where is_active = true
  loop
    v_sig := public.hesap_degeri_sinyal_skoru(r.signal_key, p_user_id);
    v_weighted := v_weighted + (coalesce(v_sig, 0) * r.weight);
    v_weight_sum := v_weight_sum + r.weight;
  end loop;

  if v_weight_sum <= 0 then
    v_score := 0;
  else
    -- weights≈100, skor 0–100 → 0–1000
    v_score := least(1000, greatest(0, round(v_weighted / v_weight_sum * 10)::int));
  end if;

  v_label := public.hesap_degeri_etiketi(v_score);

  update public.user_profile_stats
  set
    account_value = v_score,
    account_value_label = v_label,
    account_value_version = 1,
    account_value_updated_at = now(),
    updated_at = now()
  where user_id = p_user_id;

  return v_score;
end;
$$;

grant execute on function public.hesap_degerini_yenile(uuid) to authenticated;
grant execute on function public.hesap_degeri_etiketi(int) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) Tetikleyiciler
-- ---------------------------------------------------------------------------
create or replace function public.hesap_degeri_profil_tetik()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.hesap_degerini_yenile(new.id);
  return new;
end;
$$;

drop trigger if exists hesap_degeri_profil_sonrasi on public.profiles;
create trigger hesap_degeri_profil_sonrasi
  after insert or update of is_verified, level, updated_at
  on public.profiles
  for each row
  execute function public.hesap_degeri_profil_tetik();

create or replace function public.hesap_degeri_stats_tetik()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Yalnızca sinyal girdileri değişince; skor yazımı döngüye girmesin
  if tg_op = 'UPDATE'
     and new.followers_count is not distinct from old.followers_count
     and new.total_gifts_sent is not distinct from old.total_gifts_sent
     and new.total_gifts_received is not distinct from old.total_gifts_received
     and new.host_status is not distinct from old.host_status
  then
    return new;
  end if;
  perform public.hesap_degerini_yenile(new.user_id);
  return new;
end;
$$;

-- INSERT tetiklenmez: yenile() içinde ilk satır insert'i özyinelemeye yol açmasın
drop trigger if exists hesap_degeri_stats_sonrasi on public.user_profile_stats;
create trigger hesap_degeri_stats_sonrasi
  after update of followers_count, total_gifts_sent, total_gifts_received, host_status
  on public.user_profile_stats
  for each row
  execute function public.hesap_degeri_stats_tetik();

create or replace function public.hesap_degeri_host_tetik()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.hesap_degerini_yenile(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists hesap_degeri_host_sonrasi on public.host_profiles;
create trigger hesap_degeri_host_sonrasi
  after insert or update of violations, status, agency_id
  on public.host_profiles
  for each row
  execute function public.hesap_degeri_host_tetik();

create or replace function public.hesap_degeri_cihaz_tetik()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    perform public.hesap_degerini_yenile(new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists hesap_degeri_cihaz_sonrasi on public.device_push_tokens;
create trigger hesap_degeri_cihaz_sonrasi
  after insert or update of last_seen_at, active, user_id
  on public.device_push_tokens
  for each row
  execute function public.hesap_degeri_cihaz_tetik();

-- ---------------------------------------------------------------------------
-- 7) Mevcut kullanıcıları doldur
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select user_id from public.user_profile_stats
  loop
    perform public.hesap_degerini_yenile(r.user_id);
  end loop;
end;
$$;
