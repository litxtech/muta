/**
 * Yerel önizleme sunucusu: Vercel davranışını taklit eder.
 *
 * - Statik dosya varsa onu döner (Vercel'de dosya sistemi rewrite'tan önce gelir).
 * - Yoksa uygulama yollarını app.html'e, diğerlerini 404.html'e yönlendirir.
 * - Metin yanıtlarını gzip'ler; Lighthouse ölçümü gerçek ağa yakın olsun.
 *
 * Kullanım: node scripts/onizleme-sunucu.mjs [port]
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const kok = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'dist');
const port = Number(process.argv[2] || 4173);

const TURLER = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const STATIK_CSP =
  "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; require-trusted-types-for 'script'; trusted-types 'none'";

const PAZARLAMA = new Set([
  '/',
  '/goruntulu-sohbet',
  '/sesli-sohbet-odalari',
  '/sohbet-odalari',
  '/canli-yayin',
  '/arkadas-bul',
  '/yabanci-sohbet',
  '/tanitim',
  '/politika',
]);

function dosyaBul(yol) {
  const temiz = decodeURIComponent(yol.split('?')[0]);
  const guvenli = path.normalize(temiz).replace(/^([/\\.])+/, '');
  const tam = path.join(kok, guvenli);
  if (!tam.startsWith(kok)) return null;
  const adaylar = [tam, `${tam}.html`, path.join(tam, 'index.html')];
  for (const aday of adaylar) {
    try {
      const bilgi = fs.statSync(aday);
      if (bilgi.isFile()) return aday;
    } catch {
      /* yok */
    }
  }
  return null;
}

/** vercel.json rewrite kurallarını basitçe eşler (yerel önizleme için). */
const vercel = JSON.parse(
  fs.readFileSync(path.join(path.resolve(kok, '..'), 'vercel.json'), 'utf8'),
);

function kaynakDesen(source) {
  let desen = String(source)
    .replace(/\(\.\*\)/g, '\u0000')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  desen = desen.replace(/\u0000/g, '.*').replace(/:([a-zA-Z0-9_]+)/g, '[^/]+');
  return new RegExp(`^${desen}$`);
}

const kurallar = (vercel.rewrites || [])
  .filter((k) => !String(k.destination).startsWith('/api/'))
  .map((k) => ({ ...k, desen: kaynakDesen(k.source) }));

function rewriteHedefi(temizYol) {
  for (const kural of kurallar) {
    if (kural.desen.test(temizYol)) return kural.destination;
  }
  return null;
}

const sunucu = http.createServer((istek, yanit) => {
  const yol = istek.url || '/';
  const temizYol = decodeURIComponent(yol.split('?')[0]).replace(/\/+$/, '') || '/';
  let dosya = dosyaBul(yol);
  let durum = 200;

  if (!dosya) {
    const hedef = rewriteHedefi(temizYol);
    if (hedef) {
      dosya = path.join(kok, hedef.replace(/^\//, ''));
    } else if (temizYol === '/app' || temizYol === '/app.html') {
      dosya = path.join(kok, 'app.html');
    } else if (temizYol.startsWith('/api/')) {
      yanit.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      yanit.end('api yok');
      return;
    } else {
      // Vercel: dosya yoksa ve kural yoksa 404.
      dosya = path.join(kok, '404.html');
      durum = 404;
    }
  }

  const uzanti = path.extname(dosya).toLowerCase();
  const tur = TURLER[uzanti] || 'application/octet-stream';
  const govde = fs.readFileSync(dosya);
  const basliklar = {
    'content-type': tur,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'SAMEORIGIN',
    'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  };
  if (tur.startsWith('text/html') && (PAZARLAMA.has(temizYol) || temizYol.startsWith('/tanitim/') || temizYol.startsWith('/politika/'))) {
    basliklar['content-security-policy'] = STATIK_CSP;
    basliklar['cross-origin-opener-policy'] = 'same-origin';
  }
  if (uzanti === '.html') basliklar['cache-control'] = 'public, max-age=0, must-revalidate';
  else basliklar['cache-control'] = 'public, max-age=604800';

  const kabul = String(istek.headers['accept-encoding'] || '');
  const sikistirilabilir = /^(text\/|application\/(json|xml|javascript))/.test(tur);
  if (sikistirilabilir && kabul.includes('gzip')) {
    const gzip = zlib.gzipSync(govde, { level: 9 });
    basliklar['content-encoding'] = 'gzip';
    basliklar.vary = 'accept-encoding';
    yanit.writeHead(durum, basliklar);
    yanit.end(istek.method === 'HEAD' ? undefined : gzip);
    return;
  }
  basliklar['content-length'] = govde.length;
  yanit.writeHead(durum, basliklar);
  yanit.end(istek.method === 'HEAD' ? undefined : govde);
});

sunucu.listen(port, () => {
  console.log(`önizleme: http://localhost:${port} (dist)`);
});
