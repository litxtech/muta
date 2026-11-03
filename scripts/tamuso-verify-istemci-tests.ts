/**
 * Tamuso Verify — istemci ve sözleşme testleri.
 *
 * Kapsam:
 *  - MRZ (TD1/TD3) ayrıştırma + kontrol basamağı doğrulaması
 *  - OCR beyaz liste kırpması (kimlik/belge numarası sızmaz)
 *  - Görüntü kalitesi eşikleri (bulanık / karanlık / parlama / failed)
 *  - Hata kodlarının Türkçe karşılıkları
 *  - Migrasyon güvenlik sözleşmeleri (özel bucket, RLS, denetim, ödeme kapısı)
 *  - Rota ve çeviri anahtarı bütünlüğü
 *
 * Çalıştırma: npx --yes tsx scripts/tamuso-verify-istemci-tests.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { kaliteDegerlendir, KALITE_ESIKLERI } from '../src/moduller/tamuso-verify/BelgeKalite';
import {
  mrzAyristir,
  mrzKontrolBasamak,
  mrzdenTemizOcr,
  mrzTd1Ayristir,
  mrzTd3Ayristir,
  ocrTemizle,
} from '../src/moduller/tamuso-verify/OcrMrzAyristirici';
import { verifyHataAnahtari } from '../src/moduller/tamuso-verify/HataCeviri';
import {
  CekimDurumunuHesapla,
  CekimHataAnahtari,
  CekimHataYonlendirmesi,
} from '../src/moduller/cuzdan/yayinci/CekimKapisi';
import {
  BelgeMimeTipi,
  BelgeUzantisi,
  GecerliEksikler,
  OdemeProfiliVerisiCoz,
} from '../src/moduller/cuzdan/yayinci/OdemeProfiliYardimcilari';
import type {
  YayinciKazancOzeti,
  YayinciUygunluk,
} from '../src/moduller/cuzdan/yayinci/YayinciKazancApi';

const KOK = process.cwd();
let basarili = 0;
let basarisiz = 0;

function assert(kosul: unknown, mesaj: string) {
  if (kosul) {
    basarili += 1;
  } else {
    basarisiz += 1;
    console.error(`  ✗ ${mesaj}`);
  }
}

function esit(gercek: unknown, beklenen: unknown, mesaj: string) {
  assert(
    JSON.stringify(gercek) === JSON.stringify(beklenen),
    `${mesaj} (gerçek: ${JSON.stringify(gercek)}, beklenen: ${JSON.stringify(beklenen)})`,
  );
}

function dosya(rel: string): string {
  return fs.readFileSync(path.join(KOK, rel), 'utf8');
}

function varMi(rel: string): boolean {
  return fs.existsSync(path.join(KOK, rel));
}

/* ------------------------------------------------------------------ */
/* MRZ üretimi (test verisi)                                           */
/* ------------------------------------------------------------------ */

const BOSLUK = (n: number) => ''.padEnd(n, '<');

function td3Satirlari(girdi: {
  soyad: string;
  ad: string;
  belgeNo: string;
  dogum: string;
  gecerlilik: string;
  uyruk?: string;
  cinsiyet?: string;
}): string[] {
  const adAlan = `${girdi.soyad.toUpperCase()}<<${girdi.ad.toUpperCase()}`.padEnd(39, '<').slice(0, 39);
  const l1 = `P<TUR${adAlan}`;
  const belgeNo = girdi.belgeNo.padEnd(9, '<').slice(0, 9);
  const kisisel = BOSLUK(14);
  const ara =
    `${belgeNo}${mrzKontrolBasamak(belgeNo)}` +
    (girdi.uyruk ?? 'TUR') +
    `${girdi.dogum}${mrzKontrolBasamak(girdi.dogum)}` +
    (girdi.cinsiyet ?? 'M') +
    `${girdi.gecerlilik}${mrzKontrolBasamak(girdi.gecerlilik)}` +
    `${kisisel}${mrzKontrolBasamak(kisisel)}`;
  const bilesik = `${ara.slice(0, 10)}${ara.slice(13, 20)}${ara.slice(21, 28)}${ara.slice(28, 43)}`;
  return [l1, `${ara}${mrzKontrolBasamak(bilesik)}`];
}

function td1Satirlari(girdi: {
  soyad: string;
  ad: string;
  belgeNo: string;
  dogum: string;
  gecerlilik: string;
  uyruk?: string;
  cinsiyet?: string;
}): string[] {
  const belgeNo = girdi.belgeNo.padEnd(9, '<').slice(0, 9);
  const l1 = `I<TUR${belgeNo}${mrzKontrolBasamak(belgeNo)}${BOSLUK(15)}`;
  const bas = `${girdi.dogum}${mrzKontrolBasamak(girdi.dogum)}${girdi.cinsiyet ?? 'F'}${girdi.gecerlilik}${mrzKontrolBasamak(girdi.gecerlilik)}${girdi.uyruk ?? 'TUR'}${BOSLUK(11)}`;
  const bilesik = `${l1.slice(5, 30)}${bas.slice(0, 7)}${bas.slice(8, 15)}${bas.slice(18, 29)}`;
  const l2 = `${bas}${mrzKontrolBasamak(bilesik)}`;
  const l3 = `${girdi.soyad.toUpperCase()}<<${girdi.ad.toUpperCase()}`.padEnd(30, '<').slice(0, 30);
  return [l1, l2, l3];
}

