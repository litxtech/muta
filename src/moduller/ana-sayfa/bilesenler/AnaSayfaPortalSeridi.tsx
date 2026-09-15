import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

export type AnaSayfaPortal = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  tint: string;
};

type Props = {
  portallar: AnaSayfaPortal[];
  onPress: (href: string) => void;
};

/** Hızlı portal şeridi — hub’a açılan premium girişler */
export function AnaSayfaPortalSeridi({ portallar, onPress }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.serit}
    >
      {portallar.map((portal) => (
        <Pressable
          key={portal.key}
          onPress={() => onPress(portal.href)}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={portal.label}
        >
          <LinearGradient
            colors={[`${portal.tint}40`, `${portal.tint}12`]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={[styles.ikon, { borderColor: `${portal.tint}55` }]}
          >
            <Ionicons name={portal.icon} size={20} color={portal.tint} />
          </LinearGradient>
          <Text style={styles.etiket} numberOfLines={1}>
            {portal.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  serit: {
    paddingHorizontal: BoslukTokenlari.xl,
    gap: BoslukTokenlari.md,
    paddingBottom: BoslukTokenlari.lg,
  },
  item: {
    width: 64,
    alignItems: 'center',
    gap: 8,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  ikon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  etiket: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    textAlign: 'center',
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
