import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PolitikaKodu } from '../icerik/PolitikaMetinleri';
import { POLITIKA_METINLERI } from '../icerik/PolitikaMetinleri';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  onaylar: Record<PolitikaKodu, boolean>;
  onDegisti: (kod: PolitikaKodu, deger: boolean) => void;
  onOku: (kod: PolitikaKodu) => void;
};

const SIRALAMA: PolitikaKodu[] = ['tos', 'privacy', 'child_safety'];

/** Kayıt — zorunlu politika onay kutuları */
export function PolitikaOnayKutulari({ onaylar, onDegisti, onOku }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.baslik}>Yasal onaylar</Text>
      {SIRALAMA.map((kod) => {
        const p = POLITIKA_METINLERI[kod];
        const secili = onaylar[kod];
        return (
          <View key={kod} style={styles.satir}>
            <Pressable
              onPress={() => onDegisti(kod, !secili)}
              style={styles.kutuHit}
              hitSlop={4}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: secili }}
            >
              <View style={[styles.kutu, secili && styles.kutuAktif]}>
                {secili ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : null}
              </View>
            </Pressable>
            <Pressable style={styles.metinHit} onPress={() => onOku(kod)}>
              <Text style={styles.etiket}>
                {p.onayEtiketi}{' '}
                <Text style={styles.link}>Oku</Text>
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export function TumPolitikaOnaylariVerildi(
  onaylar: Record<PolitikaKodu, boolean>,
): boolean {
  return SIRALAMA.every((k) => onaylar[k]);
}

const styles = StyleSheet.create({
  wrap: {
    gap: BoslukTokenlari.md,
    padding: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: RenkTokenlari.bgCard,
  },
  baslik: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textDim,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: BoslukTokenlari.sm,
  },
  kutuHit: { paddingTop: 2 },
  kutu: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: RenkTokenlari.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RenkTokenlari.surface,
  },
  kutuAktif: {
    backgroundColor: RenkTokenlari.primary,
    borderColor: RenkTokenlari.primary,
  },
  metinHit: { flex: 1 },
  etiket: {
    ...TipografiTokenlari.caption,
    color: RenkTokenlari.textMuted,
    lineHeight: 20,
  },
  link: {
    color: RenkTokenlari.primarySoft,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
