import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../../../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../../../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../../../tasarim-sistemi/BoslukVeYaricapTokenlari';

export type CanliAcilisMod = {
  kod: string;
  ad: string;
  alt: string;
  rozet?: string;
  icon: keyof typeof Ionicons.glyphMap;
  renkler: [string, string, string];
  tint: string;
};

type Props = {
  mod: CanliAcilisMod;
  onPress: () => void;
};

/** Instagram create tarzı — tam genişlik, yüksek, görsel ağırlıklı kart */
export function CanliAcilisModKarti({ mod, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.press, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={mod.ad}
    >
      <LinearGradient
        colors={mod.renkler}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={styles.kart}
      >
        <View style={styles.ust}>
          {mod.rozet ? (
            <View style={[styles.rozet, { borderColor: `${mod.tint}66` }]}>
              <Text style={[styles.rozetYazi, { color: mod.tint }]}>
                {mod.rozet}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <View style={[styles.ikonWrap, { backgroundColor: `${mod.tint}28` }]}>
            <Ionicons name={mod.icon} size={28} color={mod.tint} />
          </View>
        </View>

        <View style={styles.alt}>
          <Text style={styles.ad}>{mod.ad}</Text>
          <Text style={styles.aciklama} numberOfLines={2}>
            {mod.alt}
          </Text>
        </View>

        <View style={styles.ok}>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.55)" />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    width: '100%',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  kart: {
    minHeight: 168,
    borderRadius: YaricapTokenlari.xl,
    padding: BoslukTokenlari.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  ust: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  rozet: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: YaricapTokenlari.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  rozetYazi: {
    ...TipografiTokenlari.micro,
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 10,
  },
  ikonWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alt: {
    gap: 4,
    paddingRight: 28,
    marginTop: BoslukTokenlari.md,
  },
  ad: {
    ...TipografiTokenlari.title,
    color: RenkTokenlari.text,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.4,
    fontWeight: '800',
  },
  aciklama: {
    ...TipografiTokenlari.caption,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 18,
  },
  ok: {
    position: 'absolute',
    right: 16,
    bottom: 18,
  },
});
