/**
 * Pazarlama sayfalarının içeriği.
 *
 * Kural: yalnızca üründe gerçekten olan özellikler yazılır. Uydurma sayı,
 * kullanıcı yorumu, "en iyi" iddiası veya kazanç vaadi yoktur.
 */
import { kacis, sssSemasi } from './web-kabuk.mjs';
import { sayfaIcerigi } from './seo-metin.mjs';

const EKRANLAR = [
  {
    ad: 'canli',
    alt: 'Tamuso canlı yayın ekranı: yayıncı, izleyici sayısı ve canlı etiketi',
    yazi: 'Canlı yayın ve izleyici sayacı',
  },
  {
    ad: 'gorusme',
    alt: 'Tamuso görüntülü görüşme ekranı: iki kişi kamerayla bağlanır',
    yazi: 'Birebir görüntülü görüşme',
  },
  {
    ad: 'kesfet',
    alt: 'Tamuso keşfet ekranı: yeni insanlar, odalar ve yayınlar',
    yazi: 'Keşfet ve yeni insanlar',
  },
];

function ekranSeridi() {
  const oge = (e) =>
    `<figure class="ekran">
        <img src="/gorsel/ekran-${e.ad}-720.webp"
             srcset="/gorsel/ekran-${e.ad}-360.webp 360w, /gorsel/ekran-${e.ad}-720.webp 720w"
             sizes="(max-width: 760px) 30vw, 360px"
             width="360" height="480" loading="lazy" decoding="async"
             alt="${kacis(e.alt)}">
        <figcaption>${kacis(e.yazi)}</figcaption>
      </figure>`;
  return `<section class="bolum">
  <div class="sinir">
    <div class="bolum-ust">
      <span class="etiket">Uygulamadan</span>
      <h2>Ekranda ne görüyorsan uygulamada o var</h2>
      <p>Yayın, görüşme ve keşfet aynı hesabın içinde. Aşağıdaki üç ekran günlük kullanımın özeti.</p>
    </div>
    <div class="ekranlar">${EKRANLAR.map(oge).join('')}</div>
  </div>
</section>`;
}

function ozellikKartlari() {
  const kartlar = [
    {
      ikon: '01',
      baslik: 'Görüntülü görüşme',
      metin: 'Kamerayla birebir bağlan, karşı tarafı canlı gör. Görüşme içinde yazılı mesaj da gönderebilirsin.',
      yol: '/goruntulu-sohbet',
      bag: 'Görüntülü sohbet sayfası',
    },
    {
      ikon: '02',
      baslik: 'Sesli sohbet odaları',
      metin: 'Mikrofonlu odalarda birden fazla kişiyle konuş. İstersen yalnızca dinleyici olarak kal.',
      yol: '/sesli-sohbet-odalari',
      bag: 'Sesli odalar sayfası',
    },
    {
      ikon: '03',
      baslik: 'Canlı yayın ve PK',
      metin: 'Kameranla yayına çık, izleyicilerle anlık etkileşim kur. PK ile iki yayıncı yan yana yarışır.',
      yol: '/canli-yayin',
      bag: 'Canlı yayın sayfası',
    },
    {
      ikon: '04',
      baslik: 'Mesajlaşma',
      metin: 'Kişilerinle yazış, sohbeti görüşme içinde sürdür. Hikâyelerle kısa süreli paylaşım yap.',
      yol: '/arkadas-bul',
      bag: 'Arkadaş bul sayfası',
    },
    {
      ikon: '05',
      baslik: 'Keşfet, ülke ve şehir',
      metin: 'Yeni insanları, odaları ve yayınları keşfet. Ülke ve şehir sayfalarından yerel topluluğu gör.',
      yol: '/yabanci-sohbet',
      bag: 'Yabancı sohbet sayfası',
    },
    {
      ikon: '06',
      baslik: 'Coin ve sosyal oyunlar',
      metin: 'Coin uygulama içi bakiyedir; hediye, görüşme ve oyunlarda kullanılır. Meyve çarkı sunucu saatine göre döner.',
      yol: '/tanitim/coinler',
      bag: 'Coinler hakkında',
    },
  ];
  return `<section class="bolum" id="ozellikler">
  <div class="sinir">
    <div class="bolum-ust">
      <span class="etiket">Özellikler</span>
      <h2>Görüntülü sohbetten canlı yayına, tek hesapta</h2>
      <p>Tamuso tek bir sohbet uygulaması değil; görüşme, yayın, sesli oda ve mesaj aynı yerin parçası.</p>
    </div>
    <div class="izgara izgara-3">
      ${kartlar
        .map(
          (k) => `<article class="kart">
        <div class="kart-ikon" aria-hidden="true">${k.ikon}</div>
        <h3>${kacis(k.baslik)}</h3>
        <p>${kacis(k.metin)}</p>
        <a class="kart-bag" href="${k.yol}">${kacis(k.bag)}</a>
      </article>`,
        )
        .join('')}
    </div>
  </div>
</section>`;
}

function adimlar() {
  const liste = [
    {
      baslik: 'Kayıt ol',
      metin: 'E-posta ile hesabını aç. Kayıt ücretsizdir; tarayıcıdan veya uygulamadan devam edebilirsin.',
    },
    {
      baslik: 'Profilini tamamla',
      metin: 'Kullanıcı adı, profil fotoğrafı ve kısa bir tanıtım ekle. Keşfet seni bu bilgilerle gösterir.',
    },
    {
      baslik: 'Sohbeti başlat',
      metin: 'Bir yayına yorum yaz, sesli odaya katıl veya bir kişiye görüntülü görüşme isteği gönder.',
    },
  ];
  return `<section class="bolum">
  <div class="sinir">
    <div class="bolum-ust">
      <span class="etiket">Nasıl başlarım?</span>
      <h2>Üç adımda ilk sohbet</h2>
      <p>Kurulum uzun değil. Hesabı açtıktan sonra keşfet ekranı açılır, oradan devam edersin.</p>
    </div>
    <div class="izgara izgara-3">
      ${liste
        .map(
          (a, i) => `<article class="adim">
        <div class="adim-no" aria-hidden="true">${i + 1}</div>
        <h3>${kacis(a.baslik)}</h3>
        <p>${kacis(a.metin)}</p>
      </article>`,
        )
        .join('')}
    </div>
  </div>
</section>`;
}

function kimlerIcin() {
  const liste = [
    {
      baslik: 'Yeni arkadaş arayanlar',
      metin: 'Keşfet ekranında yayınları ve odaları görür, tanışmak istediğin kişiye doğrudan yazarsın.',
      yol: '/arkadas-bul',
      bag: 'Arkadaş nasıl bulunur?',
    },
    {
      baslik: 'Sesli sohbeti sevenler',
      metin: 'Kamera açmadan, mikrofonla katıldığın odalarda sohbet edersin. Dinleyici olarak kalmak da mümkün.',
      yol: '/sesli-sohbet-odalari',
      bag: 'Sesli odalar nasıl çalışır?',
    },
    {
      baslik: 'Yayıncı olmak isteyenler',
      metin: 'Canlı yayın açabilir, PK’ye çıkabilir ve ajans ya da host akışından yayıncı başvurusu yapabilirsin.',
      yol: '/canli-yayin',
      bag: 'Canlı yayın rehberi',
    },
    {
      baslik: 'Farklı ülkelerden insanlarla konuşanlar',
      metin: 'Ülke ve şehir sayfaları yerel topluluğu gösterir; arayüz beş dilde kullanılabilir.',
      yol: '/yabanci-sohbet',
      bag: 'Yabancı sohbet rehberi',
    },
  ];
  return `<section class="bolum">
  <div class="sinir">
    <div class="bolum-ust">
      <span class="etiket">Kimler için?</span>
      <h2>Hangi sohbet sana uyuyor?</h2>
    </div>
    <div class="izgara izgara-2">
      ${liste
        .map(
          (k) => `<article class="kart">
        <h3>${kacis(k.baslik)}</h3>
        <p>${kacis(k.metin)}</p>
        <a class="kart-bag" href="${k.yol}">${kacis(k.bag)}</a>
      </article>`,
        )
        .join('')}
    </div>
  </div>
</section>`;
}

