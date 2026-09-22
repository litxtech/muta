-- Platform iletişim (hamburger / şikayet) — admin canlı günceller

create table if not exists public.platform_iletisim_ayar (
  id smallint primary key default 1 check (id = 1),
  support_email text not null default 'support@litxtech.com',
  whatsapp_e164 text not null default '905330483061',
  whatsapp_gorunen text not null default '0533 048 30 61',
  baslik text not null default 'Kurumsal iletişim',
  alt_metin text not null default 'Şikayet · destek · uygunsuz içerik',
  guncelleyen uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.platform_iletisim_ayar (id)
values (1)
on conflict (id) do nothing;

alter table public.platform_iletisim_ayar enable row level security;

drop policy if exists "Platform iletisim public read" on public.platform_iletisim_ayar;
create policy "Platform iletisim public read"
  on public.platform_iletisim_ayar for select to anon, authenticated
  using (true);

drop policy if exists "Platform iletisim admin write" on public.platform_iletisim_ayar;
create policy "Platform iletisim admin write"
  on public.platform_iletisim_ayar for all to authenticated
  using (public.ben_admin_miyim())
  with check (public.ben_admin_miyim());

create or replace function public.platform_iletisim_ayari_get()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.platform_iletisim_ayar%rowtype;
begin
  select * into v_row from public.platform_iletisim_ayar where id = 1;
  if not found then
    return jsonb_build_object(
      'support_email', 'support@litxtech.com',
      'whatsapp_e164', '905330483061',
      'whatsapp_gorunen', '0533 048 30 61',
      'baslik', 'Kurumsal iletişim',
      'alt_metin', 'Şikayet · destek · uygunsuz içerik'
    );
  end if;
  return jsonb_build_object(
    'support_email', v_row.support_email,
    'whatsapp_e164', v_row.whatsapp_e164,
    'whatsapp_gorunen', v_row.whatsapp_gorunen,
    'baslik', v_row.baslik,
    'alt_metin', v_row.alt_metin,
    'updated_at', v_row.updated_at
  );
end;
$$;

grant execute on function public.platform_iletisim_ayari_get() to anon, authenticated;

create or replace function public.admin_platform_iletisim_ayarla(
  p_support_email text default null,
  p_whatsapp_e164 text default null,
  p_whatsapp_gorunen text default null,
  p_baslik text default null,
  p_alt_metin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_wa text;
  v_wa_g text;
begin
  if not public.ben_admin_miyim() then
    raise exception 'Forbidden: admin only';
  end if;

  insert into public.platform_iletisim_ayar (id) values (1)
  on conflict (id) do nothing;

  v_email := nullif(trim(coalesce(p_support_email, '')), '');
  v_wa := regexp_replace(coalesce(p_whatsapp_e164, ''), '[^0-9]', '', 'g');
  v_wa_g := nullif(trim(coalesce(p_whatsapp_gorunen, '')), '');

  if v_email is not null and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Gecersiz e-posta';
  end if;
  if p_whatsapp_e164 is not null and length(v_wa) < 10 then
    raise exception 'Gecersiz WhatsApp numarasi';
  end if;

  update public.platform_iletisim_ayar set
    support_email = coalesce(v_email, support_email),
    whatsapp_e164 = case when p_whatsapp_e164 is not null then v_wa else whatsapp_e164 end,
    whatsapp_gorunen = coalesce(v_wa_g, whatsapp_gorunen),
    baslik = coalesce(nullif(trim(coalesce(p_baslik, '')), ''), baslik),
    alt_metin = coalesce(nullif(trim(coalesce(p_alt_metin, '')), ''), alt_metin),
    guncelleyen = auth.uid(),
    updated_at = now()
  where id = 1;

  return public.platform_iletisim_ayari_get();
end;
$$;

grant execute on function public.admin_platform_iletisim_ayarla(text, text, text, text, text)
  to authenticated;