/* ------------------------------------------------------------------ */
/* Testler                                                             */
/* ------------------------------------------------------------------ */

function mrzTestleri() {
  const [l1, l2] = td3Satirlari({
    soyad: 'YILMAZ',
    ad: 'AYSE NUR',
    belgeNo: 'U12345678',
    dogum: '900215',
    gecerlilik: '310912',
  });
  const td3 = mrzTd3Ayristir([l1!, l2!]);
  esit(td3.format, 'TD3', 'TD3 formatı tanınır');
  esit(td3.belgeTuru, 'passport', 'TD3 pasaport olarak sınıflanır');
  esit(td3.soyad, 'Yilmaz', 'TD3 soyadı ASCII olarak çözülür');
  esit(td3.ad, 'Ayse Nur', 'TD3 adı çözülür');
  esit(td3.dogumTarihi, '1990-02-15', 'TD3 doğum tarihi 19xx çözülür');
  esit(td3.gecerlilikTarihi, '2031-09-12', 'TD3 geçerlilik tarihi 20xx çözülür');
  assert(td3.kontrolBasamaklariGecerli, 'TD3 dört kontrol basamağı da geçerli');
  esit(td3.kontroller.length, 4, 'TD3 dört kontrol raporlanır');

  // Tek haneli bozulma → kontrol basamağı uyarır
  const bozuk = l2!.slice(0, 9) + (l2![9] === '9' ? '8' : '9') + l2!.slice(10);
  const td3Bozuk = mrzTd3Ayristir([l1!, bozuk]);
  assert(!td3Bozuk.kontrolBasamaklariGecerli, 'TD3 bozuk kontrol basamağı yakalanır');
  assert(
    td3Bozuk.kontroller.some((k) => k.alan === 'belge_no' && !k.gecerli),
    'TD3 belge no kontrolü ayrı raporlanır',
  );

  const [t1, t2, t3] = td1Satirlari({
    soyad: 'DEMIR',
    ad: 'MEHMET',
    belgeNo: 'A12345678',
    dogum: '850701',
    gecerlilik: '301231',
  });
  const td1 = mrzTd1Ayristir([t1!, t2!, t3!]);
  esit(td1.format, 'TD1', 'TD1 formatı tanınır');
  esit(td1.belgeTuru, 'id_card', 'TD1 kimlik kartı olarak sınıflanır');
  esit(td1.ad, 'Mehmet', 'TD1 adı çözülür');
  esit(td1.soyad, 'Demir', 'TD1 soyadı çözülür');
  esit(td1.dogumTarihi, '1985-07-01', 'TD1 doğum tarihi çözülür');
  assert(td1.kontrolBasamaklariGecerli, 'TD1 kontrol basamakları geçerli');

  const otomatik = mrzAyristir(`\n${l1}\n${l2}\n`);
  esit(otomatik.format, 'TD3', 'Metinden MRZ otomatik bulunur');

  const yok = mrzAyristir('bu bir mrz degil');
  esit(yok.format, 'bilinmiyor', 'MRZ olmayan metin bilinmiyor döner');
  assert(!yok.kontrolBasamaklariGecerli, 'MRZ yoksa kontrol geçerli sayılmaz');

  // Gelecekteki doğum yılı 19xx'e düşer (90 → 1990, 20 → 2020 değil 1920)
  const gelecek = mrzTd3Ayristir(
    td3Satirlari({
      soyad: 'TEST',
      ad: 'KISI',
      belgeNo: 'X00000001',
      dogum: '300101',
      gecerlilik: '301231',
    }),
  );
  esit(gelecek.dogumTarihi, '1930-01-01', 'Gelecekteki doğum tarihi 19xx kabul edilir');
}

function ocrTestleri() {
  const ham = {
    first_name: 'Ayşe',
    last_name: 'Yılmaz',
    birth_date: '1990-02-15',
    expiry_date: '2031-09-12',
    doc_type: 'passport',
    mrz_valid: true,
    mrz_checksum_ok: true,
    confidence: 3.4,
    tckn: '11111111111',
    document_number: 'U12345678',
    mrz_line: 'P<TURYILMAZ<<AYSE<NUR...',
    national_id: '12345678901',
  };
  const temiz = ocrTemizle(ham);
  esit(temiz.first_name, 'Ayşe', 'OCR adı korunur');
  esit(temiz.last_name, 'Yılmaz', 'OCR soyadı korunur');
  esit(temiz.confidence, 1, 'OCR güveni 0-1 aralığına sıkıştırılır');
  assert(!('tckn' in temiz), 'OCR: TCKN sunucuya gönderilmez');
  assert(!('national_id' in temiz), 'OCR: ulusal kimlik no gönderilmez');
  assert(!('document_number' in temiz), 'OCR: belge numarası gönderilmez');
  assert(!('mrz_line' in temiz), 'OCR: ham MRZ satırı gönderilmez');
  assert(!JSON.stringify(temiz).includes('11111111111'), 'OCR çıktısında kimlik no yok');

  esit(ocrTemizle(null), {}, 'null OCR boş nesne döner');
  esit(ocrTemizle([1, 2]), {}, 'dizi OCR boş nesne döner');

  const mrz = mrzTd3Ayristir(
    td3Satirlari({
      soyad: 'KAYA',
      ad: 'ALI',
      belgeNo: 'P99887766',
      dogum: '990505',
      gecerlilik: '290505',
    }),
  );
  const mrzOcr = mrzdenTemizOcr(mrz);
  esit(mrzOcr.mrz_valid, true, 'MRZ geçerliliği beyaz listede taşınır');
  esit(mrzOcr.mrz_checksum_ok, true, 'MRZ kontrol basamağı beyaz listede taşınır');
  esit(mrzOcr.doc_type, 'passport', 'MRZ belge türü beyaz listede taşınır');
  assert(!('belgeNo' in (mrzOcr as Record<string, unknown>)), 'MRZ belge no dışa verilmez');
}