function guvenlikBlogu() {
  return `<section class="bolum" id="guvenlik">
  <div class="sinir">
    <div class="izgara izgara-2">
      <div>
        <span class="etiket">Güvenlik</span>
        <h2>Topluluk kuralları her sohbetin başında</h2>
        <p style="color:var(--soluk);margin-top:14px">Tamuso 18 yaş ve üzeri kullanıcılar içindir. İstenmeyen bir davranışla karşılaştığında kişiyi engelleyebilir, içeriği bildirebilir ve destek ekibine yazabilirsin. Kullanıcı içeriği topluluk kurallarına göre değerlendirilir; çocuklara yönelik içerikte sıfır tolerans uygulanır.</p>
        <ul style="color:var(--soluk);margin-top:12px">
          <li>Engelle ve bildir: sohbeti ve yayını anında kapatır.</li>
          <li>Gizlilik: kişisel verilerin işlenmesi <a href="/politika/privacy">gizlilik politikasında</a> yazılı.</li>
          <li>Kurallar: <a href="/politika/community_rules">topluluk kuralları</a> ve <a href="/politika/tos">kullanım şartları</a>.</li>
          <li>Destek: uygulama içi canlı destek, e-posta ve WhatsApp.</li>
        </ul>
      </div>
      <div class="kart" style="display:flex;flex-direction:column;justify-content:center;gap:14px;padding:26px">
        <h3 style="font-size:1.25rem">Destek kanalları</h3>
        <p style="margin:0">Giriş yaptıktan sonra uygulama içindeki canlı destek sohbeti açılır. E-posta ve WhatsApp her zaman kullanılabilir.</p>
        <p style="margin:0"><a href="mailto:support@litxtech.com">support@litxtech.com</a></p>
        <p style="margin:0"><a href="https://wa.me/905330483061" rel="noopener">WhatsApp: 0533 048 30 61</a></p>
        <p style="margin:0"><a href="/politika/child_safety">Çocuk koruma politikası</a></p>
      </div>
    </div>
  </div>
</section>`;
}

function blogBolumu(yazilar) {
  if (!yazilar || yazilar.length === 0) return '';
  return `<section class="bolum-dar">
  <div class="sinir">
    <div class="bolum-ust">
      <span class="etiket">Blog</span>
      <h2>Tamuso’dan son yazılar</h2>
    </div>
    <div class="izgara izgara-3">
      ${yazilar
        .map(
          (y) => `<a class="kart" href="/blog/${encodeURIComponent(y.slug)}" style="display:block">
        <h3>${kacis(y.title)}</h3>
        <p style="margin-top:8px">${kacis((y.excerpt || '').slice(0, 150))}</p>
      </a>`,
        )
        .join('')}
    </div>
  </div>
</section>`;
}

export function anasayfaIcerik(sonYazilar = []) {
  return `<section class="kahraman">
  <div class="sinir kahraman-ic">
    <div>
      <p class="rozet"><i aria-hidden="true"></i> Canlı topluluk</p>
      <h1>Görüntülü sohbet, canlı yayın ve <em>yeni arkadaşlar</em> tek uygulamada</h1>
      <p class="kahraman-alt">Tamuso’da kamerayı açıp birebir görüşür, sesli odalara katılır, canlı yayın açar ve mesajlaşırsın. Kayıt ücretsiz; tarayıcıdan açabilir, iOS ve Android uygulamasıyla devam edebilirsin.</p>
      <div class="kahraman-btnler">
        <a class="dugme dugme-dolu dugme-buyuk" href="/register">Ücretsiz kayıt ol</a>
        <a class="dugme dugme-hayalet dugme-buyuk" href="/goruntulu-sohbet">Nasıl çalışır?</a>
      </div>
      <ul class="guven">
        <li>18 yaş ve üzeri topluluk</li>
        <li>iOS · Android · web</li>
        <li>Türkçe, İngilizce, Arapça, İspanyolca, Portekizce</li>
      </ul>
    </div>
    <div class="sahne" aria-hidden="true">
      <div class="sahne-kart sahne-canli">
        <div class="canli-ust">
          <span class="canli-etiket"><b></b> CANLI</span>
          <span class="izleyici">1.284 izleyici</span>
        </div>
        <div class="yayinci">EY</div>
        <p class="sahne-ad">Elif · akustik gece</p>
        <p class="sahne-not">Yayın açık · sohbete katılabilirsin</p>
        <div class="tepki"><span></span><span></span><span></span></div>
      </div>
      <div class="sahne-kart sahne-sohbet">
        <p class="balon balon-sol">Selam, müsait misin?</p>
        <p class="balon balon-sag">Evet, görüntülü geçelim</p>
        <p class="balon balon-sol">Tamam, seni arıyorum</p>
      </div>
      <div class="sahne-kart sahne-oda">
        <div class="oda-yuz"><b>MK</b><b>SD</b><b>AY</b></div>
        <div>
          <p class="oda-yazi">Sesli oda · Gece sohbeti</p>
          <p class="oda-alt">12 kişi konuşuyor</p>
        </div>
        <div class="dalga" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      </div>
    </div>
  </div>
</section>

${ozellikKartlari()}
${ekranSeridi()}
${adimlar()}
${kimlerIcin()}
${guvenlikBlogu()}
${blogBolumu(sonYazilar)}`;
}

const ANASAYFA_SSS = [
  {
    soru: 'Tamuso nedir, ne için kullanılır?',
    cevap:
      'Tamuso; görüntülü sohbet, canlı yayın, sesli sohbet odaları, mesajlaşma, hikâye ve sosyal oyunları aynı hesapta toplayan bir sosyal uygulamadır. Web tarayıcısından, iOS ve Android uygulamasından kullanılabilir.',
  },
  {
    soru: 'Görüntülü sohbet için uygulama indirmem şart mı?',
    cevap:
      'Hayır. Tamuso tarayıcıda da açılır. Kayıt olduktan sonra görüşme, sesli oda ve yayın ekranları web üzerinden kullanılabilir; mobilde bildirim ve arka plan sesi için uygulama tercih edilir.',
  },
  {
    soru: 'Tamuso ücretsiz mi?',
    cevap:
      'Kayıt olmak ücretsizdir. Görüntülü görüşme, hediye ve oyunlarda uygulama içi bakiye olan coin kullanılır. Güncel tutarlar ve paketler uygulama içinde görünür; bu sayfada fiyat listesi yayınlanmaz.',
  },
  {
    soru: 'Sesli odaya nasıl katılırım?',
    cevap:
      'Keşfet ekranındaki sesli odalardan birini açıp katıl düğmesine basman yeterli. Mikrofon izni verdiğinde konuşmacı olarak katılırsın; izin vermezsen odayı dinleyici olarak takip edebilirsin.',
  },
  {
    soru: 'Canlı yayın açmak için ne gerekiyor?',
    cevap:
      'Hesabın ve kamera izni yeterli. Yayına çıktığında izleyiciler yayınını canlı izler, yorum yazar ve hediye gönderebilir. Yayıncı başvurusu ve ajans akışı uygulama içinden yürür.',
  },
  {
    soru: 'Kaç yaş için uygun?',
    cevap:
      'Tamuso 18 yaş ve üzeri kullanıcılar içindir. Çocuklara yönelik içerikte sıfır tolerans uygulanır; çocuk koruma politikası ve topluluk kuralları sitede yayınlanır.',
  },
  {
    soru: 'Hesabımı nasıl silerim?',
    cevap:
      'Uygulama içindeki hesap silme ekranını kullanabilir veya support@litxtech.com adresine yazabilirsin. Silme talebi, gizlilik politikasında yazılı süre içinde işlenir.',
  },
];

