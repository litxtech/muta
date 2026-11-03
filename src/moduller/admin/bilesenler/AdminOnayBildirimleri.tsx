import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../contexts/AuthContext';
import {
  AdminOnayBalonlariGetir,
  type AdminOnayBalonu,
} from '../okuma/AdminOnayBalonlari';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  AnimasyonTokenlari,
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

/**
 * Onay kuyruklarının kaç saniyede bir yoklanacağı.
 * Panel açıkken yeni başvuru düşerse üstten baloncuk olarak belirir.
 */
const YOKLAMA_MS = 30_000;
/** Aynı anda en fazla bu kadar baloncuk üst üste gösterilir. */
const EN_FAZLA_BILDIRIM = 3;
/** Baloncuğun kendiliğinden kapanma süresi. */
const KAPANMA_MS = 12_000;
/** Tarayıcıda son görülen sayılar — yenilemeden sonra da fark yakalanır. */
const DEPO_ONEK = 'tamuso.admin.onay.gorulen.v2';

/** Baloncuk üretilecek onay kuyrukları (rapor gibi diğer sayaçlar hariç). */
const ONAY_KUYRUKLARI = new Set([
  'verify',
  'kimlik',
  'ajans',
  'itiraz',
  'yayinci_odeme',
  'yayinci_kazanc',
]);

const IKONLAR: Record<string, keyof typeof Ionicons.glyphMap> = {
  verify: 'shield-checkmark',
  kimlik: 'id-card-outline',
  ajans: 'business-outline',
  itiraz: 'alert-circle-outline',
  yayinci_odeme: 'cash-outline',
  yayinci_kazanc: 'wallet-outline',
};

type Bildirim = AdminOnayBalonu & {
  /** Liste anahtarı — aynı kuyruktan art arda gelen bildirimler çakışmasın. */
  anahtar: number;
  /** Son görülen sayıya göre artış. */
  delta: number;
};

type TarayiciDepo = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
};

function tarayiciDepo(): TarayiciDepo | null {
  if (Platform.OS !== 'web') return null;
  const g = globalThis as unknown as {
    window?: { localStorage?: TarayiciDepo };
  };
  return g.window?.localStorage ?? null;
}

function gorulenleriOku(anahtar: string): Record<string, number> | null {
  try {
    const ham = tarayiciDepo()?.getItem(anahtar);
    if (!ham) return null;
    const veri = JSON.parse(ham) as unknown;
    if (!veri || typeof veri !== 'object') return null;
    const sonuc: Record<string, number> = {};
    for (const [k, v] of Object.entries(veri as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) sonuc[k] = n;
    }
    return sonuc;
  } catch {
    return null;
  }
}

function gorulenleriYaz(anahtar: string, veri: Record<string, number>): void {
  try {
    tarayiciDepo()?.setItem(anahtar, JSON.stringify(veri));
  } catch {
    // Gizli sekme / kota hatası bildirim üretimini engellemesin.
  }
}