function kaliteTestleri() {
  const iyi = kaliteDegerlendir({
    genislik: 1440,
    yukseklik: 900,
    parlaklik: 130,
    kontrast: 62,
    keskinlik: 220,
    parlakOran: 0.02,
    karanlikOran: 0.01,
  });
  esit(iyi.state, 'passed', 'Net ve aydınlık görüntü geçer');

  const bulanik = kaliteDegerlendir({
    genislik: 1440,
    yukseklik: 900,
    parlaklik: 120,
    kontrast: 55,
    keskinlik: KALITE_ESIKLERI.minKeskinlik - 15,
    parlakOran: 0.01,
    karanlikOran: 0.01,
  });
  esit(bulanik.state, 'warned', 'Hafif bulanıklık uyarı üretir');
  assert(bulanik.kodlar.includes('bulanik'), 'Bulanıklık kodu raporlanır');

  const karanlik = kaliteDegerlendir({
    genislik: 1200,
    yukseklik: 800,
    parlaklik: KALITE_ESIKLERI.minParlaklik - 10,
    kontrast: 40,
    keskinlik: 180,
    parlakOran: 0.01,
    karanlikOran: 0.2,
  });
  esit(karanlik.state, 'warned', 'Yetersiz ışık uyarı üretir');
  assert(karanlik.kodlar.includes('karanlik'), 'Karanlık kodu raporlanır');

  const parlama = kaliteDegerlendir({
    genislik: 1200,
    yukseklik: 800,
    parlaklik: 120,
    kontrast: 45,
    keskinlik: 160,
    parlakOran: 0.3,
    karanlikOran: 0.01,
  });
  assert(parlama.kodlar.includes('parlama'), 'Parlama kodu raporlanır');

  const kullanilamaz = kaliteDegerlendir({
    genislik: 400,
    yukseklik: 260,
    parlaklik: 20,
    kontrast: 8,
    keskinlik: 10,
    parlakOran: 0,
    karanlikOran: 0.7,
  });
  esit(kullanilamaz.state, 'failed', 'Kullanılamaz görüntü reddedilir (yeniden çekim)');
  assert(kullanilamaz.kodlar.includes('kucuk'), 'Düşük çözünürlük kodu raporlanır');
}

function hataTestleri() {
  esit(verifyHataAnahtari('document_required'), 'verify.hataBelgeGerekli', 'Belge zorunlu hatası çevrilir');
  esit(verifyHataAnahtari('document_back_required'), 'verify.hataArkaGerekli', 'Arka yüz hatası çevrilir');
  esit(verifyHataAnahtari('selfie_required'), 'verify.hataSelfieGerekli', 'Selfie zorunlu hatası çevrilir');
  esit(verifyHataAnahtari('adult_required'), 'verify.hataYetiskin', '18 yaş hatası çevrilir');
  esit(verifyHataAnahtari('selfie_attempts_exhausted'), 'verify.hataDenemeBitti', 'Deneme limiti çevrilir');
  esit(verifyHataAnahtari('session_expired'), 'verify.hataOturumSuresi', 'Oturum süresi çevrilir');
  esit(verifyHataAnahtari('application_not_editable'), 'verify.hataTekrar', 'Durum kilidi çevrilir');
  esit(verifyHataAnahtari('upload_failed:mime'), 'verify.hataYukleme', 'Yükleme hatası çevrilir');
  esit(verifyHataAnahtari('appeal_already_open'), 'verify.itirazZatenVar', 'İtiraz tekrarı çevrilir');
  esit(verifyHataAnahtari('bilinmeyen_kod'), 'verify.hataGenel', 'Bilinmeyen kod genel hataya düşer');
  esit(verifyHataAnahtari(null), 'verify.hataGenel', 'Boş kod genel hataya düşer');
}