function ilgiliBaglantilar(baslik, baglantilar) {
  return `<section class="bolum-dar">
  <div class="sinir">
    <h2 style="margin-bottom:16px">${kacis(baslik)}</h2>
    <div class="izgara izgara-3">
      ${baglantilar
        .map(
          (b) => `<a class="kart" href="${b.yol}" style="display:block">
        <h3>${kacis(b.ad)}</h3>
        <p style="margin-top:8px">${kacis(b.metin)}</p>
      </a>`,
        )
        .join('')}
    </div>
  </div>
</section>`;
}

function yaziSayfasi({ baslik, h1, giris, govde, sss, ilgili }) {
  return `<section class="sayfa-bas">
  <div class="sinir"><div class="sayfa-bas-ic">
    <span class="etiket">Tamuso</span>
    <h1>${kacis(h1 || baslik)}</h1>
    <p class="giris">${kacis(giris)}</p>
  </div></div>
</section>
<section class="bolum-dar">
  <div class="sinir"><article class="yazi">${govde}</article></div>
</section>
${sss && sss.length ? sssBolumuHtml(sss) : ''}
${ilgili ? ilgiliBaglantilar('İlgili sayfalar', ilgili) : ''}`;
}

/** sssBolumu kabuk tarafında; döngüsel import olmasın diye burada küçük kopya. */
function sssBolumuHtml(sorular) {
  return `<section class="bolum" id="sss">
  <div class="sinir">
    <div class="bolum-ust"><span class="etiket">SSS</span><h2>Sık sorulan sorular</h2></div>
    <div class="sss">
      ${sorular
        .map(
          (s) => `<details><summary>${kacis(s.soru)}</summary><div class="cevap"><p>${kacis(s.cevap)}</p></div></details>`,
        )
        .join('\n')}
    </div>
  </div>
</section>`;
}

/* ------------------------------------------------------------------ */
/* Anahtar kelime sayfaları                                            */
/* ------------------------------------------------------------------ */

function goruntuluSohbet() {
  const govde = `
<p><strong>Görüntülü sohbet</strong>, iki kişinin kamerayla aynı anda birbirini gördüğü bir görüşme biçimidir. Tamuso’da bu görüşme tek bir ekranda başlar: keşfet ekranında bir kişiyi ya da yayını açarsın, görüşme isteği gönderirsin ve karşı taraf kabul ettiğinde kamera bağlantısı kurulur. Görüşme sırasında yazılı mesaj göndermeye devam edebilirsin.</p>

<h2>Görüntülü sohbet nasıl başlar?</h2>
<p>Tamuso’da görüntülü görüşme üç adımda açılır:</p>
<ol>
  <li><strong>Hesabını aç.</strong> E-posta ile kayıt olursun. Kayıt ücretsizdir.</li>
  <li><strong>Kimi arayacağını seç.</strong> Keşfet ekranındaki kişiler, odalar ve yayınlar arasından seçim yaparsın.</li>
  <li><strong>Görüşmeyi başlat.</strong> Karşı taraf kabul ettiğinde kamera ve mikrofon izinleri istenir; izin verdiğinde görüntü akışı başlar.</li>
</ol>
<p>Görüşme sırasında kameranı kapatabilir, mikrofonu susturabilir veya görüşmeyi sonlandırabilirsin. Karşı tarafın kamerası kapalıysa sesli devam edersin.</p>

<h2>Kamera açmadan da sohbet edebilirsin</h2>
<p>Herkes ilk saniyede kamera açmak istemez. Tamuso bunun için iki alternatif sunar:</p>
<ul>
  <li><strong>Sesli sohbet odaları:</strong> mikrofonla katıldığın, birden fazla kişinin bulunduğu odalar. Yalnızca dinlemek de mümkün.</li>
  <li><strong>Mesajlaşma:</strong> kişilerinle yazışarak tanışabilir, görüşmeyi daha sonra açabilirsin.</li>
</ul>
<p>Bu iki yol, görüntülü görüşmeyi acele etmeden tanışmak isteyenler için pratik bir başlangıçtır.</p>

<h2>Görüntülü görüşmede güvenlik</h2>
<p>Görüntülü sohbet kişisel bir alandır. Tamuso’da her kullanıcı karşısındaki kişiyi engelleyebilir ve içeriği bildirebilir. Topluluk kuralları görüşme, yayın ve mesajların tamamında geçerlidir.</p>
<ul>
  <li>Rahatsız eden kişiyi engellediğinde yeni mesaj ve arama gönderemez.</li>
  <li>Kural ihlali içeren içerik bildirildiğinde inceleme başlar.</li>
  <li>Kamera ve mikrofon yalnızca sen izin verdiğinde açılır; izinleri cihaz ayarlarından geri alabilirsin.</li>
  <li>Platform 18 yaş ve üzeri kullanıcılar içindir.</li>
</ul>

<h2>Görüntülü sohbet, sesli oda ve canlı yayın arasındaki fark</h2>
<table>
  <tr><th>Biçim</th><th>Kaç kişi?</th><th>Kamera</th><th>Ne zaman kullanılır?</th></tr>
  <tr><td>Görüntülü görüşme</td><td>İki kişi</td><td>Açık</td><td>Birebir tanışma ve sohbet</td></tr>
  <tr><td>Sesli oda</td><td>Grup</td><td>Kapalı</td><td>Kalabalık sohbet, birlikte dinleme</td></tr>
  <tr><td>Canlı yayın</td><td>Yayıncı + izleyici</td><td>Açık</td><td>Geniş kitleye ulaşma</td></tr>
</table>

<h2>Hangi cihazlarda çalışır?</h2>
<p>Tamuso web tarayıcısında, iOS ve Android uygulamasında çalışır. Tarayıcıda ek kurulum gerekmez; kamera ve mikrofon izinlerini tarayıcı sorar. Mobil uygulamada arka plan sesi ve anlık bildirimler de desteklenir.</p>

<h2>Görüşme ücretli mi?</h2>
<p>Kayıt olmak ücretsizdir. Görüntülü görüşme, hediye ve oyunlarda uygulama içi bakiye olan coin kullanılır. Güncel tutarlar uygulama içinde gösterilir; bu sayfada fiyat listesi yayınlanmaz.</p>

<div class="kutu"><p><strong>Kısa özet:</strong> Tamuso’da görüntülü sohbet, tanışmayı hızlandıran birebir kamera görüşmesidir. İstersen sesli odaya veya mesaja geçebilir, istediğin an görüşmeyi kapatabilirsin.</p></div>
`;

  const sss = [
    {
      soru: 'Görüntülü sohbet için kamera şart mı?',
      cevap:
        'Görüntülü görüşme için kamera gerekir. Kameranı açmak istemiyorsan sesli sohbet odalarında mikrofonla veya mesajlaşma ekranından yazışarak devam edebilirsin.',
    },
    {
      soru: 'Görüşme sırasında mesaj gönderebilir miyim?',
      cevap:
        'Evet. Görüşme açıkken yazılı mesaj göndermeye devam edebilirsin. Bu, ses duyulmadığında veya not bırakmak istediğinde işe yarar.',
    },
    {
      soru: 'Karşı taraf kamerayı kapatırsa ne olur?',
      cevap:
        'Görüşme sesli olarak devam eder. Görüntü akışı yalnızca iki taraf da kamerasını açtığında görünür.',
    },
    {
      soru: 'İzinleri sonradan geri alabilir miyim?',
      cevap:
        'Evet. Tarayıcıda site izinlerinden, mobilde cihaz ayarlarından kamera ve mikrofon iznini kaldırabilirsin. İzin kaldırıldığında yeni görüşme başlatılamaz, var olan görüşme görüntüsüz sürer.',
    },
  ];

  const ilgili = [
    { yol: '/sesli-sohbet-odalari', ad: 'Sesli sohbet odaları', metin: 'Mikrofonlu odalarda grup sohbeti nasıl işler?' },
    { yol: '/canli-yayin', ad: 'Canlı yayın', metin: 'Kameranla yayına çıkma ve izleyiciyle etkileşim.' },
    { yol: '/arkadas-bul', ad: 'Arkadaş bul', metin: 'Keşfet ekranını kullanarak yeni insanlarla tanışma.' },
  ];

  return {
    yol: '/goruntulu-sohbet',
    baslik: 'Görüntülü sohbet: kamerayı aç, konuş | Tamuso',
    aciklama:
      'Tamuso’da görüntülü sohbet: birebir kamera görüşmesi, görüşme içi mesaj, sesli odaya geçiş ve engelleme. Web, iOS ve Android. 18 yaş ve üzeri.',
    anahtar: 'görüntülü sohbet, görüntülü görüşme, kamera aç sohbet, canlı görüntülü konuşma',
    h1: 'Görüntülü sohbet: kamerayı aç, gerçek insanlarla konuş',
    giris:
      'Tanımadığın insanlarla birebir kamera bağlantısı kur, görüşme içinde yazış ve istediğin an bitir. Tamuso web tarayıcısında da çalışır.',
    govde,
    sss,
    ilgili,
  };
}

