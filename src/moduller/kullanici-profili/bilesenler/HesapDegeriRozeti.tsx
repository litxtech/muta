import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';

type Props = {
  value: number;
  label?: string | null;
};

const GOLD = ['#FFF6D1', '#F5E6A8', '#D4AF37', '#B8860B'] as const;
const GOLD_EDGE = ['#FFE9A0', '#C9A227', '#8B6914'] as const;

/** Profilde altın kaplama hesap değeri rozeti (güven / kalite skoru). */
export function HesapDegeriRozeti({ value, label }: Props) {
  const skor = Math.max(0, Math.min(1000, Math.round(value || 0)));
  const etiket = (label?.trim() || HesapDegeriEtiketi(skor)).toUpperCase();

  return (
    <View style={styles.wrap} accessibilityLabel={`Hesap değeri ${skor}, ${etiket}`}>
      <LinearGradient colors={[...GOLD_EDGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.edge}>
        <LinearGradient
          colors={[...GOLD]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.inner}
        >
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={14} color="#3A2A08" />
          </View>
          <View style={styles.copy}>
            <Text style={styles.kicker}>HESAP DEĞERİ</Text>
            <View style={styles.skorSatir}>
              <Text style={styles.skor}>{skor}</Text>
              <Text style={styles.etiket}>{etiket}</Text>
            </View>
          </View>
        </LinearGradient>
      </LinearGradient>
    </View>
  );
}

export function HesapDegeriEtiketi(score: number): string {
  if (score >= 750) return 'Prestijli';
  if (score >= 550) return 'Yüksek güven';
  if (score >= 350) return 'Güvenilir';
  if (score >= 150) return 'Yükselen';
  return 'Yeni';
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    alignSelf: 'center',
    maxWidth: '100%',
  },
  edge: {
    borderRadius: 14,
    padding: 1.5,
  },
  inner: {
    borderRadius: 12.5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,246,209,0.55)',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(58,42,8,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flexShrink: 1,
  },
  kicker: {
    ...TipografiTokenlari.micro,
    color: 'rgba(58,42,8,0.72)',
    fontWeight: '800',
    letterSpacing: 0.8,
    fontSize: 9,
  },
  skorSatir: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 1,
  },
  skor: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    color: '#3A2A08',
    letterSpacing: 0.2,
  },
  etiket: {
    ...TipografiTokenlari.micro,
    color: '#5C4510',
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