function migrationGuvenlikTestleri() {
  const sema = dosya('supabase/migrations/20261101140000_tamuso_verify_sema.sql');
  const admin = dosya('supabase/migrations/20261101142000_tamuso_verify_admin_rpc.sql');
  const odeme = dosya('supabase/migrations/20261101143000_tamuso_verify_odeme_kapisi.sql');

  assert(/'tamuso-verify-docs'[\s\S]{0,80}false/.test(sema), 'Bucket public=false olarak tanımlı');
  assert(sema.includes('create policy tamuso_verify_own_insert'), 'Yükleme politikası var');
  assert(
    sema.includes("(storage.foldername(name))[1] = auth.uid()::text"),
    'Yükleme yolu kullanıcı klasörüyle sınırlı',
  );
  assert(
    !/create policy [a-z_]+ on storage\.objects\s+for select to (anon|public)/i.test(sema),
    'storage.objects üzerinde anon/public SELECT politikası yok',
  );
  assert(
    sema.includes("public.admin_has_permission('identity.document.read')"),
    'Belge okuma özel izne bağlı',
  );

  const tablolar = [
    'identity_applications',
    'identity_documents',
    'identity_capture_sessions',
    'identity_review_events',
    'identity_verification_decisions',
    'identity_appeals',
    'identity_access_audit',
  ];
  for (const tablo of tablolar) {
    assert(
      sema.includes(`alter table public.${tablo} enable row level security`),
      `${tablo} için RLS açık`,
    );
  }

  // Kullanıcı yalnızca OKUYABİLİR; yazma politikası yok (tüm yazma RPC'de).
  assert(
    !/create policy [a-z_]+ on public\.identity_(applications|documents|capture_sessions|verification_decisions)\s+for (insert|update|delete)/i.test(
      sema,
    ),
    'Kimlik tablolarında istemci INSERT/UPDATE/DELETE politikası yok',
  );

  assert(sema.includes('nonce_hash'), 'Selfie oturumu nonce hash ile saklanır');
  assert(
    admin.includes('second_reviewer_id') && admin.includes('second_approval_self'),
    'İkinci onay farklı yönetici gerektirir',
  );
  assert(admin.includes("'identity.document.read'"), 'Belge görüntüleme ayrı RBAC izni');
  assert(
    admin.includes('identity_access_audit') && admin.includes("'document_viewed'"),
    'Belge erişimi denetim kaydına yazılır',
  );
  assert(
    odeme.includes('creator_payout_identity_gate') &&
      odeme.includes('identity_odeme_kosullari'),
    'Ödeme kapısı trigger ve koşul fonksiyonu tanımlı',
  );
  assert(odeme.includes('identity_saklama_calistir'), 'Saklama/imha işi tanımlı');

  const rpc = dosya('supabase/migrations/20261101141000_tamuso_verify_rpc.sql');
  assert(
    rpc.includes("v_path not like (v_uid::text || '/' || p_application_id::text || '/%')"),
    'Sunucu depolama yolunu kullanıcı/başvuru ile doğrular',
  );
  assert(
    rpc.includes("encode(sha256(convert_to(btrim(coalesce(p_nonce, '')), 'UTF8')), 'hex') <> v_s.nonce_hash"),
    'Selfie nonce hash doğrulaması sunucuda',
  );
  assert(
    rpc.includes("v_gelen is distinct from v_s.challenge_sequence"),
    'Hareket sırası birebir doğrulanır',
  );

  const api = dosya('src/moduller/tamuso-verify/VerifyApi.ts');
  assert(
    !/from\('identity_[a-z_]+'\)\s*\.\s*(insert|update|delete)/.test(api),
    'İstemci kimlik tablolarına doğrudan yazmaz',
  );
  assert(api.includes('VERIFY_BUCKET'), 'İstemci özel kovayı kullanır');
  assert(!/createSignedUrl|getPublicUrl/.test(api), 'İstemci public/signed URL üretmez');
}