function sesliOdalar() {
  const govde = `
<p><strong>Sesli sohbet odaları</strong>, birden fazla kişinin mikrofonla aynı anda konuştuğu alanlardır. Tamuso’da odayı açan kişi konuşmacı koltuklarını yönetir; dinleyiciler odayı takip eder, sıra geldiğinde konuşmaya katılır. Kamera açmak zorunlu değildir.</p>

<h2>Sesli oda nasıl çalışır?</h2>
<ol>
  <li><strong>Odayı bul.</strong> Keşfet ekranında açık odalar ve konuları listelenir.</li>
  <li><strong>Katıl.</strong> Dinleyici olarak girersin; mikrofon izni verdiğinde konuşmacı koltuğuna geçebilirsin.</li>
  <li><strong>Konuş veya dinle.</strong> Konuşurken mikrofonu kapatabilir, yerini değiştirebilir veya odadan çıkabilirsin.</li>
</ol>

<h2>Odada neler yapılır?</h2>
<ul>
  <li><strong>Sohbet:</strong> gündem, müzik, günlük konular ve tanışma odaları.</li>
  <li><strong>Birlikte dinleme:</strong> aynı yayını veya müziği birlikte takip etme.</li>
  <li><strong>Oyun ve yarışma:</strong> odada soru-cevap ve küçük etkinlikler.</li>
  <li><strong>Topluluk:</strong> şehir ve ülke sayfalarından yerel odaları görme.</li>
</ul>

<h2>Kamera açmadan sohbet etmenin avantajı</h2>
<p>Sesli oda, görüntülü görüşmeye göre daha kalabalık ve daha az kişisel bir alandır. Yeni bir topluluğa girmek, dili pratik yapmak veya yalnızca dinlenmek için uygundur. Mikrofonunu kapalı tuttuğunda kimse sesini duymaz.</p>

<h2>Oda moderasyonu ve güvenlik</h2>
<ul>
  <li>Oda yöneticisi konuşmacı koltuğunu ve mikrofonları yönetir.</li>
  <li>Rahatsız eden kullanıcıyı engelleyebilir, içeriği bildirebilirsin.</li>
  <li>Topluluk kuralları odalarda da geçerlidir; 18 yaş ve üzeri kullanıcılar içindir.</li>
  <li>Mikrofon izni yalnızca sen verdiğinde açılır.</li>
</ul>

<h2>Sesli oda ile görüntülü sohbet arasındaki fark</h2>
<table>
  <tr><th>Özellik</th><th>Sesli oda</th><th>Görüntülü sohbet</th></tr>
  <tr><td>Katılımcı</td><td>Grup</td><td>İki kişi</td></tr>
  <tr><td>Kamera</td><td>Gerekmez</td><td>Gerekir</td></tr>
  <tr><td>Kim konuşur?</td><td>Koltuk alanlar</td><td>İki taraf</td></tr>
  <tr><td>Uygun olduğu durum</td><td>Topluluk, dinleme, tanışma</td><td>Birebir tanışma</td></tr>
</table>

<h2>Hangi cihazlarda kullanılır?</h2>
<p>Sesli odalar web tarayıcısında, iOS ve Android uygulamasında çalışır. Mobil uygulamada ses arka planda devam eder; böylece kısa süreliğine uygulamadan çıktığında oda bağlantısı kopmaz.</p>

<div class="kutu"><p><strong>Kısa özet:</strong> Sesli sohbet odaları kamera açmadan toplulukla konuşmanın en kolay yolu. Dinleyici olarak başla, hazır olduğunda mikrofonu aç.</p></div>
`;

  const sss = [
    {
      soru: 'Sesli odaya mikrofon açmadan katılabilir miyim?',
      cevap:
        'Evet. Odaya dinleyici olarak katılırsın. Mikrofon izni vermediğinde sesin iletilmez; istediğin zaman konuşmacı koltuğuna geçebilirsin.',
    },
    {
      soru: 'Odada kaç kişi olabilir?',
      cevap:
        'Oda kapasitesi ve konuşmacı koltuk sayısı odaya göre değişir. Dinleyici sayısı konuşmacı sayısından fazla olabilir.',
    },
    {
      soru: 'Odayı kim yönetir?',
      cevap:
        'Odayı açan kişi ve yetkili yöneticiler konuşmacı koltuklarını, mikrofonları ve oda kurallarını yönetir.',
    },
    {
      soru: 'Sesli odalar ücretli mi?',
      cevap:
        'Kayıt olmak ücretsizdir. Uygulama içi hediye ve bazı etkileşimlerde coin kullanılır; güncel tutarlar uygulama içinde görünür.',
    },
  ];

  const ilgili = [
    { yol: '/goruntulu-sohbet', ad: 'Görüntülü sohbet', metin: 'Birebir kamera görüşmesi nasıl başlar?' },
    { yol: '/canli-yayin', ad: 'Canlı yayın', metin: 'Yayına çıkma, PK ve izleyici etkileşimi.' },
    { yol: '/arkadas-bul', ad: 'Arkadaş bul', metin: 'Keşfet, kişiler ve takip akışı.' },
  ];

  return {
    yol: '/sesli-sohbet-odalari',
    baslik: 'Sesli sohbet odaları: mikrofonu aç | Tamuso',
    aciklama:
      'Tamuso sesli sohbet odaları: mikrofonlu grup sohbeti, dinleyici olarak katılma, oda moderasyonu ve kamera açmadan konuşma. 18 yaş ve üzeri.',
    anahtar: 'sesli sohbet odaları, sesli oda, mikrofonlu sohbet, sesli sohbet sitesi',
    h1: 'Sesli sohbet odaları: mikrofonu aç, odaya katıl',
    giris:
      'Kamera açmadan, mikrofonla topluluk sohbetine katıl. İstersen yalnızca dinle, hazır olduğunda konuşmacı koltuğuna geç.',
    govde,
    sss,
    ilgili,
  };
}

