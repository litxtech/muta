/**
 * Pazarlama sitesini statik HTML olarak üretir.
 *
 * Neden: Expo tek sayfa uygulaması tüm paketi (≈10 MB JS) yüklemeden hiçbir şey
 * basmıyordu. Lighthouse LCP 17,6 sn / TBT 1.430 ms ölçtü. Bu betik ana sayfa ve
 * herkese açık tanıtım sayfalarını JavaScript'siz, satır içi stilli HTML olarak yazar.
 * Uygulamanın kendisi dist/app.html üzerinden çalışmaya devam eder.
 *
 * Çalıştır: node scripts/web-site-olustur.mjs   (expo export sonrası)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ctaKutusu,
  kabuk,
  sssBolumu,
} from './web-kabuk.mjs';
import {
  anasayfaSayfasi,
  anasayfaSss,
  anahtarSayfalari,
  mevcutIcerik,
  MEVCUT_SAYFALAR,
} from './web-sayfalar.mjs';

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.env.SEO_DIST ? path.resolve(process.env.SEO_DIST) : path.join(kok, 'dist');
const ORIGIN = 'https://www.tamuso.com';

function envYukle() {
  const yol = path.join(kok, '.env');
  if (!fs.existsSync(yol)) return;
  for (const satir of fs.readFileSync(yol, 'utf8').split(/\n/)) {
    const es = satir.replace(/\r$/, '').match(/^([A-Z0-9_]+)=(.*)$/);
    if (!es || process.env[es[1]]) continue;
    process.env[es[1]] = es[2].trim().replace(/^["']|["']$/g, '');
  }
}

envYukle();

function yaz(goreliYol, html) {
  const dosya =
    goreliYol === '/'
      ? path.join(dist, 'index.html')
      : path.join(dist, ...goreliYol.split('/').filter(Boolean), 'index.html');
  fs.mkdirSync(path.dirname(dosya), { recursive: true });
  fs.writeFileSync(dosya, html);
  return dosya;
}

/** Uygulama kabuğunu app.html'e taşır; arama motorlarına kapalı işaretler. */
function uygulamaKabugu() {
  /* İkinci ve sonraki çalıştırmalarda dist/index.html pazarlama sayfasıdır.
     Gerçek uygulama kabuğu app.html'de durur; ondan devam ederiz. */
  const index = path.join(dist, 'index.html');
  const app = path.join(dist, 'app.html');
  const kabukIcerir = (yol) =>
    fs.existsSync(yol) && fs.readFileSync(yol, 'utf8').includes('_expo/static/js');

  let kaynak = index;
  if (!kabukIcerir(index)) {
    if (kabukIcerir(app)) {
      kaynak = app;
    } else {
      console.error('web: Expo paketi bulunamadı. Önce expo export --platform web çalıştır.');
      process.exit(1);
    }
  }
  let html = fs.readFileSync(kaynak, 'utf8');
  html = html
    .replace(
      /<meta name="robots"[^>]*>/i,
      '<meta name="robots" content="noindex,nofollow,noarchive">',
    )
    .replace(/<title>[^<]*<\/title>/i, '<title>Tamuso</title>')
    /* noindex sayfada canonical/hreflang sinyali tutmayız. */
    .replace(/\s*<link rel="canonical"[^>]*>/i, '')
    .replace(/\s*<link rel="alternate"[^>]*>/gi, '');
  if (!html.includes('noindex,nofollow')) {
    html = html.replace('</head>', '  <meta name="robots" content="noindex,nofollow,noarchive">\n  </head>');
  }
  fs.writeFileSync(path.join(dist, 'app.html'), html);
  console.log('web: uygulama kabuğu -> dist/app.html');
}