function adminMerkeziTestleri() {
  const merkez = 'apps/super-admin/app/admin/kimlik-dogrulama/index.tsx';
  const detay = 'apps/super-admin/app/admin/kimlik-dogrulama/[id].tsx';
  assert(varMi(merkez), 'Web admin: Kimlik Doğrulama Merkezi sayfası mevcut');
  assert(varMi(detay), 'Web admin: başvuru inceleme sayfası mevcut');

  const merkezKod = dosya(merkez);
  const detayKod = dosya(detay);
  const istemci = dosya('src/moduller/admin/kimlik-dogrulama/AdminKimlikIslemleri.ts');

  assert(
    istemci.includes("rpc('admin_identity_dashboard')") &&
      istemci.includes("rpc('admin_identity_basvurular'") &&
      istemci.includes("rpc('admin_identity_basvuru_detay'"),
    'Admin istemcisi yalnızca RPC üzerinden okur',
  );
  assert(
    !/from\('identity_[a-z_]+'\)\s*\.\s*(insert|update|delete)/.test(istemci),
    'Admin istemcisi kimlik tablolarına doğrudan yazmaz',
  );
  assert(!/getPublicUrl|createSignedUrl\([^)]*24\s*\*\s*3600/.test(istemci), 'Admin istemcisi public URL üretmez');
  assert(istemci.includes('IMZALI_URL_SANIYE = 300'), 'İmzalı URL ömrü 300 sn');

  assert(
    merkezKod.includes('belge_goruntuleme_yetkisi') && merkezKod.includes('ayar_yetkisi'),
    'Merkez ekranı sunucudan gelen izinleri gösterir',
  );
  assert(
    detayKod.includes('belge_goruntuleme_yetkisi') && detayKod.includes('AdminVerifyBelgeUrl'),
    'Belge görüntüleyici özel izin ve kısa ömürlü URL ister',
  );
  assert(
    detayKod.includes('AdminVerifyIkinciOnay') && detayKod.includes('AdminVerifyItirazKarar'),
    'Detay ekranı ikinci onay ve itiraz kararını destekler',
  );
  assert(
    detayKod.includes("action === 'reject' && !secilenKod"),
    'Ret işlemi gerekçe kodu olmadan gönderilmez',
  );
  assert(
    merkezKod.includes('ayar_yetkisi'),
    'Ayar değişikliği ayrı yetkiye bağlı gösterilir',
  );

  const katalog = dosya('src/moduller/admin/arama/AdminModulKatalogu.ts');
  assert(
    katalog.includes("href: '/admin/kimlik-dogrulama'") && katalog.includes("bolum: 'Güvenlik'"),
    'Güvenlik bölümünde Kimlik Doğrulama Merkezi bağlantısı var',
  );

  const admin = dosya('supabase/migrations/20261101142000_tamuso_verify_admin_rpc.sql');
  assert(
    admin.includes("if not public.identity_yetki('identity.document.read') then"),
    'Belge erişimi identity.document.read ile korunur',
  );
  assert(
    admin.indexOf("'document_viewed'") > 0 &&
      admin.indexOf("'document_viewed'") < admin.indexOf("'bucket', v_doc.storage_bucket"),
    'Denetim kaydı dosya yolu döndürülmeden ÖNCE yazılır',
  );
  assert(
    admin.includes('raise exception \'reason_required\'') &&
      admin.includes("if p_action in ('approve', 'reject')"),
    'Onay/ret gerekçe olmadan uygulanmaz',
  );
  assert(
    admin.includes("if v_app.status in ('approved', 'rejected') then"),
    'Karara bağlanmış başvuru yeniden karara alınamaz',
  );
  assert(
    admin.includes('second_approval_self') && admin.includes('second_reviewer_id'),
    'İkinci onayda kendi kararını onaylama engeli var',
  );
  assert(
    admin.includes("if not public.identity_yetki('identity.settings.manage') then raise exception 'Forbidden'; end if;"),
    'Ayar değişikliği identity.settings.manage gerektirir',
  );
  assert(
    admin.includes("admin_identity_ikinci_onay") && admin.includes('p_onay'),
    'İkinci onay RPC tanımlı',
  );
  assert(
    admin.includes("'identity.view'") && admin.includes('order by'),
    'Kuyruk RPC kimlik görüntüleme izniyle sıralı sonuç döner',
  );

  const odeme = dosya('supabase/migrations/20261101143000_tamuso_verify_odeme_kapisi.sql');
  assert(
    odeme.includes('create trigger creator_payout_requests_identity_gate') &&
      odeme.includes('before insert on public.creator_payout_requests'),
    'Payout talebi trigger ile kimlik kapısına bağlı',
  );
  assert(
    odeme.includes("raise exception 'identity_required'") &&
      odeme.includes("raise exception 'identity_document_level_insufficient'"),
    'Kapı kimlik onayı ve belge seviyesini ayrı ayrı zorlar',
  );
  assert(
    odeme.includes("'kyc_source', 'tamuso_verify'"),
    'KYC kaynağı Tamuso Verify olarak raporlanır',
  );
  assert(
    odeme.includes('revoke all on function public.identity_saklama_calistir(int) from public, anon, authenticated') &&
      odeme.includes('to service_role'),
    'Saklama işi yalnızca service_role ile çalışır',
  );
  assert(
    odeme.includes("interval '30 days'") && odeme.includes("delete_reason = 'retention'"),
    'Saklama işi işaretleme + bekleme + imha adımlarını uygular',
  );
}

function rotaVeCeviriTestleri() {
  assert(varMi('app/kyc/index.tsx'), 'KYC rotası mevcut');
  assert(varMi('app/cuzdan/yayinci-kazanclari/kimlik-dogrula.tsx'), 'Kimliğimi Doğrula rotası mevcut');
  assert(varMi('src/moduller/tamuso-verify/TamusoVerifyAkisi.tsx'), 'Akış bileşeni mevcut');
  assert(varMi('src/moduller/tamuso-verify/bilesenler/BelgeCekimModal.tsx'), 'Belge çekim modalı mevcut');
  assert(varMi('src/moduller/tamuso-verify/bilesenler/SelfieModal.tsx'), 'Selfie modalı mevcut');

  const kyc = dosya('app/kyc/index.tsx');
  assert(kyc.includes('TamusoVerifyAkisi'), 'KYC rotası yeni akışı render eder');
  const layout = dosya('app/_layout.tsx');
  assert(
    layout.includes('cuzdan/yayinci-kazanclari/kimlik-dogrula'),
    'Yeni rota stack te kayıtlı',
  );
  const kazanc = dosya('app/cuzdan/yayinci-kazanclari/index.tsx');
  assert(kazanc.includes('kimlik-dogrula'), 'Yayıncı kazancı ekranı doğrulamaya bağlanır');

  const anahtarTopla = (kaynak: string, blok: string): string[] => {
    const bas = kaynak.indexOf(`  ${blok}: {`);
    if (bas < 0) return [];
    const son = kaynak.indexOf('\n  },', bas);
    const govde = kaynak.slice(bas, son < 0 ? undefined : son);
    return [...govde.matchAll(/^\s{4}([A-Za-z0-9_]+):/gm)].map((m) => m[1]!).sort();
  };

  const tr = dosya('src/i18n/locales/tr.ts');
  const en = dosya('src/i18n/locales/en.ts');
  const trAnahtar = anahtarTopla(tr, 'verify');
  const enAnahtar = anahtarTopla(en, 'verify');
  assert(trAnahtar.length > 60, 'TR verify sözlüğü dolu');
  const eksikEn = trAnahtar.filter((k) => !enAnahtar.includes(k));
  const eksikTr = enAnahtar.filter((k) => !trAnahtar.includes(k));
  esit(eksikEn, [], 'EN sözlüğünde eksik verify anahtarı yok');
  esit(eksikTr, [], 'TR sözlüğünde eksik verify anahtarı yok');

  // Akışta kullanılan kritik anahtarlar gerçekten var
  for (const anahtar of [
    'girisBaslik',
    'onayMetni',
    'belgeTuruBaslik',
    'selfieBaslik',
    'bilgiBaslik',
    'itirazBaslik',
    'veriSil',
    'galeridenSec',
    'durum_approved',
    'durum_appeal_review',
  ]) {
    assert(trAnahtar.includes(anahtar), `TR verify.${anahtar} tanımlı`);
  }
}