function canliYayin() {
  const govde = `
<p><strong>Canlı yayın</strong>, kameranın açık olduğu ve izleyicilerin aynı anda izlediği yayın biçimidir. Tamuso’da yayın açmak için hesabın ve kamera izni yeterlidir. İzleyiciler yayını canlı izler, yorum yazar ve hediye gönderebilir.</p>

<h2>Canlı yayın nasıl başlar?</h2>
<ol>
  <li><strong>Yayın ekranını aç.</strong> Kamera ve mikrofon izinlerini verirsin.</li>
  <li><strong>Başlık ve kapak seç.</strong> Yayının konusu izleyicinin ilk gördüğü bilgidir.</li>
  <li><strong>Yayına çık.</strong> Yayın açıkken izleyici sayısı ve yorumlar aynı ekranda akar.</li>
  <li><strong>Bitir.</strong> Yayını kapattığında tekrar açabilirsin; geçmiş yayınlar profilinde kalır.</li>
</ol>

<h2>PK: iki yayıncı yan yana</h2>
<p>PK, iki yayıncının aynı ekranda yan yana yayın yaptığı bir düellodur. İzleyiciler iki tarafı da takip eder ve desteklediği tarafa hediye gönderebilir. PK sonucu yayın sırasında gösterilir; yayıncı istediğinde yeni bir PK başlatabilir.</p>

<h2>Yayıncı olmak: host ve ajans akışı</h2>
<p>Düzenli yayın açmak isteyen kullanıcılar uygulama içindeki host başvurusunu kullanabilir. Ajanslar yayıncılarını kendi panellerinden yönetir; başvurular, program ve ödemeler ajans akışında yürür. Başvuru koşulları ve güncel bilgiler uygulama içinde gösterilir.</p>

<h2>İzleyici olarak neler yapabilirsin?</h2>
<ul>
  <li>Yayına yorum yaz, yayıncıyı takip et.</li>
  <li>Hediye gönder, PK’de taraf tut.</li>
  <li>Yayını paylaş veya profilinden tekrar izle.</li>
  <li>Rahatsız edici içeriği bildir, kullanıcıyı engelle.</li>
</ul>

<h2>Yayın kuralları ve güvenlik</h2>
<p>Canlı yayınlar topluluk kurallarına tabidir. Şiddet, nefret söylemi, çocuklara yönelik içerik ve izinsiz kişisel veri paylaşımı yasaktır. Kural ihlali bildirildiğinde yayın incelenir; gerekli durumlarda yayın kapatılır ve hesap kısıtlanır. Platform 18 yaş ve üzeri kullanıcılar içindir.</p>

<h2>Coin, hediye ve yayıncı kazançları</h2>
<p>Coin uygulama içi bakiyedir; hediye göndermek için kullanılır. Yayıncıların coin karşılığı kazançları, ödeme profili ve kimlik doğrulama adımları tamamlandıktan sonra yayıncı kazançları ekranından takip edilir. Tutarlar ve komisyon oranları uygulama içinde yazılıdır; bu sayfada fiyat veya kazanç vaadi yoktur.</p>

<h2>Hangi cihazlarda yayın açabilirim?</h2>
<p>Canlı yayın web tarayıcısında, iOS ve Android uygulamasında açılabilir. Mobil uygulamada ön ve arka kamera arasında geçiş yapabilirsin.</p>

<div class="kutu"><p><strong>Kısa özet:</strong> Canlı yayın, kameranı açıp izleyicinle aynı anda buluşmanın yolu. Yayıncı olarak başvurabilir, izleyici olarak yorum ve hediye gönderebilirsin.</p></div>
`;

  const sss = [
    {
      soru: 'Canlı yayın açmak için kaç takipçi gerekir?',
      cevap:
        'Yayın açmak için takipçi şartı yoktur; hesabın ve kamera izni yeterlidir. Düzenli yayıncılık ve ajans süreci için uygulama içindeki host başvurusu kullanılır.',
    },
    {
      soru: 'Yayınımı kimler görebilir?',
      cevap:
        'Yayın, platformdaki kullanıcılar tarafından keşfet ve yayın listelerinden görülebilir. Yayın sırasında izleyici sayısı ve yorumlar canlı akar.',
    },
    {
      soru: 'PK nedir?',
      cevap:
        'PK, iki yayıncının aynı ekranda yan yana yayın yaptığı düellodur. İzleyiciler iki tarafı da izler ve hediye gönderebilir.',
    },
    {
      soru: 'Yayın kaydı saklanıyor mu?',
      cevap:
        'Yayınlar yayıncının profilinde geçmiş yayın olarak görünebilir. Görünürlük ayarları ve kaldırma talepleri için destek ekibine yazabilirsin.',
    },
  ];

  const ilgili = [
    { yol: '/goruntulu-sohbet', ad: 'Görüntülü sohbet', metin: 'Birebir kamera görüşmesi.' },
    { yol: '/sesli-sohbet-odalari', ad: 'Sesli sohbet odaları', metin: 'Kamera açmadan grup sohbeti.' },
    { yol: '/tanitim/coinler', ad: 'Coinler', metin: 'Uygulama içi bakiye nasıl kullanılır?' },
  ];

  return {
    yol: '/canli-yayin',
    baslik: 'Canlı yayın yap: kameranı aç | Tamuso',
    aciklama:
      'Tamuso’da canlı yayın: kamera izniyle yayına çık, izleyici yorumları, PK düelloları, hediye ve yayıncı başvurusu. 18 yaş ve üzeri.',
    anahtar: 'canlı yayın, canlı yayın yap, canlı yayın uygulaması, yayıncı ol',
    h1: 'Canlı yayın yap: kameranı aç, izleyicinle buluş',
    giris:
      'Yayına çık, izleyici yorumlarını aynı ekranda gör ve PK ile başka bir yayıncıyla yan yana yayın yap.',
    govde,
    sss,
    ilgili,
  };
}

