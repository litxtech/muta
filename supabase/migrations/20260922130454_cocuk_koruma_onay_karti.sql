-- Çocuk Koruma onay kartı: tek seferlik 18+ beyanı / ret → hesap kapatma
-- Admin: onay verenler / vermeyenler listesi

alter table public.profiles
  add column if not exists child_protection_consent_status text
    check (child_protection_consent_status is null
      or child_protection_consent_status in ('approved', 'declined')),
  add column if not exists child_protection_consent_at timestamptz;

comment on column public.profiles.child_protection_consent_status is
  'Tek seferlik çocuk koruma kartı: approved | declined | null=henüz yok';

create table if not exists public.cocuk_koruma_onaylari (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  decision text not null check (decision in ('approved', 'declined')),
  decided_at timestamptz not null default now(),
  display_name_snapshot text,
  username_snapshot text,
  public_user_id_snapshot text,
  locale text,
  app_version text,
  constraint cocuk_koruma_onaylari_user_unique unique (user_id)
);

create index if not exists cocuk_koruma_onaylari_decision_idx
  on public.cocuk_koruma_onaylari (decision, decided_at desc);

alter table public.cocuk_koruma_onaylari enable row level security;

drop policy if exists cocuk_koruma_onaylari_select_own on public.cocuk_koruma_onaylari;
create policy cocuk_koruma_onaylari_select_own
  on public.cocuk_koruma_onaylari
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.ben_admin_miyim()
  );

revoke insert, update, delete on public.cocuk_koruma_onaylari from authenticated, anon;
grant select on public.cocuk_koruma_onaylari to authenticated;

create or replace function public.cocuk_koruma_onay_durumu()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_deleted timestamptz;
  v_banned timestamptz;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'kod', 'not_authenticated');
  end if;

  select
    child_protection_consent_status,
    deleted_at,
    banned_at
  into v_status, v_deleted, v_banned
  from public.profiles
  where id = v_uid;

  if not found then
    return jsonb_build_object('ok', true, 'gerekli', false, 'kod', 'no_profile');
  end if;

  if v_deleted is not null or v_banned is not null then
    return jsonb_build_object('ok', true, 'gerekli', false, 'kod', 'inactive');
  end if;

  if v_status = 'approved' then
    return jsonb_build_object('ok', true, 'gerekli', false, 'status', 'approved');
  end if;

  if v_status = 'declined' then
    return jsonb_build_object('ok', true, 'gerekli', false, 'status', 'declined');
  end if;

  return jsonb_build_object('ok', true, 'gerekli', true, 'status', null);
end;
$$;

grant execute on function public.cocuk_koruma_onay_durumu() to authenticated;

create or replace function public.cocuk_koruma_onayla(
  p_locale text default null,
  p_app_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_display text;
  v_username text;
  v_public text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'kod', 'not_authenticated');
  end if;

  select
    child_protection_consent_status,
    display_name,
    username,
    public_user_id
  into v_status, v_display, v_username, v_public
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'kod', 'no_profile');
  end if;

  if v_status = 'approved' then
    return jsonb_build_object('ok', true, 'kod', 'already_approved');
  end if;

  if v_status = 'declined' then
    return jsonb_build_object('ok', false, 'kod', 'already_declined');
  end if;

  insert into public.cocuk_koruma_onaylari (
    user_id,
    decision,
    display_name_snapshot,
    username_snapshot,
    public_user_id_snapshot,
    locale,
    app_version
  ) values (
    v_uid,
    'approved',
    v_display,
    v_username,
    v_public,
    nullif(trim(p_locale), ''),
    nullif(trim(p_app_version), '')
  )
  on conflict (user_id) do nothing;

  update public.profiles set
    child_protection_consent_status = 'approved',
    child_protection_consent_at = now(),
    updated_at = now()
  where id = v_uid;

  return jsonb_build_object('ok', true, 'kod', 'approved');
end;
$$;

grant execute on function public.cocuk_koruma_onayla(text, text) to authenticated;

create or replace function public.cocuk_koruma_reddet(
  p_locale text default null,
  p_app_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_display text;
  v_username text;
  v_public text;
  v_sil jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'kod', 'not_authenticated');
  end if;

  select
    child_protection_consent_status,
    display_name,
    username,
    public_user_id
  into v_status, v_display, v_username, v_public
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'kod', 'no_profile');
  end if;

  if v_status = 'approved' then
    return jsonb_build_object('ok', false, 'kod', 'already_approved');
  end if;

  if v_status = 'declined' then
    v_sil := public.hesap_sil_istegi('child_protection_under_18');
    return jsonb_build_object(
      'ok', true,
      'kod', 'already_declined',
      'hesap', v_sil
    );
  end if;

  insert into public.cocuk_koruma_onaylari (
    user_id,
    decision,
    display_name_snapshot,
    username_snapshot,
    public_user_id_snapshot,
    locale,
    app_version
  ) values (
    v_uid,
    'declined',
    v_display,
    v_username,
    v_public,
    nullif(trim(p_locale), ''),
    nullif(trim(p_app_version), '')
  )
  on conflict (user_id) do update set
    decision = excluded.decision,
    decided_at = now(),
    display_name_snapshot = excluded.display_name_snapshot,
    username_snapshot = excluded.username_snapshot,
    public_user_id_snapshot = excluded.public_user_id_snapshot,
    locale = excluded.locale,
    app_version = excluded.app_version;

  update public.profiles set
    child_protection_consent_status = 'declined',
    child_protection_consent_at = now(),
    updated_at = now()
  where id = v_uid;

  v_sil := public.hesap_sil_istegi('child_protection_under_18');

  return jsonb_build_object(
    'ok', true,
    'kod', 'declined',
    'hesap', v_sil
  );
end;
$$;

grant execute on function public.cocuk_koruma_reddet(text, text) to authenticated;

create or replace function public.admin_cocuk_koruma_listesi(
  p_decision text default null,
  p_limit int default 200
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 200), 500));
  v_rows jsonb;
  v_approved int;
  v_declined int;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  if p_decision is not null
     and p_decision not in ('approved', 'declined') then
    raise exception 'Invalid decision filter';
  end if;

  select count(*) filter (where decision = 'approved'),
         count(*) filter (where decision = 'declined')
  into v_approved, v_declined
  from public.cocuk_koruma_onaylari;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  into v_rows
  from (
    select
      o.id,
      o.user_id,
      o.decision,
      o.decided_at,
      o.display_name_snapshot,
      o.username_snapshot,
      o.public_user_id_snapshot,
      o.locale,
      o.app_version,
      p.display_name,
      p.username,
      p.avatar_url,
      p.deleted_at,
      p.banned_at
    from public.cocuk_koruma_onaylari o
    left join public.profiles p on p.id = o.user_id
    where p_decision is null or o.decision = p_decision
    order by o.decided_at desc
    limit v_limit
  ) t;

  return jsonb_build_object(
    'ok', true,
    'approved_count', coalesce(v_approved, 0),
    'declined_count', coalesce(v_declined, 0),
    'rows', v_rows
  );
end;
$$;

grant execute on function public.admin_cocuk_koruma_listesi(text, int) to authenticated;
