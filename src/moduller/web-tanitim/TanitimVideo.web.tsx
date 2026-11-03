import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

type Baglanti = {
  saveData?: boolean;
  effectiveType?: string;
};

/**
 * Mobil / yavaş ağ: video hiç indirilmesin, afiş kalsın.
 * Lighthouse mobil profili (1.6 Mbps) 3g bildirir; bu durumda video yüklenmez.
 */
function videoYuklenebilir(): boolean {
  if (typeof navigator === 'undefined') return false;
  const baglanti = (navigator as Navigator & { connection?: Baglanti }).connection;
  if (!baglanti) return true;
  if (baglanti.saveData) return false;
  const tip = baglanti.effectiveType ?? '';
  return tip !== 'slow-2g' && tip !== '2g' && tip !== '3g';
}

function sayfaYuklendiMi(): boolean {
  return typeof document !== 'undefined' && document.readyState === 'complete';
}

type Props = {
  kaynak: string;
  poster: string;
  /** Ana ekran kahramanı: afişi hemen ve yüksek öncelikle yükle. */
  oncelikli?: boolean;
};

/**
 * Tanıtım videoları.
 *
 * Açılışta 4-6 videoyu `preload="auto"` ile indirmek 15+ MB trafik üretiyordu ve
 * JS paketiyle bant genişliği yarışına giriyordu (LCP 17 sn).
 * Artık: önce yalnızca afiş (poster) boyanır, video görünür alana girince ve
 * sayfa yüklendikten sonra indirilir. Tasarruf modunda video hiç indirilmez.
 */
export function TanitimVideo({ kaynak, poster, oncelikli = false }: Props) {
  const kap = useRef<View>(null);
  const [videoAcik, setVideoAcik] = useState(false);

  useEffect(() => {
    if (videoAcik) return undefined;
    if (!videoYuklenebilir()) return undefined;

    let iptal = false;
    let zaman: ReturnType<typeof setTimeout> | undefined;
    let gozlemci: IntersectionObserver | undefined;

    const baslat = () => {
      if (!iptal) setVideoAcik(true);
    };

    /** Sayfa yüklendikten sonra: ağ önce kritik JS/CSS'i alsın. */
    const sayfaSonrasi = (gecikme: number) => {
      const zamanla = () => {
        zaman = setTimeout(baslat, gecikme);
      };
      if (sayfaYuklendiMi()) zamanla();
      else window.addEventListener('load', zamanla, { once: true });
      return () => {
        window.removeEventListener('load', zamanla);
        if (zaman) clearTimeout(zaman);
      };
    };

    // Kahraman videosu: LCP sonrası, kullanıcı kaydırmasa da oynasın.
    if (oncelikli) {
      const temizle = sayfaSonrasi(1200);
      return () => {
        iptal = true;
        temizle();
      };
    }

    const oge = kap.current as unknown as Element | null;
    if (!oge || typeof IntersectionObserver === 'undefined') {
      const temizle = sayfaSonrasi(1500);
      return () => {
        iptal = true;
        temizle();
      };
    }

    gozlemci = new IntersectionObserver(
      (girisler) => {
        if (!girisler.some((g) => g.isIntersecting)) return;
        gozlemci?.disconnect();
        gozlemci = undefined;
        // Aynı anda birden fazla video başlamasın: kısa kademeli gecikme.
        zaman = setTimeout(baslat, 400);
      },
      { rootMargin: '320px 0px' },
    );
    gozlemci.observe(oge);

    return () => {
      iptal = true;
      if (zaman) clearTimeout(zaman);
      gozlemci?.disconnect();
    };
  }, [videoAcik, oncelikli]);

  return (
    <View ref={kap} pointerEvents="none" style={StyleSheet.absoluteFill}>
      {videoAcik
        ? React.createElement('video', {
            src: kaynak,
            poster,
            autoPlay: true,
            muted: true,
            loop: true,
            playsInline: true,
            preload: 'auto',
            style: {
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              backgroundColor: '#080811',
            },
          })
        : React.createElement('img', {
            src: poster,
            alt: '',
            loading: oncelikli ? 'eager' : 'lazy',
            fetchPriority: oncelikli ? 'high' : 'auto',
            decoding: 'async',
            style: {
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            },
          })}
    </View>
  );
}