function arkadasBul() {
  const govde = `
<p><strong>Arkadaş bulmak</strong> için önce kiminle tanışmak istediğini bilmen gerekir: aynı şehirde mi, aynı dilde mi, yoksa yalnızca yayın izleyen biriyle mi? Tamuso’nun keşfet ekranı bu üç yolu da tek yerde toplar.</p>

<h2>Keşfet ekranı nasıl çalışır?</h2>
<p>Keşfet; açık yayınları, sesli odaları ve öne çıkan profilleri gösterir. Bir karta dokunduğunda yayını izler, odaya katılır veya profile gidersin. Profilde kullanıcının tanıtımı, hikâyeleri ve paylaşımları bulunur.</p>
<ul>
  <li><strong>Yayınlar:</strong> şu anda canlı olan yayıncılar.</li>
  <li><strong>Odalar:</strong> konuşan ve dinleyen kişilerin bulunduğu sesli odalar.</li>
  <li><strong>Profiller:</strong> tanışmak istediğin kişilerin tanıtım sayfaları.</li>
</ul>

<h2>Tanıştıktan sonra ne olur?</h2>
<p>İlgini çeken kişiyi takip edebilir, mesaj gönderebilir veya görüntülü görüşme isteyebilirsin. Karşılıklı takip, kişiler listende görünmesini sağlar. Sohbeti sürdürmek istemiyorsan engelleme seçeneği her zaman açıktır.</p>

<h2>Hikâyeler ve kısa paylaşımlar</h2>
<p>Hikâyeler kısa süreli görsel paylaşımlardır. Bir kullanıcının hikâyesine bakmak, tanışmadan önce neyle ilgilendiğini görmenin en hızlı yoludur. Hikâyeler belirli bir süre sonra arşive geçer.</p>

<h2>Ülke ve şehir sayfaları</h2>
<p>Ülke ve şehir sayfaları, aynı bölgedeki kullanıcıları ve odaları bir araya getirir. Şehir ligi ve sıralamalar, hangi şehirlerin daha aktif olduğunu gösterir. Yurt dışında yaşayanlar için kendi dilinde sohbet eden toplulukları bulmak kolaylaşır.</p>

<h2>Güvenli tanışma için öneriler</h2>
<ul>
  <li>İlk sohbette kişisel bilgilerini (adres, telefon, iş yeri) paylaşma.</li>
  <li>Görüntülü görüşmeye geçmeden önce kısa bir mesajlaşma yeterli olabilir.</li>
  <li>Rahatsız eden davranışta kişiyi engelle ve içeriği bildir.</li>
  <li>Platform 18 yaş ve üzeri kullanıcılar içindir; yaşını doğru bildir.</li>
</ul>

<h2>Arkadaş bulmak neden zor geliyor?</h2>
<p>Çoğu uygulama yalnızca mesaj kutusu sunar; karşı taraf cevap yazmazsa sohbet başlamaz. Tamuso’da canlı yayınlar ve sesli odalar, sohbetin kendiliğinden başladığı ortak alanlardır. Bir yayına yorum yazmak veya odada söz almak, ilk mesajı atmadan tanışmanın en doğal yoludur.</p>

<div class="kutu"><p><strong>Kısa özet:</strong> Keşfet ekranı, canlı yayınlar ve sesli odalar üzerinden tanış; takip et, mesaj yaz, görüntülü görüşmeye geç.</p></div>
`;

  const sss = [
    {
      soru: 'Tamuso’da nasıl arkadaş bulurum?',
      cevap:
        'Keşfet ekranındaki yayınlara ve odalara katıl, ilgini çeken kişileri takip et ve mesaj gönder. Karşılıklı takip kişiler listende görünür.',
    },
    {
      soru: 'Yakınımdaki kişileri görebilir miyim?',
      cevap:
        'Şehir sayfaları aynı bölgedeki kullanıcıları ve odaları listeler. Konum izni paylaşmadan da şehir seçerek bu listeye ulaşabilirsin.',
    },
    {
      soru: 'Beni rahatsız eden birini nasıl engellerim?',
      cevap:
        'Profil veya sohbet ekranındaki engelle seçeneğini kullan. Engellenen kişi sana mesaj gönderemez ve arama başlatamaz.',
    },
  ];

  const ilgili = [
    { yol: '/goruntulu-sohbet', ad: 'Görüntülü sohbet', metin: 'Tanıştıktan sonra birebir kamera görüşmesi.' },
    { yol: '/sesli-sohbet-odalari', ad: 'Sesli sohbet odaları', metin: 'Ortak alanda tanışmanın en hızlı yolu.' },
    { yol: '/yabanci-sohbet', ad: 'Yabancı sohbet', metin: 'Farklı ülkelerden insanlarla tanışma.' },
  ];

  return {
    yol: '/arkadas-bul',
    baslik: 'Arkadaş bul: keşfet, tanış, sohbet | Tamuso',
    aciklama:
      'Tamuso’da arkadaş bul: keşfet ekranı, canlı yayınlar, sesli odalar, hikâyeler ve şehir sayfaları. Engelleme ve bildirme ile güvenli tanışma.',
    anahtar: 'arkadaş bul, yeni arkadaşlar, tanışma uygulaması, sohbet arkadaşı',
    h1: 'Arkadaş bul: keşfet, tanış, sohbeti sürdür',
    giris:
      'Keşfet ekranındaki yayınlar ve sesli odalar sohbeti kendiliğinden başlatır. Takip et, mesaj yaz, hazır olduğunda görüntülü görüşmeye geç.',
    govde,
    sss,
    ilgili,
  };
}

