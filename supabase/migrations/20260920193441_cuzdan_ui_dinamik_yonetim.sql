-- Dinamik cüzdan UI: versioned payload + live pointer + audit.
-- Finansal bakiyeyi / IAP product ID'lerini değiştirmez.
-- Feature flags (wallet_exchange / withdraw) güvenlik kapısı olarak kalır.

create table if not exists public.wallet_ui_versions (
  id uuid primary key default gen_random_uuid(),
  version_no integer not null,
  status text not null check (status in ('draft', 'published', 'archived')),
  label text,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  published_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (version_no)
);

create table if not exists public.wallet_ui_live (
  id int primary key default 1 check (id = 1),
  version_id uuid not null references public.wallet_ui_versions(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.wallet_ui_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  config_key text,
  old_value jsonb,
  new_value jsonb,
  version_id uuid references public.wallet_ui_versions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists wallet_ui_versions_status_idx
  on public.wallet_ui_versions (status, version_no desc);
create index if not exists wallet_ui_audit_created_idx
  on public.wallet_ui_audit_logs (created_at desc);

alter table public.wallet_ui_versions enable row level security;
alter table public.wallet_ui_live enable row level security;
alter table public.wallet_ui_audit_logs enable row level security;

drop policy if exists "wallet_ui_versions_select_auth" on public.wallet_ui_versions;
create policy "wallet_ui_versions_select_auth"
  on public.wallet_ui_versions for select to authenticated
  using (
    status = 'published'
    or public.ben_admin_miyim()
  );

drop policy if exists "wallet_ui_live_select_auth" on public.wallet_ui_live;
create policy "wallet_ui_live_select_auth"
  on public.wallet_ui_live for select to authenticated
  using (true);

drop policy if exists "wallet_ui_audit_admin" on public.wallet_ui_audit_logs;
create policy "wallet_ui_audit_admin"
  on public.wallet_ui_audit_logs for select to authenticated
  using (public.ben_admin_miyim());

-- Storage bucket for wallet UI assets (admin upload)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wallet-ui',
  'wallet-ui',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "wallet_ui_public_read" on storage.objects;
create policy "wallet_ui_public_read"
  on storage.objects for select to public
  using (bucket_id = 'wallet-ui');

drop policy if exists "wallet_ui_admin_write" on storage.objects;
create policy "wallet_ui_admin_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'wallet-ui' and public.ben_admin_miyim());

drop policy if exists "wallet_ui_admin_update" on storage.objects;
create policy "wallet_ui_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'wallet-ui' and public.ben_admin_miyim())
  with check (bucket_id = 'wallet-ui' and public.ben_admin_miyim());

drop policy if exists "wallet_ui_admin_delete" on storage.objects;
create policy "wallet_ui_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'wallet-ui' and public.ben_admin_miyim());

-- Varsayılan payload (mevcut cüzdan UI ile uyumlu)
create or replace function public.wallet_ui_default_payload()
returns jsonb
language sql
immutable
as $$
  select '{
    "schema_version": 1,
    "general": {
      "screen_name": "Cüzdan",
      "eyebrow": "HESABIM",
      "subtitle": "",
      "description": ""
    },
    "wallet_icon": {
      "source": "ionicon",
      "ionicon": "wallet-outline",
      "url": null,
      "size": 22,
      "color": "#FFFFFF",
      "background": "rgba(232,64,145,0.22)",
      "radius": 14,
      "opacity": 1,
      "visible": true
    },
    "coin": {
      "name": "Coin",
      "short_name": "Coin",
      "source": "ionicon",
      "ionicon": "logo-bitcoin",
      "url": null,
      "color": "#F0B429",
      "gradient_start": "#F0B429",
      "gradient_end": "#E84091",
      "size": 18,
      "placement": "before",
      "show_beside_amount": true
    },
    "theme": {
      "preset": "premium",
      "background": "#0B0614",
      "surface": "#16121E",
      "cardBackground": "#1A1424",
      "primary": "#E84091",
      "secondary": "#8B5CF6",
      "accent": "#F0B429",
      "buttonBackground": "rgba(232,64,145,0.16)",
      "buttonText": "#FFFFFF",
      "primaryText": "#FFFFFF",
      "secondaryText": "rgba(255,255,255,0.62)",
      "border": "rgba(255,255,255,0.10)",
      "positive": "#34D399",
      "warning": "#F0B429",
      "gradientStart": "#E84091",
      "gradientEnd": "#8B5CF6",
      "gradientDirection": "vertical",
      "radius": 16
    },
    "sections": [
      {"key":"header","enabled":true,"sort_order":10},
      {"key":"hero_card","enabled":true,"sort_order":20},
      {"key":"quick_actions","enabled":true,"sort_order":30},
      {"key":"summary","enabled":true,"sort_order":40},
      {"key":"tabs","enabled":true,"sort_order":50},
      {"key":"coin_info","enabled":true,"sort_order":60},
      {"key":"ledger","enabled":true,"sort_order":70},
      {"key":"gifts","enabled":true,"sort_order":80},
      {"key":"topup","enabled":true,"sort_order":90},
      {"key":"withdraw","enabled":true,"sort_order":100}
    ],
    "actions": [
      {
        "key":"takas",
        "enabled":true,
        "title":"Takas / anlaşma",
        "subtitle":"",
        "icon":"swap-horizontal",
        "icon_type":"ionicon",
        "icon_color":"#F0B429",
        "background_color":"rgba(255,255,255,0.06)",
        "text_color":"#FFFFFF",
        "sort_order":10,
        "action_type":"route",
        "action_target":"/cuzdan/takas",
        "requires_flag":"wallet_exchange_enabled"
      },
      {
        "key":"kyc",
        "enabled":true,
        "title":"Kimlik onayı",
        "subtitle":"",
        "icon":"shield-checkmark-outline",
        "icon_type":"ionicon",
        "icon_color":"#E84091",
        "background_color":"rgba(255,255,255,0.06)",
        "text_color":"#FFFFFF",
        "sort_order":20,
        "action_type":"route",
        "action_target":"/kyc",
        "requires_flag":null
      },
      {
        "key":"hareket_belge",
        "enabled":true,
        "title":"Hesap özeti",
        "subtitle":"PDF / Excel",
        "icon":"document-text-outline",
        "icon_type":"ionicon",
        "icon_color":"#FFFFFF",
        "background_color":"rgba(255,255,255,0.06)",
        "text_color":"#FFFFFF",
        "sort_order":30,
        "action_type":"open_statement",
        "action_target":null,
        "requires_flag":null
      }
    ],
    "texts": [
      {
        "key":"coin_info",
        "type":"info",
        "enabled":true,
        "sort_order":10,
        "style_variant":"footnote",
        "locales":{
          "tr":"Coinler Tamuso içerisinde kullanılan sanal öğelerdir ve nakit paraya dönüştürülemez.",
          "en":"Coins are virtual items used within Tamuso and cannot be redeemed for cash.",
          "ar":"العملات عناصر افتراضية داخل تاموسو ولا يمكن استبدالها نقداً."
        }
      },
      {
        "key":"purchase_locked",
        "type":"warning",
        "enabled":true,
        "sort_order":20,
        "style_variant":"warning",
        "locales":{
          "tr":"Satın alma geçici olarak kapalı.",
          "en":"Purchases are temporarily unavailable.",
          "ar":"الشراء غير متاح مؤقتاً."
        }
      },
      {
        "key":"summary_title",
        "type":"heading",
        "enabled":true,
        "sort_order":5,
        "style_variant":"section",
        "locales":{"tr":"Özet","en":"Summary","ar":"ملخص"}
      }
    ],
    "assets": {
      "banner_url": null,
      "empty_state_url": null
    }
  }'::jsonb;
$$;

-- Seed draft + published v1
do $$
declare
  v_id uuid;
  v_payload jsonb := public.wallet_ui_default_payload();
begin
  if not exists (select 1 from public.wallet_ui_versions) then
    insert into public.wallet_ui_versions (version_no, status, label, payload, published_at)
    values (1, 'published', 'Başlangıç', v_payload, now())
    returning id into v_id;

    insert into public.wallet_ui_live (id, version_id, updated_at)
    values (1, v_id, now())
    on conflict (id) do update set version_id = excluded.version_id, updated_at = now();

    insert into public.wallet_ui_versions (version_no, status, label, payload)
    values (2, 'draft', 'Taslak', v_payload);
  end if;
end $$;

create or replace function public.wallet_ui_canli_getir()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  select v.id, v.version_no, v.payload, v.published_at, v.label
    into v_row
  from public.wallet_ui_live l
  join public.wallet_ui_versions v on v.id = l.version_id
  where l.id = 1 and v.status = 'published'
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'source', 'default',
      'version_no', 0,
      'version_id', null,
      'payload', public.wallet_ui_default_payload()
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'source', 'live',
    'version_no', v_row.version_no,
    'version_id', v_row.id,
    'published_at', v_row.published_at,
    'label', v_row.label,
    'payload', coalesce(v_row.payload, public.wallet_ui_default_payload())
  );
