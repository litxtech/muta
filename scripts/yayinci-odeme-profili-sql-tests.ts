/**
 * Yayıncı ödeme profili — gerçek migration izole PGlite üzerinde çalıştırılır.
 *
 * Kapsam:
 *  - profil kaydı (ad/telefon/vergi/şirket beyanı) ve eksik listesi
 *  - "şirketim yok" beyanında şirket evrakı istenmemesi
 *  - belge sürümleme: yeni yükleme eskiyi ezmez, version artar
 *  - belge silme/güncelleme yasağı (document_immutable)
 *  - tüm ülkeler: tanımsız ülke için genel havale şeması
 *
 * Çalıştırma: npx --yes tsx scripts/yayinci-odeme-profili-sql-tests.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const MIGRATIONLAR = [
  '20261101150000_yayinci_odeme_profili.sql',
  '20261101200000_yayinci_onay_kuyrugu.sql',
];

const STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text,
  name text
);
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)] $$;

create table public.profiles (
  id uuid primary key,
  display_name text,
  username text,
  country_code text
);

create table public.creator_earning_entries (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null,
  eligible boolean not null default true,
  paid_at timestamptz,
  payout_request_id uuid,
  hold_reason text,
  period_end date,
  created_at timestamptz not null default now()
);
create function public.yayinci_kazanc_durumu(e public.creator_earning_entries) returns text
language sql stable as $$
  select case
    when not e.eligible then 'ineligible'
    when e.paid_at is not null then 'paid'
    when e.payout_request_id is not null then 'in_payout'
    when e.hold_reason is not null then 'on_hold'
    when e.period_end >= (now() at time zone 'UTC')::date then 'pending'
    else 'available'
  end
$$;

create function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.test_perms (user_id uuid, permission text);
create function public.admin_has_permission(p text) returns boolean
language sql stable as $$
  select exists (select 1 from public.test_perms where user_id = auth.uid() and permission = p)
$$;

create table public.finans_denetim_stub (action text, entity_type text);
create function public.finans_denetim_yaz(
  p_actor uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_amount numeric default null, p_before jsonb default null,
  p_after jsonb default null, p_details jsonb default '{}'::jsonb
) returns uuid language plpgsql as $$
begin
  insert into public.finans_denetim_stub (action, entity_type) values (p_action, p_entity_type);
  return gen_random_uuid();
end;
$$;

create function public.bildirim_kuyurga_ekle(
  p_user uuid, p_channel text, p_title text, p_body text, p_link text, p_meta jsonb
) returns uuid language sql as $$ select gen_random_uuid() $$;

create table public.creator_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  method text,
  scheme text,
  country_code text,
  currency text,
  account_holder text,
  bank_name text,
  iban_masked text,
  iban_hash text,
  details jsonb not null default '{}'::jsonb,
  details_masked jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  verified_at timestamptz,
  last_changed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.user_bank_accounts (
  user_id uuid primary key,
  account_holder text,
  bank_name text,
  iban text,
  updated_at timestamptz not null default now()
);

create table public.financial_audit_events (
  actor_id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  details jsonb
);

create table public.country_payout_methods (
  country_code text,
  method text,
  provider text,
  currency text,
  min_payout_usd numeric default 25,
  is_enabled boolean default true,
  auto_payout boolean default false,
  requirements jsonb default '{}'::jsonb,
  primary key (country_code, method)
);

insert into public.country_payout_methods (country_code, method, requirements)
values ('TR', 'bank_transfer', '{"scheme":"iban","bank_name_required":false,
  "fields":[{"key":"iban","required":true,"pattern":"^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$"}]}'::jsonb);

create function public.odeme_detay_normallestir(p jsonb) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_object_agg(lower(e.k), trim(e.v)), '{}'::jsonb)
  from jsonb_each_text(coalesce(p, '{}'::jsonb)) e(k, v)
  where trim(coalesce(e.v, '')) <> ''
$$;

create function public.odeme_detay_birincil_alan(p jsonb) returns text
language sql immutable as $$
  select t.alan from unnest(array['iban','account_number','wallet_number','clabe'])
    with ordinality as t(alan, sira)
  where coalesce(p ->> t.alan, '') <> ''
  order by t.sira limit 1
$$;

create function public.odeme_detay_maskeli(p jsonb) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_object_agg(lower(e.k),
    case when lower(e.k) in ('iban','account_number','wallet_number','clabe','document_id')
      then '****' || right(e.v, 4) else e.v end), '{}'::jsonb)
  from jsonb_each_text(coalesce(p, '{}'::jsonb)) e(k, v)
  where trim(coalesce(e.v, '')) <> ''
$$;

create function public.odeme_detay_dogrula(p_spec jsonb, p_details jsonb) returns text
language plpgsql immutable as $$
declare f jsonb; k text; v text;
begin
  for f in select e.oge from jsonb_array_elements(coalesce(p_spec -> 'fields', '[]'::jsonb)) e(oge) loop
    k := lower(coalesce(f ->> 'key', ''));
    v := p_details ->> k;
    if coalesce((f ->> 'required')::boolean, true) and coalesce(trim(v), '') = '' then
      return 'field_required:' || k;
    end if;
    if coalesce(trim(v), '') <> '' and f ? 'pattern' and v !~ (f ->> 'pattern') then
      return 'field_invalid:' || k;
    end if;
  end loop;
  return null;
end;
$$;

create function public.iban_gecerli_mi(p text) returns boolean
language sql immutable as $$
  select upper(regexp_replace(coalesce(p, ''), '\\s', '', 'g')) ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'
$$;
`;

const KULLANICI = '00000000-0000-0000-0000-0000000000a1';
const KULLANICI2 = '00000000-0000-0000-0000-0000000000b2';
const YONETICI = '00000000-0000-0000-0000-0000000000c3';

let gecen = 0;
let kalan = 0;

function dogrula(kosul: unknown, mesaj: string) {
  if (kosul) {
    gecen += 1;
  } else {
    kalan += 1;
    console.error('FAIL', mesaj);
  }
}

function esit(gercek: unknown, beklenen: unknown, mesaj: string) {
  const a = JSON.stringify(gercek);
  const b = JSON.stringify(beklenen);
  dogrula(a === b, `${mesaj} (gerçek: ${a}, beklenen: ${b})`);
}

async function hataBekle(db: PGlite, sql: string, params: unknown[], kod: string, mesaj: string) {
  try {
    await db.query(sql, params);
    dogrula(false, `${mesaj} — hata bekleniyordu (${kod})`);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    dogrula(m.includes(kod), `${mesaj} (beklenen kod: ${kod}, gelen: ${m})`);
  }
}

async function main() {
  const db = new PGlite();
  await db.exec(STUB);

  for (const dosya of MIGRATIONLAR) {
    const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', dosya), 'utf8');
    await db.exec(sql);
  }

  await db.query(
    `insert into public.profiles (id, display_name, username, country_code)
     values ($1, 'Ayşe Yılmaz', 'ayse', 'TR'), ($2, 'İkinci Kullanıcı', 'ikinci', 'DE')`,
    [KULLANICI, KULLANICI2],
  );
  await db.exec(`select set_config('request.jwt.claim.sub', '${KULLANICI}', false)`);

  /* --- 1) Profil yokken eksik listesi ---------------------------------- */
  let durum = (await db.query(`select public.yayinci_odeme_profilim() as d`)).rows[0] as any;
  esit(durum.d.tamam, false, 'Profil yokken tamam değil');
  esit(durum.d.eksikler, ['profil'], 'Profil yokken tek eksik: profil');

  /* --- 2) Doğrulama: ad / telefon / ülke ------------------------------- */
  await hataBekle(
    db,
    `select public.yayinci_odeme_profili_kaydet('TUR', 'A', 'Y', '123', null)`,
    [],
    'invalid_country',
    'Üç harfli ülke reddedilir',
  );
  await hataBekle(
    db,
    `select public.yayinci_odeme_profili_kaydet('TR', 'A', 'Yılmaz', '05551112233', null)`,
    [],
    'invalid_first_name',
    'Tek harfli ad reddedilir',
  );
  await hataBekle(
    db,
    `select public.yayinci_odeme_profili_kaydet('TR', 'Ayşe', 'Yılmaz', '12', null)`,
    [],
    'invalid_phone',
    'Kısa telefon reddedilir',
  );
  await hataBekle(
    db,
    `select public.yayinci_odeme_profili_kaydet('TR', 'Ayşe', 'Yılmaz', '05551112233', '!!!')`,
    [],
    'invalid_tax_number',
    'Geçersiz vergi numarası reddedilir',
  );
  await hataBekle(
    db,
    `select public.yayinci_odeme_profili_kaydet('TR', 'Ayşe', 'Yılmaz', '05551112233', '1234567890', null, true, '', null)`,
    [],
    'company_name_required',
    'Şirket var denirse unvan zorunlu',
  );
  await hataBekle(
    db,
    `select public.yayinci_odeme_profili_kaydet('TR', 'Ayşe', 'Yılmaz', '05551112233', '1234567890', null, true, 'Tamuso Ltd', '', null)`,
    [],
    'company_tax_number_required',
    'Şirket var denirse şirket vergi no zorunlu',
  );

  /* --- 3) "Şirketim yok" beyanı ---------------------------------------- */
  durum = (
    await db.query(
      `select public.yayinci_odeme_profili_kaydet(
         'TR', 'Ayşe', 'Yılmaz', '0555 111 22 33', '1234567890', 'Kadıköy', false, null, null, null, '+90'
       ) as d`,
    )
  ).rows[0] as any;

  esit(durum.d.exists, true, 'Profil kaydı oluşur');
  esit(durum.d.sirket_yok, true, '"Şirketim yok" beyanı yazılır');
  esit(durum.d.has_company, false, 'Şirket yok olarak işaretlenir');
  esit(durum.d.belge_gerekli, ['tax_certificate'], 'Şirket yoksa yalnızca vergi levhası istenir');
  esit(
    durum.d.eksikler,
    ['vergi_belgesi'],
    'Şirket yokken eksik yalnızca vergi levhası',
  );
  esit(durum.d.profile.phone, '0555 111 22 33', 'Telefon kaydedilir');
  esit(durum.d.profile.tax_number, '1234567890', 'Vergi numarası kaydedilir');

  /* --- 4) Şirket evrakı, şirket beyanı yokken reddedilir ---------------- */
  await hataBekle(
    db,
    `select public.yayinci_odeme_belgesi_kaydet(
       'company_registration', '${KULLANICI}/sirket-1.pdf', 'application/pdf', 'sirket.pdf', 1000
     )`,
    [],
    'company_not_declared',
    'Şirket yokken şirket evrakı kabul edilmez',
  );

  /* --- 5) Belgeler sürümlenir, silinemez -------------------------------- */
  const b1 = (
    await db.query(
      `select public.yayinci_odeme_belgesi_kaydet(
         'tax_certificate', '${KULLANICI}/vergi-1.pdf', 'application/pdf', 'vergi.pdf', 2048
       ) as d`,
    )
  ).rows[0] as any;
  esit(b1.d.version, 1, 'İlk belge sürüm 1');

  const b2 = (
    await db.query(
      `select public.yayinci_odeme_belgesi_kaydet(
         'tax_certificate', '${KULLANICI}/vergi-2.pdf', 'application/pdf', 'vergi-yeni.pdf', 4096
       ) as d`,
    )
  ).rows[0] as any;
  esit(b2.d.version, 2, 'Yeni yükleme sürüm 2 açar');
  esit(
    await db.query(
      `select count(*)::int as n from public.creator_payout_documents where user_id = $1`,
      [KULLANICI],
    ).then((r) => (r.rows[0] as any).n),
    2,
    'Eski sürüm korunur, silinmez',
  );

  await hataBekle(
    db,
    `delete from public.creator_payout_documents where id = $1`,
    [b1.d.id],
    'document_immutable',
    'Belge silinemez',
  );
  await hataBekle(
    db,
    `update public.creator_payout_documents set storage_path = 'x' where id = $1`,
    [b1.d.id],
    'document_immutable',
    'Belge yolu değiştirilemez',
  );

  await hataBekle(
    db,
    `select public.yayinci_odeme_belgesi_kaydet(
       'tax_certificate', 'baska/vergi.pdf', 'application/pdf', 'vergi.pdf', 100
     )`,
    [],
    'invalid_storage_path',
    'Başka kullanıcının klasörüne yükleme reddedilir',
  );
  await hataBekle(
    db,
    `select public.yayinci_odeme_belgesi_kaydet(
       'tax_certificate', '${KULLANICI}/vergi.exe', 'application/x-msdownload', 'v.exe', 10
     )`,
    [],
    'invalid_mime',
    'Desteklenmeyen dosya türü reddedilir',
  );

  durum = (await db.query(`select public.yayinci_odeme_profilim() as d`)).rows[0] as any;
  esit(durum.d.tamam, true, 'Vergi levhası yüklenince profil tamamlanır');
  esit(durum.d.status, 'submitted', 'Profil incelemeye gönderilir');
  esit(durum.d.eksikler, [], 'Eksik kalmaz');
  esit(durum.d.documents.length, 2, 'Belgeler listelenir');

  /* --- 6) Şirket beyanı + şirket evrakı --------------------------------- */
  durum = (
    await db.query(
      `select public.yayinci_odeme_profili_kaydet(
         'DE', 'Ayşe', 'Yılmaz', '01701234567', '1234567890', null, true,
         'Tamuso GmbH', 'DE123456789', 'DE', '+49'
       ) as d`,
    )
  ).rows[0] as any;
  esit(durum.d.has_company, true, 'Şirket beyanı kaydedilir');
  esit(durum.d.sirket_yok, false, 'Şirket var olarak işaretlenir');
  esit(
    durum.d.belge_gerekli,
    ['tax_certificate', 'company_registration'],
    'Şirket varsa ticaret sicil belgesi de istenir',
  );
  esit(durum.d.eksikler, ['sirket_belgesi'], 'Şirket evrakı eksik görünür');
  esit(durum.d.profile.company_tax_number, 'DE123456789', 'Şirket vergi no kaydedilir');
  esit(durum.d.profile.company_country_code, 'DE', 'Şirket ülkesi kaydedilir');

  const sirketBelge = (
    await db.query(
      `select public.yayinci_odeme_belgesi_kaydet(
         'company_registration', '${KULLANICI}/ticaret-sicil.pdf', 'application/pdf', 'sicil.pdf', 8192
       ) as d`,
    )
  ).rows[0] as any;
  esit(sirketBelge.d.version, 1, 'Şirket evrakı ilk sürüm');

  durum = (await db.query(`select public.yayinci_odeme_profilim() as d`)).rows[0] as any;
  esit(durum.d.tamam, true, 'Şirket evrakı yüklenince profil tamamlanır');

  /* --- 7) Tüm ülkeler: tanımsız ülke genel havale ----------------------- */
  const ulke = (await db.query(`select public.yayinci_odeme_ulke_durumu('JP') as d`)).rows[0] as any;
  esit(ulke.d.supported, true, 'Tanımsız ülke de desteklenir');
  esit(ulke.d.generic, true, 'Tanımsız ülke genel şema kullanır');
  esit(ulke.d.methods[0].scheme, 'local_account', 'Genel şema yerel hesap');
  dogrula(
    (ulke.d.methods[0].fields as any[]).some((f) => f.key === 'account_number'),
    'Genel şemada hesap numarası alanı var',
  );

  const tr = (await db.query(`select public.yayinci_odeme_ulke_durumu('TR') as d`)).rows[0] as any;
  esit(tr.d.supported, true, 'Tanımlı ülke desteklenir');
  esit(tr.d.generic, false, 'Tanımlı ülke genel şemaya düşmez');

  const hesap = (
    await db.query(
      `select public.yayinci_odeme_hesabi_kaydet(
         'Ayşe Yılmaz', 'Mizuho Bank', null, 'JP', 'USD', 'bank_transfer', 'local_account',
         '{"account_number":"1234567","swift_bic":"MHCBJPJT"}'::jsonb
       ) as d`,
    )
  ).rows[0] as any;
  esit(hesap.d.scheme, 'local_account', 'Tanımsız ülkede yerel hesap kaydedilir');
  esit(hesap.d.status, 'pending_verification', 'Hesap doğrulama bekler');
  esit(hesap.d.details_masked.account_number, '****4567', 'Hesap numarası maskelenir');

  await hataBekle(
    db,
    `select public.yayinci_odeme_hesabi_kaydet('Ayşe Yılmaz', '', null, 'JP', 'USD', 'bank_transfer', 'local_account', '{"account_number":"1234567"}'::jsonb)`,
    [],
    'bank_name_required',
    'Genel şemada banka adı zorunlu',
  );

  /* --- 8) Admin: yalnızca izinli, karar denetlenir ---------------------- */
  await hataBekle(
    db,
    `select public.admin_yayinci_odeme_profili_getir('${KULLANICI}')`,
    [],
    'Forbidden',
    'Yetkisiz admin profili göremez',
  );

  await hataBekle(
    db,
    `select public.admin_yayinci_onay_kuyrugu()`,
    [],
    'Forbidden',
    'Yetkisiz admin onay kuyruğunu göremez',
  );

  await db.query(`insert into public.test_perms (user_id, permission) values ($1, 'finance.view')`, [
    YONETICI,
  ]);
  await db.exec(`select set_config('request.jwt.claim.sub', '${YONETICI}', false)`);

  /* --- 8.a) Onay kuyruğu: profil + belge + hesap tek listede ----------- */
  const kuyruk = (await db.query(`select public.admin_yayinci_onay_kuyrugu() as d`))
    .rows[0] as any;
  esit(kuyruk.d.sayilar.profil, 1, 'Onay bekleyen profil sayılır');
  esit(kuyruk.d.sayilar.belge, 3, 'Onay bekleyen belgeler sayılır');
  esit(kuyruk.d.sayilar.hesap, 1, 'Doğrulama bekleyen hesap sayılır');
  esit(kuyruk.d.sayilar.kazanc, 0, 'Kazanç kaydı yokken sayaç sıfır');
  esit(kuyruk.d.sayilar.onay_bekleyen_toplam, 5, 'Toplam onay bekleyen sayısı');
  esit(kuyruk.d.items.length, 5, 'Kuyruk üç türü birlikte listeler');
  dogrula(
    kuyruk.d.items.some((i: any) => i.tur === 'profil'),
    'Kuyrukta ödeme profili kaydı var',
  );
  dogrula(
    kuyruk.d.items.filter((i: any) => i.tur === 'belge').every((i: any) => i.detay.version >= 1),
    'Belge kayıtları sürüm bilgisi taşır',
  );

  const yalnizHesap = (
    await db.query(`select public.admin_yayinci_onay_kuyrugu('hesap') as d`)
  ).rows[0] as any;
  esit(yalnizHesap.d.items.length, 1, 'Tür filtresi hesap kaydını daraltır');
  esit(yalnizHesap.d.items[0].tur, 'hesap', 'Filtre türü korur');
  esit(yalnizHesap.d.items[0].detay.account_holder, 'Ayşe Yılmaz', 'Hesap sahibi görünür');
  esit(yalnizHesap.d.items[0].user_id, KULLANICI, 'Hesap kullanıcıya bağlanır');

  const admin = (
    await db.query(`select public.admin_yayinci_odeme_profili_getir($1) as d`, [KULLANICI])
  ).rows[0] as any;
  esit(admin.d.exists, true, 'Admin profili görür');
  esit(admin.d.documents.length, 3, 'Admin tüm belge sürümlerini görür');

  const erisim = (
    await db.query(`select public.admin_yayinci_odeme_belgesi_erisim($1) as d`, [b2.d.id])
  ).rows[0] as any;
  esit(erisim.d.bucket, 'creator-payout-docs', 'Belge erişimi özel kovayı döner');
  esit(erisim.d.expires_in, 300, 'İmzalı bağlantı kısa ömürlü');

  await hataBekle(
    db,
    `select public.admin_yayinci_odeme_belgesi_karar($1, 'rejected', '')`,
    [b1.d.id],
    'note_required',
    'Belge reddi gerekçe ister',
  );
  const karar = (
    await db.query(`select public.admin_yayinci_odeme_belgesi_karar($1, 'approved', 'uygun') as d`, [
      b2.d.id,
    ])
  ).rows[0] as any;
  esit(karar.d.status, 'approved', 'Belge onaylanır');

  const profilKarar = (
    await db.query(`select public.admin_yayinci_odeme_profili_karar($1, 'verified', 'tamam') as d`, [
      KULLANICI,
    ])
  ).rows[0] as any;
  esit(profilKarar.d.status, 'verified', 'Profil doğrulanır');

  /* --- 8.b) Karar verilen kayıt kuyruktan düşer ------------------------ */
  const sonra = (await db.query(`select public.admin_yayinci_onay_sayilari() as d`))
    .rows[0] as any;
  esit(sonra.d.profil, 0, 'Onaylanan profil kuyruktan düşer');
  esit(sonra.d.belge, 2, 'Onaylanan belge kuyruktan düşer');
  esit(sonra.d.hesap, 1, 'Doğrulanmayan hesap kuyrukta kalır');

  const denetim = await db.query(
    `select count(*)::int as n from public.finans_denetim_stub where action like 'payout_%'`,
  );
  dogrula((denetim.rows[0] as any).n >= 3, 'Profil/belge işlemleri denetime yazılır');

  /* --- 9) Doğrulanmış profil değişirse incelemeye döner ----------------- */
  await db.exec(`select set_config('request.jwt.claim.sub', '${KULLANICI}', false)`);
  durum = (
    await db.query(
      `select public.yayinci_odeme_profili_kaydet(
         'TR', 'Ayşe', 'Yılmaz', '0555 111 22 33', '9876543210', 'Kadıköy', false, null, null, null, '+90'
       ) as d`,
    )
  ).rows[0] as any;
  esit(durum.d.status, 'submitted', 'Vergi numarası değişince profil yeniden incelemeye döner');

  /* --- 10) Diğer kullanıcı ayrı kalır ---------------------------------- */
  await db.exec(`select set_config('request.jwt.claim.sub', '${KULLANICI2}', false)`);
  const diger = (await db.query(`select public.yayinci_odeme_profilim() as d`)).rows[0] as any;
  esit(diger.d.exists, false, 'Profil kullanıcıya özeldir');

  console.log(`\nyayinci-odeme-profili-sql: ${gecen} geçti, ${kalan} kaldı`);
  if (kalan > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
