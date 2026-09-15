import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { RenkTokenlari } from '../tasarim-sistemi/RenkTokenlari';
import { TipografiTokenlari } from '../tasarim-sistemi/TipografiTokenlari';
import {
  BoslukTokenlari,
  YaricapTokenlari,
} from '../tasarim-sistemi/BoslukVeYaricapTokenlari';

type Props = {
  baslik: string;
  alt: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint?: string;
  onPress: () => void;
  compact?: boolean;
};

/** Feed / hub icin gradient ozellik karti */
export function OzellikKarti({
  baslik,
  alt,
  icon,
  tint = RenkTokenlari.primary,
  onPress,
  compact,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.press, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={['rgba(48,36,62,0.98)', 'rgba(24,18,34,0.99)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, compact && styles.cardCompact]}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${tint}22`, borderColor: `${tint}55` }]}>
          <Ionicons name={icon} size={compact ? 16 : 18} color={tint} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>
            {baslik}
          </Text>
          <Text style={styles.alt} numberOfLines={1}>
            {alt}
          </Text>
        </View>
        <View style={[styles.ok, { borderColor: `${tint}40` }]}>
          <Ionicons name="arrow-forward" size={14} color={tint} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { flex: 1 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BoslukTokenlari.md,
    paddingVertical: BoslukTokenlari.md,
    paddingHorizontal: BoslukTokenlari.md,
    borderRadius: YaricapTokenlari.md,
    borderWidth: 1,
    borderColor: RenkTokenlari.border,
    minHeight: 68,
  },
  cardCompact: {
    minHeight: 56,
    paddingVertical: BoslukTokenlari.sm + 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  title: {
    ...TipografiTokenlari.body,
    color: RenkTokenlari.text,
    fontWeight: '700',
  },
  alt: {
    ...TipografiTokenlari.micro,
    color: RenkTokenlari.textMuted,
    letterSpacing: 0.2,
  },
  ok: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
