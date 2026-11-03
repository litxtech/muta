/**
 * Tamuso Verify — gerçek migration'lar izole PGlite (bellek içi Postgres)
 * üzerinde çalıştırılarak doğrulanır. Canlı veritabanına bağlanmaz.
 *
 * Calistir: npm run test:tamuso-verify
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const MIGRASYONLAR = [
  '20261101140000_tamuso_verify_sema.sql',
  '20261101141000_tamuso_verify_rpc.sql',
  '20261101142000_tamuso_verify_admin_rpc.sql',
  '20261101143000_tamuso_verify_odeme_kapisi.sql',
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

-- ---------------------------------------------------------------------------
-- Admin RBAC (gerçek katalog tablolarının test için asgari hali)
-- ---------------------------------------------------------------------------
create table public.admin_permission_catalog (
  permission_key text primary key,
  label text not null,
  description text not null default '',
  category text not null,
  risk text not null default 'LOW',
  module_href text,
  sort_order int not null default 100,
  is_active boolean not null default true
);
create table public.admin_roles (
  role_code text primary key,
  name text not null,
  description text not null default '',
  is_system boolean not null default false,
  is_super boolean not null default false,
  sort_order int not null default 100
);
create table public.admin_role_permissions (
  role_code text,
  permission_code text
);

create table public.test_perms (user_id uuid, permission text);
create function public.admin_has_permission(p_permission text) returns boolean
  language sql stable as $$
  select exists (
    select 1 from public.test_perms
    where user_id = auth.uid() and permission = p_permission
  )
$$;
create function public.ben_admin_miyim() returns boolean language sql stable as
  $$ select exists (select 1 from public.test_perms where user_id = auth.uid()) $$;

-- ---------------------------------------------------------------------------
-- Uygulama tabloları
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key,
  display_name text,
  username text,
  public_user_id text,
  avatar_url text,
  birth_date date,
  is_guest boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.wallet_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  wallet_number char(18) not null unique,
  wallet_brand_name text not null default 'MUTA PAY',
  legal_first_name text,
  legal_last_name text,
  kyc_status text not null default 'none'
    check (kyc_status in ('none','pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creator_program_enrollments (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'applied',
  country_code text,
  tax_status text not null default 'pending',
  contract_version_id uuid,
  contract_accepted_at timestamptz,
  age_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creator_payout_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  method text,
  account_holder text,
  bank_name text,
  iban_masked text,
  scheme text,
  details_masked jsonb not null default '{}'::jsonb,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  updated_at timestamptz not null default now()
);

create table public.creator_earning_entries (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null,
  net_usd numeric(14,2) not null default 0,
  available_at timestamptz not null default now(),
  payout_request_id uuid,
  created_at timestamptz not null default now()
);
create function public.yayinci_kazanc_durumu(e public.creator_earning_entries)
returns text language sql stable as $$
  select case
    when e.payout_request_id is not null then 'requested'
    when e.available_at <= now() then 'available'
    else 'pending'
  end
$$;

create table public.platform_economy_config (
  id smallint primary key,
  payout_min_usd numeric(14,2) not null default 25.00,
  payout_transfer_fee_usd numeric(14,2) not null default 0
);
insert into public.platform_economy_config (id) values (1);

create table public.country_payout_methods (
  country_code text not null,
  method text not null,
  provider text,
  currency text,
  min_payout_usd numeric(14,2) not null default 25.00,
  is_enabled boolean not null default true,
  auto_payout boolean not null default false,
  requirements jsonb not null default '{}'::jsonb,
  primary key (country_code, method)
);
create function public.yayinci_odeme_ulke_durumu(p_country_code text)
returns jsonb language sql stable security definer as $$
  select jsonb_build_object(
    'country_code', upper(trim(coalesce(p_country_code, ''))),
    'supported', exists (
      select 1 from public.country_payout_methods c
      where c.country_code = upper(trim(coalesce(p_country_code, ''))) and c.is_enabled
    )
  )
$$;

create table public.finance_risk_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'open',
  severity text not null default 'low',
  created_at timestamptz not null default now()
);

create table public.creator_payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount_usd numeric(14,2) not null,
  fee_usd numeric(14,2) not null default 0,
  net_usd numeric(14,2) not null default 0,
  method text,
  account_holder text,
  bank_name text,
  iban_masked text,
  payout_scheme text,
  payout_details_masked jsonb not null default '{}'::jsonb,
  idempotency_key text,
  period_end date,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create function public.bildirim_kuyruga_ekle(
  p_user uuid, p_channel text, p_title text, p_body text, p_link text, p_meta jsonb)
returns uuid language sql as $$ select gen_random_uuid() $$;
`;

const U = {
  A: '00000000-0000-0000-0000-0000000000a1', // doğrulamayı tamamlayan kullanıcı
  B: '00000000-0000-0000-0000-0000000000b2', // reddedilen + itiraz
  C: '00000000-0000-0000-0000-0000000000c3', // inceleme personeli
  D: '00000000-0000-0000-0000-0000000000d4', // ikinci yönetici
  E: '00000000-0000-0000-0000-0000000000e5', // 18 yaş altı
  F: '00000000-0000-0000-0000-0000000000f6', // misafir
};

let failed = 0;
let passed = 0;

function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', msg);
  } else {
    passed += 1;
  }
}

function esit(gercek: unknown, beklenen: unknown, msg: string) {
  assert(
    String(gercek) === String(beklenen),
    `${msg} (beklenen ${String(beklenen)}, gelen ${String(gercek)})`,
  );
}

const db = new PGlite();

async function deger<T = unknown>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<T>(sql, params);
  const satir = r.rows[0] as Record<string, unknown> | undefined;
  return (satir ? Object.values(satir)[0] : undefined) as T;
}

async function tek<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  const r = await db.query<T>(sql, params);
  return r.rows[0] as T;
}

async function hataBekle(
  sql: string,
  params: unknown[],
  icerik: string,
  msg: string,
) {
  try {
    await db.query(sql, params);
    assert(false, `${msg}: hata bekleniyordu (${icerik})`);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    assert(
      m.toLowerCase().includes(icerik.toLowerCase()),
      `${msg}: beklenen "${icerik}", gelen "${m}"`,
    );
  }
}

async function kullanici(uid: string | null) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
}

async function yetki(uid: string, izinler: string[]) {
  await db.query(`delete from public.test_perms where user_id = $1`, [uid]);
  for (const izin of izinler) {
    await db.query(`insert into public.test_perms (user_id, permission) values ($1, $2)`, [
      uid,
      izin,
    ]);
  }
}

/** RPC'yi çağırır ve jsonb sonucu döndürür. */
async function rpc(ad: string, args: unknown[], uid: string | null) {
  await kullanici(uid);
  const params = args.map((_, i) => `$${i + 1}`).join(', ');
  return deger<Record<string, any>>(`select public.${ad}(${params})`, args);
}

