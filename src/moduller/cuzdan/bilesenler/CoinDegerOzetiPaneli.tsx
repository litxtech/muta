import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  CoinDegerOzeti,
  TryYazi,
} from '../katalog/CoinTakasPaylasimi';
import { DEFAULT_CUZDAN_UI_CONFIG } from '../ui-config/CuzdanUiVarsayilan';
import type { CuzdanUiValueSummary } from '../ui-config/CuzdanUiTipleri';
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
  iadeMetin?: string;
  /** Admin value_summary — yoksa varsayılan Apple-güvenli metinler */
  ozet?: Partial<CuzdanUiValueSummary> | null;
};

function ozetBirlesik(
  ozet?: Partial<CuzdanUiValueSummary> | null,
): CuzdanUiValueSummary {
  return { ...DEFAULT_CUZDAN_UI_CONFIG.value_summary, ...(ozet ?? {}) };
}

/** Coin stoku → katalog / platform / hesap özeti (Apple-güvenli dil) */
export function CoinDegerOzetiPaneli({
  coins,
  kompakt = false,
  iadeUyari = false,
  iadeMetin,
  ozet: ozetProp,
}: Props) {
  const cfg = useMemo(() => ozetBirlesik(ozetProp), [ozetProp]);
  const ozet = useMemo(() => CoinDegerOzeti(coins), [coins]);

  if (!cfg.enabled || ozet.coins <= 0) {
    return null;
  }

  const satirVar =
    cfg.show_katalog || cfg.show_platform_share || cfg.show_seller_net;
  if (!satirVar && !cfg.show_payment_note && !cfg.show_language_note) {
    return null;
  }

  return (
    <View style={[styles.wrap, kompakt && styles.wrapKompakt]}>
      {cfg.show_katalog ? (
        <>
          <Text style={styles.baslik}>{cfg.katalog_label}</Text>
          <Text style={styles.katalog}>{TryYazi(ozet.katalogTl)}</Text>
        </>
      ) : null}

      {(cfg.show_platform_share || cfg.show_seller_net) && (
        <View style={styles.kirilim}>
          {cfg.show_platform_share ? (
            <View style={styles.satir}>
              <Text style={styles.etiket}>{cfg.platform_label}</Text>
              <Text style={styles.deger}>{TryYazi(ozet.platformTl)}</Text>
            </View>
          ) : null}
          {cfg.show_seller_net ? (
            <View style={styles.satir}>
              <Text style={styles.etiketNet}>{cfg.seller_net_label}</Text>
              <Text style={styles.net}>{TryYazi(ozet.saticiNetTl)}</Text>
            </View>
          ) : null}
        </View>
      )}

      {!kompakt ? (
        <>
          {cfg.show_payment_note && cfg.payment_note ? (
            <Text style={styles.not}>{cfg.payment_note}</Text>
          ) : null}
          {cfg.show_language_note && cfg.language_note ? (
            <Text style={styles.dil}>{cfg.language_note}</Text>
          ) : null}
          {iadeUyari && iadeMetin ? (
            <Text style={styles.iade}>{iadeMetin}</Text>
          ) : null}
        </>
      ) : cfg.show_payment_note && cfg.payment_note ? (
        <Text style={styles.notKompakt}>{cfg.payment_note}</Text>
      ) : null}
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
