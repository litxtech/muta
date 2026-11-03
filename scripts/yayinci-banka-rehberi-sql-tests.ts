/**
 * Yayıncı banka rehberi — gerçek migration'lar izole PGlite üzerinde çalıştırılır.
 *
 * Kapsam:
 *  - Ülke banka/cüzdan rehberi ve ülke kuralları (IBAN uzunluğu, para birimi)
 *  - Ülke durumu: kanal + alan şeması + banka listesi
 *  - Hesap kaydı: bank_code ile banka adı çözümü, IBAN doğrulaması
 *  - IBAN kullanmayan ülkelerde (US routing, PH GCash, IN UPI) kayıt hatası
 *    veren user_bank_accounts uzunluk kısıtının düzeltilmesi
 *
 * Çalıştırma: npx --yes tsx scripts/yayinci-banka-rehberi-sql-tests.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const MIGRASYONLAR = [
  '20261101160000_yayinci_banka_rehberi.sql',
  '20261101161000_yayinci_banka_rehberi_ek_ulkeler.sql',
  '20261101163000_yayinci_banka_hesabi_kisit_duzeltme.sql',
];

const STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.profiles (id uuid primary key);

create function public.ben_admin_miyim() returns boolean language sql stable as $$ select false $$;

create function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.financial_audit_events (
  actor_id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  details jsonb
);

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

-- 018_profil_banka_hesabi.sql ile birebir: eski dar kısıt korunur ki
-- düzeltme migration'ının gerçekten gevşettiği doğrulansın.
create table public.user_bank_accounts (
  user_id uuid primary key,
  account_holder text not null,
  bank_name text not null,
  iban text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_bank_accounts_iban_len
    check (char_length(replace(iban, ' ', '')) between 15 and 34)
);
create unique index user_bank_accounts_iban_unique
  on public.user_bank_accounts (upper(replace(iban, ' ', '')));

create table public.country_payout_methods (
  country_code char(2) not null,
  method text not null,
  provider text,
  currency char(3) not null default 'USD',
  min_payout_usd numeric not null default 25,
  is_enabled boolean not null default true,
  auto_payout boolean not null default false,
  requires_kyc boolean not null default true,
  requires_tax_info boolean not null default true,
  requirements jsonb not null default '{}'::jsonb,
  note text,
  updated_at timestamptz not null default now(),
  primary key (country_code, method)
);

-- 20261101100000_yayinci_odeme_hesabi_coklu_ulke.sql ile aynı doğrulama.
create function public.odeme_detay_dogrula(p_spec jsonb, p_details jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_fields jsonb := coalesce(p_spec -> 'fields', '[]'::jsonb);
  f jsonb;
  k text;
  v text;
begin
  if jsonb_typeof(v_fields) <> 'array' then
    return 'invalid_spec';
  end if;

  for f in select e.oge from jsonb_array_elements(v_fields) as e(oge) loop
    k := lower(coalesce(f ->> 'key', ''));
    if k = '' then
      return 'invalid_spec';
    end if;
    v := p_details ->> k;

    if coalesce((f ->> 'required')::boolean, true) and coalesce(trim(v), '') = '' then
      return 'field_required:' || k;
    end if;

    if coalesce(trim(v), '') <> '' then
      if f ? 'pattern' and v !~ (f ->> 'pattern') then
        return 'field_invalid:' || k;
      end if;
      if f ? 'enum' and not exists (
        select 1
        from jsonb_array_elements_text(f -> 'enum') as el(deger)
        where lower(el.deger) = lower(v)
      ) then
        return 'field_invalid:' || k;
      end if;
      if f ? 'max_length' and length(v) > (f ->> 'max_length')::int then
        return 'field_invalid:' || k;
      end if;
      if f ? 'min_length' and length(v) < (f ->> 'min_length')::int then
        return 'field_invalid:' || k;
      end if;
      if coalesce((f ->> 'numeric')::boolean, false) and v !~ '^[0-9]+$' then
        return 'field_invalid:' || k;
      end if;
    end if;
  end loop;

  return null;
end;
$$;

create function public.iban_gecerli_mi(p text) returns boolean
language plpgsql immutable as $$
declare
  v text := upper(regexp_replace(coalesce(p, ''), '\\s', '', 'g'));
  i int;
  c text;
  parca text;
  v_mod numeric := 0;
begin
  if v !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then
    return false;
  end if;
  v := substr(v, 5) || substr(v, 1, 4);
  for i in 1..length(v) loop
    c := substr(v, i, 1);
    if c ~ '[0-9]' then
      parca := c;
    else
      parca := (ascii(c) - 55)::text;
    end if;
    v_mod := (v_mod * power(10, length(parca)) + parca::numeric)::numeric;
    v_mod := v_mod % 97;
  end loop;
  return v_mod = 1;
end;
$$;
`;

const KULLANICI = '00000000-0000-0000-0000-0000000000a1';

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

async function hataBekle(
  db: PGlite,
  sql: string,
  params: unknown[],
  kod: string,
  mesaj: string,
) {
  try {
    await db.query(sql, params);
    dogrula(false, `${mesaj} — hata bekleniyordu (${kod})`);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    dogrula(m.includes(kod), `${mesaj} (beklenen kod: ${kod}, gelen: ${m})`);
  }
}

async function kaydet(
  db: PGlite,
  girdi: {
    ulke: string;
    yontem?: string;
    sema: string;
    sahip?: string;
    banka?: string;
    para?: string;
    bankaKodu?: string | null;
    detay: Record<string, string>;
  },
) {
  return db.query(
    `select public.yayinci_odeme_hesabi_kaydet(
       $1, $2, null, $3, $4, $5, $6, $7::jsonb, $8
     ) as r`,
    [
      girdi.sahip ?? 'Ada Lovelace',
      girdi.banka ?? '',
      girdi.ulke,
      girdi.para ?? 'USD',
      girdi.yontem ?? 'bank_transfer',
      girdi.sema,
      JSON.stringify(girdi.detay),
      girdi.bankaKodu ?? null,
    ],
  );
}

async function main() {
  const db = new PGlite();
  await db.exec(STUB);

  for (const dosya of MIGRASYONLAR) {
    const sql = readFileSync(
      join(process.cwd(), 'supabase', 'migrations', dosya),
      'utf8',
    );
    try {
      await db.exec(sql);
    } catch (e) {
      console.error('MIGRATION HATASI', dosya, e);
      throw e;
    }
  }

  await db.query(`insert into public.profiles (id) values ($1)`, [KULLANICI]);
  await db.exec(`select set_config('request.jwt.claim.sub', '${KULLANICI}', false)`);

  /* --- 1) Rehber ve kurallar ---------------------------------------------- */
  let liste = (
    await db.query(`select public.odeme_banka_listesi('GB','bank') as b`)
  ).rows[0] as any;
  dogrula(Array.isArray(liste.b) && liste.b.length >= 10, 'GB banka listesi dolu');

  liste = (
    await db.query(`select public.odeme_banka_listesi('US','bank') as b`)
  ).rows[0] as any;
  dogrula(
    Array.isArray(liste.b) && liste.b.some((x: any) => x.code === 'chase'),
    'US banka listesi Chase içerir',
  );

  liste = (
    await db.query(`select public.odeme_banka_listesi('IN','wallet') as b`)
  ).rows[0] as any;
  dogrula(
    Array.isArray(liste.b) && liste.b.some((x: any) => x.code === 'phonepe'),
    'IN cüzdan listesi PhonePe içerir',
  );

  const uzunluk = (
    await db.query(`select public.iban_ulke_uzunlugu('gb') as u`)
  ).rows[0] as any;
  esit(uzunluk.u, 22, 'GB IBAN uzunluğu 22');

  const adi = (
    await db.query(`select public.odeme_banka_adi('gb','barclays','bank') as a`)
  ).rows[0] as any;
  esit(adi.a, 'Barclays', 'Banka kodu banka adına çözülür');

  /* --- 2) Ülke durumu: alanlar + banka listesi ---------------------------- */
  const gb = (
    await db.query(`select public.yayinci_odeme_ulke_durumu('GB') as d`)
  ).rows[0] as any;
  const gbAna = gb.d.methods.find((m: any) => m.method === 'bank_transfer');
  dogrula(Boolean(gbAna), 'GB banka transferi kanalı var');
  esit(
    gbAna.fields.map((f: any) => f.key),
    ['sort_code', 'account_number'],
    'GB alanları sort code + hesap no',
  );
  esit(gbAna.banks.length >= 10, true, 'GB kanalında banka listesi dolu');
  esit(gb.d.rules.currency, 'GBP', 'GB para birimi GBP');
  esit(gb.d.banks.bank.length >= 10, true, 'GB genel banka listesi dolu');

  const us = (
    await db.query(`select public.yayinci_odeme_ulke_durumu('US') as d`)
  ).rows[0] as any;
  const usAna = us.d.methods.find((m: any) => m.method === 'bank_transfer');
  esit(
    usAna.fields.map((f: any) => f.key),
    ['routing_number', 'account_number', 'account_type', 'swift_bic'],
    'US alanları routing + hesap + tür',
  );

  const tr = (
    await db.query(`select public.yayinci_odeme_ulke_durumu('TR') as d`)
  ).rows[0] as any;
  esit(tr.d.rules.iban_length, 26, 'TR IBAN uzunluğu 26');

  const bilinmeyen = (
    await db.query(`select public.yayinci_odeme_ulke_durumu('ZZ') as d`)
  ).rows[0] as any;
  dogrula(bilinmeyen.d.supported, 'Tanımsız ülkede genel havale şeması devrede');
  esit(bilinmeyen.d.generic, true, 'Tanımsız ülke generic işaretli');

  /* --- 3) TR IBAN kaydı + banka kodu ------------------------------------- */
  let r = (
    await kaydet(db, {
      ulke: 'TR',
      sema: 'iban',
      bankaKodu: 'ziraat',
      detay: { iban: 'TR33 0006 1005 1978 6457 8413 26' },
    })
  ).rows[0] as any;
  esit(r.r.bank_name, 'Ziraat Bankası', 'TR banka adı rehberden gelir');
  esit(r.r.bank_code, 'ziraat', 'TR banka kodu kaydedilir');
  esit(r.r.status, 'pending_verification', 'Yeni hesap doğrulama bekler');
  dogrula(
    String(r.r.details_masked.iban).endsWith('1326'),
    'IBAN maskeli saklanır',
  );

  /* --- 4) Hatalı IBAN uzunluğu reddedilir -------------------------------- */
  await hataBekle(
    db,
    `select public.yayinci_odeme_hesabi_kaydet('Ada','Ziraat',null,'TR','TRY','bank_transfer','iban',$1::jsonb,null)`,
    [JSON.stringify({ iban: 'TR3300061005197864578413' })],
    'invalid_iban',
    'Kısa TR IBAN reddedilir',
  );

  /* --- 5) IBAN ülke uyuşmazlığı ------------------------------------------ */
  await hataBekle(
    db,
    `select public.yayinci_odeme_hesabi_kaydet('Ada','Deutsche Bank',null,'DE','EUR','bank_transfer','iban',$1::jsonb,null)`,
    [JSON.stringify({ iban: 'TR330006100519786457841326' })],
    'iban_country_mismatch',
    'DE hesabına TR IBAN reddedilir',
  );

  /* --- 6) Geçersiz banka kodu -------------------------------------------- */
  await hataBekle(
    db,
    `select public.yayinci_odeme_hesabi_kaydet('Ada','',null,'TR','TRY','bank_transfer','iban',$1::jsonb,'yokbank')`,
    [JSON.stringify({ iban: 'TR330006100519786457841326' })],
    'invalid_bank',
    'Rehberde olmayan banka kodu reddedilir',
  );

  /* --- 7) ABD: 8 haneli hesap numarası (eski kısıtın kırıldığı yer) ------ */
  r = (
    await kaydet(db, {
      ulke: 'US',
      sema: 'us_ach',
      para: 'USD',
      bankaKodu: 'chase',
      detay: {
        routing_number: '021000021',
        account_number: '12345678',
        account_type: 'checking',
      },
    })
  ).rows[0] as any;
  esit(r.r.bank_name, 'JPMorgan Chase', 'US banka adı rehberden gelir');
  esit(r.r.scheme, 'us_ach', 'US şeması us_ach');

  /* --- 8) Filipinler: 11 haneli GCash numarası --------------------------- */
  r = (
    await kaydet(db, {
      ulke: 'PH',
      yontem: 'wallet_transfer',
      sema: 'wallet',
      para: 'PHP',
      bankaKodu: 'gcash',
      detay: { wallet_number: '09171234567' },
    })
  ).rows[0] as any;
  esit(r.r.bank_code, 'gcash', 'PH cüzdan kodu kaydedilir');

  /* --- 9) İngiltere: sort code tireleri normalleşir ---------------------- */
  r = (
    await kaydet(db, {
      ulke: 'GB',
      sema: 'uk_sort_code',
      para: 'GBP',
      bankaKodu: 'barclays',
      detay: { sort_code: '20-00-00', account_number: '55779911' },
    })
  ).rows[0] as any;
  esit(r.r.details_masked.sort_code, '200000', 'Sort code tireleri temizlenir');
  dogrula(
    String(r.r.details_masked.account_number).endsWith('9911'),
    'GB hesap numarası maskelenir',
  );

  /* --- 10) Eksik zorunlu alan -------------------------------------------- */
  await hataBekle(
    db,
    `select public.yayinci_odeme_hesabi_kaydet('Ada','',null,'GB','GBP','bank_transfer','uk_sort_code','{"sort_code":"200000"}'::jsonb,'barclays')`,
    [],
    'field_required:account_number',
    'GB hesap numarası zorunlu',
  );

  /* --- 11) Banka adı zorunlu ülkede boş banka ---------------------------- */
  await hataBekle(
    db,
    `select public.yayinci_odeme_hesabi_kaydet('Ada','',null,'US','USD','bank_transfer','us_ach',$1::jsonb,null)`,
    [
      JSON.stringify({
        routing_number: '021000021',
        account_number: '12345678',
        account_type: 'checking',
      }),
    ],
    'bank_name_required',
    'US için banka adı zorunlu',
  );

  /* --- 12) user_bank_accounts kısıtı gevşetildi -------------------------- */
  const kisit = (
    await db.query(
      `select pg_get_constraintdef(oid) as d
       from pg_constraint where conname = 'user_bank_accounts_iban_len'`,
    )
  ).rows[0] as any;
  dogrula(String(kisit.d).includes('4'), 'Kısıt 4 karaktere kadar izin verir');

  const index = (
    await db.query(
      `select count(*)::int as c from pg_indexes
       where tablename = 'user_bank_accounts' and indexname = 'user_bank_accounts_iban_unique'`,
    )
  ).rows[0] as any;
  esit(index.c, 0, 'Global tekil IBAN indeksi kaldırıldı');

  const ozet = await db.query(
    `select count(*)::int as c from public.country_bank_directory`,
  );
  dogrula(
    (ozet.rows[0] as any).c > 400,
    'Banka rehberi 400+ satır içerir',
  );

  console.log(
    `\nyayinci-banka-rehberi-sql: ${gecen} başarılı, ${kalan} başarısız`,
  );
  if (kalan > 0) process.exitCode = 1;
  await db.close();
}

void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
