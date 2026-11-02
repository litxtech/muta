/**
 * Pazarlama sayfalarının HTML kabuğu.
 * Kural: sayfalarda JavaScript yok. Böylece TBT 0 ms, ağ yükü ~20 KB olur.
 */
import { WEB_STIL } from './web-stil.mjs';

export const ORIGIN = 'https://www.tamuso.com';

export const MENU = [
  { yol: '/goruntulu-sohbet', ad: 'Görüntülü sohbet' },
  { yol: '/sesli-sohbet-odalari', ad: 'Sesli odalar' },
  { yol: '/canli-yayin', ad: 'Canlı yayın' },
  { yol: '/arkadas-bul', ad: 'Arkadaş bul' },
  { yol: '/blog', ad: 'Blog' },
];

export const URUN_BAGLANTILARI = [
  { yol: '/goruntulu-sohbet', ad: 'Görüntülü sohbet' },
  { yol: '/sesli-sohbet-odalari', ad: 'Sesli sohbet odaları' },
  { yol: '/sohbet-odalari', ad: 'Sohbet odaları' },
  { yol: '/canli-yayin', ad: 'Canlı yayın' },
  { yol: '/arkadas-bul', ad: 'Arkadaş bul' },
  { yol: '/yabanci-sohbet', ad: 'Yabancı sohbet' },
  { yol: '/tanitim/ozellikler', ad: 'Tüm özellikler' },
  { yol: '/tanitim/coinler', ad: 'Coinler' },
  { yol: '/tanitim/meyve', ad: 'Meyve oyunu' },
];

export const KURUM_BAGLANTILARI = [
  { yol: '/tanitim/hakkinda', ad: 'Tamuso hakkında' },
  { yol: '/tanitim/yatirim', ad: 'Yatırım' },
  { yol: '/tanitim/isbirligi', ad: 'İşbirliği' },
  { yol: '/blog', ad: 'Blog' },
  { yol: '/destek', ad: 'Destek' },
];

export const YASAL_BAGLANTILARI = [
  { yol: '/politika', ad: 'Politikalar' },
  { yol: '/politika/tos', ad: 'Kullanım şartları' },
  { yol: '/politika/privacy', ad: 'Gizlilik politikası' },
  { yol: '/politika/community_rules', ad: 'Topluluk kuralları' },
  { yol: '/politika/child_safety', ad: 'Çocuk koruma' },
];

