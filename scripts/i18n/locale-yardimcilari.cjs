/**
 * i18n araçları — ortak yardımcılar.
 *
 * Locale dosyaları: ts (tr/en/es/pt) ve json (ar/fr/fil).
 * Düzenleme metin tabanlı EKLEME ile yapılır: mevcut satırlar korunur,
 * sadece yeni anahtar/değer satırları araya girer (minimal diff).
 */
const path = require('path');
const fs = require('fs');

const KOK = path.resolve(__dirname, '..', '..');
const LOCALES = path.join(KOK, 'src', 'i18n', 'locales');
const DILLER = ['tr', 'en', 'es', 'pt', 'ar', 'fr', 'fil'];
const JSON_DILLER = new Set(['ar', 'fr', 'fil']);

function localeYolu(dil) {
  return path.join(LOCALES, `${dil}.${JSON_DILLER.has(dil) ? 'json' : 'ts'}`);
}

/** TS locale dosyasını export edilmiş obje olarak yükler. */
function tsYukle(dil) {
  const kod = fs.readFileSync(localeYolu(dil), 'utf8').replace(/^\uFEFF/, '');
  const esittir = kod.indexOf('=');
  const bas = kod.indexOf('{', esittir);
  if (bas < 0) throw new Error(`${dil}: kök obje bulunamadı`);
  let derinlik = 0;
  let metin = null;
  let kacisVar = false;
  let son = -1;
  for (let i = bas; i < kod.length; i += 1) {
    const c = kod[i];
    if (metin) {
      if (kacisVar) kacisVar = false;
      else if (c === '\\') kacisVar = true;
      else if (c === metin) metin = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      metin = c;
      continue;
    }
    if (c === '/' && kod[i + 1] === '/') {
      while (i < kod.length && kod[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && kod[i + 1] === '*') {
      i = kod.indexOf('*/', i + 2) + 1;
      continue;
    }
    if (c === '{') derinlik += 1;
    else if (c === '}') {
      derinlik -= 1;
      if (derinlik === 0) {
        son = i;
        break;
      }
    }
  }
  if (son < 0) throw new Error(`${dil}: kök obje kapanışı bulunamadı`);
  const govde = kod.slice(bas, son + 1);
  return new Function(`return (${govde});`)();
}

function yukle(dil) {
  if (JSON_DILLER.has(dil)) {
    return JSON.parse(fs.readFileSync(localeYolu(dil), 'utf8'));
  }
  return tsYukle(dil);
}

function duzlestir(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      duzlestir(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

function sozluk(dil) {
  return duzlestir(yukle(dil));
}

/* ---------------------------------------------------------------- yazma --- */

const GECERLI_ANAHTAR = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function anahtarYaz(k, json) {
  return !json && GECERLI_ANAHTAR.test(k) ? k : JSON.stringify(k);
}

function kacis(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function bosluk(n) {
  return ' '.repeat(n);
}

/**
 * Açılış satırındaki `{` ile eşleşen kapanış `}` satırını bulur.
 * Girintiye değil, gerçek süslü parantez derinliğine bakar (dosyalarda
 * girinti tutarsız olabiliyor).
 */
function eslesenKapanis(satirlar, acilis, son) {
  let derinlik = 0;
  let metin = null;
  let kacisVar = false;
  for (let i = acilis; i < son; i += 1) {
    const s = satirlar[i];
    for (let j = 0; j < s.length; j += 1) {
      const c = s[j];
      if (metin) {
        if (kacisVar) kacisVar = false;
        else if (c === '\\') kacisVar = true;
        else if (c === metin) metin = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        metin = c;
        continue;
      }
      if (c === '/' && s[j + 1] === '/') break;
      if (c === '{') derinlik += 1;
      else if (c === '}') {
        derinlik -= 1;
        if (derinlik === 0) return { acilis, kapanis: i };
      }
    }
  }
  throw new Error(`Kapanış bulunamadı: ${satirlar[acilis].trim()}`);
}

/** Verilen anahtarın obje bloğunu (açılış/kapanış satırı) bulur. */
function blokBul(satirlar, bas, son, girinti, anahtar, json) {
  const acilis = new RegExp(
    `^\\s*${kacis(anahtarYaz(anahtar, json))}:\\s*\\{\\s*$`,
  );
  for (let i = bas; i < son; i += 1) {
    if (!acilis.test(satirlar[i])) continue;
    return eslesenKapanis(satirlar, i, son);
  }
  return null;
}

/** Verilen yol için tek satırlık yeni blok üretir. */
function yeniBlok(girinti, parcalar, deger, json) {
  const anahtar = anahtarYaz(parcalar[0], json);
  if (parcalar.length === 1) {
    return [
      `${bosluk(girinti)}${anahtar}: ${JSON.stringify(deger)}${json ? '' : ','}`,
    ];
  }
  return [
    `${bosluk(girinti)}${anahtar}: {`,
    ...yeniBlok(girinti + 2, parcalar.slice(1), deger, json),
    `${bosluk(girinti)}}${json ? '' : ','}`,
  ];
}

/** Ekleme noktasından önceki son satıra gerekiyorsa virgül ekler. */
function virgulGarantile(satirlar, konum, bas) {
  for (let i = konum - 1; i >= bas; i -= 1) {
    const t = satirlar[i].trim();
    if (t === '') continue;
    if (/[{[,]$/.test(t)) return;
    if (!/,$/.test(t)) satirlar[i] = `${satirlar[i]},`;
    return;
  }
}

/** [bas, son) aralığına (bir objenin içi) anahtarı ekler / günceller. */
function ekle(satirlar, bas, son, girinti, parcalar, deger, json) {
  const anahtar = anahtarYaz(parcalar[0], json);
  const mevcut = new RegExp(`^${bosluk(girinti)}${kacis(anahtar)}:\\s*`);

  if (parcalar.length === 1) {
    const govde = `${bosluk(girinti)}${anahtar}: ${JSON.stringify(deger)}`;
    for (let i = bas; i < son; i += 1) {
      if (!mevcut.test(satirlar[i])) continue;
      // Değer birden fazla satıra yayılmışsa (string birleştirme) artık
      // satırları da temizle.
      let j = i;
      while (
        j + 1 < son &&
        !/,\s*$/.test(satirlar[j]) &&
        !/^\s*\}\s*,?\s*$/.test(satirlar[j]) &&
        j - i < 6
      ) {
        j += 1;
      }
      satirlar.splice(i, j - i + 1, `${govde}${json ? '' : ','}`);
      return;
    }
    virgulGarantile(satirlar, son, bas);
    satirlar.splice(son, 0, `${govde}${json ? '' : ','}`);
    return;
  }

  const blok = blokBul(satirlar, bas, son, girinti, parcalar[0], json);
  if (blok) {
    ekle(
      satirlar,
      blok.acilis + 1,
      blok.kapanis,
      girinti + 2,
      parcalar.slice(1),
      deger,
      json,
    );
    return;
  }
  virgulGarantile(satirlar, son, bas);
  satirlar.splice(son, 0, ...yeniBlok(girinti, parcalar, deger, json));
}

/** Kök objenin iç aralığını bulur (her eklemeden önce yeniden hesaplanır). */
function kokAralik(satirlar, json) {
  if (json) {
    const bas = satirlar.findIndex((s) => s.trim() === '{');
    if (bas < 0) throw new Error('Kök obje başlangıcı bulunamadı');
    const { kapanis } = eslesenKapanis(satirlar, bas, satirlar.length);
    return { bas: bas + 1, son: kapanis };
  }
  const bas = satirlar.findIndex((s) => /=\s*\{\s*$/.test(s));
  if (bas < 0) throw new Error('Kök obje başlangıcı bulunamadı');
  const { kapanis } = eslesenKapanis(satirlar, bas, satirlar.length);
  return { bas: bas + 1, son: kapanis };
}

/** Windows kilitlerine karşı denemeli atomik yazma. */
function guvenliYaz(yol, icerik) {
  const gecici = `${yol}.tmp-${process.pid}`;
  fs.writeFileSync(gecici, icerik, 'utf8');
  let sonHata = null;
  for (let i = 0; i < 8; i += 1) {
    try {
      fs.renameSync(gecici, yol);
      return;
    } catch (e) {
      sonHata = e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  try {
    fs.unlinkSync(gecici);
  } catch {
    /* yok say */
  }
  throw sonHata;
}

/**
 * Bir dile ait çoklu çeviriyi tek seferde yazar.
 * kayitlar: { "a.b": "metin", ... }
 */
/** JSON modunda eklenen satırların sonundaki eksik virgülleri tamamlar. */
function jsonVirgulDuzelt(satirlar) {
  for (let i = 0; i < satirlar.length - 1; i += 1) {
    const s = satirlar[i];
    if (!/^(\s+)(?:"[\w.]+"|[\w.]+):\s+.+$/.test(s)) continue;
    if (/[,{[(\\]$/.test(s.trimEnd())) continue;
    let j = i + 1;
    while (j < satirlar.length && satirlar[j].trim() === '') j += 1;
    if (j >= satirlar.length) continue;
    if (satirlar[j].trim().startsWith('}')) continue;
    satirlar[i] = `${s},`;
  }
}

function yazCoklu(dil, kayitlar) {
  const json = JSON_DILLER.has(dil);
  const yol = localeYolu(dil);
  const satirlar = fs.readFileSync(yol, 'utf8').split('\n');
  const oncekiAnahtarlar = Object.keys(sozluk(dil));
  let sayi = 0;
  for (const [anahtar, deger] of Object.entries(kayitlar)) {
    if (typeof deger !== 'string' || deger.trim() === '') {
      throw new Error(`${dil}: boş/geçersiz değer → ${anahtar}`);
    }
    const { bas, son } = kokAralik(satirlar, json);
    ekle(satirlar, bas, son, 2, anahtar.split('.'), deger, json);
    sayi += 1;
  }
  if (json) jsonVirgulDuzelt(satirlar);
  guvenliYaz(yol, satirlar.join('\n'));
  dogrula(dil, kayitlar, oncekiAnahtarlar);
  return sayi;
}

/** Yazma sonrası sözlüğü yeniden okur; yanlış bloğa yazımı yakalar. */
function dogrula(dil, kayitlar, oncekiAnahtarlar) {
  const yeni = sozluk(dil);
  const yanlis = Object.keys(kayitlar).filter((k) => yeni[k] !== kayitlar[k]);
  if (yanlis.length) {
    throw new Error(
      `${dil}: ${yanlis.length} anahtar doğrulanamadı → ${yanlis.slice(0, 5).join(', ')}`,
    );
  }
  const onceki = new Set(oncekiAnahtarlar);
  const kayip = oncekiAnahtarlar.filter((k) => !(k in yeni));
  if (kayip.length) {
    throw new Error(
      `${dil}: ${kayip.length} anahtar kayboldu → ${kayip.slice(0, 5).join(', ')}`,
    );
  }
  const ekstra = Object.keys(yeni).filter(
    (k) => !onceki.has(k) && !(k in kayitlar),
  );
  if (ekstra.length) {
    throw new Error(
      `${dil}: beklenmeyen ${ekstra.length} anahtar → ${ekstra.slice(0, 5).join(', ')}`,
    );
  }
}

module.exports = {
  KOK,
  LOCALES,
  DILLER,
  JSON_DILLER,
  localeYolu,
  yukle,
  yazCoklu,
  sozluk,
  duzlestir,
  eslesenKapanis,
  guvenliYaz,
  bosluk,
};