async function kur() {
  await db.exec(STUB);
  for (const dosya of MIGRASYONLAR) {
    await db.exec(readFileSync(join(__dirname, '..', 'supabase', 'migrations', dosya), 'utf8'));
  }

  await db.exec(`
    insert into public.profiles (id, display_name, username, public_user_id, birth_date, is_guest) values
      ('${U.A}', 'Deniz Ak', 'deniz', 'TM1001', '1994-04-12', false),
      ('${U.B}', 'Ege Su', 'egesu', 'TM1002', '1991-08-03', false),
      ('${U.C}', 'İnceleme Personeli', 'reviewer', 'ADM1', '1990-01-01', false),
      ('${U.D}', 'İnceleme Lideri', 'reviewlead', 'ADM2', '1990-01-01', false),
      ('${U.E}', 'Genç Kullanıcı', 'genc', 'TM1003', '2012-02-02', false),
      ('${U.F}', 'Misafir', 'misafir', 'TM1004', '1995-05-05', true);

    insert into public.wallet_accounts (user_id, wallet_number, kyc_status) values
      ('${U.A}', '100000000000000001', 'none'),
      ('${U.B}', '100000000000000002', 'none'),
      ('${U.E}', '100000000000000003', 'none'),
      ('${U.C}', '100000000000000004', 'none'),
      ('${U.D}', '100000000000000005', 'none');

    insert into public.creator_program_enrollments
      (user_id, status, country_code, tax_status, contract_accepted_at) values
      ('${U.A}', 'approved', 'TR', 'complete', now()),
      ('${U.B}', 'approved', 'TR', 'complete', now()),
      ('${U.E}', 'approved', 'TR', 'complete', now());

    insert into public.creator_payout_accounts (user_id, status, method, details, details_masked) values
      ('${U.A}', 'verified', 'iban', '{"iban":"TR00"}'::jsonb, '{"iban":"TR**"}'::jsonb),
      ('${U.B}', 'verified', 'iban', '{"iban":"TR11"}'::jsonb, '{"iban":"TR**"}'::jsonb);

    insert into public.country_payout_methods (country_code, method, provider, is_enabled) values
      ('TR', 'iban', 'manual', true),
      ('ZZ', 'iban', 'manual', true);

    insert into public.creator_earning_entries (creator_id, net_usd, available_at) values
      ('${U.A}', 30.00, now() - interval '1 day'),
      ('${U.B}', 40.00, now() - interval '1 day');
  `);
}

async function selfieTamamla(uid: string, appId: string) {
  const oturum = await rpc('identity_selfie_oturumu_baslat', [appId], uid);
  const sira = oturum.challenge_sequence as string[];
  const adimlar = sira.map((adim) => ({ adim, tamamlandi: true }));
  const sonuc = await rpc(
    'identity_selfie_tamamla',
    [oturum.session_id, oturum.nonce, `${uid}/${appId}/selfie.jpg`, adimlar, { state: 'passed' }, {}, 800, 800, 120000],
    uid,
  );
  return { oturum, sonuc, sira };
}

