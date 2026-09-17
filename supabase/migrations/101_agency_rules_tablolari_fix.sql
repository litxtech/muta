-- 067 işaretliydi ama agency_rules / agency_payment_templates ve
-- ilgili yönetim RPC'leri remote'da yoktu. Idempotent onarım.

-- ---------------------------------------------------------------------------
-- Ajans kurallari
-- ---------------------------------------------------------------------------
create table if not exists public.agency_rules (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  body text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_rules_body_len check (char_length(body) <= 8000)
);

drop trigger if exists agency_rules_updated_at on public.agency_rules;
create trigger agency_rules_updated_at
  before update on public.agency_rules
  for each row execute function public.set_updated_at();

alter table public.agency_rules enable row level security;

drop policy if exists "Agency rules select" on public.agency_rules;
create policy "Agency rules select"
  on public.agency_rules for select to authenticated
  using (true);

drop policy if exists "Agency rules owner write" on public.agency_rules;
create policy "Agency rules owner write"
  on public.agency_rules for all to authenticated
  using (
    exists (
      select 1 from public.agencies a
      where a.id = agency_id and (a.owner_id = auth.uid() or public.ben_admin_miyim())
    )
  )
  with check (
    exists (
      select 1 from public.agencies a
      where a.id = agency_id and (a.owner_id = auth.uid() or public.ben_admin_miyim())
    )
  );

grant select, insert, update, delete on public.agency_rules to authenticated;

-- ---------------------------------------------------------------------------
-- Ajans odeme sablonu
-- ---------------------------------------------------------------------------
create table if not exists public.agency_payment_templates (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  account_holder text not null default '',
  bank_name text not null default '',
  iban text not null default '',
  phone text not null default '',
  note text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_payment_iban_len check (
    iban = '' or char_length(replace(iban, ' ', '')) between 15 and 34
  ),
  constraint agency_payment_note_len check (char_length(note) <= 1000)
);

drop trigger if exists agency_payment_templates_updated_at on public.agency_payment_templates;
create trigger agency_payment_templates_updated_at
  before update on public.agency_payment_templates
  for each row execute function public.set_updated_at();

alter table public.agency_payment_templates enable row level security;

drop policy if exists "Agency payment select owner" on public.agency_payment_templates;
create policy "Agency payment select owner"
  on public.agency_payment_templates for select to authenticated
  using (
    exists (
      select 1 from public.agencies a
      where a.id = agency_id and (a.owner_id = auth.uid() or public.ben_admin_miyim())
    )
  );

drop policy if exists "Agency payment owner write" on public.agency_payment_templates;
create policy "Agency payment owner write"
  on public.agency_payment_templates for all to authenticated
  using (
    exists (
      select 1 from public.agencies a
      where a.id = agency_id and (a.owner_id = auth.uid() or public.ben_admin_miyim())
    )
  )
  with check (
    exists (
      select 1 from public.agencies a
      where a.id = agency_id and (a.owner_id = auth.uid() or public.ben_admin_miyim())
    )
  );

grant select, insert, update, delete on public.agency_payment_templates to authenticated;

-- ---------------------------------------------------------------------------
-- Yardimci + yonetim RPC'leri (067'den; remote'da eksikti)
-- ---------------------------------------------------------------------------
create or replace function public.ajans_sahibi_veya_admin(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agencies a
    where a.id = p_agency_id
      and (
        a.owner_id = auth.uid()
        or public.ben_admin_miyim()
      )
  );
$$;

create or replace function public.ajans_yonetim_ajanslarim()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'agency_public_id', a.agency_public_id,
      'name', a.name,
      'status', a.status,
      'is_coin_distributor', a.is_coin_distributor,
      'invite_code', a.invite_code,
      'host_count', a.host_count,
      'level_code', a.level_code
    ) order by a.created_at desc)
    from public.agencies a
    where a.owner_id = v_uid
      and a.status in ('active', 'suspended')
  ), '[]'::jsonb);
end;
$$;