function yabanciSohbet() {
  const govde = `
<p><strong>Yabancı sohbet</strong>, farklı ülkelerden veya farklı dillerden insanlarla tanışmak isteyenler için kullanılan bir ifadedir. Tamuso’da ülke ve şehir sayfaları, o ülkedeki kullanıcıları ve odaları listeler. Arayüz beş dilde kullanılabilir.</p>

<h2>Hangi diller destekleniyor?</h2>
<p>Uygulama arayüzü Türkçe, İngilizce, Arapça, İspanyolca ve Portekizce olarak kullanılabilir. Dil seçimi hesap ayarlarından yapılır. Blog ve tanıtım sayfaları ek olarak Almanca ve Rusça içerik de yayınlar.</p>

<h2>Ülke ve şehir sayfaları ne işe yarar?</h2>
<ul>
  <li>Bir ülkedeki açık yayınları ve odaları gösterir.</li>
  <li>Şehir sayfası, aynı bölgedeki kullanıcıları bir araya getirir.</li>
  <li>Şehir ligi ve sıralamalar, topluluğun hareketini gösterir.</li>
</ul>
<p>Yurt dışında yaşayan Türkçe konuşanlar için şehir sayfaları, aynı dilde sohbet eden topluluğu bulmanın en pratik yoludur.</p>

<h2>Dil pratiği için nasıl kullanılır?</h2>
<ol>
  <li>Hedef dilde yayın yapan kullanıcıları keşfet ekranında bul.</li>
  <li>Yayına yorum yazarak başla; yazılı sohbet, konuşmadan daha az streslidir.</li>
  <li>Hazır olduğunda sesli odaya katıl; mikrofonu açmadan dinlemek de öğreticidir.</li>
  <li>Karşı taraf da istiyorsa görüntülü görüşmeye geç.</li>
</ol>

<h2>Kültürler arası sohbet için öneriler</h2>
<ul>
  <li>Kısa ve net cümlelerle başla; deyim ve argo karşı tarafı zorlayabilir.</li>
  <li>Din, siyaset ve kişisel bilgiler gibi hassas konuları ilk sohbette açma.</li>
  <li>Saat farkını unutma; karşı tarafın yerel saatini sor.</li>
  <li>Anlamadığın bir şey olduğunda tekrar sormak normaldir.</li>
</ul>

<h2>Güvenlik ve topluluk kuralları</h2>
<p>Yabancı sohbet, tanımadığın kişilerle konuşmak demektir. Tamuso’da her kullanıcıyı engelleyebilir ve içeriği bildirebilirsin. Platform 18 yaş ve üzeri kullanıcılar içindir. Kişisel bilgilerini paylaşmadan önce karşı tarafı tanımaya zaman ayır.</p>

<h2>Görüntülü görüşmede dil bariyeri</h2>
<p>Yazılı sohbet, telaffuz kaygısı olmadan anlaşmayı kolaylaştırır. Sesli odalar ise dinleme pratiği için uygundur. Görüntülü görüşme, jest ve mimikler devreye girdiğinde anlaşmayı hızlandırır.</p>

<div class="kutu"><p><strong>Kısa özet:</strong> Ülke ve şehir sayfalarıyla farklı ülkelerden insanlara ulaş, önce yazılı sohbetle başla, sonra sesli odaya veya görüntülü görüşmeye geç.</p></div>
`;

  const sss = [
    {
      soru: 'Tamuso’da yabancı insanlarla konuşabilir miyim?',
      cevap:
        'Evet. Ülke ve şehir sayfaları farklı bölgelerdeki kullanıcıları ve odaları listeler. Arayüz beş dilde kullanılabilir.',
    },
    {
      soru: 'Hangi dillerde arayüz var?',
      cevap:
        'Türkçe, İngilizce, Arapça, İspanyolca ve Portekizce. Dil seçimi hesap ayarlarından yapılır.',
    },
    {
      soru: 'Dil bilmiyorum, yine de kullanabilir miyim?',
      cevap:
        'Evet. Arayüz dilini Türkçeye alabilir, yalnızca Türkçe konuşan kullanıcılarla sohbet edebilirsin.',
    },
  ];

  const ilgili = [
    { yol: '/arkadas-bul', ad: 'Arkadaş bul', metin: 'Keşfet ve kişiler akışı.' },
    { yol: '/sesli-sohbet-odalari', ad: 'Sesli sohbet odaları', metin: 'Dinleme pratiği için odalar.' },
    { yol: '/goruntulu-sohbet', ad: 'Görüntülü sohbet', metin: 'Birebir kamera görüşmesi.' },
  ];

  return {
    yol: '/yabanci-sohbet',
    baslik: 'Yabancı sohbet: yeni ülkeler, yeni insanlar | Tamuso',
    aciklama:
      'Tamuso’da yabancı sohbet: ülke ve şehir sayfaları, beş dilde arayüz, sesli odalarda dinleme pratiği ve güvenli tanışma önerileri.',
    anahtar: 'yabancı sohbet, yabancılarla sohbet, yabancı dil pratiği, ülke sohbet',
    h1: 'Yabancı sohbet: farklı ülkelerden insanlarla tanış',
    giris:
      'Ülke ve şehir sayfalarıyla yeni topluluklar keşfet, önce yazılı sohbetle başla, sonra sesli odaya veya görüntülü görüşmeye geç.',
    govde,
    sss,
    ilgili,
  };
}

function sohbetOdalari() {
  const govde = `
<p><strong>Sohbet odaları</strong>, Tamuso’da üç ayrı biçimde karşına çıkar: mikrofonlu sesli odalar, birebir görüntülü görüşme ve canlı yayın. Üçü de aynı hesapta çalışır; keşfet ekranından bir odaya girersin, mikrofon ya da kamera iznini verirsin ve sohbet başlar. Bu sayfa oda türlerini, katılma adımlarını ve kuralları tek yerde toplar.</p>

<h2>Hangi oda türü sana uygun?</h2>
<ul>
  <li><strong>Sesli oda:</strong> Birden fazla kişinin mikrofonla konuştuğu grup sohbeti. Kamera açmadan katılabilir, istersen yalnızca dinleyici kalabilirsin. Ayrıntı: <a href="/sesli-sohbet-odalari">sesli sohbet odaları</a>.</li>
  <li><strong>Görüntülü görüşme:</strong> İki kişinin kamerayla bağlandığı birebir görüşme. Tanışmak ve yüz yüze konuşmak için uygundur. Ayrıntı: <a href="/goruntulu-sohbet">görüntülü sohbet</a>.</li>
  <li><strong>Canlı yayın:</strong> Bir yayıncının kamerayla yayına çıktığı, izleyicilerin yorum ve hediye gönderdiği oda. PK ile iki yayıncı yan yana yarışır. Ayrıntı: <a href="/canli-yayin">canlı yayın</a>.</li>
  <li><strong>Mesaj ve hikâye:</strong> Oda dışında yazışmak, sohbeti sürdürmek ve kısa süreli hikâye paylaşmak için kullanılır.</li>
</ul>

<h2>Odaya katılmak için ne gerekiyor?</h2>
<ol>
  <li><strong>Hesap aç.</strong> Kayıt ücretsizdir; e-posta ile hesabını oluşturursun.</li>
  <li><strong>Keşfet ekranını aç.</strong> Açık yayınlar, sesli odalar ve öne çıkan profiller aynı listede görünür.</li>
  <li><strong>Bir oda seç ve katıl.</strong> Sesli odada mikrofon izni verirsen konuşmacı, vermezsen dinleyici olursun.</li>
  <li><strong>Profilini tamamla.</strong> Kullanıcı adı, fotoğraf ve kısa tanıtım, odalarda seni tanıtan bilgidir.</li>
</ol>

<h2>Sesli odada rolleri kim belirler?</h2>
<p>Odayı açan kişi ve yetkili yöneticiler konuşmacı koltuklarını, mikrofonları ve oda kurallarını yönetir. Bir kullanıcıyı odadan çıkarabilir veya koltuğunu kapatabilirler. Kurallara uymayan davranışları bildirmek için oda içindeki bildir düğmesini kullanabilirsin.</p>

<h2>Görüntülü görüşme ile canlı yayın arasındaki fark</h2>
<ul>
  <li>Görüntülü görüşme <strong>ikili</strong>dir; iki kişi birbirini görür.</li>
  <li>Canlı yayın <strong>tek yönlü</strong> yayınlanır; izleyici sayısı sınırlı değildir, etkileşim yorum ve hediye ile olur.</li>
  <li>Görüşme isteği karşı tarafın kabulüyle başlar; yayın ise yayıncı başlattığında herkese açılır.</li>
</ul>

<h2>Sohbet odalarında güvenlik</h2>
<p>Tamuso 18 yaş ve üzeri kullanıcılar içindir. Şiddet, nefret söylemi, çocuklara yönelik içerik ve izinsiz kişisel veri paylaşımı yasaktır. Rahatsız edici bir durumda kişiyi engelleyebilir, içeriği bildirebilir ve destek ekibine yazabilirsin. Ayrıntılar <a href="/politika/community_rules">topluluk kuralları</a> ve <a href="/politika/child_safety">çocuk koruma politikası</a> sayfalarında yazılı.</p>

<h2>Telefonda ve bilgisayarda sohbet</h2>
<p>Sohbet odaları web tarayıcısında, iOS ve Android uygulamasında açılır. Tarayıcıda hesabını açıp doğrudan katılabilirsin; mobil uygulamada bildirimler ve arka plan sesi daha rahat çalışır.</p>

<h2>Sohbet odaları ücretli mi?</h2>
<p>Kayıt olmak ve odalara katılmak ücretsizdir. Hediye ve bazı etkileşimlerde uygulama içi bakiye olan coin kullanılır. Güncel tutarlar ve paketler uygulama içinde görünür; bu sayfada fiyat listesi yayınlanmaz.</p>

<div class="kutu"><p><strong>Kısa özet:</strong> Sesli oda dinlemek ve konuşmak, görüntülü görüşme iki kişiyle yüz yüze tanışmak, canlı yayın ise geniş bir izleyici kitlesine ulaşmak için. Üçü de aynı hesapta ve aynı keşfet ekranında.</p></div>
`;

  const sss = [
    {
      soru: 'Sohbet odaları ücretsiz mi?',
      cevap:
        'Kayıt olmak ve odalara katılmak ücretsizdir. Hediye ve bazı etkileşimlerde uygulama içi bakiye olan coin kullanılır; tutarlar uygulama içinde görünür.',
    },
    {
      soru: 'Mikrofon olmadan sesli odaya katılabilir miyim?',
      cevap:
        'Evet. Mikrofon izni vermezsen odayı dinleyici olarak takip edersin; hazır olduğunda izin verip konuşmacı koltuğuna geçebilirsin.',
    },
    {
      soru: 'Görüntülü sohbet için uygulama indirmem şart mı?',
      cevap:
        'Hayır. Görüntülü görüşme ve sesli odalar tarayıcıda da açılır. Mobilde bildirim ve arka plan sesi için uygulama tercih edilir.',
    },
    {
      soru: 'Sohbet odaları kaç yaş için?',
      cevap:
        'Platform 18 yaş ve üzeri kullanıcılar içindir. Çocuklara yönelik içerikte sıfır tolerans uygulanır.',
    },
    {
      soru: 'Oda yöneticisi kim?',
      cevap:
        'Odayı açan kullanıcı ve yetkili yöneticiler; konuşmacı koltuklarını, mikrofonları ve oda kurallarını onlar yönetir.',
    },
  ];

  const ilgili = [
    { yol: '/sesli-sohbet-odalari', ad: 'Sesli sohbet odaları', metin: 'Mikrofonlu grup sohbeti nasıl işler?' },
    { yol: '/goruntulu-sohbet', ad: 'Görüntülü sohbet', metin: 'Birebir kamera görüşmesi nasıl başlar?' },
    { yol: '/canli-yayin', ad: 'Canlı yayın', metin: 'Yayına çıkma, PK ve izleyici etkileşimi.' },
    { yol: '/arkadas-bul', ad: 'Arkadaş bul', metin: 'Keşfet, kişiler ve takip akışı.' },
  ];

  return {
    yol: '/sohbet-odalari',
    baslik: 'Sohbet odaları: sesli, görüntülü ve canlı yayın | Tamuso',
    aciklama:
      'Tamuso sohbet odaları: mikrofonlu sesli odalar, birebir görüntülü görüşme ve canlı yayın aynı hesapta. Katılma adımları, oda kuralları ve güvenlik. 18 yaş ve üzeri.',
    anahtar: 'sohbet odaları, sohbet odası, ücretsiz sohbet odaları, mobil sohbet odaları, sohbet sitesi',
    h1: 'Sohbet odaları: sesli, görüntülü ve canlı yayın bir arada',
    giris:
      'Sesli odada dinle ve konuş, görüntülü görüşmede kamera aç, canlı yayında izleyicinle buluş. Hangi oda türünün sana uyduğunu bu sayfadan seç.',
    govde,
    sss,
    ilgili,
  };
}

