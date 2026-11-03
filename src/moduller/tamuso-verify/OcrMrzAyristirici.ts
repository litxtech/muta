/**
 * Tamuso Verify — istemci OCR / MRZ yardımcıları.
 *
 * Amaç: MRZ varsa kontrol basamağı ile "okunabilirlik" doğrulaması yapmak ve
 * kullanıcıya bilgi önermek. Bu çıktı kimlik doğrulama onayı ÜRETMEZ.
 *
 * Gizlilik: Kimlik numarası, belge numarası, MRZ ham satırı hiçbir yere
 * gönderilmez. Sunucuya yalnızca `ocrTemizle()` beyaz listesi gider; sunucu da
 * `identity_ocr_temizle` ile aynı kırpmayı tekrar uygular.
 */
import type { VerifyBelgeTuru } from './tipler';

/** Sunucudaki `identity_ocr_temizle` ile birebir aynı anahtar kümesi. */
export type TemizOcr = {
  first_name?: string;
  last_name?: string;
  birth_date?: string;
  expiry_date?: string;
  doc_type?: string;
  mrz_valid?: boolean;
  mrz_checksum_ok?: boolean;
  confidence?: number;
};

export type MrzKontrol = { alan: string; gecerli: boolean };

export type MrzSonucu = {
  format: 'TD1' | 'TD3' | 'bilinmiyor';
  belgeTuru: VerifyBelgeTuru | null;
  ad: string | null;
  soyad: string | null;
  /** YYYY-MM-DD */
  dogumTarihi: string | null;
  /** YYYY-MM-DD */
  gecerlilikTarihi: string | null;
  uyruk: string | null;
  kontroller: MrzKontrol[];
  /** Tüm zorunlu kontrol basamakları geçerli mi */
  kontrolBasamaklariGecerli: boolean;
  uyarilar: string[];
};

const MRZ_SATIR_UZUNLUK_TD3 = 44;
const MRZ_SATIR_SAYISI_TD3 = 2;
const MRZ_SATIR_UZUNLUK_TD1 = 30;
const MRZ_SATIR_SAYISI_TD1 = 3;

/** ICAO 9303 ağırlıkları */
const AGIRLIKLAR = [7, 3, 1] as const;

export function mrzKarakterDegeri(karakter: string): number {
  if (karakter >= '0' && karakter <= '9') return karakter.charCodeAt(0) - 48;
  const buyuk = karakter.toUpperCase();
  if (buyuk >= 'A' && buyuk <= 'Z') return buyuk.charCodeAt(0) - 65 + 10;
  // '<' ve bilinmeyen tüm karakterler 0
  return 0;
}

/** ICAO 9303 kontrol basamağı; beklenen tek hane (0-9). */
export function mrzKontrolBasamak(veri: string): number {
  let toplam = 0;
  for (let i = 0; i < veri.length; i += 1) {
    toplam += mrzKarakterDegeri(veri[i] ?? '') * AGIRLIKLAR[i % 3];
  }
  return toplam % 10;
}

function basamakMetni(ham: string): number | null {
  if (!/^\d$/.test(ham)) return null;
  return Number(ham);
}

/**
 * YYMMDD → YYYY-MM-DD.
 * `yuzYil`: doğum tarihi için 19xx/20xx, geçerlilik için 20xx seçilir.
 */