function BildirimKarti({
  bildirim,
  onKapat,
}: {
  bildirim: Bildirim;
  onKapat: (anahtar: number) => void;
}) {
  const giris = useRef(new Animated.Value(0)).current;
  const kapatRef = useRef(onKapat);
  kapatRef.current = onKapat;

  useEffect(() => {
    Animated.timing(giris, {
      toValue: 1,
      duration: AnimasyonTokenlari.yavas,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    const zaman = setTimeout(() => kapatRef.current(bildirim.anahtar), KAPANMA_MS);
    return () => clearTimeout(zaman);
  }, [bildirim.anahtar, giris]);

  const ikon = IKONLAR[bildirim.id] ?? 'notifications-outline';

  return (
    <Animated.View
      style={[
        styles.kart,
        {
          opacity: giris,
          transform: [
            {
              translateY: giris.interpolate({
                inputRange: [0, 1],
                outputRange: [-56, 0],
              }),
            },
          ],
        },
      ]}
      accessibilityRole="alert"
    >
      <Pressable
        style={styles.icerik}
        onPress={() => {
          kapatRef.current(bildirim.anahtar);
          router.push(bildirim.href as never);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${bildirim.etiket}: ${bildirim.delta} yeni kayıt. Kontrol et.`}
      >
        <View style={styles.ikonKutu}>
          <Ionicons name={ikon} size={17} color={RenkTokenlari.accent} />
        </View>
        <View style={styles.metin}>
          <Text style={styles.baslik} numberOfLines={1}>
            Yeni onay: {bildirim.etiket}
          </Text>
          <Text style={styles.alt} numberOfLines={1}>
            +{bildirim.delta} yeni kayıt · {bildirim.adet} bekliyor · Kontrol et
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={RenkTokenlari.textDim} />
      </Pressable>
      <Pressable
        style={styles.kapat}
        onPress={() => kapatRef.current(bildirim.anahtar)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Bildirimi kapat"
      >
        <Ionicons name="close" size={14} color={RenkTokenlari.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

/**
 * Yönetim panelinin her ekranında görünen onay baloncukları.
 *
 * Sayaçlar `AdminOnayBalonlariGetir` ile yoklanır. Bir kuyruktaki bekleyen
 * sayı son görülen değerin üstüne çıktığında üstten aşağı kayan bir baloncuk
 * belirir; tıklanınca ilgili kuyruğa gider. Son görülen sayılar tarayıcıda
 * tutulur, böylece sayfa yenilense de artış yakalanır.
 */
export function AdminOnayBildirimleri() {
  const { profile } = useAuth();
  const kimlik = profile?.id ?? null;

  const [bildirimler, setBildirimler] = useState<Bildirim[]>([]);
  const gorulenRef = useRef<Record<string, number> | null>(null);
  const sayacRef = useRef(0);

  const kapat = useCallback((anahtar: number) => {
    setBildirimler((eski) => eski.filter((b) => b.anahtar !== anahtar));
  }, []);

  useEffect(() => {
    if (!kimlik) {
      setBildirimler([]);
      return;
    }

    let aktif = true;
    const depoAnahtari = `${DEPO_ONEK}:${kimlik}`;
    gorulenRef.current = gorulenleriOku(depoAnahtari);
    setBildirimler([]);

    const kontrol = async () => {
      let gelen: AdminOnayBalonu[] = [];
      try {
        gelen = (await AdminOnayBalonlariGetir()).filter((b) => ONAY_KUYRUKLARI.has(b.id));
      } catch {
        return;
      }
      if (!aktif) return;

      const onceki = gorulenRef.current;
      const yeni: Record<string, number> = {};
      const yeniBildirimler: Bildirim[] = [];

      for (const b of gelen) {
        yeni[b.id] = b.adet;
        const eski = onceki?.[b.id];
        if (onceki && eski !== undefined && b.adet > eski) {
          sayacRef.current += 1;
          yeniBildirimler.push({
            ...b,
            delta: b.adet - eski,
            anahtar: sayacRef.current,
          });
        }
      }

      // Kuyruktan düşen sayaçlar 0'a çekilir; ileride yeniden düşerse artış sayılır.
      if (onceki) {
        for (const k of Object.keys(onceki)) {
          if (!(k in yeni)) yeni[k] = 0;
        }
      }

      gorulenRef.current = yeni;
      gorulenleriYaz(depoAnahtari, yeni);

      if (yeniBildirimler.length) {
        setBildirimler((eski) =>
          [...yeniBildirimler, ...eski].slice(0, EN_FAZLA_BILDIRIM),
        );
      }
    };

    void kontrol();
    const zaman = setInterval(() => void kontrol(), YOKLAMA_MS);

    return () => {
      aktif = false;
      clearInterval(zaman);
    };
  }, [kimlik]);

  if (Platform.OS !== 'web' || bildirimler.length === 0) return null;

  return (
    <View style={styles.katman} pointerEvents="box-none">
      {bildirimler.map((b) => (
        <BildirimKarti key={b.anahtar} bildirim={b} onKapat={kapat} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  katman: {
    position: 'absolute',
    top: BoslukTokenlari.md,
    left: 0,
    right: 0,
    zIndex: 9000,
    elevation: 9000,
    alignItems: 'center',
    paddingHorizontal: BoslukTokenlari.md,
    gap: BoslukTokenlari.sm,
  },
  kart: {
    width: '100%',
    maxWidth: 460,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: BoslukTokenlari.md,
    paddingRight: 6,
    paddingVertical: 10,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: `${RenkTokenlari.accent}88`,
    backgroundColor: RenkTokenlari.bgElevated,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  icerik: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ikonKutu: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${RenkTokenlari.accent}1F`,
    flexShrink: 0,
  },
  metin: { flex: 1, minWidth: 0, gap: 1 },
  baslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: 12.5,
  },
  alt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 10.5,
  },
  kapat: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    flexShrink: 0,
  },
});
