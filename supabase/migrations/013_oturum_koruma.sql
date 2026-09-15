-- Oturum koruma: ban, hesap silme, cihaz oturum iptali
-- Manuel cikis disinda oturum uygulama tarafinda otomatik sonlanmaz.
-- Run after 001–012

alter table public.profiles
  add column if not exists banned_at timestamptz,
  add column if not exists ban_reason text,
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_requested_at timestamptz;

create index if not exists profiles_banned_idx
  on public.profiles (banned_at) where banned_at is not null;
create index if not exists profiles_deleted_idx
  on public.profiles (deleted_at) where deleted_at is not null;

-- Oturum / hesap durumu (mobil her acilista kontrol)
create or replace function public.oturum_koruma_durumu()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.profiles%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'kod', 'no_auth');
  end if;

  select * into v_row from public.profiles where id = v_uid;
  if not found then
    return jsonb_build_object('ok', false, 'kod', 'no_profile');
  end if;

  if v_row.deleted_at is not null then
    return jsonb_build_object(
      'ok', false,
      'kod', 'deleted',
      'mesaj', 'Hesap silinmis',
      'deleted_at', v_row.deleted_at
    );
  end if;

  if v_row.banned_at is not null then
    return jsonb_build_object(
      'ok', false,
      'kod', 'banned',
      'mesaj', coalesce(v_row.ban_reason, 'Hesap askida'),
      'banned_at', v_row.banned_at
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'kod', 'active',
    'oturum_koruma', true,
    'mesaj', 'Oturum kalici; sadece manuel cikis / ban / silme sonlandirir'
  );
end;
$$;

-- Kullanici kendi hesabini silme istegi (soft delete + cihaz oturumlari)
create or replace function public.hesap_sil_istegi(p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  update public.profiles set
    deleted_at = now(),
    deletion_requested_at = now(),
    display_name = 'Silinmiş hesap',
    username = 'deleted_' || replace(id::text, '-', ''),
    avatar_url = null,
    bio = '',
    updated_at = now()
  where id = v_uid and deleted_at is null;

  update public.device_sessions
    set revoked_at = now()
  where user_id = v_uid and revoked_at is null;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    v_uid, 'account_delete_requested', 'medium',
    jsonb_build_object('reason', p_reason)
  );

  return jsonb_build_object('ok', true, 'kod', 'deleted');
end;
$$;

-- Platform ban (service_role / admin). Mobil dogrudan cagirmaz.
create or replace function public.kullanici_banla(
  p_user_id uuid,
  p_reason text default 'policy_violation'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then raise exception 'user required'; end if;

  update public.profiles set
    banned_at = now(),
    ban_reason = coalesce(nullif(trim(p_reason), ''), 'policy_violation'),
    updated_at = now()
  where id = p_user_id;

  update public.device_sessions
    set revoked_at = now()
  where user_id = p_user_id and revoked_at is null;

  insert into public.security_events (user_id, event_type, severity, metadata)
  values (
    p_user_id, 'account_banned', 'high',
    jsonb_build_object('reason', p_reason)
  );

  return jsonb_build_object('ok', true, 'kod', 'banned');
end;
$$;

create or replace function public.kullanici_ban_kaldir(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set
    banned_at = null,
    ban_reason = null,
    updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('ok', true, 'kod', 'unbanned');
end;
$$;

-- Kritik RPC'lerde ban/silinmis engeli (hediye ornegi genisletilebilir)
create or replace function public.hesap_aktif_mi(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id
      and banned_at is null
      and deleted_at is null
  );
$$;

grant execute on function public.oturum_koruma_durumu to authenticated;
grant execute on function public.hesap_sil_istegi to authenticated;
grant execute on function public.hesap_aktif_mi to authenticated;
grant execute on function public.kullanici_banla to service_role;
grant execute on function public.kullanici_ban_kaldir to service_role;
