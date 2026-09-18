import React, { useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { CoinPackage } from '../../../types/models';
import { CanliCoinSimgesi } from './CanliCoinSimgesi';
import { YetkiliAjansYukleSeridi } from './YetkiliAjansYukleSeridi';
import { PaketFiyatTry } from '../katalog/CoinPaketFiyat';
import { COIN_TRY_ORANI } from '../katalog/CoinTryOrani';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

function formatTry(n: number): string {
  return `${n.toLocaleString('tr-TR', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })} ₺`;
}

function formatCoin(n: number): string {
  return n.toLocaleString('tr-TR');
}

function bonusYuzde(coins: number, bonus: number): number | null {
  if (!bonus || coins <= 0) return null;
  return Math.round((bonus / coins) * 100);
}

/** @deprecated Import `PaketFiyatTry` from `../katalog/CoinPaketFiyat` */
export { PaketFiyatTry };

type Props = {
  packages: CoinPackage[];
  locked?: boolean;
  onBuy: (pkg: CoinPackage) => void;
  /** Üst başlık/alt yazı (modal içinde gizlenebilir) */
  baslikGoster?: boolean;
  /** Altında yetkili ajans listesi (varsayılan açık) */
  yetkiliAjansGoster?: boolean;
  /** Ajans seçilince IAP paketlerini yenile */
  onPaketleriYenile?: () => void;
};

export function CoinPaketMagaza({
  packages,
  locked,
  onBuy,
  baslikGoster = true,
  yetkiliAjansGoster = true,
  onPaketleriYenile,
}: Props) {
  const sirali = useMemo(
    () =>
      [...packages].sort(
        (a, b) => PaketFiyatTry(a) - PaketFiyatTry(b) || a.coins - b.coins,
      ),
    [packages],
  );

  const maxFiyat = Math.max(...sirali.map(PaketFiyatTry), 1);
  const nabizPaketId = sirali.find((p) => !!p.badge)?.id ?? null;
  const odemeKanal =
    Platform.OS === 'ios'
      ? 'Apple'
      : Platform.OS === 'android'
        ? 'Google'
        : 'Mağaza';

  return (
    <View style={styles.wrap}>
      {baslikGoster ? (
        <>
          <Text style={styles.title}>Coin yükle</Text>
          <Text style={styles.sub}>
            {odemeKanal} ile güvenli ödeme · 1 coin ={' '}
            {COIN_TRY_ORANI.toFixed(2).replace('.', ',')} ₺ · büyük pakette daha
            avantajlı
          </Text>
        </>
      ) : null}

      <View style={styles.grid}>
        {sirali.map((pkg) => {
          const fiyat = PaketFiyatTry(pkg);
          const bonus = pkg.bonus_coins || 0;
          const toplam = pkg.coins + bonus;
          const seviye = Math.min(1, fiyat / maxFiyat);
          const vurgu = !!pkg.badge;
          const nabizAcik = pkg.id === nabizPaketId;
          const ekstra = bonusYuzde(pkg.coins, bonus);

          return (
            <Pressable
              key={pkg.id}
              disabled={locked}
              onPress={() => onBuy(pkg)}
              accessibilityRole="button"
              accessibilityLabel={`${pkg.title}, ${formatCoin(toplam)} coin, ${formatTry(fiyat)} satın al`}
              style={({ pressed }) => [
                styles.kartWrap,
                pressed && styles.kartPressed,
                locked && styles.kartKilitli,
              ]}
            >
              <LinearGradient
                colors={
                  vurgu
                    ? ['#4A1F3A', '#2A1830', '#1A1220']
                    : ['#2C2438', '#1E1828']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.kart, vurgu && styles.kartVurgu]}
              >
                {vurgu ? (
                  <LinearGradient
                    colors={[...RenkTokenlari.gradientPrimary]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.badge}
                  >
                    <Text style={styles.badgeText}>{pkg.badge}</Text>
                  </LinearGradient>
                ) : null}

                <View style={styles.ustSatir}>
                  <CanliCoinSimgesi
                    size={vurgu ? 42 : 36}
                    seviye={seviye}
                    animasyon={nabizAcik}
                  />
                  <View style={styles.ustMetin}>
                    <Text style={styles.pkgTitle} numberOfLines={1}>
                      {pkg.title}
                    </Text>
                    {ekstra != null ? (
                      <View style={styles.bonusChip}>
                        <Text style={styles.bonusChipText}>+%{ekstra} bonus</Text>
                      </View>
                    ) : (
                      <Text style={styles.paketEtiket}>Anında yükle</Text>
                    )}
                  </View>
                </View>

                <View style={styles.miktarBlok}>
                  <Text style={[styles.coins, vurgu && styles.coinsVurgu]}>
                    {formatCoin(toplam)}
                  </Text>
                  <Text style={styles.coinsBirim}>coin</Text>
                </View>

                {bonus > 0 ? (
                  <Text style={styles.coinsAlt}>
                    {formatCoin(pkg.coins)} +{' '}
                    <Text style={styles.bonusInline}>
                      {formatCoin(bonus)} bonus
                    </Text>
                  </Text>
                ) : (
                  <Text style={styles.coinsAlt}>Net bakiye</Text>
                )}

                <LinearGradient
                  colors={
                    vurgu
                      ? [...RenkTokenlari.gradientPrimary]
                      : [...RenkTokenlari.gradientGold]
                  }
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.cta}
                >
                  <Text style={styles.ctaFiyat}>{formatTry(fiyat)}</Text>
                  <Text style={styles.ctaAksiyon}>Satın Al</Text>
                </LinearGradient>
              </LinearGradient>
            </Pressable>
          );
        })}
      </View>

      {yetkiliAjansGoster ? (
        <YetkiliAjansYukleSeridi
          locked={locked}
          onPaketleriYenile={onPaketleriYenile}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: BoslukTokenlari.sm },
  title: { ...TipografiTokenlari.h2, color: RenkTokenlari.text },
  sub: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BoslukTokenlari.md,
  },
  kartWrap: {
    width: '47.5%',
    flexGrow: 1,
    minWidth: '46%',
  },
  kartPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  kartKilitli: {
    opacity: 0.5,
  },
  kart: {
    borderRadius: YaricapTokenlari.lg,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    paddingTop: BoslukTokenlari.lg,
    paddingHorizontal: BoslukTokenlari.md,
    paddingBottom: BoslukTokenlari.md,
    gap: 8,
    minHeight: 220,
    overflow: 'hidden',
  },
  kartVurgu: {
    borderColor: RenkTokenlari.borderAccent,
    borderWidth: 1.5,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: YaricapTokenlari.sm,
    zIndex: 2,
  },
  badgeText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textOnOverlay,
    fontWeight: '900',
    fontSize: 9,
    letterSpacing: 0.6,
  },
  ustSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 28,
  },
  ustMetin: {
    flex: 1,
    gap: 3,
  },
  pkgTitle: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
  },
  paketEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  bonusChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(61, 207, 176, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(61, 207, 176, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: YaricapTokenlari.pill,
  },
  bonusChipText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontWeight: '800',
    fontSize: 9,
    letterSpacing: 0.2,
  },
  miktarBlok: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  coins: {
    ...TipografiTokenlari.h2,
    color: RenkTokenlari.accent,
    fontWeight: '900',
    fontSize: 26,
    letterSpacing: -0.4,
  },
  coinsVurgu: {
    color: RenkTokenlari.primarySoft,
  },
  coinsBirim: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    fontWeight: '700',
  },
  coinsAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    marginBottom: 2,
  },
  bonusInline: {
    color: RenkTokenlari.mint,
    fontWeight: '800',
  },
  cta: {
    marginTop: 'auto',
    borderRadius: YaricapTokenlari.md,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  ctaFiyat: {
    ...TipografiTokenlari.body,
    color: '#1A1220',
    fontWeight: '900',
    fontSize: 16,
  },
  ctaAksiyon: {
    ...TipografiTokenlari.micro,
    color: 'rgba(26, 18, 32, 0.72)',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
