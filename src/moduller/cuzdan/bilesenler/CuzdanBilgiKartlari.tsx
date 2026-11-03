import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';
import { useCeviri } from '../../../i18n/useCeviri';
import type { CeviriAnahtari } from '../../../i18n/useCeviri';

type BilgiKartiProps = {
  baslikAnahtari: CeviriAnahtari;
  metinAnahtari: CeviriAnahtari;
  ikon: React.ComponentProps<typeof Ionicons>['name'];
  renk?: string;
  /** Başlangıçta açık mı? Cüzdan ana kartı açık başlar. */
  varsayilanAcik?: boolean;
  rozetAnahtari?: CeviriAnahtari;
};

/**
 * Apple App Review ve kullanıcı güveni için hazırlanmış bilgilendirme kartı.
 * Metinler i18n üzerinden gelir; kart statiktir, sunucudan uzaktan değiştirilemez.
 */
export function BilgiKarti({
  baslikAnahtari,
  metinAnahtari,
  ikon,
  renk = RenkTokenlari.primarySoft,
  varsayilanAcik = false,
  rozetAnahtari,
}: BilgiKartiProps) {
  const { t } = useCeviri();
  const [acik, setAcik] = useState(varsayilanAcik);

  return (
    <View style={styles.kart}>
      <Pressable
        onPress={() => setAcik((a) => !a)}
        style={({ pressed }) => [styles.baslik, pressed && { opacity: 0.84 }]}
        accessibilityRole="button"
        accessibilityState={{ expanded: acik }}
        accessibilityLabel={t(baslikAnahtari)}
      >
        <View style={[styles.ikonKap, { backgroundColor: `${renk}1F` }]}>
          <Ionicons name={ikon} size={15} color={renk} />
        </View>
        <View style={styles.baslikCopy}>
          <View style={styles.baslikSatir}>
            <Text style={styles.baslikYazi} numberOfLines={1}>
              {t(baslikAnahtari)}
            </Text>
            {rozetAnahtari ? (
              <View style={styles.rozet}>
                <Text style={styles.rozetYazi}>{t(rozetAnahtari)}</Text>
              </View>
            ) : null}
          </View>
          {!acik ? (
            <Text style={styles.onizleme} numberOfLines={1}>
              {t(metinAnahtari)}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={acik ? 'chevron-up' : 'chevron-down'}
          size={15}
          color={RenkTokenlari.textDim}
        />
      </Pressable>
      {acik ? (
        <View style={styles.metinKap}>
          <View style={[styles.ayrac, { backgroundColor: `${renk}33` }]} />
          <Text style={styles.metin}>{t(metinAnahtari)}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Cüzdanım ekranının en altında sabit duran kısa yasal bilgilendirme.
 * App Store 3.1.1 / 5.2 incelemesinde hızlıca görülebilir olmalıdır.
 */
export function OnemliBilgilendirmeKarti() {
  const { t } = useCeviri();
  return (
    <LinearGradient
      colors={[`${RenkTokenlari.accent}20`, `${RenkTokenlari.primary}12`]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.onemliKart}
    >
      <View style={styles.onemliUst}>
        <View style={styles.onemliIkon}>
          <Ionicons name="shield-checkmark" size={14} color={RenkTokenlari.accent} />
        </View>
        <Text style={styles.onemliBaslik}>{t('cuzdanBilgi.onemliBaslik')}</Text>
      </View>
      <Text style={styles.onemliMetin}>{t('cuzdanBilgi.onemliMetin')}</Text>
    </LinearGradient>
  );
}

/**
 * Cüzdanım altındaki yasal erişim şeridi.
 * App Store 5.1.1: Kullanım Koşulları ve Gizlilik Politikası uygulama içinden
 * erişilebilir olmalıdır. Yayıncı programı için hediye/kazanç politikası bağlanır.
 * Rotalar gerçek politika kodlarıyla eşleşir: tos · privacy · gift_earnings.
 */
const YASAL_BAGLANTILAR: { anahtar: CeviriAnahtari; href: string }[] = [
  { anahtar: 'cuzdanBilgi.yasalKosullar', href: '/politika/tos' },
  { anahtar: 'cuzdanBilgi.yasalGizlilik', href: '/politika/privacy' },
  { anahtar: 'cuzdanBilgi.yasalYayinci', href: '/politika/gift_earnings' },
];

export function CuzdanYasalBaglantiKarti() {
  const { t } = useCeviri();
  return (
    <View style={styles.yasalKart}>
      <View style={styles.yasalUst}>
        <Ionicons name="document-text-outline" size={13} color={RenkTokenlari.textDim} />
        <Text style={styles.yasalBaslik}>{t('cuzdanBilgi.yasalBaslik')}</Text>
      </View>
      <View style={styles.yasalListe}>
        {YASAL_BAGLANTILAR.map((l) => (
          <Pressable
            key={l.href}
            onPress={() => router.push(l.href as any)}
            accessibilityRole="link"
            accessibilityLabel={t(l.anahtar)}
            hitSlop={6}
            style={({ pressed }) => [styles.yasalBag, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.yasalYazi} numberOfLines={2}>
              {t(l.anahtar)}
            </Text>
            <Ionicons name="chevron-forward" size={11} color={RenkTokenlari.textDim} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * Kullanıcıya "hangi bakiye ne işe yarar" tablosunu tek bakışta gösterir.
 */
export function CuzdanOzetTablosu() {
  const { t } = useCeviri();
  const satirlar: { anahtar: CeviriAnahtari; deger: CeviriAnahtari; renk: string }[] = [
    {
      anahtar: 'cuzdanBilgi.ozetSatin',
      deger: 'cuzdanBilgi.ozetSatinDeger',
      renk: RenkTokenlari.accent,
    },
    {
      anahtar: 'cuzdanBilgi.ozetOyun',
      deger: 'cuzdanBilgi.ozetOyunDeger',
      renk: RenkTokenlari.violet,
    },
    {
      anahtar: 'cuzdanBilgi.ozetElmas',
      deger: 'cuzdanBilgi.ozetElmasDeger',
      renk: RenkTokenlari.primarySoft,
    },
    {
      anahtar: 'cuzdanBilgi.ozetKazanc',
      deger: 'cuzdanBilgi.ozetKazancDeger',
      renk: RenkTokenlari.mint,
    },
    {
      anahtar: 'cuzdanBilgi.ozetOdeme',
      deger: 'cuzdanBilgi.ozetOdemeDeger',
      renk: RenkTokenlari.mint,
    },
    {
      anahtar: 'cuzdanBilgi.ozetMinimum',
      deger: 'cuzdanBilgi.ozetMinimumDeger',
      renk: RenkTokenlari.accent,
    },
    {
      anahtar: 'cuzdanBilgi.ozetPaylasim',
      deger: 'cuzdanBilgi.ozetPaylasimDeger',
      renk: RenkTokenlari.primarySoft,
    },
  ];

  return (
    <View style={styles.ozetKart}>
      <Text style={styles.ozetBaslik}>{t('cuzdanBilgi.ozetBaslik')}</Text>
      {satirlar.map((s, i) => (
        <View
          key={s.anahtar}
          style={[styles.ozetSatir, i === satirlar.length - 1 && styles.ozetSatirSon]}
        >
          <View style={[styles.ozetNokta, { backgroundColor: s.renk }]} />
          <Text style={styles.ozetEtiket}>{t(s.anahtar)}</Text>
          <Text style={[styles.ozetDeger, { color: s.renk }]} numberOfLines={2}>
            {t(s.deger)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  kart: {
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
    overflow: 'hidden',
  },
  baslik: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  ikonKap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  baslikCopy: { flex: 1, minWidth: 0, gap: 2 },
  baslikSatir: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  baslikYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
    fontSize: 13,
    flexShrink: 1,
  },
  rozet: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.chipFill,
  },
  rozetYazi: {
    ...TipografiTokenlari.micro,
    fontSize: 9,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
  onizleme: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10.5,
    lineHeight: 14,
  },
  metinKap: { paddingHorizontal: 13, paddingBottom: 13, gap: 10 },
  ayrac: { height: StyleSheet.hairlineWidth, width: '100%' },
  metin: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  onemliKart: {
    gap: 8,
    padding: 14,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: `${RenkTokenlari.accent}3D`,
  },
  onemliUst: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onemliIkon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${RenkTokenlari.accent}26`,
  },
  onemliBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: 12.5,
  },
  onemliMetin: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontSize: 11.5,
    lineHeight: 17,
  },
  ozetKart: {
    gap: 2,
    padding: 15,
    borderRadius: YaricapTokenlari.lg,
    backgroundColor: RenkTokenlari.bgCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  ozetBaslik: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 6,
  },
  ozetSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: RenkTokenlari.border,
  },
  ozetSatirSon: { borderBottomWidth: 0 },
  ozetNokta: { width: 6, height: 6, borderRadius: 3 },
  ozetEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  ozetDeger: {
    ...TipografiTokenlari.micro,
    fontSize: 10.5,
    fontWeight: '700',
    maxWidth: '52%',
    textAlign: 'right',
  },
  bosluk: { height: BoslukTokenlari.sm },
  yasalKart: {
    gap: 9,
    padding: 13,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: RenkTokenlari.border,
  },
  yasalUst: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  yasalBaslik: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  yasalListe: { gap: 2 },
  yasalBag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
  },
  yasalYazi: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textDecorationLine: 'underline',
    textDecorationColor: RenkTokenlari.textDim,
  },
});