/* ------------------------------------------------------------------ */
/* Mevcut tanıtım / politika sayfaları (gerçek uygulama metinleri)     */
/* ------------------------------------------------------------------ */

function mevcutSayfa(yol, h1Elle) {
  const ham = sayfaIcerigi(yol);
  const h1 = h1Elle || (ham.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || 'Tamuso';
  let govde = ham
    .replace(/<h1>[\s\S]*?<\/h1>/, '')
    .replace(/<footer>[\s\S]*?<\/footer>/, '')
    .replace(/^<article>/, '')
    .replace(/<\/article>\s*$/, '');
  govde = govde.replace(/<pre>/g, '<div class="kutu"><pre>').replace(/<\/pre>/g, '</pre></div>');
  return { h1, govde };
}

export const MEVCUT_SAYFALAR = [
  '/tanitim',
  '/tanitim/ozellikler',
  '/tanitim/coinler',
  '/tanitim/meyve',
  '/tanitim/hakkinda',
  '/tanitim/yatirim',
  '/tanitim/isbirligi',
  '/politika',
  '/politika/tos',
  '/politika/privacy',
  '/politika/community_rules',
  '/politika/child_safety',
];

export function mevcutIcerik(yol, meta) {
  const { h1, govde } = mevcutSayfa(yol);
  return {
    yol,
    baslik: meta.title,
    aciklama: meta.description,
    h1,
    giris: meta.description,
    icerik: `<section class="sayfa-bas">
  <div class="sinir"><div class="sayfa-bas-ic">
    <span class="etiket">${yol.startsWith('/politika') ? 'Yasal' : 'Tamuso'}</span>
    <h1>${kacis(h1)}</h1>
    <p class="giris">${kacis(meta.description)}</p>
  </div></div>
</section>
<section class="bolum-dar">
  <div class="sinir"><article class="yazi">${govde}</article></div>
</section>`,
    semalar: [],
  };
}

/** Anahtar kelime sayfalarını üretir. */
export function anahtarSayfalari() {
  /* Hub sayfası: "sohbet odaları" aramasını karşılar ve diğer odalara iç bağlantı verir. */
  const hub = {
    yol: '/sohbet-odalari',
    ad: 'Sohbet odaları',
    metin: 'Sesli, görüntülü ve canlı odalara toplu bakış.',
  };
  return [goruntuluSohbet(), sesliOdalar(), canliYayin(), arkadasBul(), yabanciSohbet(), sohbetOdalari()].map(
    (sayfa) => {
      const ilgili = sayfa.yol === hub.yol ? sayfa.ilgili : [hub, ...sayfa.ilgili];
      return {
        ...sayfa,
        ilgili,
        icerik: yaziSayfasi({ ...sayfa, ilgili }),
        semalar: [sssSemasi(sayfa.sss)],
      };
    },
  );
}

export function anasayfaSayfasi(sonYazilar) {
  return {
    yol: '/',
    baslik: 'Tamuso | Görüntülü sohbet, canlı yayın ve arkadaş bul',
    aciklama:
      'Tamuso ile görüntülü sohbet et, canlı yayın aç, sesli sohbet odalarına katıl ve yeni arkadaşlar bul. Web, iOS ve Android. 18 yaş ve üzeri.',
    anahtar: 'görüntülü sohbet, canlı yayın, sesli sohbet odaları, arkadaş bul, sohbet uygulaması',
    anaSayfa: true,
    icerik: anasayfaIcerik(sonYazilar),
    semalar: [
      sssSemasi(ANASAYFA_SSS),
      {
        '@type': 'SoftwareApplication',
        name: 'Tamuso',
        applicationCategory: 'SocialNetworkingApplication',
        applicationSubCategory: 'Sohbet ve canlı yayın',
        operatingSystem: 'Web, iOS, Android',
        url: 'https://www.tamuso.com/',
        description:
          'Görüntülü sohbet, canlı yayın, sesli sohbet odaları, mesajlaşma ve sosyal oyunlar.',
        inLanguage: 'tr-TR',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'TRY' },
        featureList: [
          'Görüntülü sohbet',
          'Canlı yayın ve PK',
          'Sesli sohbet odaları',
          'Mesajlaşma',
          'Hikâyeler',
          'Keşfet',
          'Coin ve sosyal oyunlar',
        ],
      },
    ],
  };
}

/** Ana sayfanın SSS'si kabuk tarafından basılır. */
export function anasayfaSss() {
  return ANASAYFA_SSS;
}