function cekimKapisiTestleri() {
  const uygunluk = (ek: Partial<YayinciUygunluk> = {}): YayinciUygunluk => ({
    user_id: 'u-1',
    is_adult: true,
    program_status: 'approved',
    program_approved: true,
    kyc_status: 'approved',
    kyc_verified: true,
    payout_account_status: 'verified',
    payout_account_verified: true,
    tax_status: 'complete',
    tax_complete: true,
    open_high_risk: false,
    eligible: true,
    verify: {
      identity_status: 'approved',
      document_level: 'complete',
      document_level_ok: true,
      kodlar: [],
    },
    ...ek,
  });

  const ozet = (ek: Partial<YayinciKazancOzeti> = {}): YayinciKazancOzeti =>
    ({
      withdrawals_enabled: true,
      open_request: null,
      minimum_reached: true,
      available_usd: 50,
      program_status: 'approved',
      payout_min_usd: 25,
      ...ek,
    }) as unknown as YayinciKazancOzeti;

  const hazir = CekimDurumunuHesapla(uygunluk(), ozet());
  esit(hazir.kod, 'hazir', 'Doğrulanmış hesap ve yeterli bakiye talebi açar');
  esit(hazir.talepOlusturulabilir, true, 'Hazır durumda talep oluşturulabilir');

  const kimlikYok = CekimDurumunuHesapla(
    uygunluk({
      kyc_verified: false,
      verify: {
        identity_status: 'not_started',
        document_level: null,
        document_level_ok: null,
        kodlar: ['identity_required'],
      },
    }),
    ozet(),
  );
  esit(kimlikYok.kod, 'kimlik', 'Kimlik yoksa çekim kimliğe yönlenir');
  esit(kimlikYok.yonlendirme, 'kimlik', 'Kimlik kapısı Tamuso Verify ekranına gider');
  esit(kimlikYok.talepOlusturulabilir, false, 'Kimlik yokken talep oluşturulamaz');

  const incelemede = CekimDurumunuHesapla(
    uygunluk({
      kyc_verified: false,
      verify: {
        identity_status: 'under_review',
        document_level: null,
        document_level_ok: null,
        kodlar: ['identity_required'],
      },
    }),
    ozet(),
  );
  esit(incelemede.kod, 'kimlik_inceleme', 'İncelemedeki kimlik ayrı durum gösterir');
  esit(incelemede.talepOlusturulabilir, false, 'İnceleme sürerken talep oluşturulamaz');

  const belgeEksik = CekimDurumunuHesapla(
    uygunluk({
      verify: {
        identity_status: 'approved',
        document_level: 'basic',
        document_level_ok: false,
        kodlar: ['identity_document_level_insufficient'],
      },
    }),
    ozet(),
  );
  esit(belgeEksik.kod, 'kimlik_belge', 'Yetersiz belge seviyesi ayrıca yakalanır');
  esit(belgeEksik.yonlendirme, 'kimlik', 'Belge eksiği doğrulama akışına yönlendirir');

  const hesapYok = CekimDurumunuHesapla(
    uygunluk({ payout_account_verified: false }),
    ozet(),
  );
  esit(hesapYok.kod, 'hesap', 'Ödeme hesabı doğrulanmadan talep açılmaz');
  esit(hesapYok.yonlendirme, 'hesap', 'Hesap eksiği ödeme hesabı ekranına gider');

  const minimum = CekimDurumunuHesapla(uygunluk(), ozet({ minimum_reached: false }));
  esit(minimum.kod, 'minimum', 'Minimum altı bakiye talebi kapatır');
  esit(minimum.yonlendirme, null, 'Minimum eksiği yönlendirme gerektirmez');

  const acikTalep = CekimDurumunuHesapla(
    uygunluk(),
    ozet({ open_request: { amount_usd: 30, fee_usd: 0, net_usd: 30, status: 'pending' } }),
  );
  esit(acikTalep.kod, 'acik_talep', 'Açık talep varken yeni talep açılmaz');

  const kapali = CekimDurumunuHesapla(uygunluk(), ozet({ withdrawals_enabled: false }));
  esit(kapali.kod, 'kapali', 'Çekim kapalıyken talep düğmesi kapanır');

  const risk = CekimDurumunuHesapla(uygunluk({ open_high_risk: true }), ozet());
  esit(risk.kod, 'risk', 'Açık yüksek risk talebi engeller');

  const programYok = CekimDurumunuHesapla(
    uygunluk({ program_approved: false }),
    ozet(),
  );
  esit(programYok.kod, 'program', 'Program onayı yoksa çekim kapalıdır');

  // Sunucu hata kodları → kullanıcı metni / yönlendirme
  esit(
    CekimHataAnahtari('identity_required'),
    'verify.cekimHataKimlik',
    'identity_required kimlik hatasına çevrilir',
  );
  esit(
    CekimHataAnahtari('kyc_required'),
    'verify.cekimHataKimlik',
    'Eski kyc_required kodu da kimlik hatasına çevrilir',
  );
  esit(
    CekimHataYonlendirmesi('identity_document_level_insufficient'),
    'kimlik',
    'Belge seviyesi hatası doğrulamaya yönlendirir',
  );
  esit(
    CekimHataYonlendirmesi('bank_account_required'),
    'hesap',
    'Banka hesabı hatası ödeme hesabına yönlendirir',
  );
  esit(
    CekimHataYonlendirmesi('below_minimum'),
    null,
    'Minimum hatası yönlendirme gerektirmez',
  );

  // Ödeme profili kapısı — vergi/şirket/banka tek ekranda toplanır
  const profilYok = CekimDurumunuHesapla(uygunluk(), ozet(), false);
  esit(profilYok.kod, 'profil', 'Profil eksikse çekim profile yönlenir');
  esit(profilYok.yonlendirme, 'profil', 'Profil kapısı ödeme profili ekranına gider');
  esit(profilYok.talepOlusturulabilir, false, 'Profil eksikken talep oluşturulamaz');
  esit(
    CekimDurumunuHesapla(uygunluk(), ozet(), true).kod,
    'hazir',
    'Profil tamamsa çekim akışı açılır',
  );
  esit(
    CekimDurumunuHesapla(uygunluk(), ozet()).kod,
    'hazir',
    'Profil bilgisi yoksa (RPC dağıtılmadıysa) eski davranış korunur',
  );
  esit(
    CekimHataYonlendirmesi('payout_profile_required'),
    'profil',
    'Sunucu profil hatası ödeme profiline yönlendirir',
  );
  esit(
    CekimHataAnahtari('profile_required'),
    'verify.cekimHataProfil',
    'profile_required kodu anlaşılır metne çevrilir',
  );

  // İstemci kablolaması: talep RPC'si ve profil girişi bağlı mı?
  const kazanc = dosya('app/cuzdan/yayinci-kazanclari/index.tsx');
  assert(
    kazanc.includes('YayinciOdemeTalebiOlustur'),
    'Yayıncı kazancı ekranı para çekme talebi RPC sini çağırır',
  );
  assert(
    kazanc.includes('CekimDurumunuHesapla'),
    'Yayıncı kazancı ekranı çekim kapısı kararını kullanır',
  );
  const profilAyarlar = dosya('app/profil-ayarlar/index.tsx');
  assert(
    profilAyarlar.includes('VerifyProfilSatiri'),
    'Profil ayarlarında Tamuso Verify satırı var',
  );
  assert(
    profilAyarlar.includes('kimlik-dogrula'),
    'Profil ayarları satırı doğrulama akışına gider',
  );
  assert(
    kazanc.includes('odeme-profili'),
    'Yayıncı kazancı ekranı ödeme profiline bağlanır',
  );
  assert(
    kazanc.includes('profil?.tamam'),
    'Çekim kapısı profil tamamlanma durumunu kullanır',
  );
}

