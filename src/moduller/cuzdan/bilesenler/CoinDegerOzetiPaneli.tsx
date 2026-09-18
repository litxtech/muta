import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  CoinDegerOzeti,
  TryYazi,
} from '../katalog/CoinTakasPaylasimi';
import {
  TAKAS_DIL_NOTU,
  TAKAS_IADE_UYARISI,
  TAKAS_ODEME_BILGISI,
} from '../takas/TakasOdemeBilgisi';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  coins: number;
  /** Kart içi kompakt; takas formu için geniş */
  kompakt?: boolean;
  /** İade uyarısını göster */
  iadeUyari?: boolean;
};

/** Coin stoku → katalog / platform / satıcı net özeti (Apple-güvenli dil) */
export function CoinDegerOzetiPaneli({
  coins,
  kompakt = false,
  iadeUyari = false,
}: Props) {
  const ozet = useMemo(() => CoinDegerOzeti(coins), [coins]);

  if (ozet.coins <= 0) {
    return null;
  }

  return (
    <View style={[styles.wrap, kompakt && styles.wrapKompakt]}>
      <Text style={styles.baslik}>Katalog değeri</Text>
      <Text style={styles.katalog}>{TryYazi(ozet.katalogTl)}</Text>

      <View style={styles.kirilim}>
        <View style={styles.satir}>
          <Text style={styles.etiket}>Platform payı (%60)</Text>
          <Text style={styles.deger}>{TryYazi(ozet.platformTl)}</Text>
        </View>
        <View style={styles.satir}>
          <Text style={styles.etiketNet}>Anlaşma sonrası tahmini tutar</Text>
          <Text style={styles.net}>{TryYazi(ozet.saticiNetTl)}</Text>
        </View>
      </View>

      {!kompakt ? (
        <>
          <Text style={styles.not}>{TAKAS_ODEME_BILGISI}</Text>
          <Text style={styles.dil}>{TAKAS_DIL_NOTU}</Text>
          {iadeUyari ? (
            <Text style={styles.iade}>{TAKAS_IADE_UYARISI}</Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.notKompakt}>{TAKAS_ODEME_BILGISI}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: BoslukTokenlari.sm,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    backgroundColor: RenkTokenlari.pressFill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
  },
  wrapKompakt: {
    padding: BoslukTokenlari.sm + 2,
    gap: 6,
  },
  baslik: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontSize: 10,
  },
  katalog: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  kirilim: { gap: 6 },
  satir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  etiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 12,
    flex: 1,
  },
  etiketNet: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
    fontSize: 12,
    flex: 1,
  },
  deger: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
    fontSize: 12,
  },
  net: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.accent,
    fontWeight: '800',
    fontSize: 14,
  },
  not: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  notKompakt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  dil: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10,
    lineHeight: 14,
  },
  iade: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.danger,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
});