export function kacis(deger) {
  return String(deger ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function jsonLdEtiketi(veri) {
  return `<script type="application/ld+json">${JSON.stringify(veri).replace(/</g, '\\u003c')}</script>`;
}

/** Organization + WebSite her sayfada; sayfa kendi düğümlerini ekler. */
function temelSemalar() {
  return [
    {
      '@type': 'Organization',
      '@id': `${ORIGIN}/#kurum`,
      name: 'Tamuso',
      alternateName: 'Tamuso Sosyal',
      url: `${ORIGIN}/`,
      logo: {
        '@type': 'ImageObject',
        url: `${ORIGIN}/gorsel/logo-512.png`,
        width: 512,
        height: 512,
      },
      sameAs: [`${ORIGIN}/`],
      description:
        'Tamuso; görüntülü sohbet, canlı yayın, sesli odalar, mesajlaşma ve sosyal oyunları bir arada sunan sosyal uygulamadır.',
    },
    {
      '@type': 'WebSite',
      '@id': `${ORIGIN}/#site`,
      name: 'Tamuso',
      url: `${ORIGIN}/`,
      inLanguage: 'tr-TR',
      publisher: { '@id': `${ORIGIN}/#kurum` },
    },
  ];
}

function kirintiSemasi(yol, baslik) {
  const parcalar = yol.split('/').filter(Boolean);
  if (parcalar.length === 0) return null;
  const ogeler = [{ name: 'Ana sayfa', item: `${ORIGIN}/` }];
  let biriken = '';
  for (const parca of parcalar) {
    biriken += `/${parca}`;
    ogeler.push({
      name: parca === parcalar[parcalar.length - 1] ? baslik : parca,
      item: `${ORIGIN}${biriken}`,
    });
  }
  return {
    '@type': 'BreadcrumbList',
    itemListElement: ogeler.map((oge, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: oge.name,
      item: oge.item,
    })),
  };
}

export function kirintiHtml(yol, baslik) {
  const parcalar = yol.split('/').filter(Boolean);
  if (parcalar.length === 0) return '';
  const ogeler = [
    `<li><a href="/">Ana sayfa</a></li>`,
    ...parcalar.map((parca, i) =>
      i === parcalar.length - 1
        ? `<li><span aria-current="page">${kacis(baslik)}</span></li>`
        : `<li><a href="/${parcalar.slice(0, i + 1).join('/')}">${kacis(parca)}</a></li>`,
    ),
  ];
  return `<nav aria-label="Sayfa yolu"><ol class="kirinti">${ogeler.join('')}</ol></nav>`;
}

export function ustBar(yol) {
  const baglanti = (oge) =>
    `<a href="${oge.yol}"${oge.yol === yol ? ' aria-current="page"' : ''}>${kacis(oge.ad)}</a>`;
  const panel = [...MENU, ...URUN_BAGLANTILARI.filter((o) => !MENU.some((m) => m.yol === o.yol)), ...KURUM_BAGLANTILARI, ...YASAL_BAGLANTILARI]
    .filter((oge, i, dizi) => dizi.findIndex((x) => x.yol === oge.yol) === i)
    .map(baglanti)
    .join('');
  return `<header class="ust">
  <div class="sinir ust-ic">
    <a class="marka" href="/" aria-label="Tamuso ana sayfa">
      <span class="marka-yazi">TAMUSO</span>
      <span class="marka-cizgi"></span>
    </a>
    <nav class="menu-ana" aria-label="Ana menü">${MENU.map(baglanti).join('')}</nav>
    <details class="mobil-menu">
      <summary aria-label="Menüyü aç"><span></span></summary>
      <div class="mobil-panel">${panel}</div>
    </details>
    <div class="ust-sag">
      <a class="dugme dugme-hayalet" href="/login">Giriş yap</a>
      <a class="dugme dugme-dolu" href="/register">Kayıt ol</a>
    </div>
  </div>
</header>`;
}

function sutun(baslik, ogeler) {
  return `<div><h2>${kacis(baslik)}</h2><ul>${ogeler
    .map((oge) => `<li><a href="${oge.yol}">${kacis(oge.ad)}</a></li>`)
    .join('')}</ul></div>`;
}

export function altBilgi() {
  return `<footer class="alt">
  <div class="sinir">
    <div class="alt-izgara">
      <div class="alt-marka">
        <a class="marka" href="/" aria-label="Tamuso ana sayfa">
          <span class="marka-yazi">TAMUSO</span>
          <span class="marka-cizgi"></span>
        </a>
        <p>Görüntülü sohbet, canlı yayın, sesli odalar ve mesajlaşma tek uygulamada. Tamuso, LitxTech LLC iştirakidir.</p>
        <p>Destek: <a href="mailto:support@litxtech.com">support@litxtech.com</a></p>
      </div>
      ${sutun('Ürün', URUN_BAGLANTILARI)}
      ${sutun('Şirket', KURUM_BAGLANTILARI)}
      ${sutun('Yasal', YASAL_BAGLANTILARI)}
    </div>
    <div class="alt-son">
      <p>© ${new Date().getUTCFullYear()} Tamuso · LitxTech LLC</p>
      <p>Platform 18 yaş ve üzeri kullanıcılar içindir.</p>
    </div>
  </div>
</footer>`;
}

export function ctaKutusu({
  baslik = 'Bugün bir sohbet başlat',
  metin = 'Kayıt ücretsiz. Kameranı aç, sesli odaya katıl ya da canlı yayın aç — hepsi aynı hesapta.',
} = {}) {
  return `<section class="bolum-dar">
  <div class="sinir">
    <div class="cta-kutu">
      <h2>${kacis(baslik)}</h2>
      <p>${kacis(metin)}</p>
      <div class="cta-btnler">
        <a class="dugme dugme-dolu dugme-buyuk" href="/register">Ücretsiz kayıt ol</a>
        <a class="dugme dugme-hayalet dugme-buyuk" href="/login">Giriş yap</a>
      </div>
      <p class="cta-not">18 yaş ve üzeri · iOS, Android ve web tarayıcı</p>
    </div>
  </div>
</section>`;
}

export function sssBolumu(sorular, baslik = 'Sık sorulan sorular') {
  if (!sorular || sorular.length === 0) return '';
  return `<section class="bolum" id="sss">
  <div class="sinir">
    <div class="bolum-ust">
      <span class="etiket">SSS</span>
      <h2>${kacis(baslik)}</h2>
    </div>
    <div class="sss">
      ${sorular
        .map(
          (s) => `<details>
        <summary>${kacis(s.soru)}</summary>
        <div class="cevap"><p>${kacis(s.cevap)}</p></div>
      </details>`,
        )
        .join('\n      ')}
    </div>
  </div>
</section>`;
}

export function sssSemasi(sorular) {
  if (!sorular || sorular.length === 0) return null;
  return {
    '@type': 'FAQPage',
    mainEntity: sorular.map((s) => ({
      '@type': 'Question',
      name: s.soru,
      acceptedAnswer: { '@type': 'Answer', text: s.cevap },
    })),
  };
}

/**
 * @param {object} sayfa
 * @param {string} sayfa.yol        örn. "/goruntulu-sohbet"
 * @param {string} sayfa.baslik     <title>
 * @param {string} sayfa.aciklama   meta description
 * @param {string} sayfa.icerik     <main> içeriği
 * @param {string} [sayfa.gorsel]   og görseli (mutlak yol)
 * @param {Array}  [sayfa.semalar]  ek JSON-LD düğümleri
 * @param {boolean}[sayfa.anaSayfa]
 * @param {string} [sayfa.anahtar]  ana anahtar kelime
 */
export function kabuk(sayfa) {
  const {
    yol,
    baslik,
    aciklama,
    icerik,
    gorsel = '/gorsel/og.jpg',
    semalar = [],
    anaSayfa = false,
    anahtar = '',
  } = sayfa;
  const url = yol === '/' ? `${ORIGIN}/` : `${ORIGIN}${yol}`;

  const dugumler = temelSemalar();
  dugumler.push({
    '@type': anaSayfa ? 'WebPage' : 'WebPage',
    '@id': `${url}#sayfa`,
    url,
    name: baslik,
    description: aciklama,
    inLanguage: 'tr-TR',
    isPartOf: { '@id': `${ORIGIN}/#site` },
    about: { '@id': `${ORIGIN}/#kurum` },
    ...(anahtar ? { keywords: anahtar } : {}),
    ...(gorsel ? { primaryImageOfPage: { '@type': 'ImageObject', url: `${ORIGIN}${gorsel}` } } : {}),
  });
  const kirinti = kirintiSemasi(yol, baslik.split('|')[0].trim());
  if (kirinti) dugumler.push(kirinti);
  for (const ek of semalar) if (ek) dugumler.push(ek);

  const semaEtiketi = jsonLdEtiketi({ '@context': 'https://schema.org', '@graph': dugumler });

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${kacis(baslik)}</title>
<meta name="description" content="${kacis(aciklama)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="tr" href="${url}">
<link rel="alternate" hreflang="x-default" href="${url}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/gorsel/logo-512.png">
<link rel="sitemap" type="application/xml" title="Sitemap" href="${ORIGIN}/sitemap.xml">
<meta name="theme-color" content="#07060d">
<meta name="color-scheme" content="dark">
<meta name="format-detection" content="telephone=no">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tamuso">
<meta property="og:locale" content="tr_TR">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${kacis(baslik)}">
<meta property="og:description" content="${kacis(aciklama)}">
<meta property="og:image" content="${ORIGIN}${gorsel}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Tamuso — görüntülü sohbet, canlı yayın ve arkadaş bul">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${kacis(baslik)}">
<meta name="twitter:description" content="${kacis(aciklama)}">
<meta name="twitter:image" content="${ORIGIN}${gorsel}">
${semaEtiketi}
<style>${WEB_STIL}</style>
</head>
<body>
<a class="atla" href="#icerik">İçeriğe geç</a>
${ustBar(yol)}
<main id="icerik">
${icerik}
</main>
${altBilgi()}
</body>
</html>
`;
}
