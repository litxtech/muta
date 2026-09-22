-- Ajans Yönetim V2 Faz1: RBAC, CRM, invites, audit, RLS sıkılaştırma
-- DROP TABLE yok; production verisi korunur.

-- ---------------------------------------------------------------------------
-- agencies: username + verified
-- ---------------------------------------------------------------------------
alter table public.agencies
  add column if not exists username text,
  add column if not exists is_verified boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'agencies_username_len'
  ) then
    alter table public.agencies
      add constraint agencies_username_len
      check (username is null or char_length(username) between 3 and 32);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'agencies_username_format'
  ) then
    alter table public.agencies
      add constraint agencies_username_format
      check (
        username is null
        or username ~ '^[a-z0-9]([a-z0-9_]*[a-z0-9])?$'
      );
  end if;
end $$;

create unique index if not exists agencies_username_uidx
  on public.agencies (lower(username))
  where username is not null;

-- Seviye: platinum ekle (royal/legendary korunur)
insert into public.agency_levels (code, name, sort_order, is_active)
values ('platinum', 'Platinum', 35, true)
on conflict (code) do nothing;

create table if not exists public.agency_level_criteria (
  level_code text primary key references public.agency_levels(code) on delete cascade,
  min_active_hosts int not null default 0,
  min_monthly_live_hours numeric(10,2) not null default 0,
  min_monthly_room_hours numeric(10,2) not null default 0,
  min_monthly_score bigint not null default 0,
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.agency_level_criteria (level_code, min_active_hosts, min_monthly_live_hours, min_monthly_room_hours, min_monthly_score)
values
  ('bronze', 0, 0, 0, 0),
  ('silver', 5, 20, 40, 1000),
  ('gold', 12, 60, 120, 5000),
  ('platinum', 20, 120, 300, 15000),
  ('diamond', 35, 200, 500, 40000),
  ('royal', 50, 350, 800, 80000),
  ('legendary', 80, 500, 1200, 150000)
on conflict (level_code) do nothing;

alter table public.agency_level_criteria enable row level security;
drop policy if exists "agency_level_criteria_select" on public.agency_level_criteria;
create policy "agency_level_criteria_select"
  on public.agency_level_criteria for select to authenticated
  using (true);
grant select on public.agency_level_criteria to authenticated;

-- ---------------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------------
create table if not exists public.agency_permissions (
  code text primary key,
  description text not null default '',
  sort_order int not null default 0
);

insert into public.agency_permissions (code, description, sort_order) values
  ('agency.view_dashboard', 'Dashboard görüntüle', 10),
  ('agency.manage_profile', 'Ajans profilini yönet', 20),
  ('agency.manage_members', 'Üyeleri yönet', 30),
  ('agency.manage_applications', 'Başvuruları yönet', 40),
  ('agency.manage_invites', 'Davetleri yönet', 50),
  ('agency.manage_teams', 'Ekipleri yönet', 60),
  ('agency.manage_roles', 'Rolleri yönet', 70),
  ('agency.manage_schedule', 'Program yönet', 80),
  ('agency.manage_events', 'Etkinlikleri yönet', 90),
  ('agency.manage_announcements', 'Duyuru gönder', 100),
  ('agency.manage_tasks', 'Görevleri yönet', 110),
  ('agency.view_analytics', 'Analitik gör', 120),
  ('agency.view_finance', 'İşlemleri gör', 130),
  ('agency.manage_coin_operations', 'Coin işlemi yap', 140),
  ('agency.manage_support', 'Destek taleplerini gör', 150),
  ('agency.view_audit', 'Audit log gör', 160),
  ('agency.manage_settings', 'Ayarları yönet', 170),
  ('agency.manage_rooms', 'Ses odası kur', 180),
  ('agency.view_live_ops', 'Canlı operasyonu gör', 190),
  ('agency.manage_crm', 'CRM not/etiket yönet', 200)
on conflict (code) do nothing;

create table if not exists public.agency_role_templates (
  role_code text primary key,
  name text not null,
  is_system boolean not null default true,
  sort_order int not null default 0
);

insert into public.agency_role_templates (role_code, name, is_system, sort_order) values
  ('OWNER', 'Sahip', true, 1),
  ('MANAGER', 'Yönetici', true, 2),
  ('MODERATOR', 'Moderatör', true, 3),
  ('HOST_MANAGER', 'Host Sorumlusu', true, 4),
  ('MEMBER', 'Üye', true, 5)
on conflict (role_code) do nothing;

create table if not exists public.agency_role_default_permissions (
  role_code text not null references public.agency_role_templates(role_code) on delete cascade,
  permission_code text not null references public.agency_permissions(code) on delete cascade,
  primary key (role_code, permission_code)
);

-- OWNER: tüm yetkiler
insert into public.agency_role_default_permissions (role_code, permission_code)
select 'OWNER', p.code from public.agency_permissions p
on conflict do nothing;

-- MANAGER
insert into public.agency_role_default_permissions (role_code, permission_code)
select 'MANAGER', x
from unnest(array[
  'agency.view_dashboard','agency.manage_profile','agency.manage_members',
  'agency.manage_applications','agency.manage_invites','agency.manage_teams',
  'agency.manage_schedule','agency.manage_events','agency.manage_announcements',
  'agency.manage_tasks','agency.view_analytics','agency.view_finance',
  'agency.manage_support','agency.view_audit','agency.manage_rooms',
  'agency.view_live_ops','agency.manage_crm'
]) as x
on conflict do nothing;

-- MODERATOR
insert into public.agency_role_default_permissions (role_code, permission_code)
select 'MODERATOR', x
from unnest(array[
  'agency.view_dashboard','agency.manage_members','agency.manage_applications',
  'agency.manage_announcements','agency.view_live_ops','agency.manage_rooms','agency.manage_crm'
]) as x
on conflict do nothing;

-- HOST_MANAGER
insert into public.agency_role_default_permissions (role_code, permission_code)
select 'HOST_MANAGER', x
from unnest(array[
  'agency.view_dashboard','agency.manage_members','agency.manage_schedule',
  'agency.manage_tasks','agency.view_live_ops','agency.manage_crm','agency.manage_rooms'
]) as x
on conflict do nothing;

-- MEMBER
insert into public.agency_role_default_permissions (role_code, permission_code)
select 'MEMBER', x
from unnest(array['agency.view_dashboard']) as x
on conflict do nothing;

create table if not exists public.agency_staff_roles (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_code text not null references public.agency_role_templates(role_code),
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, user_id)
);

