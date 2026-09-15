import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  coins: number;
  diamonds: number;
  hesapKodu?: string | null;
  sahipAdi?: string | null;
  yuklenen?: number;
  harcanan?: number;
};

function formatBakiye(n: number): string {
  return n.toLocaleString('tr-TR');
}

function maskeHesap(kod?: string | null): string {
  const temiz = (kod ?? 'TAMUSO').replace(/\s/g, '').toUpperCase().slice(-8);
  const pad = temiz.padStart(8, '0');
  return `••••  ••••  ••••  ${pad.slice(0, 4)} ${pad.slice(4)}`;
}

/** Banka kartı estetiğinde bakiye yüzü */
export function CuzdanBankaKarti({
  coins,
  diamonds,
  hesapKodu,
  sahipAdi,
  yuklenen = 0,
  harcanan = 0,
}: Props) {
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['#2C1A3A', '#1A1028', '#120E1C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.kart}
      >
        <View style={styles.parlama} pointerEvents="none" />
        <View style={styles.ust}>
          <View>
            <Text style={styles.marka}>TAMUSO</Text>
            <Text style={styles.kartTip}>Premium cüzdan</Text>
          </View>
          <View style={styles.chip}>
            <LinearGradient
              colors={[...RenkTokenlari.gradientGold]}
              style={styles.chipIc}
            />
          </View>
        </View>

        <Text style={styles.hesapNo}>{maskeHesap(hesapKodu)}</Text>

        <View style={styles.bakiyeSatir}>
          <View style={styles.bakiyeKol}>
            <View style={styles.etiketSatir}>
              <LinearGradient colors={[...RenkTokenlari.gradientGold]} style={styles.miniIkon}>
                <Ionicons name="ellipse" size={8} color="#12040C" />
              </LinearGradient>
              <Text style={styles.etiket}>Coin hesabı</Text>
            </View>
            <Text style={styles.tutar}>{formatBakiye(coins)}</Text>
          </View>
          <View style={styles.ayrac} />
          <View style={styles.bakiyeKol}>
            <View style={styles.etiketSatir}>
              <LinearGradient
                colors={[...RenkTokenlari.gradientDiamond]}
                style={styles.miniIkon}
              >
                <Ionicons name="diamond" size={9} color="#12040C" />
              </LinearGradient>
              <Text style={styles.etiket}>Elmas hesabı</Text>
            </View>
            <Text style={styles.tutar}>{formatBakiye(diamonds)}</Text>
          </View>
        </View>

        <View style={styles.alt}>
          <View>
            <Text style={styles.altEtiket}>Hesap sahibi</Text>
            <Text style={styles.altDeger} numberOfLines={1}>
              {(sahipAdi ?? 'Üye').toUpperCase()}
            </Text>
          </View>
          <View style={styles.altSag}>
            <Text style={styles.altEtiket}>Özet</Text>
            <Text style={styles.altDegerMini}>
              +{formatBakiye(yuklenen)} / −{formatBakiye(harcanan)}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: BoslukTokenlari.xl,
  },
  kart: {
    borderRadius: YaricapTokenlari.lg + 2,
    padding: BoslukTokenlari.xl,
    borderWidth: 1,
    borderColor: 'rgba(240, 180, 41, 0.28)',
    minHeight: 210,
    overflow: 'hidden',
    gap: BoslukTokenlari.lg,
  },
  parlama: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(232, 64, 145, 0.16)',
  },
  ust: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  marka: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.accent,
    letterSpacing: 2.4,
    fontWeight: '800',
  },
  kartTip: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    marginTop: 2,
    fontSize: 10,
  },
  chip: {
    width: 42,
    height: 30,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(240,180,41,0.45)',
  },
  chipIc: { flex: 1 },
  hesapNo: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    letterSpacing: 2.2,
    fontWeight: '600',
    fontSize: 14,
  },
  bakiyeSatir: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  bakiyeKol: { flex: 1, gap: 6 },
  ayrac: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: BoslukTokenlari.md,
  },
  etiketSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniIkon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 10,
  },
  tutar: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
    fontSize: 26,
    letterSpacing: -0.5,
  },
  alt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: BoslukTokenlari.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: BoslukTokenlari.md,
  },
  altSag: { alignItems: 'flex-end' },
  altEtiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    fontSize: 9,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  altDeger: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.text,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  altDegerMini: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    fontWeight: '600',
  },
});
