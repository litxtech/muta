import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { CoinPackage } from '../../../types/models';
import {
  PaketFiyatiGosterilebilir,
  PaketFiyatTry,
  PaketFiyatYazi,
} from '../katalog/CoinPaketFiyat';
import { useCeviri } from '../../../i18n/useCeviri';
import { DIL_LOCALE_MAP } from '../../../i18n/diller';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  GolgeTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

/** @deprecated Import `PaketFiyatTry` from `../katalog/CoinPaketFiyat` */
export { PaketFiyatTry };

const LISTE_BOSLUK = 12;

/** SKU → canlı dilde kademe adı (DB başlığı yalnızca yedek). */
const KADEME_ANAHTARLARI = [
  'pack1',
  'pack2',
  'pack3',
  'pack4',
  'pack5',
  'pack6',
  'pack7',
  'pack8',
] as const;

type Props = {
  packages: CoinPackage[];
  locked?: boolean;
  onBuy: (pkg: CoinPackage) => void;
  baslikGoster?: boolean;
  /** Paket yenileme sürüyor — düğme spinner gösterir. */
  yenileniyor?: boolean;
  /** Mağaza fiyatları / katalog listesini yeniden çeker. */
  onPaketleriYenile?: () => void;
};

/** #RRGGBB / #RGB → rgba(). Token dışı üretim yok; yalnızca saydamlık türetir. */
function saydam(renk: string, alfa: number): string {
  const h = (renk ?? '').replace('#', '').trim();
  if (h.length !== 3 && h.length !== 6) return renk;
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return renk;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

type KademeGorsel = { emoji: string; renk: string };

/** 1–8 kademe kimliği — emoji + vurgu rengi (tema tokenlerinden). */
function kademeGorsel(sira: number): KademeGorsel {
  switch (sira) {
    case 1:
      return { emoji: '🟢', renk: RenkTokenlari.mint };
    case 2:
      return { emoji: '🔵', renk: RenkTokenlari.violet };
    case 3:
      return { emoji: '🟣', renk: RenkTokenlari.magenta };
    case 4:
      return { emoji: '💎', renk: RenkTokenlari.violet };
    case 5:
      return { emoji: '⭐', renk: RenkTokenlari.accent };
    case 6:
      return { emoji: '👑', renk: RenkTokenlari.accent };
    case 7:
      return { emoji: '🔥', renk: RenkTokenlari.primary };
    case 8:
      return { emoji: '💰', renk: RenkTokenlari.accent };
    default:
      return { emoji: '🪙', renk: RenkTokenlari.primary };
  }
}

/** Bonus yüzdesi — tam .5 ise ondalık göster, diğerlerini tam sayıya yuvarla. */
function bonusYuzde(bonus: number, taban: number): number {
  if (!taban || taban <= 0 || bonus <= 0) return 0;
  const ham = (bonus / taban) * 100;
  const tam = Math.round(ham);
  return Math.abs(ham - tam) >= 0.49 && Math.abs(ham - tam) <= 0.51
    ? Math.round(ham * 10) / 10
    : tam;
}

export function CoinPaketMagaza({
  packages,
  locked,
  onBuy,
  baslikGoster = true,
  yenileniyor = false,
  onPaketleriYenile,
}: Props) {
  const { t, dil } = useCeviri();
  const loc = DIL_LOCALE_MAP[dil];
  const formatCoin = (n: number) => n.toLocaleString(loc);
  const [listeGenislik, setListeGenislik] = useState(0);

  /** DB'deki rozet metni Türkçe sabittir — bilinen kademelerde canlı dile çevir. */
  const kademeRozeti = (pkg: CoinPackage): string | null => {
    const sku = (pkg.sku ?? '').trim();
    if (sku === 'tamuso_coin_pack_2') return t('coinPaket.badgePopuler');
    if (sku === 'tamuso_coin_pack_8') return t('coinPaket.badgeEnAvantajli');
    return pkg.badge?.trim() || null;
  };

  const kartGenislik =
    listeGenislik > 0 ? (listeGenislik - LISTE_BOSLUK) / 2 : undefined;

  const sirali = useMemo(
    () =>
      [...packages].sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          PaketFiyatTry(a) - PaketFiyatTry(b) ||
          a.coins - b.coins,
      ),
    [packages],
  );

  const odemeKanal =
    Platform.OS === 'ios'
      ? 'App Store'
      : Platform.OS === 'android'
        ? 'Google Play'
        : t('cuzdanX.kanalMagaza');

  const listeOlcusu = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - listeGenislik) > 1) setListeGenislik(w);
  };

  return (
    <View style={styles.wrap}>
      {baslikGoster ? (
        <View style={styles.baslikBlok}>
          <View style={styles.baslikUst}>
            <Text style={styles.title}>{t('cuzdanX.coinPaketleri')}</Text>
            {onPaketleriYenile ? (
              <Pressable
                onPress={onPaketleriYenile}
                disabled={yenileniyor}
                accessibilityRole="button"
                accessibilityLabel={t('ortak.yenile')}
                accessibilityState={{ busy: yenileniyor, disabled: yenileniyor }}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.yenileChip,
                  pressed && styles.kartPressed,
                  yenileniyor && styles.yenileChipBekliyor,
                ]}
              >
                {yenileniyor ? (
                  <ActivityIndicator
                    size="small"
                    color={RenkTokenlari.textMuted}
                    style={styles.yenileSpinner}
                  />
                ) : (
                  <Ionicons
                    name="refresh"
                    size={12}
                    color={RenkTokenlari.textMuted}
                  />
                )}
                <Text style={styles.yenileYazi}>{t('ortak.yenile')}</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.sub}>
            {t('cuzdanX.paketSecOde', { kanal: odemeKanal })}
          </Text>
          <Text style={styles.ipucu}>{t('cuzdanX.paketBonusIpucu')}</Text>
        </View>
      ) : null}

      <View style={styles.guvenSeridi}>
        <View style={styles.guvenMadde}>
          <Ionicons
            name="shield-checkmark"
            size={14}
            color={RenkTokenlari.mint}
          />
          <Text style={styles.guvenYazi}>{odemeKanal}</Text>
        </View>
        <View style={styles.guvenNokta} />
        <View style={styles.guvenMadde}>
          <Ionicons name="flash" size={14} color={RenkTokenlari.accent} />
          <Text style={styles.guvenYazi}>{t('cuzdanX.anindaYukleme')}</Text>
        </View>
        <View style={styles.guvenNokta} />
        <View style={styles.guvenMadde}>
          <Ionicons
            name="lock-closed"
            size={13}
            color={RenkTokenlari.textMuted}
          />
          <Text style={styles.guvenYazi}>{t('cuzdanX.guvenliOdeme')}</Text>
        </View>
      </View>

      <View style={styles.liste} onLayout={listeOlcusu}>
        {sirali.map((pkg) => {
          const sira = pkg.sort_order ?? 0;
          const gorsel = kademeGorsel(sira);
          const bonus = pkg.bonus_coins || 0;
          const toplam = pkg.coins + bonus;
          const yuzde = bonusYuzde(bonus, pkg.coins);
          const rozet = kademeRozeti(pkg);
          const vurgu = !!rozet;
          const magazaFiyatiVar = PaketFiyatiGosterilebilir(pkg);
          // Native'de mağaza fiyatı okunmadan satın alma açılmaz (katalog fiyatı fiyat gibi görünmesin).
          const fiyatBekliyor = !magazaFiyatiVar;
          const devreDisi = !!locked || fiyatBekliyor;
          const fiyatYazi = PaketFiyatYazi(pkg);
          const kademeAdi = (() => {
            const m = /^tamuso_coin_pack_([1-8])$/.exec((pkg.sku ?? '').trim());
            if (m) {
              const idx = Math.min(7, Math.max(0, Number(m[1]) - 1));
              return t(`coinPaket.${KADEME_ANAHTARLARI[idx]}`);
            }
            const ham = (pkg.title ?? '').replace(/\s*Coin Paketi\s*/i, '').trim();
            return ham || (pkg.title ?? '');
          })();
          const ctaRenk = vurgu
            ? RenkTokenlari.primary
            : RenkTokenlari.surface;
          const gradyanRenkleri: [string, string, ...string[]] = [
            saydam(gorsel.renk, vurgu ? 0.24 : 0.14),
            ...RenkTokenlari.gradientCard,
          ];

          return (
            <Pressable
              key={pkg.id}
              disabled={devreDisi}
              onPress={() => onBuy(pkg)}
              accessibilityRole="button"
              accessibilityState={{ disabled: devreDisi, busy: fiyatBekliyor }}
              accessibilityLabel={t('cuzdanX.satinAlA11y', {
                baslik: pkg.title,
                adet: formatCoin(toplam),
                fiyat: fiyatYazi,
              })}
              style={({ pressed }) => [
                styles.kartDis,
                kartGenislik ? { width: kartGenislik } : styles.kartYari,
                pressed && styles.kartPressed,
                devreDisi && styles.kartKilitli,
              ]}
            >
              <LinearGradient
                colors={gradyanRenkleri}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={[
                  styles.kart,
                  {
                    borderColor: saydam(gorsel.renk, vurgu ? 0.75 : 0.34),
                    borderWidth: vurgu ? 1.5 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.ustCizgi,
                    { backgroundColor: saydam(gorsel.renk, 0.9) },
                  ]}
                />

                {rozet ? (
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: vurgu
                          ? RenkTokenlari.accent
                          : RenkTokenlari.primary,
                      },
                    ]}
                  >
                    <Text style={styles.badgeText} numberOfLines={1}>
                      {rozet}
                    </Text>
                  </View>
                ) : null}

                <View
                  style={[
                    styles.ikonKutu,
                    {
                      backgroundColor: saydam(gorsel.renk, 0.16),
                      borderColor: saydam(gorsel.renk, 0.4),
                    },
                  ]}
                >
                  <Text style={styles.ikon}>{gorsel.emoji}</Text>
                </View>

                <Text style={styles.pkgTitle} numberOfLines={1}>
                  {kademeAdi}
                </Text>

                <View style={styles.miktarSatir}>
                  <Text
                    style={styles.coins}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {formatCoin(toplam)}
                  </Text>
                  <Text style={styles.coinsBirim}>{t('cuzdan.coin')}</Text>
                </View>

                <View style={styles.bonusSatir}>
                  {bonus > 0 ? (
                    <View style={styles.bonusPill}>
                      <Text style={styles.bonusPillText} numberOfLines={1}>
                        {t('cuzdanX.bonusPillKisa', {
                          adet: formatCoin(bonus),
                          yuzde,
                        })}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.bonusYok} numberOfLines={1}>
                      {t('cuzdanX.bonusYok')}
                    </Text>
                  )}
                </View>

                <View
                  style={[
                    styles.cta,
                    { backgroundColor: ctaRenk },
                    vurgu && styles.ctaVurgu,
                    fiyatBekliyor && styles.ctaBekliyor,
                  ]}
                >
                  {fiyatBekliyor ? (
                    <Text style={styles.ctaBekleYazi} numberOfLines={2}>
                      {t('cuzdanX.fiyatYukleniyor')}
                    </Text>
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.ctaFiyat,
                          vurgu && styles.ctaFiyatVurgu,
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.62}
                      >
                        {fiyatYazi}
                      </Text>
                      <Text
                        style={[
                          styles.ctaAksiyon,
                          vurgu && styles.ctaAksiyonVurgu,
                        ]}
                        numberOfLines={1}
                      >
                        {t('cuzdan.satinAl')}
                      </Text>
                    </>
                  )}
                </View>
              </LinearGradient>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.bilgiKart}>
        <Ionicons
          name="information-circle-outline"
          size={16}
          color={RenkTokenlari.textDim}
        />
        <Text style={styles.bilgi}>{t('cuzdanX.coinBilgi')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: BoslukTokenlari.md },
  baslikBlok: { gap: 4 },
  baslikUst: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  yenileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: RenkTokenlari.chipFill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  yenileChipBekliyor: {
    opacity: 0.7,
  },
  yenileSpinner: {
    width: 12,
    height: 12,
    transform: [{ scale: 0.6 }],
  },
  yenileYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    fontSize: 10,
  },
  title: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  sub: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    lineHeight: 18,
  },
  ipucu: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontWeight: '700',
    fontSize: 11,
  },
  guvenSeridi: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.surface,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  guvenMadde: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  guvenYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.2,
  },
  guvenNokta: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: RenkTokenlari.textDim,
    opacity: 0.5,
  },
  liste: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: LISTE_BOSLUK,
  },
  kartDis: {
    borderRadius: YaricapTokenlari.lg,
    ...GolgeTokenlari.card,
  },
  /** Ölçüm öncesi ilk kare — iki sütun iskeleti */
  kartYari: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  kartPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  kartKilitli: {
    opacity: 0.55,
  },
  kart: {
    flex: 1,
    borderRadius: YaricapTokenlari.lg,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 12,
    overflow: 'hidden',
    minHeight: 208,
  },
  ustCizgi: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    zIndex: 2,
    maxWidth: '80%',
  },
  badgeText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textOnPrimary,
    fontWeight: '900',
    fontSize: 8,
    letterSpacing: 0.4,
  },
  ikonKutu: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  ikon: { fontSize: 18 },
  pkgTitle: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  miktarSatir: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: 4,
    marginTop: 1,
  },
  coins: {
    ...TipografiTokenlari.h1,
    color: RenkTokenlari.text,
    fontWeight: '900',
    fontSize: 22,
    letterSpacing: -0.6,
    lineHeight: 27,
    flexShrink: 1,
  },
  coinsBirim: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textDim,
    fontWeight: '700',
    fontSize: 10,
  },
  bonusSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 22,
    marginTop: 6,
  },
  bonusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: saydam(RenkTokenlari.mint, 0.16),
    borderWidth: 1,
    borderColor: saydam(RenkTokenlari.mint, 0.38),
    maxWidth: '100%',
  },
  bonusPillText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontWeight: '800',
    fontSize: 9,
    letterSpacing: 0.2,
  },
  bonusYok: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontWeight: '600',
    fontSize: 9,
  },
  cta: {
    marginTop: 'auto',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    minHeight: 48,
  },
  ctaVurgu: {
    borderColor: RenkTokenlari.borderAccent,
  },
  ctaBekliyor: {
    backgroundColor: RenkTokenlari.surface,
    borderColor: RenkTokenlari.border,
  },
  ctaFiyat: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '900',
    fontSize: 14,
    maxWidth: '100%',
  },
  ctaFiyatVurgu: {
    color: RenkTokenlari.textOnPrimary,
  },
  ctaAksiyon: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '800',
    fontSize: 9,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  ctaAksiyonVurgu: {
    color: RenkTokenlari.textOnPrimary,
    opacity: 0.78,
  },
  ctaBekleYazi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontWeight: '700',
    fontSize: 9,
    textAlign: 'center',
    lineHeight: 12,
  },
  bilgiKart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.chipFill,
  },
  bilgi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
});