/** Ödeme profili — saf istemci yardımcıları ve migration sözleşmesi. */
function odemeProfiliTestleri() {
  // Dosya uzantısı / mime eşlemesi
  esit(BelgeUzantisi('vergi.pdf', 'application/pdf'), 'pdf', 'PDF uzantısı korunur');
  esit(BelgeUzantisi('vergi.PDF', null), 'pdf', 'Büyük harfli PDF uzantısı tanınır');
  esit(BelgeUzantisi('foto.jpeg', 'image/jpeg'), 'jpg', 'JPEG → jpg normalize edilir');
  esit(BelgeUzantisi('dosya', 'image/png'), 'png', 'Mime uzantıyı belirler');
  esit(BelgeUzantisi('dosya.unknown', null), 'jpg', 'Bilinmeyen uzantı jpg varsayılanına düşer');
  esit(BelgeMimeTipi(null, 'pdf'), 'application/pdf', 'PDF mime üretilir');
  esit(BelgeMimeTipi('image/heic', 'heic'), 'image/heic', 'HEIC mime korunur');
  esit(BelgeMimeTipi('text/plain', 'png'), 'image/png', 'text/plain reddedilir, uzantıdan üretilir');
  esit(BelgeMimeTipi('application/x-msdownload', 'exe'), 'image/jpeg', 'Bilinmeyen tür görsele düşer');

  // Sunucu yanıtı çözümleme
  const veri = OdemeProfiliVerisiCoz({
    exists: true,
    status: 'submitted',
    tamam: true,
    eksikler: [],
    sirket_yok: true,
    has_company: false,
    belge_gerekli: ['tax_certificate'],
    profile: { legal_first_name: 'Ayşe', has_company: false },
    documents: [{ id: 'd1', doc_type: 'tax_certificate', version: 2 }],
    banka: { exists: true, status: 'verified', masked: { iban: '****1234' } },
  });
  esit(veri.exists, true, 'Profil yanıtı çözülür');
  esit(veri.sirket_yok, true, '"Şirket yok" beyanı istemciye taşınır');
  esit(veri.documents.length, 1, 'Belgeler çözülür');
  esit(veri.banka.status, 'verified', 'Banka özeti çözülür');

  const bos = OdemeProfiliVerisiCoz(null);
  esit(bos.exists, false, 'Boş yanıt güvenli varsayılana düşer');
  esit(bos.status, 'incomplete', 'Varsayılan durum eksik');
  esit(bos.banka.exists, false, 'Banka yok varsayılanı');

  esit(
    GecerliEksikler(['ad', 'uydurma', 'vergi_belgesi']),
    ['ad', 'vergi_belgesi'],
    'Bilinmeyen eksik kodları atılır',
  );

  // Migration sözleşmesi
  const migrasyon = dosya('supabase/migrations/20261101150000_yayinci_odeme_profili.sql');
  assert(
    migrasyon.includes('create table if not exists public.creator_payout_profiles'),
    'Ödeme profili tablosu tanımlı',
  );
  assert(
    migrasyon.includes('has_company boolean not null default false'),
    'Şirket beyanı kolonu var',
  );
  assert(
    migrasyon.includes('create table if not exists public.creator_payout_documents'),
    'Belge tablosu tanımlı',
  );
  assert(
    migrasyon.includes("raise exception 'document_immutable'"),
    'Belge silme/güncelleme yasak',
  );
  assert(
    migrasyon.includes('coalesce(max(d.version), 0) + 1'),
    'Yeni belge sürüm numarası sunucuda artırılır',
  );
  assert(
    !migrasyon.includes('creator_payout_docs_own_delete'),
    'Kullanıcıya belge silme politikası verilmez',
  );
  assert(
    migrasyon.includes("'creator-payout-docs'"),
    'Belgeler özel kovada tutulur',
  );
  assert(
    migrasyon.includes('admin_has_permission(\'finance.view\')'),
    'Belge erişimi finans izniyle sınırlı',
  );
  assert(
    migrasyon.includes('yayinci_odeme_belge_gerekli'),
    'Zorunlu belge listesi sunucuda hesaplanır',
  );
  assert(
    migrasyon.includes("'generic', true"),
    'Tanımsız ülke için genel havale şeması döner',
  );

  // Ekran kablolaması
  const ekran = dosya('app/cuzdan/yayinci-kazanclari/odeme-profili.tsx');
  assert(ekran.includes('OdemeProfiliKaydet'), 'Profil ekranı kaydet RPC sini çağırır');
  assert(ekran.includes('OdemeBelgesiYukle'), 'Profil ekranı belge yükler');
  assert(ekran.includes('profilSirketYok'), 'Profil ekranında "şirketim yok" işareti var');
  assert(
    ekran.includes('DocumentPicker.getDocumentAsync'),
    'Belge seçimi yerel dosya seçiciyle yapılır',
  );

  const hesap = dosya('app/cuzdan/yayinci-kazanclari/odeme-hesabi.tsx');
  assert(
    hesap.includes("fallbackHref={'/cuzdan/yayinci-kazanclari/odeme-profili' as any}"),
    'Ödeme hesabı ekranı ödeme profiline geri döner',
  );

  const duzen = dosya('app/_layout.tsx');
  assert(
    duzen.includes('cuzdan/yayinci-kazanclari/odeme-profili'),
    'Ödeme profili rotası kayıtlı',
  );
}