create or replace function public.ajans_kurallari_kaydet(
  p_agency_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := coalesce(p_body, '');
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ajans_sahibi_veya_admin(p_agency_id) then
    raise exception 'Forbidden';
  end if;
  if char_length(v_body) > 8000 then
    raise exception 'Kurallar en fazla 8000 karakter';
  end if;

  insert into public.agency_rules (agency_id, body, updated_by)
  values (p_agency_id, v_body, v_uid)
  on conflict (agency_id) do update set
    body = excluded.body,
    updated_by = v_uid,
    updated_at = now();

  return jsonb_build_object('ok', true, 'body', v_body);
end;
$$;

create or replace function public.ajans_odeme_sablonu_kaydet(
  p_agency_id uuid,
  p_account_holder text,
  p_bank_name text,
  p_iban text,
  p_phone text default '',
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_holder text := trim(coalesce(p_account_holder, ''));
  v_bank text := trim(coalesce(p_bank_name, ''));
  v_iban text := upper(replace(trim(coalesce(p_iban, '')), ' ', ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_note text := trim(coalesce(p_note, ''));
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ajans_sahibi_veya_admin(p_agency_id) then
    raise exception 'Forbidden';
  end if;
  if v_holder = '' then raise exception 'Hesap sahibi zorunlu'; end if;
  if v_bank = '' then raise exception 'Banka adi zorunlu'; end if;
  if v_iban = '' then raise exception 'IBAN zorunlu'; end if;
  if char_length(v_iban) < 15 or char_length(v_iban) > 34 then
    raise exception 'IBAN gecersiz';
  end if;
  if char_length(v_note) > 1000 then raise exception 'Not cok uzun'; end if;

  insert into public.agency_payment_templates (
    agency_id, account_holder, bank_name, iban, phone, note, updated_by
  ) values (
    p_agency_id, v_holder, v_bank, v_iban, v_phone, v_note, v_uid
  )
  on conflict (agency_id) do update set
    account_holder = excluded.account_holder,
    bank_name = excluded.bank_name,
    iban = excluded.iban,
    phone = excluded.phone,
    note = excluded.note,
    updated_by = v_uid,
    updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'template', jsonb_build_object(
      'account_holder', v_holder,
      'bank_name', v_bank,
      'iban', v_iban,
      'phone', v_phone,
      'note', v_note
    )
  );
end;
$$;

create or replace function public.ajans_sil(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_agency public.agencies%rowtype;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.ajans_sahibi_veya_admin(p_agency_id) then
    raise exception 'Forbidden';
  end if;

  select * into v_agency from public.agencies where id = p_agency_id for update;
  if not found then raise exception 'Ajans bulunamadi'; end if;
  if v_agency.status = 'closed' then
    return jsonb_build_object('ok', true, 'status', 'closed');
  end if;

  update public.agencies set
    status = 'closed',
    is_coin_distributor = false,
    updated_at = now()
  where id = p_agency_id;

  update public.host_profiles set
    agency_id = null,
    status = 'independent',
    updated_at = now()
  where agency_id = p_agency_id;

  perform public.bildirim_kuyruga_ekle(
    v_agency.owner_id,
    'system',
    'Ajans kapatıldı',
    v_agency.name || ' kapatıldı. Coin dağıtımı durdu.',
    '/ajans',
    jsonb_build_object('agency_id', p_agency_id, 'type', 'agency_closed')
  );

  perform public.admin_audit_yaz(
    v_agency.owner_id,
    'agency_close',
    'Ajans kapatildi',
    jsonb_build_object('agency_id', p_agency_id, 'by', v_uid)
  );

  return jsonb_build_object('ok', true, 'status', 'closed');
end;
$$;

grant execute on function public.ajans_sahibi_veya_admin(uuid) to authenticated;
grant execute on function public.ajans_yonetim_ajanslarim() to authenticated;
grant execute on function public.ajans_kurallari_kaydet(uuid, text) to authenticated;
grant execute on function public.ajans_odeme_sablonu_kaydet(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.ajans_sil(uuid) to authenticated;
