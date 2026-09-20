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
import { PaketFiyatTry, PaketFiyatYazi } from '../katalog/CoinPaketFiyat';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

function formatCoin(n: number): string {
  return n.toLocaleString('tr-TR');
}

/** @deprecated Import `PaketFiyatTry` from `../katalog/CoinPaketFiyat` */
export { PaketFiyatTry };

type Props = {
  packages: CoinPackage[];
  locked?: boolean;
  onBuy: (pkg: CoinPackage) => void;
  baslikGoster?: boolean;
  yetkiliAjansGoster?: boolean;
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
        : 'Mağaza';

  return (
    <View style={styles.wrap}>
      {baslikGoster ? (
        <>
          <Text style={styles.title}>Coin yükle</Text>
          <Text style={styles.sub}>
            {odemeKanal} üzerinden güvenli satın alma · fiyat mağazadan gelir
          </Text>
        </>
      ) : null}

      <Text style={styles.bilgi}>
        Coinler sanal içerikler, hediyeler ve desteklenen uygulama içi özelliklerde
        kullanılır. Gerçek paraya dönüştürülemez.
      </Text>

      <View style={styles.grid}>
        {sirali.map((pkg) => {
          const bonus = pkg.bonus_coins || 0;
          const toplam = pkg.coins + bonus;
          const vurgu = !!pkg.badge;
          const fiyatYazi = PaketFiyatYazi(pkg);
          const kampanya = pkg.campaign_text?.trim();

          return (
            <Pressable
              key={pkg.id}
              disabled={locked}
              onPress={() => onBuy(pkg)}
              accessibilityRole="button"
              accessibilityLabel={`${pkg.title}, ${formatCoin(toplam)} coin, ${fiyatYazi} satın al`}
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
                {pkg.badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText} numberOfLines={1}>
                      {pkg.badge}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.ustSatir}>
                  <CanliCoinSimgesi size={vurgu ? 40 : 34} seviye={0.5} animasyon={false} />
                  <View style={styles.ustMetin}>
                    <Text style={styles.pkgTitle} numberOfLines={2}>
                      {pkg.title}
                    </Text>
                    {kampanya ? (
                      <Text style={styles.kampanya} numberOfLines={1}>
                        {kampanya}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.miktarBlok}>
                  <Text
                    style={[styles.coins, vurgu && styles.coinsVurgu]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {formatCoin(pkg.coins)}
                  </Text>
                  <Text style={styles.coinsBirim}>coin</Text>
                </View>

                {bonus > 0 ? (
                  <Text style={styles.coinsAlt} numberOfLines={2}>
                    +{formatCoin(bonus)} bonus · Toplam {formatCoin(toplam)}
                  </Text>
                ) : (
                  <Text style={styles.coinsAlt}>Toplam {formatCoin(toplam)} coin</Text>
                )}

                <View style={[styles.cta, vurgu && styles.ctaVurgu]}>
                  <Text
                    style={styles.ctaFiyat}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                  >
                    {fiyatYazi}
                  </Text>
                  <Text style={styles.ctaAksiyon}>Satın Al</Text>
                </View>
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
    marginBottom: 2,
  },
  bilgi: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: BoslukTokenlari.sm,
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
    minHeight: 210,
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
    maxWidth: '70%',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: YaricapTokenlari.sm,
    backgroundColor: RenkTokenlari.primarySoft,
    zIndex: 2,
  },
  badgeText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textOnOverlay,
    fontWeight: '900',
    fontSize: 9,
    letterSpacing: 0.4,
  },
  ustSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 28,
  },
  ustMetin: {
    flex: 1,
    gap: 2,
  },
  pkgTitle: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '800',
    fontSize: 12,
    lineHeight: 16,
  },
  kampanya: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.mint,
    fontWeight: '700',
    fontSize: 10,
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
    fontSize: 24,
    letterSpacing: -0.4,
    flexShrink: 1,
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
  cta: {
    marginTop: 'auto',
    borderRadius: YaricapTokenlari.md,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: RenkTokenlari.accent,
  },
  ctaVurgu: {
    backgroundColor: RenkTokenlari.primarySoft,
  },
  ctaFiyat: {
    ...TipografiTokenlari.body,
    color: '#1A1220',
    fontWeight: '900',
    fontSize: 15,
    maxWidth: '100%',
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
