import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { CoinPackage } from '../../../types/models';
import { CanliCoinSimgesi } from './CanliCoinSimgesi';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

function formatTry(n: number): string {
  return `${Math.round(n).toLocaleString('tr-TR')} ₺`;
}

function formatCoin(n: number): string {
  return n.toLocaleString('tr-TR');
}

export function PaketFiyatTry(pkg: CoinPackage): number {
  if (pkg.price_try != null && Number(pkg.price_try) > 0) {
    return Number(pkg.price_try);
  }
  return Math.round(Number(pkg.price_usd) * 35);
}

type Props = {
  packages: CoinPackage[];
  locked?: boolean;
  onBuy: (pkg: CoinPackage) => void;
};

export function CoinPaketMagaza({ packages, locked, onBuy }: Props) {
  const sirali = useMemo(
    () =>
      [...packages].sort(
        (a, b) => PaketFiyatTry(a) - PaketFiyatTry(b) || a.coins - b.coins,
      ),
    [packages],
  );

  const maxFiyat = Math.max(...sirali.map(PaketFiyatTry), 1);
  const nabizPaketId = sirali.find((p) => !!p.badge)?.id ?? null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Coin yükle</Text>
      <Text style={styles.sub}>
        {sirali.length} seçenek · 112 ₺ – 32.000 ₺
      </Text>

      <View style={styles.grid}>
        {sirali.map((pkg) => {
          const fiyat = PaketFiyatTry(pkg);
          const toplam = pkg.coins + (pkg.bonus_coins || 0);
          const seviye = Math.min(1, fiyat / maxFiyat);
          const vurgu = !!pkg.badge;
          const nabizAcik = pkg.id === nabizPaketId;

          return (
            <Pressable
              key={pkg.id}
              disabled={locked}
              onPress={() => onBuy(pkg)}
              style={({ pressed }) => [
                styles.kartWrap,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                locked && { opacity: 0.5 },
              ]}
            >
              <LinearGradient
                colors={
                  vurgu
                    ? ['#3A2448', '#241828', '#1A1220']
                    : ['#2A2038', '#1A1524']
                }
                style={[
                  styles.kart,
                  vurgu && { borderColor: RenkTokenlari.borderAccent },
                ]}
              >
                {pkg.badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pkg.badge}</Text>
                  </View>
                ) : null}

                <CanliCoinSimgesi
                  size={vurgu ? 48 : 40}
                  seviye={seviye}
                  animasyon={nabizAcik}
                />

                <Text style={styles.pkgTitle} numberOfLines={1}>
                  {pkg.title}
                </Text>
                <Text style={styles.coins}>{formatCoin(toplam)}</Text>
                <Text style={styles.coinsAlt}>
                  {formatCoin(pkg.coins)}
                  {pkg.bonus_coins ? ` +${formatCoin(pkg.bonus_coins)}` : ''} coin
                </Text>
                <View style={styles.fiyatKutu}>
                  <Text style={styles.fiyat}>{formatTry(fiyat)}</Text>
                </View>
              </LinearGradient>
            </Pressable>
          );
        })}
      </View>
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
    gap: BoslukTokenlari.sm,
  },
  kartWrap: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
  },
  kart: {
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    padding: BoslukTokenlari.md,
    alignItems: 'center',
    gap: 4,
    minHeight: 168,
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(232, 64, 145, 0.28)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: YaricapTokenlari.pill,
    zIndex: 2,
  },
  badgeText: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.primarySoft,
    fontWeight: '800',
    fontSize: 9,
  },
  pkgTitle: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
    marginTop: 4,
  },
  coins: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.accent,
    fontWeight: '900',
    fontSize: 16,
  },
  coinsAlt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    textAlign: 'center',
  },
  fiyatKutu: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: YaricapTokenlari.pill,
    backgroundColor: 'rgba(240,180,41,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(240,180,41,0.35)',
  },
  fiyat: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '800',
  },
});