export function mrzTarihCoz(
  ham: string,
  mod: 'dogum' | 'gecerlilik',
  bugun: Date = new Date(),
): string | null {
  if (!/^\d{6}$/.test(ham)) return null;
  const yy = Number(ham.slice(0, 2));
  const aa = Number(ham.slice(2, 4));
  const gg = Number(ham.slice(4, 6));
  if (aa < 1 || aa > 12 || gg < 1 || gg > 31) return null;

  const buYil = bugun.getUTCFullYear();
  let yil: number;
  if (mod === 'dogum') {
    // Gelecekteki doğum tarihi olamaz: iki haneli yıl bugünden büyükse 19xx
    const aday = 2000 + yy;
    yil = aday > buYil ? 1900 + yy : aday;
  } else {
    // Geçerlilik: bu yılın 50 yıl gerisine kadar 20xx, ötesi 19xx
    yil = 2000 + yy;
    if (yil < buYil - 50) yil = 1900 + yy;
  }

  const iso = `${yil}-${String(aa).padStart(2, '0')}-${String(gg).padStart(2, '0')}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== yil ||
    dt.getUTCMonth() + 1 !== aa ||
    dt.getUTCDate() !== gg
  ) {
    return null;
  }
  return iso;
}

/** "SOYAD<<AD<AD" → { soyad, ad } */
export function mrzAdAyristir(alan: string): { ad: string | null; soyad: string | null } {
  const parcalar = alan.split('<<');
  const soyadHam = (parcalar[0] ?? '').replace(/</g, ' ').trim();
  const adHam = (parcalar[1] ?? '').replace(/</g, ' ').trim();
  return {
    soyad: soyadHam ? baslikYap(soyadHam) : null,
    ad: adHam ? baslikYap(adHam) : null,
  };
}

function baslikYap(deger: string): string {
  return deger
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function satirlariHazirla(metin: string): string[] {
  return metin
    .split(/\r?\n/)
    .map((s) => s.replace(/\s+$/g, '').toUpperCase())
    .filter((s) => s.length >= 28);
}

/** TD3 (pasaport): 2 × 44 */
export function mrzTd3Ayristir(satirlar: string[]): MrzSonucu {
  const uyarilar: string[] = [];
  const l1 = (satirlar[0] ?? '').padEnd(MRZ_SATIR_UZUNLUK_TD3, '<').slice(0, MRZ_SATIR_UZUNLUK_TD3);
  const l2 = (satirlar[1] ?? '').padEnd(MRZ_SATIR_UZUNLUK_TD3, '<').slice(0, MRZ_SATIR_UZUNLUK_TD3);

  const { ad, soyad } = mrzAdAyristir(l1.slice(5, 44));

  const belgeNo = l2.slice(0, 9);
  const dogum = l2.slice(13, 19);
  const gecerlilik = l2.slice(21, 27);

  const kontroller: MrzKontrol[] = [
    { alan: 'belge_no', gecerli: basamakMetni(l2[9] ?? '') === mrzKontrolBasamak(belgeNo) },
    { alan: 'dogum_tarihi', gecerli: basamakMetni(l2[19] ?? '') === mrzKontrolBasamak(dogum) },
    { alan: 'gecerlilik', gecerli: basamakMetni(l2[27] ?? '') === mrzKontrolBasamak(gecerlilik) },
  ];

  const bilesik = `${l2.slice(0, 10)}${l2.slice(13, 20)}${l2.slice(21, 28)}${l2.slice(28, 43)}`;
  kontroller.push({
    alan: 'bilesik',
    gecerli: basamakMetni(l2[43] ?? '') === mrzKontrolBasamak(bilesik),
  });

  if (l1[0] !== 'P') uyarilar.push('td3_ulke_kodu_beklenmiyor');

  return {
    format: 'TD3',
    belgeTuru: 'passport',
    ad,
    soyad,
    dogumTarihi: mrzTarihCoz(dogum, 'dogum'),
    gecerlilikTarihi: mrzTarihCoz(gecerlilik, 'gecerlilik'),
    uyruk: l2.slice(10, 13).replace(/</g, '') || null,
    kontroller,
    kontrolBasamaklariGecerli: kontroller.every((k) => k.gecerli),
    uyarilar,
  };
}

/** TD1 (kimlik kartı / oturum): 3 × 30 */
export function mrzTd1Ayristir(satirlar: string[]): MrzSonucu {
  const uyarilar: string[] = [];
  const l1 = (satirlar[0] ?? '').padEnd(MRZ_SATIR_UZUNLUK_TD1, '<').slice(0, MRZ_SATIR_UZUNLUK_TD1);
  const l2 = (satirlar[1] ?? '').padEnd(MRZ_SATIR_UZUNLUK_TD1, '<').slice(0, MRZ_SATIR_UZUNLUK_TD1);
  const l3 = (satirlar[2] ?? '').padEnd(MRZ_SATIR_UZUNLUK_TD1, '<').slice(0, MRZ_SATIR_UZUNLUK_TD1);

  const belgeNo = l1.slice(5, 14);
  const dogum = l2.slice(0, 6);
  const gecerlilik = l2.slice(8, 14);

  const kontroller: MrzKontrol[] = [
    { alan: 'belge_no', gecerli: basamakMetni(l1[14] ?? '') === mrzKontrolBasamak(belgeNo) },
    { alan: 'dogum_tarihi', gecerli: basamakMetni(l2[6] ?? '') === mrzKontrolBasamak(dogum) },
    { alan: 'gecerlilik', gecerli: basamakMetni(l2[14] ?? '') === mrzKontrolBasamak(gecerlilik) },
  ];
  const bilesik = `${l1.slice(5, 30)}${l2.slice(0, 7)}${l2.slice(8, 15)}${l2.slice(18, 29)}`;
  kontroller.push({
    alan: 'bilesik',
    gecerli: basamakMetni(l2[29] ?? '') === mrzKontrolBasamak(bilesik),
  });

  const { ad, soyad } = mrzAdAyristir(l3);
  if (!ad && !soyad) uyarilar.push('td1_ad_okunamadi');

  return {
    format: 'TD1',
    belgeTuru: 'id_card',
    ad,
    soyad,
    dogumTarihi: mrzTarihCoz(dogum, 'dogum'),
    gecerlilikTarihi: mrzTarihCoz(gecerlilik, 'gecerlilik'),
    uyruk: l2.slice(15, 18).replace(/</g, '') || null,
    kontroller,
    kontrolBasamaklariGecerli: kontroller.every((k) => k.gecerli),
    uyarilar,
  };
}

/** Metinden MRZ bulur; formatı satır uzunluğuna göre seçer. */
export function mrzAyristir(metin: string): MrzSonucu {
  const satirlar = satirlariHazirla(metin ?? '');
  const td3 = satirlar.filter((s) => s.length >= 40);
  if (td3.length >= MRZ_SATIR_SAYISI_TD3) {
    return mrzTd3Ayristir(td3.slice(0, MRZ_SATIR_SAYISI_TD3));
  }
  const td1 = satirlar.filter((s) => s.length >= MRZ_SATIR_UZUNLUK_TD1 - 2 && s.length < 40);
  if (td1.length >= MRZ_SATIR_SAYISI_TD1) {
    return mrzTd1Ayristir(td1.slice(0, MRZ_SATIR_SAYISI_TD1));
  }
  return {
    format: 'bilinmiyor',
    belgeTuru: null,
    ad: null,
    soyad: null,
    dogumTarihi: null,
    gecerlilikTarihi: null,
    uyruk: null,
    kontroller: [],
    kontrolBasamaklariGecerli: false,
    uyarilar: ['mrz_bulunamadi'],
  };
}

function metinAl(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

/**
 * OCR çıktısını sunucu beyaz listesine indirger.
 * Kimlik numarası, belge numarası ve ham MRZ satırı burada ATILIR.
 */
export function ocrTemizle(ocr: unknown): TemizOcr {
  if (!ocr || typeof ocr !== 'object' || Array.isArray(ocr)) return {};
  const kaynak = ocr as Record<string, unknown>;
  const sonuc: TemizOcr = {};

  const ad = metinAl(kaynak.first_name);
  const soyad = metinAl(kaynak.last_name);
  const dogum = metinAl(kaynak.birth_date);
  const gecerlilik = metinAl(kaynak.expiry_date);
  const belgeTuru = metinAl(kaynak.doc_type);

  if (ad) sonuc.first_name = ad.slice(0, 80);
  if (soyad) sonuc.last_name = soyad.slice(0, 80);
  if (dogum) sonuc.birth_date = dogum.slice(0, 10);
  if (gecerlilik) sonuc.expiry_date = gecerlilik.slice(0, 10);
  if (belgeTuru) sonuc.doc_type = belgeTuru.slice(0, 32);
  if (typeof kaynak.mrz_valid === 'boolean') sonuc.mrz_valid = kaynak.mrz_valid;
  if (typeof kaynak.mrz_checksum_ok === 'boolean') {
    sonuc.mrz_checksum_ok = kaynak.mrz_checksum_ok;
  }
  if (typeof kaynak.confidence === 'number' && Number.isFinite(kaynak.confidence)) {
    sonuc.confidence = Math.min(Math.max(kaynak.confidence, 0), 1);
  }
  return sonuc;
}

/** MRZ sonucundan yalnızca beyaz listedeki alanları üretir. */
export function mrzdenTemizOcr(mrz: MrzSonucu): TemizOcr {
  return ocrTemizle({
    first_name: mrz.ad ?? undefined,
    last_name: mrz.soyad ?? undefined,
    birth_date: mrz.dogumTarihi ?? undefined,
    expiry_date: mrz.gecerlilikTarihi ?? undefined,
    doc_type: mrz.belgeTuru ?? undefined,
    mrz_valid: mrz.format !== 'bilinmiyor',
    mrz_checksum_ok: mrz.kontrolBasamaklariGecerli,
  });
}
