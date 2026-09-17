import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

export type AnaSayfaHizliOge = {
  key: string;
  baslik: string;
  alt: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  href: string;
};

type Props = {
  ogeler: AnaSayfaHizliOge[];
  onSec: (href: string) => void;
};

/** Kompakt hızlı eylem şeridi — feed’i aşağı itmez */
export function AnaSayfaHizliErisim({ ogeler, onSec }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.satir}
      style={styles.wrap}
    >
      {ogeler.map((oge) => (
        <Pressable
          key={oge.key}
          onPress={() => onSec(oge.href)}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${oge.baslik}. ${oge.alt}`}
        >
          <LinearGradient
            colors={[`${oge.tint}33`, `${oge.tint}12`]}
            style={[styles.ikon, { borderColor: `${oge.tint}44` }]}
          >
            <Ionicons name={oge.icon} size={16} color={oge.tint} />
          </LinearGradient>
          <Text style={styles.baslik} numberOfLines={1}>
            {oge.baslik}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: BoslukTokenlari.sm,
  },
  satir: {
    gap: BoslukTokenlari.sm,
    paddingRight: BoslukTokenlari.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    paddingLeft: 6,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    backgroundColor: 'rgba(33,28,46,0.65)',
  },
  pressed: { opacity: 0.85 },
  ikon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  baslik: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.text,
    fontWeight: '700',
    fontSize: 12,
    maxWidth: 110,
  },
});