function main() {
  const basliklar: [string, () => void][] = [
    ['MRZ / OCR ayrıştırma', () => {
      mrzTestleri();
      ocrTestleri();
    }],
    ['Görüntü kalitesi eşikleri', kaliteTestleri],
    ['Hata kodu çevirisi', hataTestleri],
    ['Migrasyon güvenlik sözleşmeleri', migrationGuvenlikTestleri],
    ['Admin merkezi ve ödeme kapısı', adminMerkeziTestleri],
    ['Rota ve çeviri bütünlüğü', rotaVeCeviriTestleri],
    ['Para çekme kapısı ve yönlendirme', cekimKapisiTestleri],
    ['Ödeme profili ve belge sözleşmesi', odemeProfiliTestleri],
  ];

  for (const [ad, calistir] of basliklar) {
    const once = basarisiz;
    try {
      calistir();
    } catch (e) {
      basarisiz += 1;
      console.error(`  ✗ ${ad} çalışırken hata: ${e instanceof Error ? e.message : String(e)}`);
    }
    const fark = basarisiz - once;
    console.log(`${fark === 0 ? '✓' : '✗'} ${ad}`);
  }

  console.log(`\ntamuso-verify-istemci: ${basarili} başarılı, ${basarisiz} başarısız`);
  if (basarisiz > 0) process.exit(1);
}

main();