async function sonYazilar() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anahtar = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anahtar) return [];
  const kontrol = new AbortController();
  const zaman = setTimeout(() => kontrol.abort(), 8000);
  try {
    const sorgu = new URL('/rest/v1/blog_posts', url);
    sorgu.searchParams.set('select', 'title,slug,excerpt');
    sorgu.searchParams.set('language_code', 'eq.tr');
    sorgu.searchParams.set('status', 'in.(yayinda,planlandi)');
    sorgu.searchParams.set('published_at', `lte.${new Date().toISOString()}`);
    sorgu.searchParams.set('order', 'published_at.desc');
    sorgu.searchParams.set('limit', '3');
    const yanit = await fetch(sorgu, {
      headers: { apikey: anahtar, authorization: `Bearer ${anahtar}` },
      signal: kontrol.signal,
    });
    if (!yanit.ok) return [];
    const veri = await yanit.json();
    if (!Array.isArray(veri)) return [];
    return veri.filter((y) => y.slug && y.title);
  } catch {
    return [];
  } finally {
    clearTimeout(zaman);
  }
}

function denetle(yol, html) {
  const sorunlar = [];
  if (!/<title>[^<]{10,}<\/title>/.test(html)) sorunlar.push('başlık yok');
  if (!/<meta name="description" content="[^"]{50,}"/.test(html)) sorunlar.push('açıklama kısa');
  if (!/<link rel="canonical" href="https:\/\/www\.tamuso\.com/.test(html)) sorunlar.push('canonical yok');
  if (!/<h1[ >]/.test(html)) sorunlar.push('h1 yok');
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '';
  if (h1.includes('|')) sorunlar.push('h1 başlıktan kopyalanmış');
  if (/<script src=/.test(html)) sorunlar.push('harici betik var');
  if (sorunlar.length) {
    console.error(`web: ${yol} -> ${sorunlar.join(', ')}`);
    process.exitCode = 1;
  }
}

const metaKaydi = JSON.parse(
  fs.readFileSync(path.join(kok, 'src', 'moduller', 'web-tanitim', 'seoSayfalari.json'), 'utf8'),
);
const metaHaritasi = new Map(metaKaydi.map((s) => [s.yol, s]));

uygulamaKabugu();

const yazilar = await sonYazilar();
const anasayfa = anasayfaSayfasi(yazilar);
const sayfalar = [
  {
    ...anasayfa,
    icerik: `${anasayfa.icerik}${ctaKutusu()}${sssBolumu(anasayfaSss())}`,
  },
  ...anahtarSayfalari().map((sayfa) => {
    const cta = ctaKutusu({
      baslik: 'Bu sohbeti bugün dene',
      metin: 'Kayıt ücretsiz. Hesabını aç, keşfet ekranından bir yayına veya odaya katıl.',
    });
    return {
      ...sayfa,
      icerik: sayfa.icerik.replace('<section class="bolum" id="sss">', `${cta}<section class="bolum" id="sss">`),
    };
  }),
];

for (const yol of MEVCUT_SAYFALAR) {
  const meta = metaHaritasi.get(yol);
  if (!meta) {
    console.error(`web: meta kaydı yok ${yol}`);
    process.exitCode = 1;
    continue;
  }
  const sayfa = mevcutIcerik(yol, meta);
  sayfalar.push({ ...sayfa, icerik: `${sayfa.icerik}${ctaKutusu()}` });
}

const yazilan = [];
for (const sayfa of sayfalar) {
  const html = kabuk(sayfa);
  denetle(sayfa.yol, html);
  yazilan.push(yaz(sayfa.yol, html));
}

/* 404: aynı görünüm, arama motoruna kapalı. */
const yok = kabuk({
  yol: '/404',
  baslik: 'Sayfa bulunamadı | Tamuso',
  aciklama: 'Bu adres Tamuso’da yok. Ana sayfaya dönüp görüntülü sohbet, canlı yayın ve sesli odalara göz atabilirsin.',
  icerik: `<section class="sayfa-bas"><div class="sinir"><div class="sayfa-bas-ic">
    <span class="etiket">404</span>
    <h1>Bu adres bulunamadı</h1>
    <p class="giris">Aradığın sayfa taşınmış veya hiç var olmamış olabilir. Aşağıdaki bağlantılardan devam edebilirsin.</p>
    <div class="kahraman-btnler"><a class="dugme dugme-dolu" href="/">Ana sayfa</a><a class="dugme dugme-hayalet" href="/blog">Blog</a></div>
  </div></div></section>`,
}).replace('content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"', 'content="noindex,follow"');
fs.writeFileSync(path.join(dist, '404.html'), yok);

console.log(`web: ${yazilan.length} statik sayfa yazıldı (${ORIGIN})`);
