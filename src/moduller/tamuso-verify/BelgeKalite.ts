/**
 * Tamuso Verify — görüntü kalitesi analizi.
 *
 * Neden WebView? React Native'de piksel okumak için ek yerel bağımlılık
 * gerekiyor. Zaten projede olan react-native-webview kullanılarak görüntü
 * canvas'a çizilir ve metrikler (parlaklık, kontrast, keskinlik, parlama)
 * gerçekten hesaplanır. Sonuç yalnızca ÖN KONTROLDÜR: belge gerçekliğini
 * veya canlılığı doğrulamaz, inceleme ekibi karar verir.
 */
import type { VerifyBelgeKalitesi } from './tipler';

export type KaliteMetrikleri = {
  genislik: number;
  yukseklik: number;
  parlaklik: number;
  kontrast: number;
  keskinlik: number;
  parlakOran: number;
  karanlikOran: number;
};

export const KALITE_ESIKLERI = {
  minGenislik: 640,
  minParlaklik: 55,
  maxParlakOranParlama: 0.16,
  minKontrast: 22,
  minKeskinlik: 60,
  mukemmelKeskinlik: 140,
} as const;

/**
 * Metrikleri karara çevirir.
 * - failed: görüntü kullanılamaz, yeniden çekim zorunlu
 * - warned: kullanılabilir ama kullanıcı uyarılır (yeniden çekmesi önerilir)
 */
export function kaliteDegerlendir(m: KaliteMetrikleri): VerifyBelgeKalitesi {
  const kodlar: string[] = [];
  const E = KALITE_ESIKLERI;

  if (m.genislik < E.minGenislik) kodlar.push('kucuk');
  if (m.parlaklik < E.minParlaklik) kodlar.push('karanlik');
  if (m.parlakOran > E.maxParlakOranParlama) kodlar.push('parlama');
  if (m.kontrast < E.minKontrast) kodlar.push('kontrast');
  if (m.keskinlik < E.minKeskinlik) kodlar.push('bulanik');

  const kritik =
    m.genislik < E.minGenislik ||
    m.parlaklik < 35 ||
    m.keskinlik < 28 ||
    m.kontrast < 12;

  const state: VerifyBelgeKalitesi['state'] = kritik
    ? 'failed'
    : kodlar.length > 0
      ? 'warned'
      : 'passed';

  return { state, kodlar, metrikler: m };
}

export function bilinmeyenKalite(): VerifyBelgeKalitesi {
  return { state: 'unknown', kodlar: [] };
}

/** Canvas içinde çalışan, bağımlılıksız metrik kodu (HTML string parçası). */
export const KALITE_HTML = `<!doctype html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>html,body{margin:0;background:#000;color:#fff;font:12px system-ui}canvas{display:none}</style>
</head><body>
<canvas id="c" width="1" height="1"></canvas>
<script>
(function () {
  var MAX = 360;

  function olcum(dataUrl) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var oran = Math.min(1, MAX / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * oran));
        var h = Math.max(1, Math.round(img.height * oran));
        var c = document.getElementById('c');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        var px;
        try {
          px = ctx.getImageData(0, 0, w, h).data;
        } catch (e) {
          reject(new Error('readback_blocked'));
          return;
        }

        var n = w * h;
        var luma = new Float32Array(n);
        var toplam = 0, parlak = 0, karanlik = 0;
        for (var i = 0; i < n; i++) {
          var r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
          var l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          luma[i] = l;
          toplam += l;
          if (l >= 248) parlak++;
          if (l <= 12) karanlik++;
        }
        var ort = toplam / n;

        var varyans = 0;
        for (var j = 0; j < n; j++) {
          var d = luma[j] - ort;
          varyans += d * d;
        }
        varyans /= n;

        // Laplacian varyansı: kenar enerjisi (bulanıklık göstergesi)
        var lapToplam = 0, lapKare = 0, sayac = 0;
        for (var y = 1; y < h - 1; y++) {
          for (var x = 1; x < w - 1; x++) {
            var idx = y * w + x;
            var v = -4 * luma[idx] + luma[idx - 1] + luma[idx + 1] + luma[idx - w] + luma[idx + w];
            lapToplam += v;
            lapKare += v * v;
            sayac++;
          }
        }
        var lapOrt = sayac ? lapToplam / sayac : 0;
        var lapVar = sayac ? lapKare / sayac - lapOrt * lapOrt : 0;

        resolve({
          genislik: img.width,
          yukseklik: img.height,
          parlaklik: Math.round(ort * 10) / 10,
          kontrast: Math.round(Math.sqrt(Math.max(varyans, 0)) * 10) / 10,
          keskinlik: Math.round(Math.max(lapVar, 0) * 10) / 10,
          parlakOran: Math.round((parlak / n) * 10000) / 10000,
          karanlikOran: Math.round((karanlik / n) * 10000) / 10000
        });
      };
      img.onerror = function () { reject(new Error('decode_failed')); };
      img.src = dataUrl;
    });
  }

  function cevapla(mesaj) {
    try {
      if (!window.ReactNativeWebView) return;
      window.ReactNativeWebView.postMessage(JSON.stringify(mesaj));
    } catch (e) { /* yut */ }
  }

  function mesajGeldi(ham) {
    var veri;
    try { veri = JSON.parse(ham); } catch (e) { return; }
    if (!veri || !veri.id) return;
    if (veri.tip === 'analiz') {
      olcum(veri.goruntu)
        .then(function (m) { cevapla({ id: veri.id, ok: true, metrikler: m }); })
        .catch(function (err) { cevapla({ id: veri.id, ok: false, hata: String(err && err.message || err) }); });
    }
  }

  document.addEventListener('message', function (e) { mesajGeldi(e.data); });
  window.addEventListener('message', function (e) { mesajGeldi(e.data); });

  cevapla({ tip: 'hazir' });
})();
</script>
</body></html>`;