async function testler() {
  // =========================================================================
  // 1) Başlangıç durumu ve başvuru oluşturma
  // =========================================================================
  let d = await rpc('identity_durumum', [], U.A);
  esit(d.status, 'not_started', 'başlangıçta durum not_started');
  esit(d.odeme.identity_approved, false, 'başlangıçta kimlik onayı yok');

  await hataBekle(
    `select public.identity_basvuru_baslat('VE', 'drivers_license', 'kvkk-v1')`,
    [],
    'document_type_not_supported',
    'desteklenmeyen ülke/belge kombinasyonu reddedilir',
  );

  await hataBekle(
    `select public.identity_basvuru_baslat('TR', 'student_card', 'kvkk-v1')`,
    [],
    'document_type_not_supported',
    'desteklenmeyen belge türü reddedilir',
  );

  await kullanici(U.F);
  await hataBekle(
    `select public.identity_basvuru_baslat('TR', 'id_card', 'kvkk-v1')`,
    [],
    'guest_not_allowed',
    'misafir hesap başvuru açamaz',
  );

  const ilk = await rpc('identity_basvuru_baslat', ['TR', 'id_card', 'kvkk-v1'], U.A);
  esit(ilk.created, true, 'yeni başvuru oluşturuldu');
  esit(ilk.application.status, 'awaiting_document', 'başvuru belge bekliyor');
  const appId = ilk.application.id as string;

  // =========================================================================
  // 2) Eşzamanlı ikinci başvuru engeli
  // =========================================================================
  const ikinci = await rpc('identity_basvuru_baslat', ['TR', 'passport', 'kvkk-v1'], U.A);
  esit(ikinci.created, false, 'ikinci başvuru oluşturulmaz');
  esit(ikinci.application.id, appId, 'mevcut aktif başvuru döner');
  esit(
    await deger(`select count(*) from public.identity_applications where user_id = '${U.A}'`),
    1,
    'aynı kullanıcı için tek aktif başvuru',
  );

  // Kullanıcının doğrudan tabloya yazma yetkisi yok (RLS + grant seçici)
  esit(
    await deger(
      `select has_table_privilege('authenticated', 'public.identity_applications', 'INSERT')`,
    ),
    false,
    'istemci başvuru tablosuna yazamaz',
  );
  esit(
    await deger(`select relrowsecurity from pg_class where oid = 'public.identity_applications'::regclass`),
    true,
    'başvuru tablosunda RLS açık',
  );
  esit(
    await deger(
      `select count(*) from pg_policies
        where schemaname = 'public' and tablename = 'identity_applications'
          and cmd in ('INSERT','UPDATE','DELETE')`,
    ),
    0,
    'başvuru tablosunda yazma politikası yok',
  );
  esit(
    await deger(`select has_table_privilege('authenticated', 'public.identity_documents', 'SELECT')`),
    false,
    'ham belge tablosu istemciye kapalı',
  );
  esit(
    await deger(`select has_table_privilege('authenticated', 'public.identity_access_audit', 'SELECT')`),
    false,
    'denetim tablosu istemciye kapalı',
  );

  // =========================================================================
  // 3) Belge yükleme kuralları
  // =========================================================================
  await hataBekle(
    `select public.identity_belge_kaydet($1, 'front', $2, '{}'::jsonb, 'camera', null, null, 1000, 'image/jpeg', null)`,
    [appId, `${U.B}/${appId}/front.jpg`],
    'invalid_storage_path',
    'başka kullanıcının klasörüne yükleme reddedilir',
  );

  await hataBekle(
    `select public.identity_belge_kaydet($1, 'front', $2, '{}'::jsonb, 'camera', null, null, 1000, 'application/pdf', null)`,
    [appId, `${U.A}/${appId}/front.pdf`],
    'invalid_mime',
    'geçersiz dosya türü reddedilir',
  );

  await hataBekle(
    `select public.identity_belge_kaydet($1, 'front', $2, '{}'::jsonb, 'camera', null, null, 999999999, 'image/jpeg', null)`,
    [appId, `${U.A}/${appId}/big.jpg`],
    'invalid_file_size',
    'boyut sınırı aşılırsa reddedilir',
  );

  await hataBekle(
    `select public.identity_belge_kaydet($1, 'left', $2, '{}'::jsonb, 'camera', null, null, 1000, 'image/jpeg', null)`,
    [appId, `${U.A}/${appId}/left.jpg`],
    'invalid_side',
    'tanımsız belge yüzü reddedilir',
  );

  await hataBekle(
    `select public.identity_belge_kaydet($1, 'front', $2, '{}'::jsonb, 'scanner', null, null, 1000, 'image/jpeg', null)`,
    [appId, `${U.A}/${appId}/x.jpg`],
    'invalid_capture_source',
    'geçersiz yakalama kaynağı reddedilir',
  );

  // OCR beyaz listesi: kimlik numarası hiçbir yere yazılmaz
  const temiz = await deger<Record<string, any>>(
    `select public.identity_ocr_temizle('{"first_name":"Deniz","last_name":"Ak","tckn":"11111111111","document_number":"U123456","birth_date":"1994-04-12","confidence":0.92}'::jsonb)`,
  );
  esit(temiz.first_name, 'Deniz', 'OCR: ad korunur');
  assert(!('tckn' in temiz), 'OCR: kimlik numarası saklanmaz');
  assert(!('document_number' in temiz), 'OCR: belge numarası saklanmaz');
  esit(temiz.confidence, 0.92, 'OCR: güven skoru korunur');

  // =========================================================================
  // 4) Kimlik kartı: ön + arka → selfie bekleniyor
  // =========================================================================
  const on = await rpc(
    'identity_belge_kaydet',
    [appId, 'front', `${U.A}/${appId}/front.jpg`, { state: 'warned' }, 'camera', 1200, 800, 220000, 'image/jpeg', { first_name: 'Deniz', tckn: '11111111111' }],
    U.A,
  );
  esit(on.status, 'awaiting_document', 'ön yüz sonrası arka yüz beklenir');

  const arka = await rpc(
    'identity_belge_kaydet',
    [appId, 'back', `${U.A}/${appId}/back.jpg`, { state: 'passed' }, 'camera', 1200, 800, 210000, 'image/jpeg', null],
    U.A,
  );
  esit(arka.status, 'awaiting_selfie', 'iki yüz sonrası canlı selfie beklenir');

  const ocrKayit = await deger<string>(
    `select ocr_fields::text from public.identity_documents
      where application_id = '${appId}' and side = 'front'`,
  );
  assert(!String(ocrKayit).includes('11111111111'), 'belge OCR kaydında kimlik numarası yok');

  // =========================================================================
  // 5) Canlı selfie oturumu: tek kullanımlık, rastgele sıra, nonce doğrulaması
  // =========================================================================
  const oturum = await rpc('identity_selfie_oturumu_baslat', [appId], U.A);
  const sira = oturum.challenge_sequence as string[];
  esit(sira.length, 4, 'selfie oturumunda 4 adım');
  esit(sira[0], 'center', 'ilk adım daima kameraya bakma');
  assert(new Set(sira).size === 4, 'adımlar tekrar etmez');
  esit(oturum.kalan_deneme, 3, 'başlangıçta 3 deneme hakkı');

  await hataBekle(
    `select public.identity_selfie_tamamla($1, 'yanlis-nonce', $2, $3::jsonb, '{}'::jsonb, '{}'::jsonb, 800, 800, 1000)`,
    [
      oturum.session_id,
      `${U.A}/${appId}/selfie.jpg`,
      JSON.stringify(sira.map((adim) => ({ adim, tamamlandi: true }))),
    ],
    'invalid_session_token',
    'geçersiz tek kullanımlık token reddedilir',
  );

  await hataBekle(
    `select public.identity_selfie_tamamla($1, $2, $3, $4::jsonb, '{}'::jsonb, '{}'::jsonb, 800, 800, 1000)`,
    [
      oturum.session_id,
      oturum.nonce,
      `${U.A}/${appId}/selfie.jpg`,
      JSON.stringify([...sira].reverse().map((adim) => ({ adim, tamamlandi: true }))),
    ],
    'challenge_sequence_mismatch',
    'yanlış sırada tamamlanan hareketler reddedilir',
  );

  await hataBekle(
    `select public.identity_selfie_tamamla($1, $2, $3, $4::jsonb, '{}'::jsonb, '{}'::jsonb, 800, 800, 1000)`,
    [
      oturum.session_id,
      oturum.nonce,
      `${U.A}/${appId}/selfie.jpg`,
      JSON.stringify(sira.map((adim) => ({ adim, tamamlandi: false }))),
    ],
    'challenge_not_completed',
    'tamamlanmamış hareket kabul edilmez',
  );

  const selfie = await rpc(
    'identity_selfie_tamamla',
    [oturum.session_id, oturum.nonce, `${U.A}/${appId}/selfie.jpg`, sira.map((adim) => ({ adim, tamamlandi: true })), { state: 'passed' }, { model: 'test' }, 800, 800, 120000],
    U.A,
  );
  esit(selfie.liveness, 'precheck_only', 'canlılık yalnızca ön sinyal olarak işaretlenir');
  esit(selfie.status, 'in_progress', 'selfie sonrası başvuru devam ediyor');
  esit(selfie.kalan_deneme, 2, 'deneme hakkı azalır');

  await hataBekle(
    `select public.identity_selfie_tamamla($1, $2, $3, $4::jsonb, '{}'::jsonb, '{}'::jsonb, 800, 800, 1000)`,
    [oturum.session_id, oturum.nonce, `${U.A}/${appId}/selfie2.jpg`, sira.map((adim) => ({ adim, tamamlandi: true }))],
    'session_not_pending',
    'aynı selfie oturumu ikinci kez kullanılamaz',
  );

  // =========================================================================
  // 6) Başvuruyu gönderme
  // =========================================================================
  await hataBekle(
    `select public.identity_basvuru_gonder($1, 'Deniz', 'Ak', '2012-02-02', null, 'manual')`,
    [appId],
    'adult_required',
    '18 yaş altı başvuru gönderemez',
  );

  const gonder = await rpc('identity_basvuru_gonder', [appId, 'Deniz', 'Ak', '1994-04-12', { first_name: 'Deniz', tckn: '11111111111' }, 'read'], U.A);
  esit(gonder.status, 'under_review', 'başvuru incelemeye alınır');

  await hataBekle(
    `select public.identity_basvuru_gonder($1, 'Deniz', 'Ak', '1994-04-12', null, 'manual')`,
    [appId],
    'application_not_submittable',
    'gönderilmiş başvuru tekrar gönderilemez',
  );

  d = await rpc('identity_durumum', [], U.A);
  esit(d.status, 'under_review', 'durum gerçek zamanlı under_review');
  esit(d.selfie_kalan_deneme, 2, 'kalan selfie denemesi durumda görünür');

  // =========================================================================
  // 7) Yetkisiz yönetici erişimi
  // =========================================================================
  await kullanici(U.A);
  await hataBekle(`select public.admin_identity_dashboard()`, [], 'Forbidden', 'sıradan kullanıcı dashboard göremez');
  await hataBekle(
    `select public.admin_identity_islem($1, 'approve', 'ok', 'onay', 'not')`,
    [appId],
    'Forbidden',
    'sıradan kullanıcı karar veremez',
  );

  await yetki(U.C, ['identity.view', 'identity.review', 'identity.document.read']);
  await hataBekle(
    `select public.admin_identity_islem($1, 'approve', 'ok', 'onay', 'not')`,
    [appId],
    'Forbidden',
    'belge okuyabilen personel tek başına onaylayamaz',
  );

  // Başkasının belgesine erişim
  const belgeId = await deger<string>(
    `select id from public.identity_documents where application_id = '${appId}' and side = 'front'`,
  );
  await kullanici(U.B);
  await hataBekle(
    `select public.admin_identity_belge_erisim('${belgeId}', 'review')`,
    [],
    'Forbidden',
    'yetkisiz kullanıcı belge erişimi alamaz',
  );

  const erisim = await rpc('admin_identity_belge_erisim', [belgeId, 'review'], U.C);
  esit(erisim.bucket, 'tamuso-verify-docs', 'belge erişimi özel kovadan verilir');
  esit(erisim.expires_in, 300, 'imzalı erişim 5 dakika');
  esit(
    await deger(`select count(*) from public.identity_access_audit
                  where document_id = '${belgeId}' and action = 'document_viewed'`),
    1,
    'belge görüntüleme denetim kaydına yazılır',
  );

  // =========================================================================
  // 8) İnceleme: ek belge isteme ve onay
  // =========================================================================
  await kullanici(U.C);
  const ekBelge = await rpc('admin_identity_islem', [appId, 'request_document', 'blurry', 'Belge bulanık, yeniden çekin'], U.C);
  esit(ekBelge.status, 'awaiting_document', 'ek belge istenir');

  const detay = await rpc('admin_identity_basvuru_detay', [appId], U.C);
  esit(detay.application.status, 'awaiting_document', 'detayda durum güncel');
  esit(detay.documents.length, 3, 'detayda üç görüntü kaydı (ön/arka/selfie)');
  assert(!('storage_path' in detay.documents[0]), 'detay yanıtında ham dosya yolu yok');

  const img = await deger<string>(
    `select storage_path from public.identity_documents where id = '${belgeId}'`,
  );
  assert(String(img).startsWith(`${U.A}/${appId}/`), 'depolama yolu kullanıcı ve başvuru ile kapsüllenir');

  // Kullanıcı yeniden yükler, sonra gönderir
  await rpc('identity_belge_kaydet', [appId, 'front', `${U.A}/${appId}/front2.jpg`, { state: 'passed' }, 'camera', 1200, 800, 200000, 'image/jpeg', null], U.A);
  await rpc('identity_basvuru_gonder', [appId, 'Deniz', 'Ak', '1994-04-12', null, 'manual'], U.A);

  await yetki(U.C, ['identity.view', 'identity.review', 'identity.document.read', 'identity.approve', 'identity.reject']);
  await kullanici(U.C);
  await hataBekle(
    `select public.admin_identity_islem($1, 'approve', 'match', null, null)`,
    [appId],
    'reason_required',
    'gerekçesiz onay reddedilir',
  );

  const onay = await rpc('admin_identity_islem', [appId, 'approve', 'doc_match', 'Belge ve selfie tutarlı, veri girişi doğrulandı', 'Onaylandı'], U.C);
  esit(onay.status, 'approved', 'başvuru onaylanır');
  esit(onay.bekliyor, undefined, 'ikinci onay kapalıyken tek adımda sonuçlanır');

  esit(
    await deger(
      `select decision from public.identity_verification_decisions where application_id = '${appId}' order by created_at desc limit 1`,
    ),
    'approved',
    'karar kaydı oluşturulur',
  );
  esit(
    await deger(
      `select liveness_claim from public.identity_verification_decisions where application_id = '${appId}' order by created_at desc limit 1`,
    ),
    'precheck_only',
    'karar kesin canlılık iddiası içermez',
  );
  esit(
    await deger(
      `select face_match_performed from public.identity_verification_decisions where application_id = '${appId}' order by created_at desc limit 1`,
    ),
    false,
    'yüz eşleştirme varsayılan olarak kapalı',
  );
  esit(
    await deger(`select kyc_status from public.wallet_accounts where user_id = '${U.A}'`),
    'approved',
    'cüzdan KYC durumu Tamuso Verify ile eşitlenir',
  );

  await hataBekle(
    `select public.admin_identity_islem($1, 'approve', 'doc_match', 'tekrar onay', null)`,
    [appId],
    'already_decided',
    'aynı başvuru tekrar onaylanamaz',
  );

  // =========================================================================
  // 9) Ödeme kapısı
  // =========================================================================
  const uygunluk = await rpc('yayinci_uygunluk_durumu', [null], U.A);
  esit(uygunluk.kyc_verified, true, 'uygunluk: kimlik doğrulandı');
  esit(uygunluk.kyc_source, 'tamuso_verify', 'uygunluk: kaynak Tamuso Verify');
  esit(uygunluk.eligible, true, 'uygunluk: tüm koşullar tamam');

  const kosullar = await rpc('identity_odeme_kosullari', [null], U.A);
  esit(kosullar.ok, true, 'ödeme koşulları sağlanır');
  esit(kosullar.identity_approved, true, 'kimlik onayı ödeme koşulu');
  esit(kosullar.document_level, 'complete', 'belge seviyesi complete');
  esit(kosullar.minimum_usd, 25, 'minimum ödeme 25 USD');

  await kullanici(U.A);
  await db.query(
    `insert into public.creator_payout_requests (user_id, amount_usd, net_usd, idempotency_key)
     values ($1, 30, 30, 'payout-0001')`,
    [U.A],
  );
  esit(
    await deger(`select count(*) from public.creator_payout_requests where user_id = '${U.A}'`),
    1,
    'doğrulanmış kullanıcı ödeme talebi açabilir',
  );

  await kullanici(U.B);
  await hataBekle(
    `insert into public.creator_payout_requests (user_id, amount_usd, net_usd, idempotency_key)
     values ($1, 40, 40, 'payout-0002')`,
    [U.B],
    'identity_required',
    'kimlik doğrulanmadan gerçek para talebi açılamaz',
  );

  const kosulB = await rpc('identity_odeme_kosullari', [null], U.B);
  esit(kosulB.ok, false, 'doğrulanmamış kullanıcı ödemeye uygun değil');
  assert((kosulB.kodlar as string[]).includes('identity_required'), 'engel kodu identity_required');
  esit(kosulB.min_balance_ok, true, 'doğrulanmamış olsa da bakiye korunur');

  // =========================================================================
  // 10) Ret + itiraz akışı
  // =========================================================================
  await kullanici(U.B);
  const bBasla = await rpc('identity_basvuru_baslat', ['TR', 'passport', 'kvkk-v1'], U.B);
  const bApp = bBasla.application.id as string;
  await hataBekle(
    `select public.identity_belge_kaydet($1, 'back', $2, '{}'::jsonb, 'camera', null, null, 1000, 'image/jpeg', null)`,
    [bApp, `${U.B}/${bApp}/back.jpg`],
    'back_side_not_supported',
    'tek yüzlü pasaportta arka yüz reddedilir',
  );
  await rpc('identity_belge_kaydet', [bApp, 'front', `${U.B}/${bApp}/front.jpg`, { state: 'failed' }, 'camera', 1000, 700, 100000, 'image/jpeg', null], U.B);

  // Tek yüzlü pasaport: arka yüz gerekmez → doğrudan selfie
  esit(
    await deger(`select status from public.identity_applications where id = '${bApp}'`),
    'awaiting_selfie',
    'pasaportta tek yüz yeterli',
  );

  await hataBekle(
    `select public.identity_basvuru_gonder($1, 'Ege', 'Su', '1991-08-03', null, 'manual')`,
    [bApp],
    'selfie_required',
    'selfie olmadan gönderilemez',
  );

  const bSelfie = await selfieTamamla(U.B, bApp);
  esit(bSelfie.sonuc.status, 'in_progress', 'pasaport + selfie tamamlandı');
  await rpc('identity_basvuru_gonder', [bApp, 'Ege', 'Su', '1991-08-03', null, 'manual'], U.B);

  await hataBekle(
    `select public.identity_itiraz_olustur($1, 'kisa')`,
    [bApp],
    'appeal_not_allowed',
    'onaylı/incelenen başvuruya itiraz edilemez',
  );

  await kullanici(U.C);
  await hataBekle(
    `select public.admin_identity_islem($1, 'reject', 'forged', null, null)`,
    [bApp],
    'reason_required',
    'gerekçesiz ret reddedilir',
  );

  const ret = await rpc('admin_identity_islem', [bApp, 'reject', 'illegible', 'Belge okunamıyor, geçerlilik teyit edilemedi', null], U.C);
  esit(ret.status, 'rejected', 'başvuru reddedilir');

  await kullanici(U.B);
  await hataBekle(
    `select public.identity_itiraz_olustur($1, 'kisa')`,
    [bApp],
    'appeal_message_too_short',
    'çok kısa itiraz metni reddedilir',
  );

  const itiraz = await rpc('identity_itiraz_olustur', [bApp, 'Belgem net çekilmişti, tekrar incelenmesini rica ediyorum.'], U.B);
  esit(itiraz.status, 'appeal_review', 'itiraz sonrası durum appeal_review');

  await hataBekle(
    `select public.identity_itiraz_olustur($1, 'İkinci itiraz denemesi uzun metin')`,
    [bApp],
    'appeal_not_allowed',
    'reddedilmiş durumda olmayan başvuruya yeni itiraz açılamaz',
  );

  const bTekrar = await rpc('identity_basvuru_baslat', ['TR', 'passport', 'kvkk-v1'], U.B);
  esit(bTekrar.created, false, 'aktif başvuru varken yeni başvuru açılmaz');
  esit(bTekrar.application.id, bApp, 'aktif başvuru geri döner');

  // =========================================================================
  // 11) İtiraz sonrası yeniden inceleme
  // =========================================================================
  await yetki(U.C, ['identity.view', 'identity.review', 'identity.document.read', 'identity.approve', 'identity.reject', 'identity.appeal.review']);
  const itirazListe = await rpc('admin_identity_itirazlar', ['open'], U.C);
  esit(itirazListe.kayitlar.length, 1, 'açık itiraz kuyrukta');
  const appealId = itirazListe.kayitlar[0].id as string;

  const yeniden = await rpc('admin_identity_itiraz_karar', [appealId, 'reopen', 'Belge yeniden incelenecek'], U.C);
  esit(yeniden.application_status, 'additional_verification', 'itiraz kabul edilir, başvuru yeniden açılır');

  const yeniSelfie = await selfieTamamla(U.B, bApp);
  esit(yeniSelfie.sonuc.status, 'in_progress', 'yeniden selfie alınabilir');
  await rpc('identity_basvuru_gonder', [bApp, 'Ege', 'Su', '1991-08-03', null, 'manual'], U.B);

  // =========================================================================
  // 12) İkinci yönetici onayı
  // =========================================================================
  await yetki(U.D, ['identity.view', 'identity.document.read', 'identity.approve',
                    'identity.settings.manage', 'identity.audit.view']);
  await rpc('admin_identity_ayar_guncelle', [null, null, null, true], U.D);
  await kullanici(U.C);
  await hataBekle(
    `select public.admin_identity_ayar_guncelle(null, null, null, false)`,
    [],
    'Forbidden',
    'ayar değişikliği ayrı yetki ister',
  );

  const bekleyen = await rpc('admin_identity_islem', [bApp, 'approve', 'doc_match', 'Belge ve selfie tutarlı', null], U.C);
  esit(bekleyen.bekliyor, true, 'riskli karar ikinci onaya düşer');
  esit(bekleyen.mesaj, 'second_approval_required', 'ikinci onay mesajı döner');

  await hataBekle(
    `select public.admin_identity_ikinci_onay($1, true)`,
    [bApp],
    'second_approval_self',
    'aynı yönetici kendi kararını onaylayamaz',
  );

  await yetki(U.D, ['identity.view', 'identity.document.read', 'identity.approve']);
  const ikinciOnay = await rpc('admin_identity_ikinci_onay', [bApp, true], U.D);
  esit(ikinciOnay.status, 'approved', 'ikinci yönetici onayı ile karar kesinleşir');
  esit(
    await deger(`select second_reviewer_id from public.identity_verification_decisions
                  where application_id = '${bApp}' order by created_at desc limit 1`),
    U.D,
    'ikinci denetleyen karar kaydında saklanır',
  );

  const uygunlukB = await rpc('yayinci_uygunluk_durumu', [null], U.B);
  esit(uygunlukB.kyc_verified, true, 'itiraz sonrası onay ödeme kapısını açar');

  // =========================================================================
  // 13) Dashboard ve denetim kayıtları
  // =========================================================================
  const panel = await rpc('admin_identity_dashboard', [], U.C);
  esit(panel.toplam, 2, 'dashboard: toplam başvuru');
  esit(panel.onaylanan, 2, 'dashboard: onaylanan');
  esit(panel.reddedilen, 0, 'dashboard: reddedilen');
  esit(panel.belge_goruntuleme_yetkisi, true, 'dashboard: belge izni görünür');
  esit(panel.ayar_yetkisi, false, 'dashboard: personelde ayar yetkisi yok');

  const kuyruk = await rpc('admin_identity_basvurular', [null, 'Deniz', 10, 0], U.C);
  esit(kuyruk.toplam, 1, 'kuyruk aramasında tek kayıt');
  esit(kuyruk.kayitlar[0].status, 'approved', 'kuyrukta durum güncel');

  const denetim = await rpc('admin_identity_denetim', [null, 50], U.C);
  assert(denetim.kayitlar.length > 0, 'denetim kayıtları listelenir');
  assert(
    (denetim.kayitlar as any[]).some((k) => k.action === 'document_viewed'),
    'belge görüntüleme denetimde',
  );
  assert(
    (denetim.kayitlar as any[]).some((k) => k.action === 'settings_updated'),
    'ayar değişikliği denetimde',
  );

  // =========================================================================
  // 14) Saklama ve imha
  // =========================================================================
  esit(
    await deger(`select public from storage.buckets where id = 'tamuso-verify-docs'`),
    false,
    'depolama alanı herkese açık değil',
  );

  // Süresi geçmiş selfie oturumu otomatik kapatılır
  await db.query(
    `insert into public.identity_capture_sessions
       (application_id, user_id, nonce_hash, challenge_sequence, expires_at, state)
     values ($1, $2, 'x', array['center'], now() - interval '5 minutes', 'pending')`,
    [bApp, U.B],
  );
  let saklama = await deger<Record<string, any>>(`select public.identity_saklama_calistir(100)`);
  assert(saklama.suresi_gecen_oturum >= 1, 'süresi geçen oturum expire edilir');
  esit(
    await deger(`select state from public.identity_capture_sessions
                  where application_id = '${bApp}' and nonce_hash = 'x'`),
    'expired',
    'oturum durumu expired',
  );

  // Saklama süresi dolmuş onaylı başvuru belgesi işaretlenir
  await db.query(`update public.identity_verify_settings set belge_saklama_gun = 30 where id = 1`);
  await db.query(
    `update public.identity_applications set decided_at = now() - interval '400 days' where id = $1`,
    [appId],
  );
  saklama = await deger<Record<string, any>>(`select public.identity_saklama_calistir(100)`);
  assert(saklama.isaretlenen_belge >= 1, 'saklama süresi dolan belge işaretlenir');

  const isaretli = await deger(
    `select count(*) from public.identity_documents
      where application_id = '${appId}' and deleted_at is not null and delete_reason = 'retention'`,
  );
  esit(isaretli, 3, 'üç görüntü saklama nedeniyle işaretlendi');

  // İşaretliler 30 gün sonra depodan ve tablodan silinir
  await db.query(
    `update public.identity_documents set deleted_at = now() - interval '40 days'
      where application_id = $1`,
    [appId],
  );
  await db.query(
    `insert into storage.objects (bucket_id, name)
     select 'tamuso-verify-docs', storage_path from public.identity_documents where application_id = $1`,
    [appId],
  );
  saklama = await deger<Record<string, any>>(`select public.identity_saklama_calistir(100)`);
  assert(saklama.imha_edilen_belge >= 3, 'işaretli belgeler kalıcı silinir');
  assert(saklama.silinen_obje >= 3, 'depodaki nesneler de silinir');
  esit(
    await deger(`select count(*) from public.identity_documents where application_id = '${appId}'`),
    0,
    'ham belge satırları kalmaz',
  );
  esit(
    await deger(`select count(*) from storage.objects where bucket_id = 'tamuso-verify-docs'`),
    0,
    'depoda ham görüntü kalmaz',
  );
  esit(
    await deger(`select count(*) from public.identity_verification_decisions where application_id = '${appId}'`),
    1,
    'karar kaydı saklama sonrası korunur',
  );

  // =========================================================================
  // 15) Kullanıcı veri talebi ve belge kaldırma
  // =========================================================================
  await kullanici(U.B);
  const durumB = await rpc('identity_durumum', [], U.B);
  esit(durumB.status, 'approved', 'kullanıcı kendi durumunu görür');

  const talep = await rpc('identity_ham_belge_silme_talebi', [bApp], U.B);
  assert(talep.silinen_kayit >= 1, 'kullanıcı ham belgelerinin silinmesini talep edebilir');

  const veriDurumu = await rpc('identity_veri_talebi_durumu', [], U.B);
  assert(veriDurumu.silinmis_kayit >= 1, 'veri talebi durumu yansıtılır');

  await kullanici(U.A);
  await hataBekle(
    `select public.identity_belge_kaldir('${belgeId}')`,
    [],
    'Not found',
    'başka kullanıcının belgesi kaldırılamaz',
  );

  // =========================================================================
  // 16) Onaylı başvuruda düzenleme kilidi
  // =========================================================================
  await hataBekle(
    `select public.identity_belge_kaydet($1, 'front', $2, '{}'::jsonb, 'camera', null, null, 1000, 'image/jpeg', null)`,
    [appId, `${U.A}/${appId}/again.jpg`],
    'application_not_editable',
    'onaylı başvuru üzerinde değişiklik yapılamaz',
  );
}

async function main() {
  await kur();
  await testler();
  console.log(`tamuso-verify-sql: ${passed} başarılı, ${failed} başarısız`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