create index if not exists agency_staff_roles_agency_idx
  on public.agency_staff_roles (agency_id, role_code);
create index if not exists agency_staff_roles_user_idx
  on public.agency_staff_roles (user_id);

-- Ajans bazlı özel yetki override (toggle)
create table if not exists public.agency_staff_permission_overrides (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_code text not null references public.agency_permissions(code) on delete cascade,
  granted boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (agency_id, user_id, permission_code)
);

-- Mevcut owner'lara OWNER rolü seed
insert into public.agency_staff_roles (agency_id, user_id, role_code, assigned_by)
select a.id, a.owner_id, 'OWNER', a.owner_id
from public.agencies a
where a.status <> 'closed'
on conflict (agency_id, user_id) do update
  set role_code = 'OWNER', updated_at = now();

-- ---------------------------------------------------------------------------
-- CRM (host_profiles 1:1, public profile'a çıkmaz)
-- ---------------------------------------------------------------------------
create table if not exists public.agency_member_crm (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  agency_status text not null default 'active'
    check (agency_status in ('active','passive','new','trial','leave','suspended')),
  tags text[] not null default '{}',
  notes text not null default '',
  assigned_manager_id uuid references public.profiles(id) on delete set null,
  mentor_id uuid references public.profiles(id) on delete set null,
  follow_up_at timestamptz,
  onboarding_stage text not null default 'active'
    check (onboarding_stage in (
      'applied','accepted','rules','profile','training','trial','active'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agency_id, user_id),
  constraint agency_member_crm_notes_len check (char_length(notes) <= 8000)
);

create index if not exists agency_member_crm_manager_idx
  on public.agency_member_crm (agency_id, assigned_manager_id);
create index if not exists agency_member_crm_status_idx
  on public.agency_member_crm (agency_id, agency_status);

-- Mevcut üyeler için CRM satırı
insert into public.agency_member_crm (agency_id, user_id, agency_status, onboarding_stage)
select hp.agency_id, hp.user_id,
  case when hp.status = 'suspended' then 'suspended' else 'active' end,
  'active'
from public.host_profiles hp
where hp.agency_id is not null and hp.status in ('agency', 'suspended')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Multi-invite (eski agencies.invite_code fallback kalır)
-- ---------------------------------------------------------------------------
create table if not exists public.agency_invites (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  invite_code text not null,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  max_uses int, -- null = sınırsız
  used_count int not null default 0,
  status text not null default 'active'
    check (status in ('active','exhausted','expired','revoked')),
  label text,
  created_at timestamptz not null default now(),
  unique (invite_code)
);

create index if not exists agency_invites_agency_idx
  on public.agency_invites (agency_id, status, created_at desc);

-- Mevcut tek kodu agency_invites'a taşı
insert into public.agency_invites (agency_id, invite_code, created_by, max_uses, status, label)
select a.id, a.invite_code, a.owner_id, null, 'active', 'Varsayılan'
from public.agencies a
where a.invite_code is not null
  and a.invite_code <> ''
  and not exists (
    select 1 from public.agency_invites i where i.invite_code = a.invite_code
  );

create table if not exists public.agency_invite_events (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid references public.agency_invites(id) on delete set null,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  event_type text not null
    check (event_type in ('view','scan','open','apply','accept')),
  source text not null default 'unknown'
    check (source in ('qr','deep_link','discover','direct','unknown')),
  created_at timestamptz not null default now()
);

create index if not exists agency_invite_events_agency_idx
  on public.agency_invite_events (agency_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
create table if not exists public.agency_audit_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  summary text not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agency_audit_logs_agency_idx
  on public.agency_audit_logs (agency_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Permission helpers
-- ---------------------------------------------------------------------------
create or replace function public.agency_audit_yaz(
  p_agency_id uuid,
  p_action text,
  p_summary text,
  p_target_user_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agency_audit_logs (
    agency_id, actor_id, action, summary, target_user_id, details
  ) values (
    p_agency_id, auth.uid(), p_action, p_summary, p_target_user_id,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

create or replace function public.agency_has_permission(
  p_agency_id uuid,
  p_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_role text;
  v_override boolean;
begin
  if v_uid is null then return false; end if;
  if public.ben_admin_miyim() then return true; end if;

  select owner_id into v_owner from public.agencies where id = p_agency_id;
  if not found then return false; end if;
  if v_owner = v_uid then return true; end if;

  select granted into v_override
  from public.agency_staff_permission_overrides
  where agency_id = p_agency_id
    and user_id = v_uid
    and permission_code = p_permission;
  if found then return v_override; end if;

  select role_code into v_role
  from public.agency_staff_roles
  where agency_id = p_agency_id and user_id = v_uid;
  if not found then
    -- Üye ise MEMBER varsayılanı
    if exists (
      select 1 from public.host_profiles hp
      where hp.agency_id = p_agency_id
        and hp.user_id = v_uid
        and hp.status = 'agency'
    ) then
      v_role := 'MEMBER';
    else
      return false;
    end if;
  end if;

  if v_role = 'OWNER' then return true; end if;

  return exists (
    select 1 from public.agency_role_default_permissions d
    where d.role_code = v_role and d.permission_code = p_permission
  );
end;
$$;

create or replace function public.agency_require_permission(
  p_agency_id uuid,
  p_permission text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.agency_has_permission(p_agency_id, p_permission) then
    raise exception 'Forbidden';
  end if;
end;
$$;

-- Geriye uyumluluk: sahip veya permission veya admin
create or replace function public.ajans_sahibi_veya_admin(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.ben_admin_miyim()
    or exists (
      select 1 from public.agencies a
      where a.id = p_agency_id and a.owner_id = auth.uid()
    )
    or public.agency_has_permission(p_agency_id, 'agency.manage_settings');
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.agency_staff_roles enable row level security;
alter table public.agency_staff_permission_overrides enable row level security;
alter table public.agency_member_crm enable row level security;
alter table public.agency_invites enable row level security;
alter table public.agency_invite_events enable row level security;
alter table public.agency_audit_logs enable row level security;
alter table public.agency_permissions enable row level security;
alter table public.agency_role_templates enable row level security;
alter table public.agency_role_default_permissions enable row level security;

drop policy if exists "agency_permissions_read" on public.agency_permissions;
create policy "agency_permissions_read"
  on public.agency_permissions for select to authenticated using (true);

drop policy if exists "agency_role_templates_read" on public.agency_role_templates;
create policy "agency_role_templates_read"
  on public.agency_role_templates for select to authenticated using (true);

drop policy if exists "agency_role_defaults_read" on public.agency_role_default_permissions;
create policy "agency_role_defaults_read"
  on public.agency_role_default_permissions for select to authenticated using (true);

drop policy if exists "agency_staff_roles_select" on public.agency_staff_roles;
create policy "agency_staff_roles_select"
  on public.agency_staff_roles for select to authenticated
  using (
    user_id = auth.uid()
    or public.agency_has_permission(agency_id, 'agency.manage_roles')
    or public.agency_has_permission(agency_id, 'agency.manage_members')
  );

drop policy if exists "agency_crm_select" on public.agency_member_crm;
create policy "agency_crm_select"
  on public.agency_member_crm for select to authenticated
  using (
    user_id = auth.uid()
    or public.agency_has_permission(agency_id, 'agency.manage_crm')
    or public.agency_has_permission(agency_id, 'agency.manage_members')
  );

drop policy if exists "agency_invites_select" on public.agency_invites;
create policy "agency_invites_select"
  on public.agency_invites for select to authenticated
  using (public.agency_has_permission(agency_id, 'agency.manage_invites'));

drop policy if exists "agency_audit_select" on public.agency_audit_logs;
create policy "agency_audit_select"
  on public.agency_audit_logs for select to authenticated
  using (public.agency_has_permission(agency_id, 'agency.view_audit'));

grant select on public.agency_permissions to authenticated;
grant select on public.agency_role_templates to authenticated;
grant select on public.agency_role_default_permissions to authenticated;
grant select on public.agency_staff_roles to authenticated;
grant select on public.agency_member_crm to authenticated;
grant select on public.agency_invites to authenticated;
grant select on public.agency_audit_logs to authenticated;

-- agency_rules: artık herkese açık değil
drop policy if exists "Agency rules select" on public.agency_rules;
create policy "Agency rules select"
  on public.agency_rules for select to authenticated
  using (
    public.ben_admin_miyim()
    or exists (
      select 1 from public.agencies a where a.id = agency_id and a.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.host_profiles hp
      where hp.agency_id = agency_rules.agency_id
        and hp.user_id = auth.uid()
        and hp.status = 'agency'
    )
    or public.agency_has_permission(agency_id, 'agency.manage_settings')
  );

-- invite_code sızıntısı: kolon erişimini RPC'ye bırakmak için view + revoke yok;
-- policy agencies'de zaten using(true). Güvenli yaklaşım: invite_code'u
-- security definer RPC dışında maskelemek için kolon grant'ını daraltamıyoruz
-- (PostgREST tüm kolonları kullanır). Bunun yerine invite lookup RPC zorunlu
-- ve agencies select'te invite_code null yapan helper view.

create or replace view public.agencies_public
with (security_invoker = true)
as
select
  id, agency_public_id, name, logo_url, banner_url, country, description,
  owner_id, level_code, host_count, total_gifts, monthly_score, ranking,
  trust_tier, is_coin_distributor, status, slogan, website_url, username,
  is_verified, created_at, updated_at,
  case
    when owner_id = auth.uid() or public.ben_admin_miyim()
      or public.agency_has_permission(id, 'agency.manage_invites')
    then invite_code
    else null
  end as invite_code
from public.agencies;

grant select on public.agencies_public to authenticated;

-- ---------------------------------------------------------------------------
-- Staff / CRM / Invite RPCs
-- ---------------------------------------------------------------------------
create or replace function public.ajans_izinlerim(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := 'none';
  v_perms jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  if public.ben_admin_miyim()
     or exists (select 1 from public.agencies a where a.id = p_agency_id and a.owner_id = v_uid)
  then
    v_role := 'OWNER';
    select coalesce(jsonb_agg(code order by sort_order), '[]'::jsonb)
      into v_perms from public.agency_permissions;
  else
    select role_code into v_role
    from public.agency_staff_roles
    where agency_id = p_agency_id and user_id = v_uid;
    if not found then
      if exists (
        select 1 from public.host_profiles
        where agency_id = p_agency_id and user_id = v_uid and status = 'agency'
      ) then v_role := 'MEMBER'; else v_role := 'none'; end if;
    end if;
    if v_role <> 'none' then
      select coalesce(jsonb_agg(p.code order by p.sort_order), '[]'::jsonb) into v_perms
      from public.agency_permissions p
      where public.agency_has_permission(p_agency_id, p.code);
    end if;
  end if;

  return jsonb_build_object('role', v_role, 'permissions', v_perms);
end;
$$;

grant execute on function public.ajans_izinlerim(uuid) to authenticated;

create or replace function public.ajans_staff_ata(
  p_agency_id uuid,
  p_user_id uuid,
  p_role_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_roles');
  if p_role_code = 'OWNER' then raise exception 'OWNER rolü atanamaz'; end if;
  if not exists (select 1 from public.agency_role_templates where role_code = p_role_code) then
    raise exception 'Geçersiz rol';
  end if;
  if not exists (
    select 1 from public.host_profiles
    where agency_id = p_agency_id and user_id = p_user_id and status = 'agency'
  ) and not exists (
    select 1 from public.agencies where id = p_agency_id and owner_id = p_user_id
  ) then
    raise exception 'Kullanıcı ajans üyesi değil';
  end if;

  insert into public.agency_staff_roles (agency_id, user_id, role_code, assigned_by)
  values (p_agency_id, p_user_id, p_role_code, auth.uid())
  on conflict (agency_id, user_id) do update set
    role_code = excluded.role_code,
    assigned_by = auth.uid(),
    updated_at = now();

  perform public.agency_audit_yaz(
    p_agency_id, 'staff_assign',
    'Staff rol atandı: ' || p_role_code, p_user_id,
    jsonb_build_object('role', p_role_code)
  );

  return jsonb_build_object('ok', true, 'role', p_role_code);
end;
$$;

grant execute on function public.ajans_staff_ata(uuid, uuid, text) to authenticated;

create or replace function public.ajans_staff_yetki_ayarla(
  p_agency_id uuid,
  p_user_id uuid,
  p_permission text,
  p_granted boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_roles');
  if not exists (select 1 from public.agency_permissions where code = p_permission) then
    raise exception 'Geçersiz yetki';
  end if;

  insert into public.agency_staff_permission_overrides (
    agency_id, user_id, permission_code, granted, updated_by
  ) values (
    p_agency_id, p_user_id, p_permission, p_granted, auth.uid()
  )
  on conflict (agency_id, user_id, permission_code) do update set
    granted = excluded.granted,
    updated_by = auth.uid(),
    updated_at = now();

  perform public.agency_audit_yaz(
    p_agency_id, 'staff_permission',
    'Yetki override: ' || p_permission, p_user_id,
    jsonb_build_object('permission', p_permission, 'granted', p_granted)
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.ajans_staff_yetki_ayarla(uuid, uuid, text, boolean) to authenticated;

create or replace function public.ajans_crm_guncelle(
  p_agency_id uuid,
  p_user_id uuid,
  p_agency_status text default null,
  p_tags text[] default null,
  p_notes text default null,
  p_assigned_manager_id uuid default null,
  p_mentor_id uuid default null,
  p_follow_up_at timestamptz default null,
  p_onboarding_stage text default null,
  p_clear_manager boolean default false,
  p_clear_mentor boolean default false,
  p_clear_follow_up boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_crm');

  if not exists (
    select 1 from public.host_profiles
    where agency_id = p_agency_id and user_id = p_user_id
  ) then
    raise exception 'Üye bulunamadı';
  end if;

  insert into public.agency_member_crm (agency_id, user_id)
  values (p_agency_id, p_user_id)
  on conflict do nothing;

  update public.agency_member_crm set
    agency_status = coalesce(p_agency_status, agency_status),
    tags = coalesce(p_tags, tags),
    notes = coalesce(p_notes, notes),
    assigned_manager_id = case
      when p_clear_manager then null
      when p_assigned_manager_id is not null then p_assigned_manager_id
      else assigned_manager_id end,
    mentor_id = case
      when p_clear_mentor then null
      when p_mentor_id is not null then p_mentor_id
      else mentor_id end,
    follow_up_at = case
      when p_clear_follow_up then null
      when p_follow_up_at is not null then p_follow_up_at
      else follow_up_at end,
    onboarding_stage = coalesce(p_onboarding_stage, onboarding_stage),
    updated_at = now()
  where agency_id = p_agency_id and user_id = p_user_id;

  -- Ajans askı: host_profiles.status'u platform ban yapmaz
  if p_agency_status = 'suspended' then
    update public.host_profiles
    set status = 'suspended', updated_at = now()
    where user_id = p_user_id and agency_id = p_agency_id;
  elsif p_agency_status is not null and p_agency_status <> 'suspended' then
    update public.host_profiles
    set status = 'agency', updated_at = now()
    where user_id = p_user_id and agency_id = p_agency_id and status = 'suspended';
  end if;

  perform public.agency_audit_yaz(
    p_agency_id, 'crm_update', 'CRM güncellendi', p_user_id,
    jsonb_build_object('status', p_agency_status, 'stage', p_onboarding_stage)
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.ajans_crm_guncelle(
  uuid, uuid, text, text[], text, uuid, uuid, timestamptz, text, boolean, boolean, boolean
) to authenticated;

create or replace function public.ajans_davet_olustur(
  p_agency_id uuid,
  p_max_uses int default null,
  p_expires_at timestamptz default null,
  p_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_invites');

  v_code := upper(substr(md5(random()::text || clock_timestamp()::text || p_agency_id::text), 1, 10));

  insert into public.agency_invites (
    agency_id, invite_code, created_by, expires_at, max_uses, label
  ) values (
    p_agency_id, v_code, auth.uid(), p_expires_at, p_max_uses, nullif(trim(coalesce(p_label, '')), '')
  )
  returning id into v_id;

  perform public.agency_audit_yaz(
    p_agency_id, 'invite_create', 'Davet oluşturuldu', null,
    jsonb_build_object('invite_id', v_id, 'code', v_code, 'max_uses', p_max_uses)
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'invite_code', v_code,
    'max_uses', p_max_uses,
    'expires_at', p_expires_at
  );
end;
$$;

grant execute on function public.ajans_davet_olustur(uuid, int, timestamptz, text) to authenticated;

create or replace function public.ajans_davet_listesi(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.manage_invites');

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', i.id,
      'invite_code', i.invite_code,
      'expires_at', i.expires_at,
      'max_uses', i.max_uses,
      'used_count', i.used_count,
      'status', i.status,
      'label', i.label,
      'created_at', i.created_at
    ) order by i.created_at desc)
    from public.agency_invites i
    where i.agency_id = p_agency_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.ajans_davet_listesi(uuid) to authenticated;

create or replace function public.ajans_davet_iptal(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select agency_id into v_agency from public.agency_invites where id = p_invite_id;
  if not found then raise exception 'Davet bulunamadı'; end if;
  perform public.agency_require_permission(v_agency, 'agency.manage_invites');

  update public.agency_invites set status = 'revoked' where id = p_invite_id;
  perform public.agency_audit_yaz(v_agency, 'invite_revoke', 'Davet iptal', null,
    jsonb_build_object('invite_id', p_invite_id));
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.ajans_davet_iptal(uuid) to authenticated;

-- Join akışında multi-invite desteği (mevcut agencies.invite_code fallback)
create or replace function public.ajans_davet_kodu_coz(p_kod text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_kod text := nullif(upper(trim(coalesce(p_kod, ''))), '');
  v_agency uuid;
  v_inv public.agency_invites%rowtype;
begin
  if v_kod is null then return null; end if;

  select * into v_inv from public.agency_invites
  where invite_code = v_kod and status = 'active';
  if found then
    if v_inv.expires_at is not null and v_inv.expires_at < now() then
      return null;
    end if;
    if v_inv.max_uses is not null and v_inv.used_count >= v_inv.max_uses then
      return null;
    end if;
    return v_inv.agency_id;
  end if;

  select id into v_agency from public.agencies
  where invite_code = v_kod and status = 'active';
  return v_agency;
end;
$$;

create or replace function public.ajans_audit_listesi(
  p_agency_id uuid,
  p_limit int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.agency_require_permission(p_agency_id, 'agency.view_audit');

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id,
      'action', l.action,
      'summary', l.summary,
      'actor_id', l.actor_id,
      'target_user_id', l.target_user_id,
      'details', l.details,
      'created_at', l.created_at,
      'actor_name', coalesce(p.display_name, p.username)
    ) order by l.created_at desc)
    from (
      select * from public.agency_audit_logs
      where agency_id = p_agency_id
      order by created_at desc
      limit v_limit
    ) l
    left join public.profiles p on p.id = l.actor_id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.ajans_audit_listesi(uuid, int) to authenticated;

-- Multi-invite: join RPC uses agency_invites + legacy agencies.invite_code
create or replace function public.ajans_uye_basvurusu_olustur(
  p_agency_id uuid default null,
  p_invite_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_guest boolean;
  v_agency public.agencies%rowtype;
  v_host public.host_profiles%rowtype;
  v_mevcut uuid;
  v_ad text;
  v_row public.host_applications%rowtype;
  v_kod text := nullif(upper(trim(coalesce(p_invite_code, ''))), '');
  v_resolved uuid;
  v_invite_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select is_guest into v_guest from public.profiles where id = v_uid;
  if coalesce(v_guest, false) then raise exception 'Misafir ajansa katilamaz'; end if;

  if p_agency_id is not null then
    select * into v_agency from public.agencies where id = p_agency_id;
  elsif v_kod is not null then
    v_resolved := public.ajans_davet_kodu_coz(v_kod);
    if v_resolved is null then raise exception 'Ajans bulunamadi'; end if;
    select * into v_agency from public.agencies where id = v_resolved;
    select id into v_invite_id from public.agency_invites
    where invite_code = v_kod and status = 'active';
  else
    raise exception 'Ajans veya davet kodu gerekli';
  end if;

  if not found then raise exception 'Ajans bulunamadi'; end if;
  if v_agency.status <> 'active' then raise exception 'Ajans aktif degil'; end if;
  if v_agency.owner_id = v_uid then raise exception 'Bu ajansin sahibisin'; end if;

  select * into v_host from public.host_profiles where user_id = v_uid;
  if found and v_host.status = 'agency' and v_host.agency_id is not null then
    if v_host.agency_id = v_agency.id then
      raise exception 'Zaten bu ajansin uyesin';
    end if;
    raise exception 'Baska bir ajansa kayitlisin';
  end if;

  select ha.agency_id into v_mevcut
  from public.host_applications ha
  where ha.user_id = v_uid
    and ha.path = 'join_agency'
    and ha.status = 'agency_review'
  order by ha.created_at desc
  limit 1;

  if v_mevcut is not null then
    if v_mevcut = v_agency.id then
      raise exception 'Bu ajansa zaten bekleyen basvurun var';
    end if;
    raise exception 'Bekleyen baska bir ajans basvurun var';
  end if;

  insert into public.host_applications (user_id, path, agency_id, invite_code, status)
  values (
    v_uid,
    'join_agency',
    v_agency.id,
    coalesce(v_kod, v_agency.invite_code),
    'agency_review'
  )
  returning * into v_row;

  if v_invite_id is not null then
    update public.agency_invites
    set used_count = used_count + 1,
        status = case
          when max_uses is not null and used_count + 1 >= max_uses then 'exhausted'
          else status
        end
    where id = v_invite_id;
    insert into public.agency_invite_events (invite_id, agency_id, event_type, source)
    values (
      v_invite_id,
      v_agency.id,
      'apply',
      case when v_kod is not null then 'deep_link' else 'direct' end
    );
  end if;

  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.username), ''), 'Bir kullanici')
  into v_ad
  from public.profiles p
  where p.id = v_uid;

  if v_agency.owner_id is distinct from v_uid then
    perform public.bildirim_kuyruga_ekle(
      v_agency.owner_id,
      'system',
      'Ajans katilim basvurusu',
      coalesce(v_ad, 'Bir kullanici') || ' ' || v_agency.name || ' ajansina katilmak istiyor.',
      '/ajans/' || v_agency.id::text || '/basvurular',
      jsonb_build_object(
        'type', 'agency_host_apply',
        'agency_id', v_agency.id,
        'application_id', v_row.id
      )
    );
  end if;

  return jsonb_build_object('ok', true, 'application_id', v_row.id, 'agency_id', v_agency.id);
end;
$$;

grant execute on function public.ajans_uye_basvurusu_olustur(uuid, text) to authenticated;