end;
$$;

grant execute on function public.wallet_ui_canli_getir() to authenticated, anon;

create or replace function public.admin_wallet_ui_taslak_getir()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.wallet_ui_versions%rowtype;
  v_live uuid;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  select * into v_row
  from public.wallet_ui_versions
  where status = 'draft'
  order by version_no desc
  limit 1;

  if not found then
    select version_id into v_live from public.wallet_ui_live where id = 1;
    insert into public.wallet_ui_versions (version_no, status, label, payload, created_by)
    select coalesce(max(version_no), 0) + 1, 'draft', 'Taslak',
           coalesce((select payload from public.wallet_ui_versions where id = v_live), public.wallet_ui_default_payload()),
           auth.uid()
    from public.wallet_ui_versions
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'ok', true,
    'version_id', v_row.id,
    'version_no', v_row.version_no,
    'status', v_row.status,
    'label', v_row.label,
    'payload', v_row.payload,
    'updated_at', v_row.created_at
  );
end;
$$;

grant execute on function public.admin_wallet_ui_taslak_getir() to authenticated;

create or replace function public.admin_wallet_ui_taslak_kaydet(p_payload jsonb, p_label text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.wallet_ui_versions%rowtype;
  v_old jsonb;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid payload';
  end if;

  select * into v_row
  from public.wallet_ui_versions
  where status = 'draft'
  order by version_no desc
  limit 1
  for update;

  if not found then
    perform public.admin_wallet_ui_taslak_getir();
    select * into v_row
    from public.wallet_ui_versions
    where status = 'draft'
    order by version_no desc
    limit 1
    for update;
  end if;

  v_old := v_row.payload;
  update public.wallet_ui_versions
    set payload = p_payload,
        label = coalesce(nullif(trim(p_label), ''), label),
        created_by = coalesce(created_by, auth.uid())
  where id = v_row.id
  returning * into v_row;

  insert into public.wallet_ui_audit_logs (admin_id, action, config_key, old_value, new_value, version_id)
  values (auth.uid(), 'draft_save', 'payload', v_old, p_payload, v_row.id);

  return jsonb_build_object('ok', true, 'version_id', v_row.id, 'version_no', v_row.version_no);
end;
$$;

grant execute on function public.admin_wallet_ui_taslak_kaydet(jsonb, text) to authenticated;

create or replace function public.admin_wallet_ui_yayinla(p_label text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.wallet_ui_versions%rowtype;
  v_prev uuid;
  v_new uuid;
  v_no int;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  select * into v_draft
  from public.wallet_ui_versions
  where status = 'draft'
  order by version_no desc
  limit 1
  for update;

  if not found then
    raise exception 'No draft to publish';
  end if;

  select version_id into v_prev from public.wallet_ui_live where id = 1;

  -- Mevcut published → archived
  update public.wallet_ui_versions
    set status = 'archived'
  where status = 'published';

  -- Draft'ı published yap
  update public.wallet_ui_versions
    set status = 'published',
        published_at = now(),
        published_by = auth.uid(),
        label = coalesce(nullif(trim(p_label), ''), label, 'Yayın ' || version_no::text)
  where id = v_draft.id
  returning * into v_draft;

  insert into public.wallet_ui_live (id, version_id, updated_at, updated_by)
  values (1, v_draft.id, now(), auth.uid())
  on conflict (id) do update
    set version_id = excluded.version_id,
        updated_at = now(),
        updated_by = auth.uid();

  -- Yeni boş draft (önceki yayın kopyası)
  select coalesce(max(version_no), 0) + 1 into v_no from public.wallet_ui_versions;
  insert into public.wallet_ui_versions (version_no, status, label, payload, created_by)
  values (v_no, 'draft', 'Taslak', v_draft.payload, auth.uid())
  returning id into v_new;

  insert into public.wallet_ui_audit_logs (admin_id, action, config_key, old_value, new_value, version_id)
  values (
    auth.uid(),
    'publish',
    'live',
    jsonb_build_object('version_id', v_prev),
    jsonb_build_object('version_id', v_draft.id, 'version_no', v_draft.version_no),
    v_draft.id
  );

  return jsonb_build_object(
    'ok', true,
    'published_version_id', v_draft.id,
    'published_version_no', v_draft.version_no,
    'new_draft_id', v_new
  );
end;
$$;

grant execute on function public.admin_wallet_ui_yayinla(text) to authenticated;

create or replace function public.admin_wallet_ui_geri_al()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current uuid;
  v_prev public.wallet_ui_versions%rowtype;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  select version_id into v_current from public.wallet_ui_live where id = 1;

  select * into v_prev
  from public.wallet_ui_versions
  where status = 'archived'
  order by published_at desc nulls last, version_no desc
  limit 1;

  if not found then
    raise exception 'No previous published version';
  end if;

  update public.wallet_ui_versions set status = 'archived' where status = 'published';
  update public.wallet_ui_versions
    set status = 'published', published_at = coalesce(published_at, now())
  where id = v_prev.id;

  update public.wallet_ui_live
    set version_id = v_prev.id, updated_at = now(), updated_by = auth.uid()
  where id = 1;

  -- Draft'ı geri alınan içeriğe çek
  update public.wallet_ui_versions
    set payload = v_prev.payload
  where status = 'draft';

  insert into public.wallet_ui_audit_logs (admin_id, action, config_key, old_value, new_value, version_id)
  values (
    auth.uid(),
    'rollback',
    'live',
    jsonb_build_object('version_id', v_current),
    jsonb_build_object('version_id', v_prev.id, 'version_no', v_prev.version_no),
    v_prev.id
  );

  return jsonb_build_object('ok', true, 'version_id', v_prev.id, 'version_no', v_prev.version_no);
end;
$$;

grant execute on function public.admin_wallet_ui_geri_al() to authenticated;

create or replace function public.admin_wallet_ui_surumler(p_limit int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.version_no desc)
    from (
      select id, version_no, status, label, published_at, created_at, published_by, created_by
      from public.wallet_ui_versions
      order by version_no desc
      limit greatest(1, least(coalesce(p_limit, 30), 100))
    ) x
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_wallet_ui_surumler(int) to authenticated;

create or replace function public.admin_wallet_ui_audit(p_limit int default 50)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.created_at desc)
    from (
      select id, admin_id, action, config_key, old_value, new_value, version_id, created_at
      from public.wallet_ui_audit_logs
      order by created_at desc
      limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) x
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_wallet_ui_audit(int) to authenticated;

-- Realtime: live pointer değişince istemci yeniler
do $$
begin
  begin
    alter publication supabase_realtime add table public.wallet_ui_live;
  exception when duplicate_object then
    null;
  end;
end $$;
